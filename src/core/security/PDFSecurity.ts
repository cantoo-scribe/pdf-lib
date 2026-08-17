import PDFContext from '../PDFContext';
import {
  AES128Cipher,
  AES256Cipher,
  ARCFourCipher,
  calculateMD5,
  calculateSHA256,
} from '../crypto';
import { mergeUint8Arrays } from '../../utils';
import { getRandomBytes } from '../../utils/rng';

type RandomBytesGenerator = (bytes: number) => Uint8Array;

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
}

type Algorithm = 1 | 2 | 4 | 5;
type Revision = 2 | 3 | 4 | 5;
type KeyBits = 40 | 128 | 256;

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

    let v: Algorithm;
    switch (this.context.header.getVersionString()) {
      case '1.4':
      case '1.5':
        v = 2;
        break;
      case '1.6':
      case '1.7':
        v = 4;
        break;
      case '1.7ext3':
        v = 5;
        break;
      default:
        v = 1;
        break;
    }

    switch (v) {
      case 1:
      case 2:
      case 4:
        this.encryption = this.initializeV1V2V4(v, options);
        break;
      case 5:
        this.encryption = this.initializeV5(options);
        break;
    }
  }

  private initializeV1V2V4(v: Algorithm, options: SecurityOptions): Encryption {
    const encryption = {
      Filter: 'Standard',
    } as Encryption;

    let r: Revision;
    let permissions: number;

    switch (v) {
      case 1:
        r = 2;
        this.keyBits = 40;
        permissions = getPermissionsR2(options.permissions);
        break;
      case 2:
        r = 3;
        this.keyBits = 128;
        permissions = getPermissionsR3(options.permissions);
        break;
      case 4:
        r = 4;
        this.keyBits = 128;
        permissions = getPermissionsR3(options.permissions);
        break;
      default:
        throw new Error(`Unsupported algorithm '${v}'.`);
    }

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
    const encryption = {
      Filter: 'Standard',
    } as Encryption;

    this.keyBits = 256;

    this.encryptionKey = getEncryptionKeyR5(getRandomBytes);

    const processedUserPassword = processPasswordR5(options.userPassword);
    const userPasswordEntry = getUserPasswordR5(
      processedUserPassword,
      getRandomBytes,
    );
    const userKeySalt = userPasswordEntry.subarray(40, 48);
    const userEncryptionKeyEntry = getUserEncryptionKeyR5(
      processedUserPassword,
      userKeySalt,
      this.encryptionKey,
    );

    const processedOwnerPassword = options.ownerPassword
      ? processPasswordR5(options.ownerPassword)
      : processedUserPassword;
    const ownerPasswordEntry = getOwnerPasswordR5(
      processedOwnerPassword,
      userPasswordEntry,
      getRandomBytes,
    );
    const ownerKeySalt = ownerPasswordEntry.subarray(40, 48);
    const ownerEncryptionKeyEntry = getOwnerEncryptionKeyR5(
      processedOwnerPassword,
      ownerKeySalt,
      userPasswordEntry,
      this.encryptionKey,
    );

    const permissions = getPermissionsR3(options.permissions);
    const permissionsEntry = getEncryptedPermissionsR5(
      permissions,
      this.encryptionKey,
      getRandomBytes,
    );

    encryption.V = 5;
    encryption.Length = this.keyBits;
    encryption.CF = {
      StdCF: {
        AuthEvent: 'DocOpen',
        CFM: 'AESV3',
        Length: this.keyBits / 8,
      },
    };
    encryption.StmF = 'StdCF';
    encryption.StrF = 'StdCF';

    encryption.R = 5;

    encryption.O = ownerPasswordEntry;
    encryption.OE = ownerEncryptionKeyEntry;
    encryption.U = userPasswordEntry;
    encryption.UE = userEncryptionKeyEntry;
    encryption.P = permissions;
    encryption.Perms = permissionsEntry;

    return encryption;
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

const getUserPasswordR5 = (
  processedUserPassword: Uint8Array,
  randomBytesGenerator: RandomBytesGenerator,
) => {
  const validationSalt = randomBytesGenerator(8);
  const keySalt = randomBytesGenerator(8);
  return mergeUint8Arrays([
    sha256(mergeUint8Arrays([processedUserPassword, validationSalt])),
    validationSalt,
    keySalt,
  ]);
};

const getUserEncryptionKeyR5 = (
  processedUserPassword: Uint8Array,
  userKeySalt: Uint8Array,
  encryptionKey: Uint8Array,
) =>
  aesCbcEncrypt(
    sha256(mergeUint8Arrays([processedUserPassword, userKeySalt])),
    ZERO_IV,
    encryptionKey,
  );

const getOwnerPasswordR5 = (
  processedOwnerPassword: Uint8Array,
  userPasswordEntry: Uint8Array,
  randomBytesGenerator: RandomBytesGenerator,
) => {
  const validationSalt = randomBytesGenerator(8);
  const keySalt = randomBytesGenerator(8);
  return mergeUint8Arrays([
    sha256(
      mergeUint8Arrays([
        processedOwnerPassword,
        validationSalt,
        userPasswordEntry,
      ]),
    ),
    validationSalt,
    keySalt,
  ]);
};

const getOwnerEncryptionKeyR5 = (
  processedOwnerPassword: Uint8Array,
  ownerKeySalt: Uint8Array,
  userPasswordEntry: Uint8Array,
  encryptionKey: Uint8Array,
) =>
  aesCbcEncrypt(
    sha256(
      mergeUint8Arrays([
        processedOwnerPassword,
        ownerKeySalt,
        userPasswordEntry,
      ]),
    ),
    ZERO_IV,
    encryptionKey,
  );

const getEncryptionKeyR5 = (randomBytesGenerator: RandomBytesGenerator) =>
  randomBytesGenerator(32);

const getEncryptedPermissionsR5 = (
  permissions: number,
  encryptionKey: Uint8Array,
  randomBytesGenerator: RandomBytesGenerator,
) =>
  // A single block of CBC with a zero IV is equivalent to the ECB the spec asks for
  aesCbcEncrypt(
    encryptionKey,
    ZERO_IV,
    mergeUint8Arrays([
      lsbFirstBytes(permissions),
      PERMS_SUFFIX,
      randomBytesGenerator(4),
    ]),
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

const processPasswordR5 = (password = '') => {
  // NOTE: Removed this line to eliminate need for the saslprep dependency.
  // Probably worth investigating the cases that would be impacted by this.
  // password = unescape(encodeURIComponent(saslprep(password)));

  const length = Math.min(127, password.length);
  const out = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    out[i] = password.charCodeAt(i);
  }

  return out;
};

const md5 = (data: Uint8Array): Uint8Array =>
  calculateMD5(data, 0, data.length);

const sha256 = (data: Uint8Array): Uint8Array =>
  calculateSHA256(data, 0, data.length);

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
