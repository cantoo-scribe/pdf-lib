import PDFContext from '../PDFContext';
import PDFPageLeaf from '../structures/PDFPageLeaf';
import PDFAnnotation from './PDFAnnotation';
import PDFName from '../objects/PDFName';
import PDFNumber from '../objects/PDFNumber';
import { PDFPageAddTextMarkupAnnotationOptions } from '../../api/PDFPageOptions';

export default class PDFTextMarkupAnnotation extends PDFAnnotation {
  static create(
    context: PDFContext,
    page: PDFPageLeaf,
    options: PDFPageAddTextMarkupAnnotationOptions,
  ): PDFTextMarkupAnnotation {
    // Create the base annotation using PDFAnnotation.create()
    const baseAnnotation = PDFAnnotation.createBase(context, page, options);

    // Create a new PDFMarkupAnnotation with the same dictionary
    const markupAnnotation = new PDFTextMarkupAnnotation(baseAnnotation.dict);

    const quadPointsArray = context.obj(
      [
        options.quadPoints.leftbottomX,
        options.quadPoints.leftbottomY,
        options.quadPoints.rightbottomX,
        options.quadPoints.rightbottomY,
        options.quadPoints.lefttopX,
        options.quadPoints.lefttopY,
        options.quadPoints.righttopX,
        options.quadPoints.righttopY,
      ].map((point) => PDFNumber.of(point)),
    );
    markupAnnotation.dict.set(PDFName.of('QuadPoints'), quadPointsArray);

    return markupAnnotation;
  }
}
