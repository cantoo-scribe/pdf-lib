import { PDFDocument, StandardFonts } from '../../src/api';
import PDFHeader from '../../src/core/document/PDFHeader';
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

const ALGORITHMS: Array<[string, number, number | string]> = [
  ['RC4 40-bit (V1/R2)', 1, 3],
  ['RC4 128-bit (V2/R3)', 1, 4],
  ['AES-128 (V4/R4)', 1, 6],
  ['AES-256 (V5/R5)', 1, '7ext3'],
];

const buildEncryptedPdf = async (major: number, minor: number | string) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  pdfDoc
    .addPage([300, 200])
    .drawText(SECRET, { x: 20, y: 100, size: 14, font });

  pdfDoc.context.header = (PDFHeader.forVersion as any)(major, minor);
  pdfDoc.encrypt({
    userPassword: USER_PASSWORD,
    ownerPassword: OWNER_PASSWORD,
    permissions: { printing: 'highResolution' },
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
    } catch (error) {
      // Not every raw stream is a flate encoded content stream
    }
  });
  return streams;
};

describe('PDFDocument.encrypt', () => {
  ALGORITHMS.forEach(([name, major, minor]) => {
    describe(`using ${name}`, () => {
      it('writes an encryption dictionary and no plaintext', async () => {
        const bytes = await buildEncryptedPdf(major, minor);
        const raw = String.fromCharCode(...Array.from(bytes));

        expect(raw).toContain('/Encrypt');
        expect(raw).not.toContain(SECRET);
      });

      it('round trips through the decrypter with the user password', async () => {
        const bytes = await buildEncryptedPdf(major, minor);
        const reopened = await PDFDocument.load(bytes, {
          password: USER_PASSWORD,
        });

        const streams = decodedContentStreams(reopened);
        expect(streams.length).toBe(1);
        expect(streams[0]).toContain(SECRET_HEX);
      });

      it('round trips through the decrypter with the owner password', async () => {
        const bytes = await buildEncryptedPdf(major, minor);
        const reopened = await PDFDocument.load(bytes, {
          password: OWNER_PASSWORD,
        });

        expect(decodedContentStreams(reopened)[0]).toContain(SECRET_HEX);
      });

      it('rejects an incorrect password', async () => {
        const bytes = await buildEncryptedPdf(major, minor);
        await expect(
          PDFDocument.load(bytes, { password: 'wrong-password' }),
        ).rejects.toThrow();
      });
    });
  });
});
