import fs from 'fs';

import {
  PDFContext,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFStreamWriter,
} from '../../../src/index';

const expectedPdfBytes = new Uint8Array(
  fs.readFileSync('./tests/core/writers/data/stream-writer-1.pdf'),
);

const contentStreamText = `
  BT
    /F1 24 Tf
    100 100 Td
    (Hello World and stuff!) Tj
  ET
`;

describe('PDFStreamWriter', () => {
  it('serializes PDFContext objects using Indirect Objects, Object Streams, and XRef Streams', async () => {
    const context = PDFContext.create();

    const contentStream = context.flateStream(contentStreamText);
    const contentStreamRef = PDFRef.of(9000);
    context.assign(contentStreamRef, contentStream);

    const fontDict = context.obj({
      Type: 'Font',
      Subtype: 'Type1',
      Name: 'F1',
      BaseFont: 'Helvetica',
      Encoding: 'MacRomanEncoding',
    });
    const fontDictRef = context.register(fontDict);

    const page = context.obj({
      Type: 'Page',
      MediaBox: [0, 0, 612, 792],
      Contents: contentStreamRef,
      Resources: { Font: { F1: fontDictRef } },
    });
    const pageRef = context.register(page);

    const pages = context.obj({
      Type: 'Pages',
      Kids: [pageRef],
      Count: 1,
    });
    const pagesRef = context.register(pages);
    page.set(PDFName.of('Parent'), pagesRef);

    const catalog = context.obj({
      Type: 'Catalog',
      Pages: pagesRef,
    });
    context.trailerInfo.Root = context.register(catalog);

    const buffer = await PDFStreamWriter.forContext(
      context,
      Infinity,
      false,
      2,
    ).serializeToBuffer();

    expect(buffer.length).toBe(expectedPdfBytes.length);
    expect(buffer).toEqual(expectedPdfBytes);
  });

  it.each([
    ['Sig', 'ETSI.CAdES.detached'],
    ['DocTimeStamp', 'ETSI.RFC3161'],
  ])(
    'keeps /Type /%s signature dictionaries out of Object Streams',
    async (type, subFilter) => {
      const context = PDFContext.create();

      // The placeholder a signer locates in the saved bytes and overwrites.
      const contentsPlaceholder = 'AB'.repeat(32);

      const signatureRef = context.register(
        context.obj({
          Type: type,
          Filter: 'Adobe.PPKLite',
          SubFilter: subFilter,
          Contents: PDFHexString.of(contentsPlaceholder),
          ByteRange: [0, 999999, 999999, 999999],
        }),
      );

      const fieldRef = context.register(
        context.obj({
          Type: 'Annot',
          Subtype: 'Widget',
          FT: 'Sig',
          Rect: [0, 0, 0, 0],
          V: signatureRef,
        }),
      );

      const pagesRef = context.register(
        context.obj({ Type: 'Pages', Kids: [], Count: 0 }),
      );
      context.trailerInfo.Root = context.register(
        context.obj({
          Type: 'Catalog',
          Pages: pagesRef,
          AcroForm: { Fields: [fieldRef], SigFlags: 3 },
        }),
      );

      const buffer = await PDFStreamWriter.forContext(
        context,
        Infinity,
      ).serializeToBuffer();
      const text = Buffer.from(buffer).toString('latin1');

      const isWrittenUncompressed = (ref: PDFRef) =>
        new RegExp(`(^|\\n)${ref.objectNumber} 0 obj\\n`).test(text);

      // The signature dictionary is an indirect object of its own, with its
      // placeholder readable in the file.
      expect(isWrittenUncompressed(signatureRef)).toBe(true);
      expect(text).toContain(`/Type /${type}`);
      expect(text).toContain(`/Contents <${contentsPlaceholder}>`);

      // Ordinary dictionaries, like the signature field, are still compressed.
      expect(isWrittenUncompressed(fieldRef)).toBe(false);
      expect(text).not.toContain('/Subtype /Widget');
    },
  );
});
