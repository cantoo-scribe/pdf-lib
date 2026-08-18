import { getNodeCrypto } from '../../src/core/crypto';
import {
  AES128Cipher,
  calculateSHA256,
  calculateSHA384,
  calculateSHA512,
  PDF20,
} from '../../src/core/crypto';

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

describe('getNodeCrypto', () => {
  const native = getNodeCrypto();

  const itOnNode = native ? it : it.skip;

  itOnNode('exposes OpenSSL primitives that match known vectors', () => {
    const empty = new Uint8Array(0);
    const zeros = new Uint8Array(16);
    expect(toHex(native!.hash('sha256', empty)).toUpperCase()).toBe(
      'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
    );
    expect(
      toHex(native!.aes128CbcNoPadding(zeros, zeros, zeros)).toUpperCase(),
    ).toBe('66E94BD4EF8A2C3B884CFA59CA342B2E');
  });

  it('matches the JavaScript Algorithm 2.B implementation', () => {
    const password = new Uint8Array([0x75, 0x73, 0x65, 0x72]);
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const input = new Uint8Array(password.length + salt.length);
    input.set(password);
    input.set(salt, password.length);

    const libraryHash = new PDF20().hash(password, input, new Uint8Array());
    const jsHash = jsPdf20Hash(password, input, new Uint8Array());
    expect(toHex(libraryHash)).toBe(toHex(jsHash));
  });
});

/** Independent copy of Algorithm 2.B using only the in-tree JS primitives. */
const jsPdf20Hash = (
  password: Uint8Array,
  input: Uint8Array,
  userBytes: Uint8Array,
) => {
  let k = calculateSHA256(input, 0, input.length).subarray(0, 32);
  let e: Uint8Array = new Uint8Array([0]);
  let i = 0;
  while (i < 64 || e[e.length - 1] > i - 32) {
    const combinedLength = password.length + k.length + userBytes.length;
    const combinedArray = new Uint8Array(combinedLength);
    combinedArray.set(password, 0);
    combinedArray.set(k, password.length);
    combinedArray.set(userBytes, password.length + k.length);
    const k1 = new Uint8Array(combinedLength * 64);
    for (let j = 0, pos = 0; j < 64; j++, pos += combinedLength) {
      k1.set(combinedArray, pos);
    }
    e = new AES128Cipher(k.subarray(0, 16)).encrypt(k1, k.subarray(16, 32));
    const remainder = e.slice(0, 16).reduce((a, b) => a + b, 0) % 3;
    k =
      remainder === 0
        ? calculateSHA256(e, 0, e.length)
        : remainder === 1
          ? calculateSHA384(e, 0, e.length)
          : calculateSHA512(e, 0, e.length);
    i++;
  }
  return k.subarray(0, 32);
};
