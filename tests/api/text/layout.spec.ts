import { PDFDocument, StandardFonts, TextAlignment } from '../../../src/index';

import { layoutMultilineText } from '../../../src/api/text/layout';

const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 500;

describe('layoutMultilineText', () => {
  it('should break a paragraph at the same words as before', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const text =
      'The quick brown fox jumps over the lazy dog, then naps in the warm ' +
      'afternoon sun beside the old stone wall.';

    const layout = layoutMultilineText(text, {
      alignment: TextAlignment.Left,
      fontSize: 12,
      font,
      bounds: { x: 0, y: 0, width: 150, height: 200 },
    });

    expect(layout.lines.map((line) => line.text)).toStrictEqual([
      'The quick brown fox jumps',
      'over the lazy dog, then',
      'naps in the warm afternoon',
      'sun beside the old stone',
      'wall.',
    ]);
  });

  it('should not re-measure a long paragraph once per word on every line', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const text =
      'Ada grew up on the edge of the oldest ruin, where her mother ' +
      'scavenged for a living. ';
    const paragraph = text.repeat(40).trim(); // 3,399 characters, 56 lines

    const measure = jest.spyOn(font, 'widthOfTextAtSize');
    const layout = layoutMultilineText(paragraph, {
      alignment: TextAlignment.Left,
      fontSize: 8,
      font,
      bounds: { x: 0, y: 0, width: 220, height: 300 },
    });

    expect(layout.lines.length).toStrictEqual(56);
    // 508 with binary search; the previous implementation made 18,661.
    expect(measure.mock.calls.length).toBeLessThan(1000);
    measure.mockRestore();
  });

  it('should layout the text on one line when it fits near-perfectly', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const alignment = TextAlignment.Left;
    const padding = 0;
    const borderWidth = 0;
    const text = 'Super Mario Bros.';

    for (let fontSize = MIN_FONT_SIZE; fontSize <= MAX_FONT_SIZE; fontSize++) {
      const height = font.heightAtSize(fontSize) - (borderWidth + padding) * 2;

      const width =
        font.widthOfTextAtSize(text, fontSize) - (borderWidth + padding) * 2;

      const bounds = {
        x: borderWidth + padding,
        y: borderWidth + padding,
        width,
        height,
      };

      const multilineTextLayout = layoutMultilineText(text, {
        alignment,
        bounds,
        font,
      });

      expect(multilineTextLayout.lines.length).toStrictEqual(1);
    }
  });

  it('should layout the text on one line when it fits comfortably', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const alignment = TextAlignment.Left;
    const padding = 0;
    const borderWidth = 0;
    const text = 'Super Mario Bros.';
    const fontSize = 12;
    const height = font.heightAtSize(fontSize) - (borderWidth + padding) * 2;

    // Bounds width twice that of the text
    const width =
      (font.widthOfTextAtSize(text, fontSize) - (borderWidth + padding) * 2) *
      2;

    const bounds = {
      x: borderWidth + padding,
      y: borderWidth + padding,
      width,
      height,
    };

    const multilineTextLayout = layoutMultilineText(text, {
      alignment,
      bounds,
      font,
    });

    expect(multilineTextLayout.lines.length).toStrictEqual(1);
  });

  it('should layout the text on multiple lines when it does not fit horizontally but there is space vertically', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const alignment = TextAlignment.Left;
    const padding = 0;
    const borderWidth = 0;
    const text = 'Super Mario Bros.';

    for (let fontSize = MIN_FONT_SIZE; fontSize <= MAX_FONT_SIZE; fontSize++) {
      // Height twice that of the text
      const height =
        (font.heightAtSize(fontSize) - (borderWidth + padding) * 2) * 2;

      // Width half that of the text
      const width =
        (font.widthOfTextAtSize(text, fontSize) - (borderWidth + padding) * 2) /
        2;

      const bounds = {
        x: borderWidth + padding,
        y: borderWidth + padding,
        width,
        height,
      };

      const multilineTextLayout = layoutMultilineText(text, {
        alignment,
        bounds,
        font,
      });

      expect(multilineTextLayout.lines.length).toStrictEqual(2);
    }
  });

  it('should never exceed the maximum font size', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const alignment = TextAlignment.Left;
    const padding = 0;
    const borderWidth = 0;
    const text = 'Super Mario Bros.';

    const height = Number.MAX_VALUE;
    const width = Number.MAX_VALUE;

    const bounds = {
      x: borderWidth + padding,
      y: borderWidth + padding,
      width,
      height,
    };

    const multilineTextLayout = layoutMultilineText(text, {
      alignment,
      bounds,
      font,
    });

    expect(multilineTextLayout.lines.length).toStrictEqual(1);
    expect(multilineTextLayout.fontSize).toStrictEqual(MAX_FONT_SIZE);
  });

  it('should respect empty lines', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const alignment = TextAlignment.Left;
    const padding = 0;
    const borderWidth = 0;
    const lines = ['Super Mario Bros.', '', 'Boop'];
    const text = lines.join('\n');

    for (let fontSize = MIN_FONT_SIZE; fontSize <= MAX_FONT_SIZE; fontSize++) {
      const height = font.heightAtSize(fontSize) - (borderWidth + padding) * 2;

      const width =
        font.widthOfTextAtSize(lines[0], fontSize) -
        (borderWidth + padding) * 2;

      const bounds = {
        x: borderWidth + padding,
        y: borderWidth + padding,
        width,
        height,
      };

      const multilineTextLayout = layoutMultilineText(text, {
        alignment,
        bounds,
        font,
      });

      expect(multilineTextLayout.lines.length).toStrictEqual(3);
    }
  });
});
