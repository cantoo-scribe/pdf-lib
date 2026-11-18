import { PDFDocument, StandardFonts, TextAlignment } from '../../../src/index';

import { layoutMultilineText } from '../../../src/api/text/layout';

const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 500;

describe('layoutMultilineText', () => {
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

  it('should break each line after the last word that fits', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const alignment = TextAlignment.Left;
    const fontSize = 12;
    const text = 'The quick brown fox jumps over the lazy dog';
    const width = font.widthOfTextAtSize('The quick brown fox', fontSize) + 1;
    const bounds = { x: 0, y: 0, width, height: Number.MAX_VALUE };

    const multilineTextLayout = layoutMultilineText(text, {
      alignment,
      bounds,
      font,
      fontSize,
    });

    expect(multilineTextLayout.lines.map((line) => line.text)).toStrictEqual([
      'The quick brown fox',
      'jumps over the lazy',
      'dog',
    ]);
    multilineTextLayout.lines.forEach((line) =>
      expect(line.width).toBeLessThan(width),
    );
  });

  it('should move a word to the next line when it would exactly fill the width', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const alignment = TextAlignment.Left;
    const fontSize = 12;
    const text = 'The quick brown fox jumps over the lazy dog';
    const width = font.widthOfTextAtSize('The quick brown fox', fontSize);
    const bounds = { x: 0, y: 0, width, height: Number.MAX_VALUE };

    const multilineTextLayout = layoutMultilineText(text, {
      alignment,
      bounds,
      font,
      fontSize,
    });

    expect(multilineTextLayout.lines.map((line) => line.text)).toStrictEqual([
      'The quick brown',
      'fox jumps over the',
      'lazy dog',
    ]);
  });

  it('should put a word wider than the bounds on its own line', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const alignment = TextAlignment.Left;
    const fontSize = 12;
    const text = 'a supercalifragilisticexpialidocious';
    const width = font.widthOfTextAtSize('a b c', fontSize);
    const bounds = { x: 0, y: 0, width, height: Number.MAX_VALUE };

    const multilineTextLayout = layoutMultilineText(text, {
      alignment,
      bounds,
      font,
      fontSize,
    });

    expect(multilineTextLayout.lines.map((line) => line.text)).toStrictEqual([
      'a',
      'supercalifragilisticexpialidocious',
    ]);
  });

  it('should not re-measure the remaining text for every word of a long paragraph', async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const alignment = TextAlignment.Left;
    const fontSize = 12;
    const words = Array.from({ length: 700 }, (_, idx) => `word${idx}`);
    const text = words.join(' ');
    const bounds = { x: 0, y: 0, width: 200, height: Number.MAX_VALUE };
    const widthOfTextAtSize = jest.spyOn(font, 'widthOfTextAtSize');

    const multilineTextLayout = layoutMultilineText(text, {
      alignment,
      bounds,
      font,
      fontSize,
    });

    const lines = multilineTextLayout.lines.map((line) => line.text);
    expect(lines.join(' ')).toStrictEqual(text);
    // roughly one measurement per word, rather than one per word per line
    expect(widthOfTextAtSize.mock.calls.length).toBeLessThan(words.length * 2);
  });
});
