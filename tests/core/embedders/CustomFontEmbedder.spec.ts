import fontkit from '@cantoo/fontkit';
import fs from 'fs';

import { asUint8Array } from '../../asUint8Array';

import {
  CustomFontEmbedder,
  PDFArray,
  PDFContext,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
} from '../../../src/index';

const ubuntuFont = asUint8Array(
  fs.readFileSync('./assets/fonts/ubuntu/Ubuntu-R.ttf'),
);

const widthsOf = (context: PDFContext, fontRef: PDFRef) => {
  const fontDict = context.lookup(fontRef, PDFDict);
  const cidFontDict = fontDict
    .lookup(PDFName.of('DescendantFonts'), PDFArray)
    .lookup(0, PDFDict);
  const W = cidFontDict.lookup(PDFName.of('W'), PDFArray);

  const widths = new Map<number, number>();
  for (let idx = 0; idx < W.size(); idx += 2) {
    const firstId = W.lookup(idx, PDFNumber).asNumber();
    W.lookup(idx + 1, PDFArray)
      .asArray()
      .forEach((width, offset) =>
        widths.set(firstId + offset, (width as PDFNumber).asNumber()),
      );
  }
  return widths;
};

const toUnicodeOf = (context: PDFContext, fontRef: PDFRef) => {
  const fontDict = context.lookup(fontRef, PDFDict);
  const stream = fontDict.lookup(PDFName.of('ToUnicode'), PDFStream);
  return new TextDecoder().decode(
    decodePDFRawStream(stream as PDFRawStream).decode(),
  );
};

describe('CustomFontEmbedder', () => {
  it('can be constructed with CustomFontEmbedder.for(...)', async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder).toBeInstanceOf(CustomFontEmbedder);
  });

  it("exposes the font's name", async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder.fontName).toBe('Ubuntu');
  });

  it('can set a custom font name', async () => {
    const customName = 'abc123';
    const embedder = await CustomFontEmbedder.for(
      fontkit,
      ubuntuFont,
      customName,
    );
    expect(embedder.customName).toBe(customName);
  });

  it('can embed font dictionaries into PDFContexts without a predefined ref', async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = await embedder.embedIntoContext(context);
    expect(context.enumerateIndirectObjects().length).toBe(5);
    expect(context.lookup(ref)).toBeInstanceOf(PDFDict);
  });

  it('can embed font dictionaries into PDFContexts with a predefined ref', async () => {
    const context = PDFContext.create();
    const predefinedRef = PDFRef.of(9999);
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = await embedder.embedIntoContext(context, predefinedRef);
    expect(context.enumerateIndirectObjects().length).toBe(5);
    expect(context.lookup(predefinedRef)).toBeInstanceOf(PDFDict);
    expect(ref).toBe(predefinedRef);
  });

  it('can encode text strings into PDFHexString objects', async () => {
    const text = 'Stuff and thingz!';
    const hexCodes =
      '00360057005801AA000300440051004700030057004B004C0051004A005D0004';
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);

    expect(embedder.encodeText(text)).toBeInstanceOf(PDFHexString);
    expect(String(embedder.encodeText(text))).toBe(
      String(PDFHexString.of(hexCodes)),
    );
  });

  it('can measure the width of text strings at the given font size', async () => {
    const text = 'Stuff and thingz!';
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder.widthOfTextAtSize(text, 12)).toBe(90.672);
    expect(embedder.widthOfTextAtSize(text, 24)).toBe(181.344);
  });

  it('can measure the height of the font at the given size', async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder.heightOfFontAtSize(12)).toBeCloseTo(13.452);
    expect(embedder.heightOfFontAtSize(24)).toBeCloseTo(26.904);
  });

  it('can measure the size of the font at a given height', async () => {
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    expect(embedder.sizeOfFontAtHeight(12)).toBeCloseTo(10.705);
    expect(embedder.sizeOfFontAtHeight(24)).toBeCloseTo(21.409);
  });

  it('writes the width of every glyph of the font, including glyphs without code point', async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const { font } = embedder;

    const ref = await embedder.embedIntoContext(context);
    const widths = widthsOf(context, ref);

    expect(widths.size).toBe(font.numGlyphs);
    expect(widths.get(0)).toBeCloseTo(
      font.getGlyph!(0)!.advanceWidth * (1000 / font.unitsPerEm),
    );
  });

  it('writes the width of ligature glyphs used by the text', async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);
    const { font } = embedder;

    const text = 'Stuff and thingz!';
    const { glyphs } = font.layout(text);
    const ligature = glyphs.find((glyph) => glyph.codePoints.length > 1)!;
    expect(ligature).toBeDefined();
    embedder.encodeText(text);

    const ref = await embedder.embedIntoContext(context);

    expect(widthsOf(context, ref).get(ligature.id)).toBeCloseTo(
      ligature.advanceWidth * (1000 / font.unitsPerEm),
    );
  });

  it('only writes glyphs that have code points in the ToUnicode CMap', async () => {
    const context = PDFContext.create();
    const embedder = await CustomFontEmbedder.for(fontkit, ubuntuFont);

    const ref = await embedder.embedIntoContext(context);

    expect(toUnicodeOf(context, ref)).not.toMatch(/<[0-9a-f]{4}> <>/i);
  });
});
