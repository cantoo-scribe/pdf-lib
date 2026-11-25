import { PDFDocument, StandardFonts } from '../../src/api';
import PDFHexString from '../../src/core/objects/PDFHexString';
import PDFString from '../../src/core/objects/PDFString';
import type { EncryptionAlgorithm } from '../../src/core';
import PDFHeader from '../../src/core/document/PDFHeader';
import PDFName from '../../src/core/objects/PDFName';
import PDFArray from '../../src/core/objects/PDFArray';
import PDFDict from '../../src/core/objects/PDFDict';
import PDFNumber from '../../src/core/objects/PDFNumber';
import PDFRawStream from '../../src/core/objects/PDFRawStream';
import { decodePDFRawStream } from '../../src/core/streams/decode';

const SECRET = 'Top secret payload';
const USER_PASSWORD = 'sekret';
const OWNER_PASSWORD = 'owner';

// 'Top secret payload' as it appears in a content stream's hex string operand
const SECRET_HEX = SECRET.split('')
  .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
  .join('')
  .toUpperCase();

const ALGORITHMS: Array<[string, EncryptionAlgorithm, boolean?]> = [
  ['RC4 40-bit (V1/R2)', 'RC4-40', true],
  ['RC4 128-bit (V2/R3)', 'RC4-128', true],
  ['AES-128 (V4/R4)', 'AES-128'],
  ['AES-256 (V5/R6)', 'AES-256'],
];

const buildEncryptedPdf = async (
  algorithm: EncryptionAlgorithm,
  allowWeakCryptography?: boolean,
) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  pdfDoc
    .addPage([300, 200])
    .drawText(SECRET, { x: 20, y: 100, size: 14, font });

  pdfDoc.encrypt({
    userPassword: USER_PASSWORD,
    ownerPassword: OWNER_PASSWORD,
    permissions: { printing: 'highResolution' },
    algorithm,
    allowWeakCryptography,
  });

  return pdfDoc.save();
};

const decodedContentStreams = (pdfDoc: PDFDocument) => {
  const streams: string[] = [];
  pdfDoc.context.enumerateIndirectObjects().forEach(([, object]) => {
    if (!(object instanceof PDFRawStream)) return;
    try {
      const decoded = decodePDFRawStream(object).decode();
      const text = String.fromCharCode(...Array.from(decoded));
      if (text.includes('BT')) streams.push(text);
    } catch {
      // Not every raw stream is a flate encoded content stream
    }
  });
  return streams;
};

describe('PDFDocument.encrypt', () => {
  ALGORITHMS.forEach(([name, algorithm, allowWeakCryptography]) => {
    describe(`using ${name}`, () => {
      it('writes an encryption dictionary and no plaintext', async () => {
        const bytes = await buildEncryptedPdf(algorithm, allowWeakCryptography);
        const raw = String.fromCharCode(...Array.from(bytes));

        expect(raw).toContain('/Encrypt');
        expect(raw).not.toContain(SECRET);
      });

      it('round trips through the decrypter with the user password', async () => {
        const bytes = await buildEncryptedPdf(algorithm, allowWeakCryptography);
        const reopened = await PDFDocument.load(bytes, {
          password: USER_PASSWORD,
        });

        const streams = decodedContentStreams(reopened);
        expect(streams.length).toBe(1);
        expect(streams[0]).toContain(SECRET_HEX);
      });

      it('round trips through the decrypter with the owner password', async () => {
        const bytes = await buildEncryptedPdf(algorithm, allowWeakCryptography);
        const reopened = await PDFDocument.load(bytes, {
          password: OWNER_PASSWORD,
        });

        expect(decodedContentStreams(reopened)[0]).toContain(SECRET_HEX);
      });

      it('rejects an incorrect password', async () => {
        const bytes = await buildEncryptedPdf(algorithm, allowWeakCryptography);
        await expect(
          PDFDocument.load(bytes, { password: 'wrong-password' }),
        ).rejects.toThrow();
      });
    });
  });

  it('defaults to AES-256 and raises an older header', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.context.header = PDFHeader.forVersion(1, 3);
    pdfDoc.addPage();
    pdfDoc.encrypt({ userPassword: USER_PASSWORD });

    expect(pdfDoc.context.header.getVersionString()).toBe('1.7');
    const encryptDict = pdfDoc.context.lookup(
      pdfDoc.context.trailerInfo.Encrypt,
      PDFDict,
    );
    expect(encryptDict.lookup(PDFName.of('V'), PDFNumber).asNumber()).toBe(5);
    expect(encryptDict.lookup(PDFName.of('R'), PDFNumber).asNumber()).toBe(6);
    expect(
      pdfDoc.catalog
        .lookup(PDFName.of('Extensions'), PDFDict)
        .lookup(PDFName.of('ADBE'), PDFDict)
        .lookup(PDFName.of('ExtensionLevel'), PDFNumber)
        .asNumber(),
    ).toBe(8);
  });

  it('refuses RC4 unless allowWeakCryptography is set', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    expect(() =>
      pdfDoc.encrypt({ userPassword: USER_PASSWORD, algorithm: 'RC4-128' }),
    ).toThrow(/allowWeakCryptography/);
  });

  it('round trips a Unicode password with AES-256', async () => {
    const password = 'clé 🔒';
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    pdfDoc
      .addPage([300, 200])
      .drawText(SECRET, { x: 20, y: 100, size: 14, font });
    pdfDoc.encrypt({ userPassword: password });

    const reopened = await PDFDocument.load(await pdfDoc.save(), { password });
    expect(decodedContentStreams(reopened)[0]).toContain(SECRET_HEX);
  });

  it('decrypts when the crypt filters are indirect objects', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    pdfDoc
      .addPage([300, 200])
      .drawText(SECRET, { x: 20, y: 100, size: 14, font });
    pdfDoc.encrypt({ userPassword: '', ownerPassword: OWNER_PASSWORD });

    // Some producers (e.g. iText 2.x) write /CF and each crypt filter as
    // indirect objects instead of inline dictionaries.
    const encrypted = await PDFDocument.load(await pdfDoc.save(), {
      ignoreEncryption: true,
    });
    const { context } = encrypted;
    const encryptDict = context.lookup(context.trailerInfo.Encrypt, PDFDict);
    const cf = encryptDict.lookup(PDFName.of('CF'), PDFDict);
    const stdCf = cf.lookup(PDFName.of('StdCF'), PDFDict);
    cf.set(PDFName.of('StdCF'), context.register(stdCf));
    encryptDict.set(PDFName.of('CF'), context.register(cf));
    const bytes = await encrypted.save({ useObjectStreams: false });

    const reopened = await PDFDocument.load(bytes, { password: '' });
    expect(decodedContentStreams(reopened)[0]).toContain(SECRET_HEX);
  });

  describe('objects written outside object streams', () => {
    const LANG = PDFName.of('Lang');

    [true, false].forEach((useObjectStreams) => {
      it(`encrypts their strings (useObjectStreams: ${useObjectStreams})`, async () => {
        const pdfDoc = await PDFDocument.create();
        pdfDoc.addPage();
        pdfDoc.catalog.set(LANG, PDFString.of('en-GB'));
        pdfDoc.encrypt({
          userPassword: USER_PASSWORD,
          ownerPassword: OWNER_PASSWORD,
        });
        const bytes = await pdfDoc.save({ useObjectStreams });

        expect(Buffer.from(bytes).toString('latin1')).not.toContain('(en-GB)');
        const reopened = await PDFDocument.load(bytes, {
          password: USER_PASSWORD,
        });
        expect(
          reopened.catalog.lookup(LANG, PDFString, PDFHexString).decodeText(),
        ).toBe('en-GB');
      });
    });

    it('encrypts strings nested in arrays and stream dictionaries', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage();
      const { context } = pdfDoc;
      const nested = context.obj({ Items: [PDFString.of('inside array')] });
      pdfDoc.catalog.set(PDFName.of('Nested'), context.register(nested));
      const stream = context.stream('contents', {
        Desc: PDFString.of('inside stream dict'),
      });
      pdfDoc.catalog.set(PDFName.of('Stream'), context.register(stream));
      pdfDoc.encrypt({ userPassword: USER_PASSWORD });
      const bytes = await pdfDoc.save({ useObjectStreams: false });

      const text = Buffer.from(bytes).toString('latin1');
      expect(text).not.toContain('inside array');
      expect(text).not.toContain('inside stream dict');
      const reopened = await PDFDocument.load(bytes, {
        password: USER_PASSWORD,
      });
      expect(
        reopened.catalog
          .lookup(PDFName.of('Nested'), PDFDict)
          .lookup(PDFName.of('Items'), PDFArray)
          .lookup(0, PDFString, PDFHexString)
          .decodeText(),
      ).toBe('inside array');
      expect(
        (reopened.catalog.lookup(PDFName.of('Stream')) as PDFRawStream).dict
          .lookup(PDFName.of('Desc'), PDFString, PDFHexString)
          .decodeText(),
      ).toBe('inside stream dict');
    });

    const signatures: [string, Record<string, unknown>][] = [
      ['/Type /Sig', { Type: 'Sig' }],
      ['/Type /DocTimeStamp', { Type: 'DocTimeStamp' }],
      ['no /Type and a /ByteRange', { ByteRange: [0, 0, 0, 0] }],
    ];
    signatures.forEach(([name, entries]) => {
      it(`leaves a signature's /Contents as it is (${name})`, async () => {
        const pdfDoc = await PDFDocument.create();
        pdfDoc.addPage();
        const signature = pdfDoc.context.obj({
          ...(entries as Record<string, string>),
          Contents: PDFHexString.of('AABBCCDD'),
          Reason: PDFString.of('a reason'),
        });
        pdfDoc.catalog.set(
          PDFName.of('Signature'),
          pdfDoc.context.register(signature),
        );
        pdfDoc.encrypt({ userPassword: USER_PASSWORD });
        const bytes = await pdfDoc.save({ useObjectStreams: false });

        const text = Buffer.from(bytes).toString('latin1');
        expect(text).toContain('/Contents <AABBCCDD>');
        expect(text).not.toContain('a reason');
      });
    });
  });

  describe('saving leaves the document as it was', () => {
    const open = (bytes: Uint8Array) =>
      PDFDocument.load(bytes, { password: USER_PASSWORD });
    const LANG = PDFName.of('Lang');

    [true, false].forEach((useObjectStreams) => {
      it(`writes the same text when saved twice (useObjectStreams: ${useObjectStreams})`, async () => {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        pdfDoc.addPage([300, 200]).drawText(SECRET, { font, size: 12 });
        pdfDoc.catalog.set(LANG, PDFString.of('en-GB'));
        pdfDoc.encrypt({ userPassword: USER_PASSWORD });

        await pdfDoc.save({ useObjectStreams });
        const reopened = await open(await pdfDoc.save({ useObjectStreams }));

        expect(
          reopened.catalog.lookup(LANG, PDFString, PDFHexString).decodeText(),
        ).toBe('en-GB');
        expect(decodedContentStreams(reopened)[0]).toContain(SECRET_HEX);
      });
    });

    it('encrypts an array used by two objects with the key of each', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage();
      const { context } = pdfDoc;
      const shared = context.obj([PDFString.of('shared text')]);
      const keys = ['First', 'Second'].map((name) => PDFName.of(name));
      keys.forEach((key) =>
        pdfDoc.catalog.set(key, context.register(context.obj({ shared }))),
      );
      pdfDoc.encrypt({ userPassword: USER_PASSWORD });
      const reopened = await open(
        await pdfDoc.save({ useObjectStreams: false }),
      );

      keys.forEach((key) => {
        const array = reopened.catalog
          .lookup(key, PDFDict)
          .lookup(PDFName.of('shared'), PDFArray);
        expect(array.lookup(0, PDFString, PDFHexString).decodeText()).toBe(
          'shared text',
        );
      });
    });

    it('encrypts a string that is an object of its own', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage();
      const ref = pdfDoc.context.register(PDFString.of('on its own'));
      pdfDoc.catalog.set(LANG, ref);
      pdfDoc.encrypt({ userPassword: USER_PASSWORD });
      const bytes = await pdfDoc.save({ useObjectStreams: false });

      expect(Buffer.from(bytes).toString('latin1')).not.toContain('on its own');
      const reopened = await open(bytes);
      expect(
        reopened.catalog.lookup(LANG, PDFString, PDFHexString).decodeText(),
      ).toBe('on its own');
    });
  });
});
