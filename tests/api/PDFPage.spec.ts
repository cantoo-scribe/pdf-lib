import fs from 'fs';
import {
  cmyk,
  ColorTypes,
  PDFArray,
  PDFContentStream,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFPage,
  Separation,
  StandardFonts,
} from '../../src/index';

const birdPng = fs.readFileSync('assets/images/greyscale_bird.png');
const simplePDF = fs.readFileSync('assets/pdfs/simple.pdf');

const contentsOf = (page: PDFPage) =>
  (page.node.Contents() as PDFArray)
    .asArray()
    .map((ref) =>
      (page.doc.context.lookup(ref) as PDFContentStream).getContentsString(),
    )
    .join('');

const colorSpacesOf = (page: PDFPage) =>
  page.node.Resources()!.lookup(PDFName.of('ColorSpace'), PDFDict);

describe('PDFDocument', () => {
  describe('getSize() method', () => {
    it("returns the width and height of the the page's MediaBox", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.node.set(PDFName.MediaBox, pdfDoc.context.obj([5, 5, 20, 50]));
      expect(page.getSize()).toEqual({ width: 15, height: 45 });
    });
  });

  describe('page adding', () => {
    it('adds page with sizes to existing doc', async () => {
      const pdfDoc = await PDFDocument.load(simplePDF, {
        forIncrementalUpdate: true,
      });
      const ipc = pdfDoc.getPageCount();
      pdfDoc.addPage([500, 200]);
      expect(pdfDoc.getPageCount()).toBe(ipc + 1);
    });

    it('adds pages to existing doc', async () => {
      const pdfDoc = await PDFDocument.load(simplePDF, {
        forIncrementalUpdate: true,
      });
      const ipc = pdfDoc.getPageCount();
      pdfDoc.addPage();
      pdfDoc.insertPage(0);
      expect(pdfDoc.getPageCount()).toBe(ipc + 2);
    });
  });

  describe('page deletion', () => {
    it('deletes pages', async () => {
      const pdfDoc = await PDFDocument.load(simplePDF, {
        forIncrementalUpdate: true,
      });
      const p0Num = pdfDoc.getPage(0).ref.objectNumber;
      pdfDoc.removePage(0);
      expect(pdfDoc.getPageCount()).toBe(1);
      const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
      const rex = new RegExp(
        `xref[\r\n|\n]0 .*[\r\n|\n]${p0Num.toString().padStart(10, '0')} 65535 f`,
      );
      expect(Buffer.from(pdfBytes).toString()).toMatch(rex);
    });
  });

  describe('setSize() method', () => {
    it("sets the width and height of only the the page's MediaBox when the other boxes are not defined", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      page.setMediaBox(5, 5, 20, 50);
      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.node.MediaBox()).toBeInstanceOf(PDFArray);
      expect(page.node.CropBox()).toBeUndefined();
      expect(page.node.BleedBox()).toBeUndefined();
      expect(page.node.TrimBox()).toBeUndefined();
      expect(page.node.ArtBox()).toBeUndefined();

      page.setSize(15, 45);
      expect(page.getSize()).toEqual({ width: 15, height: 45 });
      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.node.MediaBox()).toBeInstanceOf(PDFArray);
      expect(page.node.CropBox()).toBeUndefined();
      expect(page.node.BleedBox()).toBeUndefined();
      expect(page.node.TrimBox()).toBeUndefined();
      expect(page.node.ArtBox()).toBeUndefined();
    });

    it("sets the width and height of the the page's CropBox, BleedBox, TrimBox, and ArtBox when they equal the MediaBox", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      page.setMediaBox(5, 5, 20, 50);
      page.setCropBox(5, 5, 20, 50);
      page.setBleedBox(5, 5, 20, 50);
      page.setTrimBox(5, 5, 20, 50);
      page.setArtBox(5, 5, 20, 50);

      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.getCropBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.getTrimBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.getArtBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });

      expect(page.node.MediaBox()).toBeInstanceOf(PDFArray);
      expect(page.node.CropBox()).toBeInstanceOf(PDFArray);
      expect(page.node.BleedBox()).toBeInstanceOf(PDFArray);
      expect(page.node.TrimBox()).toBeInstanceOf(PDFArray);
      expect(page.node.ArtBox()).toBeInstanceOf(PDFArray);

      page.setSize(15, 45);
      expect(page.getSize()).toEqual({ width: 15, height: 45 });
      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.getCropBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.getTrimBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.getArtBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
    });

    it("does not set the width and height of the the page's CropBox, BleedBox, TrimBox, or ArtBox when they do not equal the MediaBox", async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      page.setMediaBox(5, 5, 20, 50);
      page.setCropBox(0, 0, 20, 50);
      page.setBleedBox(5, 5, 10, 25);
      page.setTrimBox(5, 0, 10, 50);
      page.setArtBox(0, 5, 20, 25);

      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 20, height: 50 });
      expect(page.getCropBox()).toEqual({ x: 0, y: 0, width: 20, height: 50 });
      expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 10, height: 25 });
      expect(page.getTrimBox()).toEqual({ x: 5, y: 0, width: 10, height: 50 });
      expect(page.getArtBox()).toEqual({ x: 0, y: 5, width: 20, height: 25 });

      expect(page.node.MediaBox()).toBeInstanceOf(PDFArray);
      expect(page.node.CropBox()).toBeInstanceOf(PDFArray);
      expect(page.node.BleedBox()).toBeInstanceOf(PDFArray);
      expect(page.node.TrimBox()).toBeInstanceOf(PDFArray);
      expect(page.node.ArtBox()).toBeInstanceOf(PDFArray);

      page.setSize(15, 45);
      expect(page.getSize()).toEqual({ width: 15, height: 45 });
      expect(page.getMediaBox()).toEqual({ x: 5, y: 5, width: 15, height: 45 });
      expect(page.getCropBox()).toEqual({ x: 0, y: 0, width: 20, height: 50 });
      expect(page.getBleedBox()).toEqual({ x: 5, y: 5, width: 10, height: 25 });
      expect(page.getTrimBox()).toEqual({ x: 5, y: 0, width: 10, height: 50 });
      expect(page.getArtBox()).toEqual({ x: 0, y: 5, width: 20, height: 25 });
    });
  });

  // https://github.com/Hopding/pdf-lib/issues/1075
  it('drawImage() does not reuse existing XObject keys', async () => {
    const pdfDoc1 = await PDFDocument.create();
    const image1 = await pdfDoc1.embedPng(birdPng);
    const page1 = pdfDoc1.addPage();

    expect(page1.node.normalizedEntries().XObject.keys().length).toEqual(0);
    page1.drawImage(image1);
    expect(page1.node.normalizedEntries().XObject.keys().length).toEqual(1);

    const key1 = page1.node.normalizedEntries().XObject.keys()[0];

    const pdfDoc2 = await PDFDocument.load(await pdfDoc1.save());
    const image2 = await pdfDoc2.embedPng(birdPng);
    const page2 = pdfDoc2.getPage(0);

    expect(page2.node.normalizedEntries().XObject.keys().length).toEqual(1);
    page2.drawImage(image2);
    expect(page2.node.normalizedEntries().XObject.keys().length).toEqual(2);

    const key2 = page2.node.normalizedEntries().XObject.keys()[1];
    expect(key1).not.toEqual(key2);
    expect(page2.node.normalizedEntries().XObject.keys()).toEqual([key1, key2]);
  });

  // https://github.com/Hopding/pdf-lib/issues/1075
  it('setFont() does not reuse existing Font keys', async () => {
    const pdfDoc1 = await PDFDocument.create();
    const font1 = await pdfDoc1.embedFont(StandardFonts.Helvetica);
    const page1 = pdfDoc1.addPage();

    expect(page1.node.normalizedEntries().Font.keys().length).toEqual(0);
    page1.setFont(font1);
    expect(page1.node.normalizedEntries().Font.keys().length).toEqual(1);

    const key1 = page1.node.normalizedEntries().Font.keys()[0];

    const pdfDoc2 = await PDFDocument.load(await pdfDoc1.save());
    const font2 = await pdfDoc2.embedFont(StandardFonts.Helvetica);
    const page2 = pdfDoc2.getPage(0);

    expect(page2.node.normalizedEntries().Font.keys().length).toEqual(1);
    page2.setFont(font2);
    expect(page2.node.normalizedEntries().Font.keys().length).toEqual(2);

    const key2 = page2.node.normalizedEntries().Font.keys()[1];
    expect(key1).not.toEqual(key2);
    expect(page2.node.normalizedEntries().Font.keys()).toEqual([key1, key2]);
  });

  describe('getJavaScriptActions() method', () => {
    it('returns undefined when page has no JavaScript actions', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      const actions = page.getJavaScriptActions();
      expect(actions).toBeUndefined();
    });

    it('can extract page open action', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const context = pdfDoc.context;

      // Manually add AA dictionary with page open action
      const aaDict = context.obj({
        O: context.obj({
          S: 'JavaScript',
          JS: 'console.println("Page opened");',
        }),
      });
      page.node.set(PDFName.of('AA'), aaDict);

      const actions = page.getJavaScriptActions();

      expect(actions).toBeDefined();
      expect(actions?.pageOpen).toBeDefined();
      expect(actions?.pageOpen?.getScript()).toBe(
        'console.println("Page opened");',
      );
    });

    it('can extract page close action', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const context = pdfDoc.context;

      // Manually add AA dictionary with page close action
      const aaDict = context.obj({
        C: context.obj({
          S: 'JavaScript',
          JS: 'console.println("Page closed");',
        }),
      });
      page.node.set(PDFName.of('AA'), aaDict);

      const actions = page.getJavaScriptActions();

      expect(actions).toBeDefined();
      expect(actions?.pageClose).toBeDefined();
      expect(actions?.pageClose?.getScript()).toBe(
        'console.println("Page closed");',
      );
    });

    it('can extract multiple page actions', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const context = pdfDoc.context;

      const aaDict = context.obj({
        O: context.obj({
          S: 'JavaScript',
          JS: 'console.println("Opened");',
        }),
        C: context.obj({
          S: 'JavaScript',
          JS: 'console.println("Closed");',
        }),
      });
      page.node.set(PDFName.of('AA'), aaDict);

      const actions = page.getJavaScriptActions();

      expect(actions?.pageOpen?.getScript()).toBe('console.println("Opened");');
      expect(actions?.pageClose?.getScript()).toBe(
        'console.println("Closed");',
      );
    });

    it('handles AA as indirect reference', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const context = pdfDoc.context;

      const aaDict = context.obj({
        O: context.obj({
          S: 'JavaScript',
          JS: 'console.println("Test");',
        }),
      });
      const aaRef = context.register(aaDict);
      page.node.set(PDFName.of('AA'), aaRef);

      const actions = page.getJavaScriptActions();

      expect(actions?.pageOpen?.getScript()).toBe('console.println("Test");');
    });
  });

  describe('getSeparationColor() method', () => {
    const embedPantone = (pdfDoc: PDFDocument) =>
      pdfDoc.embedSeparation('PANTONE 123 C', cmyk(0, 0.22, 0.83, 0));

    it('returns a separation color with the given tint', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const color = page.getSeparationColor(embedPantone(pdfDoc), 0.5);
      expect(color.type).toBe(ColorTypes.Separation);
      expect((color as Separation).tint).toBe(0.5);
    });

    it('rejects a tint outside of [0, 1]', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const pdfSeparation = embedPantone(pdfDoc);
      expect(() => page.getSeparationColor(pdfSeparation, -0.1)).toThrow();
      expect(() => page.getSeparationColor(pdfSeparation, 1.1)).toThrow();
    });

    it('adds the separation color space to the page resources', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const pdfSeparation = embedPantone(pdfDoc);
      const color = page.getSeparationColor(pdfSeparation, 0.5) as Separation;
      const colorSpaces = colorSpacesOf(page);
      expect(colorSpaces.keys()).toEqual([color.name]);
      expect(colorSpaces.get(color.name)).toBe(pdfSeparation.ref);
    });

    it('does not add the same separation color space twice', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const pdfSeparation = embedPantone(pdfDoc);
      const color1 = page.getSeparationColor(pdfSeparation, 0.5) as Separation;
      const color2 = page.getSeparationColor(pdfSeparation, 1) as Separation;
      expect(color2.name).toBe(color1.name);
      expect(colorSpacesOf(page).keys()).toEqual([color1.name]);
    });

    it('selects the color space before setting the tint when filling', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = pdfDoc.embedStandardFont(StandardFonts.Helvetica);
      const color = page.getSeparationColor(
        embedPantone(pdfDoc),
        0.5,
      ) as Separation;

      page.drawText('spot', { font, color });
      page.drawRectangle({ width: 10, height: 10, color });

      const contents = contentsOf(page);
      expect(contents).toContain(`BT\n${color.name} cs\n0.5 scn\n`);
      expect(
        contents.match(new RegExp(`${color.name} cs\n0.5 scn\n`, 'g')),
      ).toHaveLength(2);
    });

    it('selects the color space before setting the tint when stroking', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const color = page.getSeparationColor(
        embedPantone(pdfDoc),
        0.25,
      ) as Separation;

      page.drawLine({ start: { x: 0, y: 0 }, end: { x: 10, y: 10 }, color });
      page.drawRectangle({
        width: 10,
        height: 10,
        borderColor: color,
        borderWidth: 1,
      });

      const contents = contentsOf(page);
      expect(
        contents.match(new RegExp(`${color.name} CS\n0.25 SCN\n`, 'g')),
      ).toHaveLength(2);
    });

    it('embeds the separation color space when the document is saved', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const pdfSeparation = embedPantone(pdfDoc);
      page.getSeparationColor(pdfSeparation, 1);

      const savedDoc = await PDFDocument.load(await pdfDoc.save());
      const savedPage = savedDoc.getPage(0);
      const [[, colorSpaceRef]] = colorSpacesOf(savedPage).entries();
      const colorSpace = savedDoc.context.lookup(colorSpaceRef, PDFArray);
      expect(colorSpace.get(0)).toBe(PDFName.of('Separation'));
      expect(colorSpace.get(1)).toBe(PDFName.of('PANTONE 123 C'));
    });
  });
});
