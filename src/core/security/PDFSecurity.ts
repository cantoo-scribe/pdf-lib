import PDFContext from '../PDFContext';
import {
  AES128Cipher,
  AES256Cipher,
  ARCFourCipher,
  calculateMD5,
  encodeRevision6Password,
  PDF20,
} from '../crypto';
import PDFHeader from '../document/PDFHeader';
import PDFDict from '../objects/PDFDict';
import PDFName from '../objects/PDFName';
import PDFNumber from '../objects/PDFNumber';
import { mergeUint8Arrays } from '../../utils';
import { getRandomBytes } from '../../utils/rng';

/**
 * Interface representing user permissions.
 *
 * @interface UserPermissions
 */
interface UserPermissions {
  /**
   * Printing Permission
   * For Security handlers of revision <= 2 : Boolean
   * For Security handlers of revision >= 3 : 'lowResolution' or 'highResolution'
   */
  printing?: boolean | 'lowResolution' | 'highResolution';
  /**
   * Modify Content Permission (Other than 'annotating', 'fillingForms' and 'documentAssembly')
   */
  modifying?: boolean;
  /** Copy or otherwise extract text and graphics from document */
  copying?: boolean;
  /** Permission to add or modify text annotations */
  annotating?: boolean;
  /**
   * Security handlers of revision >= 3
   * Fill in existing interactive form fields (including signature fields)
   */
  fillingForms?: boolean;
  /**
   * Security handlers of revision >= 3
   * Extract text and graphics (in support of accessibility to users with disabilities or for other purposes)
   */
  contentAccessibility?: boolean;
  /**
   * Security handlers of revision >= 3
   * Assemble the document (insert, rotate or delete pages and create bookmarks or thumbnail images)
   */
  documentAssembly?: boolean;
}

export type EncryptFn = (buffer: Uint8Array) => Uint8Array;

/**
 * Cipher used to encrypt a document.
 *
 * `AES-256` is the default and the only one recommended by ISO 32000-2. The RC4
 * variants are broken and are kept only to interoperate with viewers predating
 * Acrobat 7; selecting one requires
 * {@link SecurityOptions.allowWeakCryptography}.
 */
export type EncryptionAlgorithm = 'AES-256' | 'AES-128' | 'RC4-128' | 'RC4-40';

/**
 * Interface options for security
 * @interface SecurityOptions
 */
export interface SecurityOptions {
  /**
   * Password that provides unlimited access to the encrypted document.
   *
   * Opening encrypted document with owner password allows full (owner) access to the document
   */
  ownerPassword?: string;

  /** Password that restricts reader according to the defined permissions.
   *
   * Opening encrypted document with user password will have limitations in accordance to the permission defined.
   */
  userPassword?: string;

  /** Object representing type of user permission enforced on the document
   * @link {@link UserPermissions}
   */
  permissions?: UserPermissions;

  /**
   * Cipher to encrypt the document with. Defaults to `'AES-256'`.
   *
   * The document's own PDF version is never used to pick the cipher: it
   * describes the syntax its producer used, not what the reader opening the
   * encrypted file supports. The header is instead raised to the minimum
   * version the chosen cipher requires, so the file stays self-consistent.
   */
  algorithm?: EncryptionAlgorithm;

  /**
   * Permits selecting a broken cipher (`'RC4-40'` or `'RC4-128'`). Without it,
   * asking for RC4 throws. Only useful for viewers predating Acrobat 7 (2005).
   */
  allowWeakCryptography?: boolean;
}

type Algorithm = 1 | 2 | 4 | 5;
type Revision = 2 | 3 | 4 | 6;
type KeyBits = 40 | 128 | 256;

interface AlgorithmProfile {
  V: Algorithm;
  R: Revision;
  keyBits: KeyBits;
  /**
   * Lowest PDF version whose specification defines this handler, per ISO
   * 32000-1 Table 20 and, for AES-256, Adobe Extension Level 8.
   */
  minimumVersion: [number, number];
  weak: boolean;
}

const ALGORITHM_PROFILES: Record<EncryptionAlgorithm, AlgorithmProfile> = {
  'AES-256': {
    V: 5,
    R: 6,
    keyBits: 256,
    minimumVersion: [1, 7],
    weak: false,
  },
  'AES-128': {
    V: 4,
    R: 4,
    keyBits: 128,
    minimumVersion: [1, 6],
    weak: false,
  },
  'RC4-128': {
    V: 2,
    R: 3,
    keyBits: 128,
    minimumVersion: [1, 4],
    weak: true,
  },
  'RC4-40': {
    V: 1,
    R: 2,
    keyBits: 40,
    minimumVersion: [1, 1],
    weak: true,
  },
};

const DEFAULT_ALGORITHM: EncryptionAlgorithm = 'AES-256';

/** Adobe extension level that introduced AES-256 with revision 6. */
const AES256_EXTENSION_LEVEL = 8;

type Encryption = {
  V: number;
  R: number;
  O: Uint8Array;
  U: Uint8Array;
  P: number;
  Filter: string;
  Length?: number;
  CF?: {
    StdCF: {
      AuthEvent: 'DocOpen';
      CFM: 'AESV2' | 'AESV3';
      Length: number;
    };
  };
  StmF?: string;
  StrF?: string;
  OE?: Uint8Array;
  UE?: Uint8Array;
  Perms?: Uint8Array;
};

class PDFSecurity {
  context: PDFContext;

  // These are required values which are set by the `initalize` function.
  private id!: Uint8Array;
  private encryption!: Encryption;
  private keyBits!: KeyBits;
  private encryptionKey!: Uint8Array;
  private profile!: AlgorithmProfile;

  static create(context: PDFContext, options: SecurityOptions) {
    return new PDFSecurity(context, options);
  }

  constructor(context: PDFContext, options: SecurityOptions) {
    if (!options.ownerPassword && !options.userPassword) {
      throw new Error(
        'Either an owner password or a user password must be specified.',
      );
    }

    this.context = context;

    this.initialize(options);
  }

  private initialize(options: SecurityOptions) {
    this.id = generateRandomFileId();

    const algorithm = options.algorithm ?? DEFAULT_ALGORITHM;
    const profile = ALGORITHM_PROFILES[algorithm];

    if (!profile) {
      throw new Error(
        `Unknown encryption algorithm '${algorithm}'. Expected one of ` +
          `${Object.keys(ALGORITHM_PROFILES).join(', ')}.`,
      );
    }

    if (profile.weak && !options.allowWeakCryptography) {
      throw new Error(
        `Refusing to encrypt with ${algorithm}: RC4 is broken and was removed ` +
          "from ISO 32000-2. Use 'AES-256' (the default), or pass " +
          'allowWeakCryptography: true if you must target a viewer released ' +
          'before Acrobat 7.',
      );
    }

    this.profile = profile;
    this.encryption =
      profile.V === 5
        ? this.initializeV5(options)
        : this.initializeV1V2V4(profile, options);
  }

  /**
   * Raises the header to the lowest version that defines the chosen handler, so
   * the file never advertises a version older than the encryption it uses. The
   * version is only ever raised, never lowered.
   */
  private raiseHeaderVersion() {
    const [major, minor] = this.profile.minimumVersion;
    const [currentMajor, currentMinor] = this.context.header
      .getVersionString()
      .split('.')
      // A minor version may carry a suffix, as in the '1.7ext3' that older
      // releases used to request AES-256.
      .map((part) => parseInt(part, 10) || 0);

    if (
      currentMajor > major ||
      (currentMajor === major && currentMinor >= minor)
    ) {
      return;
    }

    this.context.header = PDFHeader.forVersion(major, minor);
  }

  /**
   * AES-256 is not part of PDF 1.7; it arrived with Adobe extension level 8,
   * which a 1.7 file declares through the catalog's `/Extensions` dictionary
   * (ISO 32000-1 §7.1, Annex E). Skipped for PDF 2.0 and later, where the
   * handler is part of the base specification.
   */
  private declareExtensionLevel() {
    if (this.profile.V !== 5) return;

    const major = parseInt(this.context.header.getVersionString(), 10) || 0;
    if (major >= 2) return;

    const { Root } = this.context.trailerInfo;
    if (!Root) return;

    const catalog = this.context.lookupMaybe(Root, PDFDict);
    if (!catalog) return;

    const extensions =
      catalog.lookupMaybe(PDFName.of('Extensions'), PDFDict) ??
      this.context.obj({});

    // Other developer prefixes describe unrelated extensions and are left alone;
    // only ADBE numbers the levels the security handlers belong to.
    const adbe =
      extensions.lookupMaybe(PDFName.of('ADBE'), PDFDict) ??
      this.context.obj({});
    const declared =
      adbe.lookupMaybe(PDFName.of('ExtensionLevel'), PDFNumber)?.asNumber() ??
      0;

    if (declared < AES256_EXTENSION_LEVEL) {
      adbe.set(
        PDFName.of('BaseVersion'),
        PDFName.of(this.context.header.getVersionString()),
      );
      adbe.set(
        PDFName.of('ExtensionLevel'),
        PDFNumber.of(AES256_EXTENSION_LEVEL),
      );
    }

    extensions.set(PDFName.of('ADBE'), adbe);
    catalog.set(PDFName.of('Extensions'), extensions);
  }

  private initializeV1V2V4(
    profile: AlgorithmProfile,
    options: SecurityOptions,
  ): Encryption {
    const encryption = {
      Filter: 'Standard',
    } as Encryption;

    const v = profile.V;
    const r = profile.R;
    this.keyBits = profile.keyBits;
    const permissions =
      r === 2
        ? getPermissionsR2(options.permissions)
        : getPermissionsR3(options.permissions);

    const paddedUserPassword = processPasswordR2R3R4(options.userPassword);

    const paddedOwnerPassword = options.ownerPassword
      ? processPasswordR2R3R4(options.ownerPassword)
      : paddedUserPassword;

    const ownerPasswordEntry = getOwnerPasswordR2R3R4(
      r,
      this.keyBits,
      paddedUserPassword,
      paddedOwnerPassword,
    );

    this.encryptionKey = getEncryptionKeyR2R3R4(
      r,
      this.keyBits,
      this.id,
      paddedUserPassword,
      ownerPasswordEntry,
      permissions,
    );

    let userPasswordEntry;
    if (r === 2) {
      userPasswordEntry = getUserPasswordR2(this.encryptionKey);
    } else {
      userPasswordEntry = getUserPasswordR3R4(this.id, this.encryptionKey);
    }

    encryption.V = v;
    if (v >= 2) {
      encryption.Length = this.keyBits;
    }
    if (v === 4) {
      encryption.CF = {
        StdCF: {
          AuthEvent: 'DocOpen',
          CFM: 'AESV2',
          Length: this.keyBits / 8,
        },
      };
      encryption.StmF = 'StdCF';
      encryption.StrF = 'StdCF';
    }

    encryption.R = r;

    encryption.O = ownerPasswordEntry;
    encryption.U = userPasswordEntry;
    encryption.P = permissions;

    return encryption;
  }

  private initializeV5(options: SecurityOptions): Encryption {
    this.keyBits = this.profile.keyBits;
    this.encryptionKey = getRandomBytes(32);

    const userPassword = encodeRevision6Password(options.userPassword);
    const userPasswordEntry = r6PasswordEntry(userPassword, EMPTY_BYTES);
    const userEncryptionKeyEntry = r6WrappedKey(
      userPassword,
      userPasswordEntry.subarray(40, 48),
      EMPTY_BYTES,
      this.encryptionKey,
    );

    const ownerPassword = options.ownerPassword
      ? encodeRevision6Password(options.ownerPassword)
      : userPassword;
    const ownerPasswordEntry = r6PasswordEntry(
      ownerPassword,
      userPasswordEntry,
    );
    const ownerEncryptionKeyEntry = r6WrappedKey(
      ownerPassword,
      ownerPasswordEntry.subarray(40, 48),
      userPasswordEntry,
      this.encryptionKey,
    );

    const permissions = getPermissionsR3(options.permissions);
    // One-block CBC with a zero IV is ECB, which ISO 32000-2 Algorithm 10 asks for.
    const permissionsEntry = aesCbcEncrypt(
      this.encryptionKey,
      ZERO_IV,
      mergeUint8Arrays([
        lsbFirstBytes(permissions),
        PERMS_SUFFIX,
        getRandomBytes(4),
      ]),
    );

    return {
      Filter: 'Standard',
      V: this.profile.V,
      R: this.profile.R,
      Length: this.keyBits,
      CF: {
        StdCF: {
          AuthEvent: 'DocOpen',
          CFM: 'AESV3',
          Length: this.keyBits / 8,
        },
      },
      StmF: 'StdCF',
      StrF: 'StdCF',
      O: ownerPasswordEntry,
      OE: ownerEncryptionKeyEntry,
      U: userPasswordEntry,
      UE: userEncryptionKeyEntry,
      P: permissions,
      Perms: permissionsEntry,
    };
  }

  getEncryptFn(obj: number, gen: number): EncryptFn {
    const v = this.encryption.V;

    if (v === 5) return aesEncryptFn(this.encryptionKey);

    if (v !== 1 && v !== 2 && v !== 4) {
      throw new Error(`Unsupported algorithm '${v}'.`);
    }

    /*
      7.6.2 Algorithm 1
      The object key is derived from the file encryption key plus the low order
      3 bytes of the object number and 2 bytes of the generation number.
    */
    const digest = mergeUint8Arrays([
      this.encryptionKey,
      new Uint8Array([
        obj & 0xff,
        (obj >> 8) & 0xff,
        (obj >> 16) & 0xff,
        gen & 0xff,
        (gen >> 8) & 0xff,
      ]),
    ]);

    if (v === 4) {
      return aesEncryptFn(md5(mergeUint8Arrays([digest, AESV2_SALT])));
    }

    const key = md5(digest).subarray(0, Math.min(16, this.keyBits / 8 + 5));
    return (buffer) => rc4(key, buffer);
  }

  encrypt() {
    this.raiseHeaderVersion();
    this.declareExtensionLevel();

    const ID = this.context.obj([this.id, this.id]);
    this.context.trailerInfo.ID = ID;

    const Encrypt = this.context.obj(this.encryption);
    this.context.trailerInfo.Encrypt = this.context.register(Encrypt);

    return this;
  }
}

/**
 * Generate a random 16-byte file identifier suitable for the PDF trailer
 * `/ID` entry (and for encryption).
 */
export const generateRandomFileId = (): Uint8Array => getRandomBytes(16);

/**
 * A fresh initialization vector is drawn per call and prepended to the
 * ciphertext, so reusing the returned fn never reuses an IV.
 */
const aesEncryptFn =
  (key: Uint8Array): EncryptFn =>
  (buffer) => {
    const iv = getRandomBytes(16);
    return mergeUint8Arrays([iv, aesCbcEncrypt(key, iv, pkcs7Pad(buffer))]);
  };

/**
 * Get Permission Flag for use Encryption Dictionary (Key: P)
 * For Security Handler revision 2
 *
 * Only bit position 3,4,5,6,9,10,11 and 12 is meaningful
 * Refer Table 22 - User access permission
 * @param  {permissions} {@link UserPermissions}
 * @returns number - Representing unsigned 32-bit integer
 */
const getPermissionsR2 = (permissions: UserPermissions = {}) => {
  let flags = 0xffffffc0 >> 0;
  if (permissions.printing) {
    flags |= 0b000000000100;
  }
  if (permissions.modifying) {
    flags |= 0b000000001000;
  }
  if (permissions.copying) {
    flags |= 0b000000010000;
  }
  if (permissions.annotating) {
    flags |= 0b000000100000;
  }
  return flags;
};

/**
 * Get Permission Flag for use Encryption Dictionary (Key: P)
 * For Security Handler revision 2
 *
 * Only bit position 3,4,5,6,9,10,11 and 12 is meaningful
 * Refer Table 22 - User access permission
 * @param  {permissions} {@link UserPermissions}
 * @returns number - Representing unsigned 32-bit integer
 */
const getPermissionsR3 = (permissions: UserPermissions = {}) => {
  let flags = 0xfffff0c0 >> 0;
  if (permissions.printing === 'lowResolution' || permissions.printing) {
    flags |= 0b000000000100;
  }
  if (permissions.printing === 'highResolution') {
    flags |= 0b100000000100;
  }
  if (permissions.modifying) {
    flags |= 0b000000001000;
  }
  if (permissions.copying) {
    flags |= 0b000000010000;
  }
  if (permissions.annotating) {
    flags |= 0b000000100000;
  }
  if (permissions.fillingForms) {
    flags |= 0b000100000000;
  }
  if (permissions.contentAccessibility) {
    flags |= 0b001000000000;
  }
  if (permissions.documentAssembly) {
    flags |= 0b010000000000;
  }
  return flags;
};

const getUserPasswordR2 = (encryptionKey: Uint8Array) =>
  rc4(encryptionKey, processPasswordR2R3R4());

const getUserPasswordR3R4 = (
  documentId: Uint8Array,
  encryptionKey: Uint8Array,
) => {
  let cipher = md5(mergeUint8Arrays([processPasswordR2R3R4(), documentId]));
  const key = new Uint8Array(encryptionKey.length);
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < key.length; j++) key[j] = encryptionKey[j] ^ i;
    cipher = rc4(key, cipher);
  }
  // Padded to 32 bytes with arbitrary data
  return mergeUint8Arrays([cipher, new Uint8Array(16)]);
};

const getOwnerPasswordR2R3R4 = (
  r: Revision,
  keyBits: KeyBits,
  paddedUserPassword: Uint8Array,
  paddedOwnerPassword: Uint8Array,
): Uint8Array => {
  let digest = paddedOwnerPassword;
  let round = r >= 3 ? 51 : 1;
  for (let i = 0; i < round; i++) {
    digest = md5(digest);
  }

  const key = new Uint8Array(keyBits / 8);
  let cipher = paddedUserPassword;
  round = r >= 3 ? 20 : 1;
  for (let i = 0; i < round; i++) {
    for (let j = 0; j < key.length; j++) key[j] = digest[j] ^ i;
    cipher = rc4(key, cipher);
  }
  return cipher;
};

const getEncryptionKeyR2R3R4 = (
  r: Revision,
  keyBits: KeyBits,
  documentId: Uint8Array,
  paddedUserPassword: Uint8Array,
  ownerPasswordEntry: Uint8Array,
  permissions: number,
): Uint8Array => {
  let key = mergeUint8Arrays([
    paddedUserPassword,
    ownerPasswordEntry,
    lsbFirstBytes(permissions),
    documentId,
  ]);
  const round = r >= 3 ? 51 : 1;
  for (let i = 0; i < round; i++) {
    key = md5(key).subarray(0, keyBits / 8);
  }
  return key;
};

const pdf20 = new PDF20();

/** Algorithm 8/9: hash || validationSalt || keySalt. `userBytes` is empty for U. */
const r6PasswordEntry = (password: Uint8Array, userBytes: Uint8Array) => {
  const validationSalt = getRandomBytes(8);
  const keySalt = getRandomBytes(8);
  return mergeUint8Arrays([
    pdf20.hash(
      password,
      mergeUint8Arrays([password, validationSalt, userBytes]),
      userBytes,
    ),
    validationSalt,
    keySalt,
  ]);
};

/** Algorithm 8/9: wrap the file encryption key with AES-256-CBC, zero IV. */
const r6WrappedKey = (
  password: Uint8Array,
  keySalt: Uint8Array,
  userBytes: Uint8Array,
  encryptionKey: Uint8Array,
) =>
  aesCbcEncrypt(
    pdf20.hash(
      password,
      mergeUint8Arrays([password, keySalt, userBytes]),
      userBytes,
    ),
    ZERO_IV,
    encryptionKey,
  );

const processPasswordR2R3R4 = (password = '') => {
  const out = new Uint8Array(32);
  const length = password.length;
  let index = 0;
  while (index < length && index < 32) {
    const code = password.charCodeAt(index);
    if (code > 0xff) {
      throw new Error('Password contains one or more invalid characters.');
    }
    out[index] = code;
    index++;
  }
  while (index < 32) {
    out[index] = PASSWORD_PADDING[index - length];
    index++;
  }
  return out;
};

const md5 = (data: Uint8Array): Uint8Array =>
  calculateMD5(data, 0, data.length);

const rc4 = (key: Uint8Array, data: Uint8Array): Uint8Array =>
  new ARCFourCipher(key).encrypt(data);

/** AES-CBC. Discards any trailing partial block, so `data` must be padded. */
const aesCbcEncrypt = (
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
): Uint8Array => {
  const cipher =
    key.length === 32 ? new AES256Cipher(key) : new AES128Cipher(key);
  return cipher.encrypt(data, iv);
};

const pkcs7Pad = (data: Uint8Array): Uint8Array => {
  const padding = 16 - (data.length % 16);
  const padded = new Uint8Array(data.length + padding);
  padded.set(data);
  padded.fill(padding, data.length);
  return padded;
};

/** Serializes a 32-bit integer low order byte first. */
const lsbFirstBytes = (data: number): Uint8Array =>
  new Uint8Array([
    data & 0xff,
    (data >> 8) & 0xff,
    (data >> 16) & 0xff,
    (data >> 24) & 0xff,
  ]);

const ZERO_IV = new Uint8Array(16);
const EMPTY_BYTES = new Uint8Array();

/** 'sAlT', appended to the object key digest by the AESV2 crypt filter. */
const AESV2_SALT = new Uint8Array([0x73, 0x41, 0x6c, 0x54]);

/* 0xffffffff followed by 'Tadb', as required by ISO 32000-2 Algorithm 10 */
const PERMS_SUFFIX = new Uint8Array([
  0xff, 0xff, 0xff, 0xff, 0x54, 0x61, 0x64, 0x62,
]);

/*
  7.6.3.3 Encryption Key Algorithm
  Algorithm 2
  Password Padding to pad or truncate
  the password to exactly 32 bytes
*/
const PASSWORD_PADDING = [
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff,
  0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c,
  0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
];

export default PDFSecurity;
