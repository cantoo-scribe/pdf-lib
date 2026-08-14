import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFString,
} from '../../src/index';

const installOptionalContent = (
  pdfDoc: PDFDocument,
  layers: { name: string; visible?: boolean }[],
  options: { baseState?: 'ON' | 'OFF'; omitOnOff?: boolean } = {},
) => {
  const { context, catalog } = pdfDoc;
  const ocgRefs: PDFRef[] = [];

  for (const layer of layers) {
    const ocgDict = context.obj({
      Type: 'OCG',
      Name: PDFString.of(layer.name),
    });
    ocgRefs.push(context.register(ocgDict));
  }

  const dDict = context.obj({}) as PDFDict;
  if (options.baseState) {
    dDict.set(PDFName.of('BaseState'), PDFName.of(options.baseState));
  }

  if (!options.omitOnOff) {
    const onArray = context.obj([]) as PDFArray;
    const offArray = context.obj([]) as PDFArray;
    layers.forEach((layer, idx) => {
      const visible = layer.visible ?? true;
      if (visible) onArray.push(ocgRefs[idx]);
      else offArray.push(ocgRefs[idx]);
    });
    dDict.set(PDFName.of('ON'), onArray);
    dDict.set(PDFName.of('OFF'), offArray);
  }

  const ocgs = context.obj([]) as PDFArray;
  ocgRefs.forEach((ref) => ocgs.push(ref));

  const ocProperties = context.obj({
    OCGs: ocgs,
    D: dDict,
  });
  catalog.set(PDFName.of('OCProperties'), ocProperties);

  return ocgRefs;
};

describe('PDFDocument optional content groups', () => {
  it('returns an empty list when the document has no OCProperties', async () => {
    const pdfDoc = await PDFDocument.create();
    expect(pdfDoc.getOptionalContentGroups()).toEqual([]);
  });

  it('lists layers with decoded names and default visibility', async () => {
    const pdfDoc = await PDFDocument.create();
    const [notesRef, watermarkRef] = installOptionalContent(pdfDoc, [
      { name: 'Notes', visible: true },
      { name: 'Watermark', visible: false },
    ]);

    expect(pdfDoc.getOptionalContentGroups()).toEqual([
      { name: 'Notes', visible: true, ref: notesRef },
      { name: 'Watermark', visible: false, ref: watermarkRef },
    ]);
  });

  it('respects BaseState when a layer is not listed in ON/OFF', async () => {
    const pdfDoc = await PDFDocument.create();
    const [hiddenByDefault] = installOptionalContent(
      pdfDoc,
      [{ name: 'Details' }],
      { baseState: 'OFF', omitOnOff: true },
    );

    expect(pdfDoc.getOptionalContentGroups()).toEqual([
      { name: 'Details', visible: false, ref: hiddenByDefault },
    ]);
  });

  it('decodes hex-string layer names', async () => {
    const pdfDoc = await PDFDocument.create();
    const { context, catalog } = pdfDoc;
    const ocgRef = context.register(
      context.obj({
        Type: 'OCG',
        Name: PDFHexString.fromText('Café'),
      }),
    );
    const onArray = context.obj([ocgRef]);
    catalog.set(
      PDFName.of('OCProperties'),
      context.obj({
        OCGs: [ocgRef],
        D: { ON: onArray, OFF: [] },
      }),
    );

    expect(pdfDoc.getOptionalContentGroups()[0].name).toBe('Café');
  });

  it('toggles visibility by name and persists after save/load', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    installOptionalContent(pdfDoc, [
      { name: 'Notes', visible: true },
      { name: 'Watermark', visible: true },
    ]);

    pdfDoc.setOptionalContentGroupVisibility('Watermark', false);

    expect(
      pdfDoc.getOptionalContentGroups().map(({ name, visible }) => ({
        name,
        visible,
      })),
    ).toEqual([
      { name: 'Notes', visible: true },
      { name: 'Watermark', visible: false },
    ]);

    const bytes = await pdfDoc.save();
    const reloaded = await PDFDocument.load(bytes);
    expect(
      reloaded.getOptionalContentGroups().map(({ name, visible }) => ({
        name,
        visible,
      })),
    ).toEqual([
      { name: 'Notes', visible: true },
      { name: 'Watermark', visible: false },
    ]);
  });

  it('supports batch updates by name and ref', async () => {
    const pdfDoc = await PDFDocument.create();
    const [notesRef, watermarkRef, guidesRef] = installOptionalContent(pdfDoc, [
      { name: 'Notes', visible: true },
      { name: 'Watermark', visible: true },
      { name: 'Guides', visible: true },
    ]);

    pdfDoc.setOptionalContentGroupVisibility([
      { name: 'Watermark', visible: false },
      { ref: guidesRef, visible: false },
    ]);

    expect(pdfDoc.getOptionalContentGroups()).toEqual([
      { name: 'Notes', visible: true, ref: notesRef },
      { name: 'Watermark', visible: false, ref: watermarkRef },
      { name: 'Guides', visible: false, ref: guidesRef },
    ]);
  });

  it('throws when toggling layers on a document without OCProperties', async () => {
    const pdfDoc = await PDFDocument.create();
    expect(() =>
      pdfDoc.setOptionalContentGroupVisibility('Nope', false),
    ).toThrow('This document has no optional content properties');
  });

  it('throws when no matching layer is found', async () => {
    const pdfDoc = await PDFDocument.create();
    installOptionalContent(pdfDoc, [{ name: 'Notes', visible: true }]);
    expect(() =>
      pdfDoc.setOptionalContentGroupVisibility('Missing', false),
    ).toThrow('No matching optional content group found');
  });
});
