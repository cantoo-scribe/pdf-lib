import PDFContext from '../PDFContext';
import PDFPageLeaf from '../structures/PDFPageLeaf';
import PDFAnnotation from './PDFAnnotation';
import PDFName from '../objects/PDFName';
import PDFNumber from '../objects/PDFNumber';
import { MarkupAnnotationOptions } from './PDFAnnotationOption';

export default class PDFMarkupAnnotation extends PDFAnnotation {
  static create(
    context: PDFContext,
    page: PDFPageLeaf,
    options: MarkupAnnotationOptions,
  ): PDFMarkupAnnotation {
    // Create the base annotation using PDFAnnotation.create()
    const baseAnnotation = PDFAnnotation.createBase(context, page, options);

    // Create a new PDFMarkupAnnotation with the same dictionary
    const markupAnnotation = new PDFMarkupAnnotation(baseAnnotation.dict);

    const quadPointsArray = context.obj(
      options.quadPoints.map((point) => PDFNumber.of(point)),
    );
    markupAnnotation.dict.set(PDFName.of('QuadPoints'), quadPointsArray);

    return markupAnnotation;
  }
}
