import {
  PDFDocument,
  PDFSeparation,
  SeparationEmbedder,
} from '../../src/index';

const createEmbedder = () =>
  SeparationEmbedder.for('PANTONE 123 C', 'DeviceCMYK', [0, 0.22, 0.83, 0]);

describe('PDFSeparation', () => {
  it('gets its name from the embedder', async () => {
    const pdfDoc = await PDFDocument.create();
    const ref = pdfDoc.context.nextRef();
    const pdfSeparation = PDFSeparation.of(ref, pdfDoc, createEmbedder());
    expect(pdfSeparation.name).toBe('PANTONE 123 C');
  });

  it('may be embedded multiple times without causing an error', async () => {
    const pdfDoc = await PDFDocument.create();
    const ref = pdfDoc.context.nextRef();
    const pdfSeparation = PDFSeparation.of(ref, pdfDoc, createEmbedder());

    await expect(pdfSeparation.embed()).resolves.not.toThrowError();
    await expect(pdfSeparation.embed()).resolves.not.toThrowError();
  });

  it('is embedded only once when embed() is called in parallel', async () => {
    const pdfDoc = await PDFDocument.create();
    const embedder = createEmbedder();
    jest.spyOn(embedder, 'embedIntoContext');
    const ref = pdfDoc.context.nextRef();
    const pdfSeparation = PDFSeparation.of(ref, pdfDoc, embedder);

    await Promise.all([pdfSeparation.embed(), pdfSeparation.embed()]);

    expect(embedder.embedIntoContext).toHaveBeenCalledTimes(1);
  });
});
