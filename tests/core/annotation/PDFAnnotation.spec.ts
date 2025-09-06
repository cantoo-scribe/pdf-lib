import fs from 'fs';
import {
  PDFDocument,
  PDFAnnotation,
  AnnotationTypes,
  PDFNumber,
  PDFName,
  PDFTextMarkupAnnotation,
} from '../../../src/index';

const simplePdf = fs.readFileSync('tests/core/data/simple.pdf');

describe('PDFAnnotation', () => {
  describe('readAnnotations() method', () => {
    it('properly reads highlight annotation objects from simple.pdf', async () => {
      // Load simple.pdf which contains a highlight annotation
      const pdfDoc = await PDFDocument.load(new Uint8Array(simplePdf));
      const page = pdfDoc.getPage(0);

      // Check that annotations were read correctly
      const annotations = page.annotations();
      expect(annotations).toBeDefined();
      expect(annotations.length).toBe(1);

      // Verify the annotation properties
      const annotation = annotations[0] as PDFTextMarkupAnnotation;
      expect(annotation).toBeInstanceOf(PDFAnnotation);
      expect(annotation).toBeInstanceOf(PDFTextMarkupAnnotation);

      // Check annotation type
      const subtype = annotation.getSubtype();
      expect(subtype).toBeDefined();
      expect(subtype).toBe(AnnotationTypes.Highlight);

      // Check annotation rectangle [100 100 200 124]
      const rect = annotation.Rect();
      expect(rect).toBeDefined();
      expect(rect?.size()).toBe(4);
      expect((rect?.lookup(0) as PDFNumber)?.asNumber()).toBe(100);
      expect((rect?.lookup(1) as PDFNumber)?.asNumber()).toBe(100);
      expect((rect?.lookup(2) as PDFNumber)?.asNumber()).toBe(200);
      expect((rect?.lookup(3) as PDFNumber)?.asNumber()).toBe(124);

      // Check annotation contents
      const contents = annotation.Contents();
      expect(contents).toBeDefined();
      expect(contents?.asString()).toBe('Highlight: Hello');

      // Check page reference
      const pageRef = annotation.getParentPage();
      expect(pageRef).toBeDefined();

      // Check color array [1 1 0] (yellow)
      const color = annotation.dict.lookup(PDFName.of('C'));
      expect(color).toBeDefined();

      // Check title/author
      const title = annotation.dict.lookup(PDFName.of('T'));
      expect(title).toBeDefined();

      // Check flags
      const flags = annotation.dict.lookup(PDFName.of('F'));
      expect(flags).toBeDefined();

      // Check quadpoints
      const quadPoints = annotation.QuadPoints();
      expect(quadPoints).toBeDefined();
      expect(quadPoints?.length).toBe(8);
      expect((quadPoints?.at(0) as PDFNumber)?.asNumber()).toBeDefined();
    });

    it('returns empty array when page has no annotations', async () => {
      // Create a new document with no annotations
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      // Check that annotations array is empty
      expect(page.annotations).toBeDefined();
      expect(page.annotations.length).toBe(0);
    });
  });
});
