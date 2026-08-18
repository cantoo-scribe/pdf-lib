import { getRandomBytes, SimpleRNG } from '../../src/utils/rng';

describe('psuedo random numbers', () => {
  it('generates distinct numbers', () => {
    const rng = SimpleRNG.withSeed(1);
    expect(rng.nextInt()).not.toEqual(rng.nextInt());
  });

  it('generates the same number across different SimpleRNG', () => {
    const rng = SimpleRNG.withSeed(1);
    expect(rng.nextInt()).toEqual(0.7098480789645691);
    expect(rng.nextInt()).toEqual(0.9742682568175951);
  });
});

describe('getRandomBytes', () => {
  it('returns the requested number of bytes', () => {
    expect(getRandomBytes(0).length).toBe(0);
    expect(getRandomBytes(16).length).toBe(16);
    expect(getRandomBytes(32).length).toBe(32);
  });

  it('fills requests larger than a single getRandomValues call', () => {
    const bytes = getRandomBytes(70000);
    expect(bytes.length).toBe(70000);
    expect(bytes.subarray(65536).some((byte) => byte !== 0)).toBe(true);
  });

  it('generates distinct values', () => {
    expect(Array.from(getRandomBytes(32))).not.toEqual(
      Array.from(getRandomBytes(32)),
    );
  });

  it('throws when the Web Crypto API is unavailable', () => {
    const realCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });
    try {
      expect(() => getRandomBytes(16)).toThrow('Web Crypto API is unavailable');
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: realCrypto,
      });
    }
  });
});
