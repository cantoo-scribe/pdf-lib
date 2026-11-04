import {
  PDFArray,
  PDFContext,
  PDFName,
  PDFRef,
  SeparationEmbedder,
} from '../../../src/index';

describe('SeparationEmbedder', () => {
  it('can be constructed with SeparationEmbedder.for(...)', () => {
    const embedder = SeparationEmbedder.for(
      'PANTONE 123 C',
      'DeviceCMYK',
      [0, 0.22, 0.83, 0],
    );
    expect(embedder).toBeInstanceOf(SeparationEmbedder);
    expect(embedder.separationName).toBe('PANTONE 123 C');
  });

  it('can embed separations into PDFContexts without a predefined ref', () => {
    const context = PDFContext.create();
    const embedder = SeparationEmbedder.for(
      'PANTONE 123 C',
      'DeviceCMYK',
      [0, 0.22, 0.83, 0],
    );

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = embedder.embedIntoContext(context);
    expect(context.enumerateIndirectObjects().length).toBe(1);
    expect(context.lookup(ref)).toBeInstanceOf(PDFArray);
  });

  it('can embed separations into PDFContexts with a predefined ref', () => {
    const context = PDFContext.create();
    const predefinedRef = PDFRef.of(9999);
    const embedder = SeparationEmbedder.for(
      'PANTONE 123 C',
      'DeviceCMYK',
      [0, 0.22, 0.83, 0],
    );

    expect(context.enumerateIndirectObjects().length).toBe(0);
    const ref = embedder.embedIntoContext(context, predefinedRef);
    expect(context.enumerateIndirectObjects().length).toBe(1);
    expect(context.lookup(predefinedRef)).toBeInstanceOf(PDFArray);
    expect(ref).toBe(predefinedRef);
  });

  it('embeds a Separation color space with a type 2 tint transform', () => {
    const context = PDFContext.create();
    const embedder = SeparationEmbedder.for(
      'PANTONE 123 C',
      'DeviceCMYK',
      [0, 0.22, 0.83, 0],
    );

    const ref = embedder.embedIntoContext(context);
    const colorSpace = context.lookup(ref, PDFArray);

    expect(colorSpace.size()).toBe(4);
    expect(colorSpace.get(0)).toBe(PDFName.of('Separation'));
    expect(colorSpace.get(1)).toBe(PDFName.of('PANTONE 123 C'));
    expect(colorSpace.get(2)).toBe(PDFName.of('DeviceCMYK'));
    expect(colorSpace.get(3).toString()).toBe(
      '<<\n/FunctionType 2\n/Domain [ 0 1 ]\n/C0 [ 0 0 0 0 ]\n/C1 [ 0 0.22 0.83 0 ]\n/N 1\n>>',
    );
  });
});
