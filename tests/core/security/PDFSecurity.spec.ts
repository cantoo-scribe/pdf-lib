import PDFContext from '../../../src/core/PDFContext';
import { CipherTransformFactory } from '../../../src/core/crypto';
import PDFHeader from '../../../src/core/document/PDFHeader';
import PDFDict from '../../../src/core/objects/PDFDict';
import PDFName from '../../../src/core/objects/PDFName';
import PDFNumber from '../../../src/core/objects/PDFNumber';
import PDFSecurity, {
  EncryptionAlgorithm,
  SecurityOptions,
} from '../../../src/core/security/PDFSecurity';

/*
  The expected values below were captured from the crypto-js backed
  implementation this module used to be built on, so they pin the wire format
  against an independent AES/RC4/MD5/SHA-256 implementation.
*/

const USER_PASSWORD = 'user-pw';
const OWNER_PASSWORD = 'owner-pw';

const ALL_PERMISSIONS = {
  printing: 'highResolution' as const,
  modifying: true,
  copying: true,
  annotating: true,
  fillingForms: true,
  contentAccessibility: true,
  documentAssembly: true,
};

const PLAINTEXT = new Uint8Array(
  'The quick brown fox jumps over the lazy dog'
    .split('')
    .map((char) => char.charCodeAt(0)),
);

const EXPECTED = {
  'v1-user': {
    V: 1,
    R: 2,
    P: -64,
    id: '7306c60730d423842267399697ea9628',
    O: '16c544e498b0305052c7449c4494a4db45003148eccb61f591c67aeb931829f0',
    U: '3890b515daf6e19de9bf2d89130064feb095c6588aad56e9c8b088b1a044829b',
    obj1: 'c20485ec2771fbd4ec3c2ba24267509f242406dd31906d394bbb61e5b0733b3f352db8b54f3b76d22c4089',
    obj2: '34f4eb4a7cdf6a39b21d5ea5e0d6292dcd3dea9f8cfe1a74dc6ecf4a04efd0ac7fb157ca1cdc8ea7d357ca',
  },
  'v1-owner': {
    V: 1,
    R: 2,
    P: -64,
    id: '7306c60730d423842267399697ea9628',
    O: '5f1514b6ad52ee24bf698e736973cb01e32bb73a0890a34b3f5b5d82f23d6b49',
    U: '07cdb24bbe6cdbc0cd7f048d8376041127557ee1fd0cca332cfd882091798a04',
    obj1: 'edbf4501935981eeb6f2e2e9bd5e718f6a86300d585cc37e7d9f66a884ca5f22f434d2534cbc5e4f052203',
    obj2: '24286a5b2e98a897df8f7b025fccd016a4e73c91b9b67c798796b8e6289c2ff31177a27acd0273cf05d7aa',
  },
  'v1-both': {
    V: 1,
    R: 2,
    P: -4,
    id: '7306c60730d423842267399697ea9628',
    O: '02d93f9ace57134d64279e6be3038b6dcd4be17322f995e53e5742acfe50821c',
    U: 'f8d8ed4f31a85350e213f5d4ed029dbd1c5af2ae079f087392a16b2bb18a81d9',
    obj1: 'cd8adde78af4f305aa52da3259fa13dd93025427a83b346b1d6016d7576cf771ba8d29b5668b1fdceb02cc',
    obj2: 'e245cc1240eb124bcd4ad1bcc4b970f3e68f0d6b28f44bb744c21bdf958e2aca15b9025f126930e2c162ce',
  },
  'v2-user': {
    V: 2,
    R: 3,
    P: -3904,
    id: '7306c60730d423842267399697ea9628',
    O: '20cb8e4cf02daac721eadfc97b55d85f97b56abb2e9c00f8610000976c094605',
    U: '9fd7fde978a61babf7320b8230a1735900000000000000000000000000000000',
    obj1: 'ef5f73249fd89c469836b5bc8a61fa4d9cdca457749bdec801365ccecb919d92148127b79c9d95e09b0b8b',
    obj2: '6151a4ba7ed1e6d021637da0ef09a39f8b37e043d4148cef54bc11ee2a4e896f0141ac02fcc475ed60864f',
  },
  'v2-owner': {
    V: 2,
    R: 3,
    P: -3904,
    id: '7306c60730d423842267399697ea9628',
    O: 'ce9d51ecc479711be707ad379a54a0f4b30916d3240087eca5e23f15b28393f3',
    U: 'a06627dab466705ce3e875839a96617c00000000000000000000000000000000',
    obj1: '44747d2f728b446c752965c2cb1ad1a5b1105ea2aed2d6378b4c43bfd5e15a935483bf452d9c07c9f163c3',
    obj2: '0c29019c5969533fa26effcb8344f499523ed4b991d25a4de04da39c792c18c7f3997b1fecd7441bf9fdbf',
  },
  'v2-both': {
    V: 2,
    R: 3,
    P: -4,
    id: '7306c60730d423842267399697ea9628',
    O: '93517ac0a77c8c723c49bd2f1024e0989d69409a0e69b142a4ee203bbeee7aa6',
    U: '6940647abbbf15a740a24e11c593307700000000000000000000000000000000',
    obj1: 'aa61a46d4a154b5d64a416540c828c86ebcc71e00abb2eb6b22c4b85ae40de3bc31c1f3657e0b903c2b87b',
    obj2: 'eb40d00b0c4b63864d7290e0cf814f4568f383af29af6d14170b20a9ca8447478924067edabc347f097678',
  },
  'v4-user': {
    V: 4,
    R: 4,
    P: -3904,
    id: '7306c60730d423842267399697ea9628',
    O: '20cb8e4cf02daac721eadfc97b55d85f97b56abb2e9c00f8610000976c094605',
    U: '9fd7fde978a61babf7320b8230a1735900000000000000000000000000000000',
    obj1: 'ac08f38e1ef3158756566fc9fe0d899da2f85064023a842bb69858b36115891239757cfff1d21cc78a9a1f51367a02139a4b8758959ed7bfe2510a0c772fd8f8',
    obj2: '1324e6f19864a21208a565f30057f954c4b933d6934a2de39c5979eddb546163e339b2b37bde93130c91e49c386fd775c959ed59ac99e4468c9814e982fa2435',
  },
  'v4-owner': {
    V: 4,
    R: 4,
    P: -3904,
    id: '7306c60730d423842267399697ea9628',
    O: 'ce9d51ecc479711be707ad379a54a0f4b30916d3240087eca5e23f15b28393f3',
    U: 'a06627dab466705ce3e875839a96617c00000000000000000000000000000000',
    obj1: 'ac08f38e1ef3158756566fc9fe0d899d23805ffa510864d867782f426c6123327be93269cdab063b63ea04008af019bf9f87886ecbc35216a45d31f25d3eaee4',
    obj2: '1324e6f19864a21208a565f30057f954881ef2c8ea875af7a9a82790eb349909cf1c7586917814e33c6dcecba18e3f6bb2c6a528de2636eb2c9a788b2be58f8f',
  },
  'v4-both': {
    V: 4,
    R: 4,
    P: -4,
    id: '7306c60730d423842267399697ea9628',
    O: '93517ac0a77c8c723c49bd2f1024e0989d69409a0e69b142a4ee203bbeee7aa6',
    U: '6940647abbbf15a740a24e11c593307700000000000000000000000000000000',
    obj1: 'ac08f38e1ef3158756566fc9fe0d899da3b2abdf2ae7de2fa85487ef9cc4ecc4f1502b8635dd96e736c12cdf4ed5fa2b6e0d379455051c453118ab7aaac5b863',
    obj2: '1324e6f19864a21208a565f30057f9546122f8cdedbcbc84d2f8c1e9a6c5f703ee0f930af4c49a15edab6aff3ee7abf8959e9a82a5d8c2257a8891a422192d65',
  },
};

const VERSIONS: Array<[string, EncryptionAlgorithm, SecurityOptions?]> = [
  ['v1', 'RC4-40', { allowWeakCryptography: true }],
  ['v2', 'RC4-128', { allowWeakCryptography: true }],
  ['v4', 'AES-128'],
];

const OPTIONS: Array<[string, SecurityOptions]> = [
  ['a user password', { userPassword: USER_PASSWORD }],
  ['an owner password', { ownerPassword: OWNER_PASSWORD }],
  [
    'both passwords and all permissions',
    {
      userPassword: USER_PASSWORD,
      ownerPassword: OWNER_PASSWORD,
      permissions: ALL_PERMISSIONS,
    },
  ],
];

// Deterministic stand-in for crypto.getRandomValues, so output is reproducible
let seed = 0;
const resetRandom = () => {
  seed = 0x2545f491;
};
const realGetRandomValues = globalThis.crypto.getRandomValues;

beforeAll(() => {
  globalThis.crypto.getRandomValues = ((array: Uint8Array) => {
    for (let idx = 0; idx < array.length; idx++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      array[idx] = (seed >>> 16) & 0xff;
    }
    return array;
  }) as typeof realGetRandomValues;
});

afterAll(() => {
  globalThis.crypto.getRandomValues = realGetRandomValues;
});

const contextFor = (major = 1, minor = 7) => {
  const context = PDFContext.create();
  context.header = PDFHeader.forVersion(major, minor);
  context.trailerInfo.Root = context.register(context.obj({ Type: 'Catalog' }));
  return context;
};

const toHex = (bytes?: Uint8Array) =>
  bytes &&
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

describe('PDFSecurity', () => {
  it('requires a password', () => {
    expect(() => PDFSecurity.create(contextFor(1, 7), {})).toThrow(
      'Either an owner password or a user password must be specified.',
    );
  });

  it('rejects Latin-1-only passwords outside Latin-1 on RC4 / AES-128', () => {
    expect(() =>
      PDFSecurity.create(contextFor(), {
        userPassword: '🔒',
        algorithm: 'AES-128',
      }),
    ).toThrow('Password contains one or more invalid characters.');
  });

  it('registers the encryption dictionary and file ID in the trailer', () => {
    resetRandom();
    const context = contextFor(1, 7);
    PDFSecurity.create(context, { userPassword: USER_PASSWORD }).encrypt();

    expect(context.trailerInfo.ID).toBeDefined();
    expect(context.trailerInfo.Encrypt).toBeDefined();
  });

  VERSIONS.forEach(([version, algorithm, extraOptions]) => {
    OPTIONS.forEach(([optionName, options], optionIdx) => {
      const key = `${version}-${['user', 'owner', 'both'][optionIdx]}`;
      const expected = (EXPECTED as any)[key];
      const securityOptions = { ...options, ...extraOptions, algorithm };

      describe(`with ${optionName} using ${algorithm}`, () => {
        it('derives the documented encryption dictionary', () => {
          resetRandom();
          const security: any = PDFSecurity.create(
            contextFor(),
            securityOptions,
          );

          expect(security.encryption.V).toBe(expected.V);
          expect(security.encryption.R).toBe(expected.R);
          expect(security.encryption.P).toBe(expected.P);
          expect(toHex(security.id)).toBe(expected.id);
          expect(toHex(security.encryption.O)).toBe(expected.O);
          expect(toHex(security.encryption.U)).toBe(expected.U);
        });

        it('encrypts objects as documented', () => {
          resetRandom();
          const security = PDFSecurity.create(contextFor(), securityOptions);

          expect(toHex(security.getEncryptFn(1, 0)(PLAINTEXT))).toBe(
            expected.obj1,
          );
          expect(toHex(security.getEncryptFn(70000, 258)(PLAINTEXT))).toBe(
            expected.obj2,
          );
        });

        // Only the AESV2 / AESV3 crypt filters prepend an IV; RC4 has none
        if (expected.V === 4 || expected.V === 5) {
          it('draws a fresh IV per call', () => {
            resetRandom();
            const context = contextFor();
            const security: any = PDFSecurity.create(
              context,
              securityOptions,
            ).encrypt();

            const encryptFn = security.getEncryptFn(7, 0);
            const first = encryptFn(PLAINTEXT);
            const second = encryptFn(PLAINTEXT);

            expect(toHex(first.subarray(0, 16))).not.toBe(
              toHex(second.subarray(0, 16)),
            );

            // Both must still decrypt, each against its own prepended IV
            const factory = new CipherTransformFactory(
              context.lookup(context.trailerInfo.Encrypt) as PDFDict,
              security.id,
              options.userPassword ?? options.ownerPassword,
            );
            [first, second].forEach((ciphertext) => {
              const decrypted = factory
                .createCipherTransform(7, 0)
                .decryptBytes(ciphertext);
              expect(Array.from(decrypted)).toEqual(Array.from(PLAINTEXT));
            });
          });
        }

        it('produces output the PDF decrypter can read back', () => {
          resetRandom();
          const context = contextFor();
          const security: any = PDFSecurity.create(
            context,
            securityOptions,
          ).encrypt();

          const encryptDict = context.lookup(
            context.trailerInfo.Encrypt,
          ) as PDFDict;
          const factory = new CipherTransformFactory(
            encryptDict,
            security.id,
            options.userPassword ?? options.ownerPassword,
          );

          const ciphertext = security.getEncryptFn(7, 0)(PLAINTEXT);
          const decrypted = factory
            .createCipherTransform(7, 0)
            .decryptBytes(ciphertext);

          expect(Array.from(decrypted)).toEqual(Array.from(PLAINTEXT));
        });
      });
    });
  });

  describe('AES-256 (V5/R6)', () => {
    OPTIONS.forEach(([optionName, options]) => {
      it(`round trips with ${optionName}`, () => {
        resetRandom();
        const context = contextFor(1, 3);
        const security: any = PDFSecurity.create(context, options).encrypt();

        expect(security.encryption.V).toBe(5);
        expect(security.encryption.R).toBe(6);
        expect(context.header.getVersionString()).toBe('1.7');
        expect(
          (
            context
              .lookup(context.trailerInfo.Root, PDFDict)
              .lookup(PDFName.of('Extensions'), PDFDict)
              .lookup(PDFName.of('ADBE'), PDFDict)
              .lookup(PDFName.of('ExtensionLevel'), PDFNumber) as PDFNumber
          ).asNumber(),
        ).toBe(8);

        const factory = new CipherTransformFactory(
          context.lookup(context.trailerInfo.Encrypt) as PDFDict,
          security.id,
          options.userPassword ?? options.ownerPassword,
        );
        const ciphertext = security.getEncryptFn(7, 0)(PLAINTEXT);
        const decrypted = factory
          .createCipherTransform(7, 0)
          .decryptBytes(ciphertext);
        expect(Array.from(decrypted)).toEqual(Array.from(PLAINTEXT));
      });
    });

    it('draws a fresh IV per call', () => {
      resetRandom();
      const context = contextFor();
      const security: any = PDFSecurity.create(context, {
        userPassword: USER_PASSWORD,
      }).encrypt();

      const encryptFn = security.getEncryptFn(7, 0);
      const first = encryptFn(PLAINTEXT);
      const second = encryptFn(PLAINTEXT);
      expect(toHex(first.subarray(0, 16))).not.toBe(
        toHex(second.subarray(0, 16)),
      );

      const factory = new CipherTransformFactory(
        context.lookup(context.trailerInfo.Encrypt) as PDFDict,
        security.id,
        USER_PASSWORD,
      );
      [first, second].forEach((ciphertext) => {
        const decrypted = factory
          .createCipherTransform(7, 0)
          .decryptBytes(ciphertext);
        expect(Array.from(decrypted)).toEqual(Array.from(PLAINTEXT));
      });
    });
  });
});
