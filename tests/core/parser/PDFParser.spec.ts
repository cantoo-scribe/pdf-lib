import fs from 'fs';

import { asUint8Array } from '../../asUint8Array';

import {
  arrayAsString,
  decodePDFRawStream,
  CharCodes,
  mergeIntoTypedArray,
  PDFDict,
  PDFDocument,
  PDFHeader,
  PDFInvalidObject,
  PDFPageLeaf,
  PDFParser,
  PDFRawStream,
  PDFRef,
  PDFString,
  ReparseError,
  typedArrayFor,
} from '../../../src/index';

describe('PDFParser', () => {
  const origConsoleWarn = console.warn;

  beforeAll(() => {
    const ignoredWarnings = [
      'Trying to parse invalid object:',
      'Invalid object ref:',
      'Removing parsed object: 0 0 R',
    ];
    console.warn = jest.fn((...args) => {
      const isIgnored = ignoredWarnings.find((iw) => args[0].includes(iw));
      if (!isIgnored) origConsoleWarn(...args);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    console.warn = origConsoleWarn;
  });

  it('throws an error when the PDF is missing a header', async () => {
    const input = `
      I_AM_NOT_A_HEADER
      1 0 obj
        (foobar)
      endobj
    `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    await expect(parser.parseDocument()).rejects.toThrow();
  });

  it("does not throw an error when the 'endobj' keyword is missing", async () => {
    const input = `
      %PDF-1.7
      1 0 obj
        (foobar)
      foo
    `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();
    expect(context.lookup(PDFRef.of(1))).toBeInstanceOf(PDFString);
  });

  // https://github.com/cantoo-scribe/pdf-lib/issues/63
  it('recovers a truncated file whose last object never closes', async () => {
    const input = `
      %PDF-1.7
      1 0 obj
        (foobar)
      endobj
      2 0 obj
        << /Length )) /Broken
    `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();

    // the complete object survives, the truncated fragment is discarded
    expect(context.lookup(PDFRef.of(1))).toBeInstanceOf(PDFString);
    expect(context.lookup(PDFRef.of(2))).toBeUndefined();
  });

  it('still reads the trailer that follows an unterminated object', async () => {
    const input = `
      %PDF-1.7
      1 0 obj
        << /Type /Catalog /Pages 3 0 R >>
      endobj
      2 0 obj
        << /Length )) /Broken
      xref
      0 1
      0000000000 65535 f
      trailer
      << /Size 3 /Root 1 0 R >>
      startxref
      9
      %%EOF
    `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();

    expect(context.lookup(PDFRef.of(2))).toBeUndefined();
    expect(context.trailerInfo.Root).toBe(PDFRef.of(1));
    expect(context.trailerInfo.Size).toBeDefined();
  });

  // https://github.com/cantoo-scribe/pdf-lib/issues/64
  it('recovers when an xref subsection header is missing its second int', async () => {
    const input = `
      %PDF-1.7
      1 0 obj
        (foobar)
      endobj
      xref
      0 2
      0000000000 65535 f
      0000000009 00000 n
      2
      trailer
      << /Size 2 /Root 1 0 R >>
      startxref
      52
      %%EOF
    `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();

    expect(context.lookup(PDFRef.of(1))).toBeInstanceOf(PDFString);
    expect(context.trailerInfo.Root).toBeDefined();
  });

  it('handles invalid binary comments after header', async () => {
    const input = mergeIntoTypedArray(
      '%PDF-1.7\n',
      new Uint8Array([128, 1, 2, 3, 4, 5, 129, 130, 131, CharCodes.Newline]),
      '1 0 obj\n',
      ' . (foobar)\n',
      'endobj',
    );
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();
    expect(context.enumerateIndirectObjects().length).toBe(1);
  });

  it('handles invalid binary comments with missing newline after header', async () => {
    const input = mergeIntoTypedArray(
      '%PDF-1.7\n',
      new Uint8Array([142, 1, 2, 3, 4, 5, 129, 130, 131]),
      '1 0 obj\n',
      ' . (foobar)\n',
      'endobj',
    );
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();
    expect(context.enumerateIndirectObjects().length).toBe(1);
  });

  it('does not stall when stuff follows the last %%EOL', async () => {
    const input = `
      %PDF-1.7
      1 0 obj
        (foobar)
      endobj
      startxref
      127
      %%EOL
      @@@@@@@@@@@@@@@@@@
    `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();
    expect(context.enumerateIndirectObjects().length).toBe(1);
  });

  it('handles invalid indirect objects', async () => {
    const input = `
    %PDF-1.7
    22 0 obj <</Type/Outlines/First ## 0 R/Last ** 0 R/Count 2>> endobj
  `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();

    expect(context.enumerateIndirectObjects().length).toBe(1);
    const object = context.lookup(PDFRef.of(22));
    expect(object).toBeInstanceOf(PDFInvalidObject);
  });

  it('throws an error with invalid indirect objects when throwOnInvalidObject=true', async () => {
    const input = `
    %PDF-1.7
    22 0 obj <</Type/Outlines/First ## 0 R/Last ** 0 R/Count 2>> endobj
  `;
    const parser = PDFParser.forBytesWithOptions(
      typedArrayFor(input),
      100,
      true,
    );
    await expect(parser.parseDocument()).rejects.toBeInstanceOf(Error);
  });

  it('handles xref sections with empty subsections', async () => {
    const input = `
    %PDF-1.7
    22 0 obj
      (foo)
    endobj
    xref
    0 0
    trailer
    << >>
    startxref
    21
    %%EOF
  `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();

    expect(context.enumerateIndirectObjects().length).toBe(1);
    const object = context.lookup(PDFRef.of(22));
    expect(object).toBeInstanceOf(PDFString);
  });

  it('can parse PDF files with comments and stuff preceding the header', async () => {
    const pdfBytes = asUint8Array(
      fs.readFileSync(
        './assets/pdfs/pdf20examples/PDF 2.0 with offset start.pdf',
      ),
    );

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-2.0\n%');
    expect(context.enumerateIndirectObjects().length).toBe(8);
  });

  it('can parse PDF files with comments stuff following the header', async () => {
    const pdfBytes = asUint8Array(
      fs.readFileSync('./assets/pdfs/stuff_following_header.pdf'),
    );

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-1.4\n%');
    expect(context.enumerateIndirectObjects().length).toBe(12);
  });

  it('can parse PDF files with missing xref table, trailer dict, and trailer', async () => {
    const pdfBytes = asUint8Array(
      fs.readFileSync('./assets/pdfs/missing_xref_trailer_dict.pdf'),
    );

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-2.0\n%');
    expect(context.enumerateIndirectObjects().length).toBe(8);
  });

  it('can parse PDF files with invalid xref table', async () => {
    const pdfBytes = asUint8Array(fs.readFileSync('./assets/pdfs/normal.pdf'));

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-1.3\n%');
    expect(context.enumerateIndirectObjects().length).toBe(108);
  });

  it('can parse PDF files without object streams or update sections', async () => {
    const pdfBytes = asUint8Array(fs.readFileSync('./assets/pdfs/normal.pdf'));

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-1.3\n%');
    expect(context.enumerateIndirectObjects().length).toBe(108);
  });

  it('can parse PDF files with update sections', async () => {
    const pdfBytes = asUint8Array(
      fs.readFileSync('./assets/pdfs/with_update_sections.pdf'),
    );

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-1.7\n%');
    // has lots of deleted objects...
    expect(context.enumerateIndirectObjects().length).toBe(138);
  });

  it('can parse PDF files with comments', async () => {
    const pdfBytes = asUint8Array(
      fs.readFileSync('./assets/pdfs/with_comments.pdf'),
    );

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-1.7\n%');
    expect(context.enumerateIndirectObjects().length).toBe(145);
  });

  it('prevents double parsing', async () => {
    const pdfBytes = asUint8Array(fs.readFileSync('./assets/pdfs/normal.pdf'));

    const parser = PDFParser.forBytesWithOptions(pdfBytes);

    await expect(parser.parseDocument()).resolves.not.toThrow();
    await expect(parser.parseDocument()).rejects.toThrow(
      new ReparseError('PDFParser', 'parseDocument'),
    );
  });

  it('can parse PDF files with binary jibberish between indirect objects', async () => {
    const pdfBytes = asUint8Array(fs.readFileSync('./assets/pdfs/giraffe.pdf'));

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-1.6\n%');
    expect(context.enumerateIndirectObjects().length).toBe(22);
  });

  it('can fix incorrect values for /Root', async () => {
    const pdfBytes = asUint8Array(
      fs.readFileSync('./assets/pdfs/invalid_root_ref.pdf'),
    );

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-1.5\n%');
    expect(context.trailerInfo.Root).toBe(PDFRef.of(2, 0));
    // the pdf has many.. many errors, not sure if 29 is actually the right number..
    expect(context.enumerateIndirectObjects().length).toBe(29);
  });

  it("can parse files containing indirect objects missing their 'endobj' keyword", async () => {
    const pdfBytes = asUint8Array(
      fs.readFileSync('./assets/pdfs/missing_endobj_keyword.pdf'),
    );

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-1.3\n%');
    expect(context.enumerateIndirectObjects().length).toBe(7);
  });

  it("can parse files with containing large arrays with most 'null' values", async () => {
    const pdfBytes = asUint8Array(
      fs.readFileSync('./assets/pdfs/bixby_guide.pdf'),
    );

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-1.4\n%');

    const objects = context.enumerateIndirectObjects();
    // 1 less than Size
    expect(objects.length).toBe(26237);
    expect(
      objects.filter(([_ref, obj]) => obj instanceof PDFPageLeaf).length,
    ).toBe(176);
  });

  it('can parse files with invalid stream EOLs: "stream \r\n', async () => {
    const pdfBytes = asUint8Array(
      fs.readFileSync('./assets/pdfs/with_invalid_stream_EOL.pdf'),
    );

    const parser = PDFParser.forBytesWithOptions(pdfBytes);
    const context = await parser.parseDocument();

    expect(context.header).toBeInstanceOf(PDFHeader);
    expect(context.header.toString()).toEqual('%PDF-1.3\n%');

    const objects = context.enumerateIndirectObjects();
    expect(objects.length).toBe(11);
    expect(
      objects.filter(([_ref, obj]) => obj instanceof PDFPageLeaf).length,
    ).toBe(2);
  });

  it('handles updated PDFs missing newline after %%EOF marker', async () => {
    const input = `
    %PDF-1.7
    22 0 obj
      (foo)
    endobj
    xref
    0 0
    trailer
    << >>
    startxref
    21
    %%EOF28 0 obj
    << /Foo /Bar >>
    endobj
    xref
    0 0
    trailer
    << >>
    startxref
    21
    %%EOF
  `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();

    expect(context.enumerateIndirectObjects().length).toBe(2);
    const object22 = context.lookup(PDFRef.of(22));
    expect(object22).toBeInstanceOf(PDFString);
    const object28 = context.lookup(PDFRef.of(28));
    expect(object28).toBeInstanceOf(PDFDict);
  });

  it('handles updated PDFs with comments preceding %%EOF marker', async () => {
    const input = `
    %PDF-1.7
    22 0 obj
      (foo)
    endobj
    xref
    0 0
    trailer
    << >>
    startxref
    21
    %%EOF28 0 obj
    << /Foo /Bar >>
    endobj
    xref
    0 0
    trailer
    << >>
    startxref
    21 % Foo
    % Bar
    %%EOF
  `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();

    expect(context.enumerateIndirectObjects().length).toBe(2);
    const object22 = context.lookup(PDFRef.of(22));
    expect(object22).toBeInstanceOf(PDFString);
    const object28 = context.lookup(PDFRef.of(28));
    expect(object28).toBeInstanceOf(PDFDict);
  });

  it('removes indirect objects with objectNumber=0', async () => {
    const input = `
    %PDF-1.7
    1 0 obj
      (foo)
    endobj
    0 0 obj
      (bar)
    endobj
    2 0 obj
      (baz)
    endobj
    %%EOF
  `;
    const parser = PDFParser.forBytesWithOptions(typedArrayFor(input));
    const context = await parser.parseDocument();

    expect(context.enumerateIndirectObjects().length).toBe(2);
    const object1 = context.lookup(PDFRef.of(1));
    expect(object1).toBeInstanceOf(PDFString);
    const object0 = context.lookup(PDFRef.of(0));
    expect(object0).toBe(undefined);
    const object2 = context.lookup(PDFRef.of(2));
    expect(object2).toBeInstanceOf(PDFString);
  });

  it('preserves pdfBytes when created for incremental update', async () => {
    const pdfBytes = asUint8Array(
      fs.readFileSync('./assets/pdfs/bixby_guide.pdf'),
    );

    const parser = PDFParser.forBytesWithOptions(
      pdfBytes,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );
    const context = await parser.parseDocument();

    expect(context.pdfFileDetails.originalBytes).toBeDefined();
    expect(context.pdfFileDetails.originalBytes?.toString()).toEqual(
      pdfBytes.toString(),
    );
  });

  describe('xref-directed recovery after a sequential scan', () => {
    type Options = {
      prefix?: string;
      generation?: number;
      entry?: 'missing' | 'free' | 'wrong offset' | 'wrong generation';
      trailer?: string;
      missingEnd?: boolean;
    };
    const drawing = '40 40 120 60 re f\n';
    function makePdf({
      prefix = '%%ULC:1.01.01 ',
      generation = 0,
      entry,
      trailer = '',
      missingEnd = false,
    }: Options = {}) {
      let text = '%PDF-1.7\n' + prefix;
      const offsets: number[] = [0];
      const objects = [
        `<< /Length ${drawing.length} >>\nstream\n${drawing}endstream`,
        '<< /Type /Catalog /Pages 3 0 R >>',
        '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
        `<< /Type /Page /Parent 3 0 R /MediaBox [0 0 200 140] /Resources << >> /Contents 1 ${generation} R >>`,
      ];
      objects.forEach((body, index) => {
        offsets.push(text.length);
        text += `${index + 1} ${index === 0 ? generation : 0} obj\n${body}\n`;
        if (!missingEnd || index !== 0) text += 'endobj\n';
      });
      const xref = text.length;
      text += `xref\n0 ${entry === 'missing' ? 1 : 5}\n0000000000 65535 f \n`;
      if (entry === 'missing') text += '2 3\n';
      for (let id = entry === 'missing' ? 2 : 1; id <= 4; id++) {
        const offset = offsets[id === 1 && entry === 'wrong offset' ? 2 : id];
        const gen =
          id === 1 ? (entry === 'wrong generation' ? 1 : generation) : 0;
        const state = id === 1 && entry === 'free' ? 'f' : 'n';
        text += `${String(offset).padStart(10, '0')} ${String(gen).padStart(5, '0')} ${state} \n`;
      }
      text += `trailer\n<< /Size 5 /Root 2 0 R ${trailer} >>\nstartxref\n${xref}\n%%EOF\n`;
      return typedArrayFor(text);
    }
    async function load(bytes: Uint8Array) {
      return PDFDocument.load(bytes, {
        updateMetadata: false,
        throwOnInvalidObject: true,
      });
    }
    function hasDrawing(doc: PDFDocument) {
      const stream = doc.getPage(0).node.Contents();
      return (
        stream instanceof PDFRawStream &&
        arrayAsString(decodePDFRawStream(stream).decode()) === drawing
      );
    }

    const cases: [string, Options, boolean][] = [
      ['ULC inline content', {}, true],
      ['another inline vendor comment', { prefix: '% AnyVendor ' }, true],
      ['normal header', { prefix: '%%ULC:1.01.01\n' }, true],
      ['nonzero generation', { generation: 2 }, true],
      ['unindexed object', { entry: 'missing' }, false],
      ['free object', { entry: 'free' }, false],
      ['wrong offset/header', { entry: 'wrong offset' }, false],
      ['wrong generation', { entry: 'wrong generation' }, false],
      ['incremental layout', { trailer: '/Prev 0' }, false],
      ['hybrid layout', { trailer: '/XRefStm 0' }, false],
      ['incomplete object', { missingEnd: true }, false],
    ];
    it.each(cases)('%s', async (_name, options, expected) => {
      const bytes = makePdf(options);
      const original = bytes.slice();
      expect(hasDrawing(await load(bytes))).toBe(expected);
      expect(bytes).toEqual(original);
    });

    it('does not recover across multiple xref sections', async () => {
      let text = arrayAsString(makePdf());
      const offset = text.length;
      text +=
        'xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 5 /Root 2 0 R >>\nstartxref\n' +
        offset +
        '\n%%EOF\n';
      expect(hasDrawing(await load(typedArrayFor(text)))).toBe(false);
    });

    it('does not overwrite already parsed objects', async () => {
      expect(
        hasDrawing(await load(makePdf({ prefix: '', entry: 'wrong offset' }))),
      ).toBe(true);
    });

    it('leaves ordinary xref-stream PDFs on their existing parsing path', async () => {
      const doc = await PDFDocument.create();
      doc
        .addPage([200, 140])
        .drawRectangle({ x: 40, y: 40, width: 120, height: 60 });
      const loaded = await load(await doc.save());
      expect(loaded.getPageCount()).toBe(1);
      expect(loaded.getPage(0).node.Contents()).toBeDefined();
    });

    it('retains the recovered drawing after save and copyPages', async () => {
      const doc = await load(makePdf());
      expect(hasDrawing(await load(await doc.save()))).toBe(true);
      const copy = await PDFDocument.create();
      for (const page of await copy.copyPages(doc, [0])) copy.addPage(page);
      expect(hasDrawing(await load(await copy.save()))).toBe(true);
    });
  });
});
