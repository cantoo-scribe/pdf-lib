import PDFContext from '../PDFContext';
import PDFPageLeaf from '../structures/PDFPageLeaf';
import PDFAnnotation from './PDFAnnotation';
import PDFName from '../objects/PDFName';
import PDFNumber from '../objects/PDFNumber';
import PDFArray from '../objects/PDFArray';
import PDFDict from '../objects/PDFDict';
import { PDFPageAddTextMarkupAnnotationOptions } from '../../api/PDFPageOptions';

export default class PDFTextMarkupAnnotation extends PDFAnnotation {
  static fromDict = (dict: PDFDict): PDFTextMarkupAnnotation =>
    new PDFTextMarkupAnnotation(dict);

  static create(
    context: PDFContext,
    page: PDFPageLeaf,
    options: PDFPageAddTextMarkupAnnotationOptions,
  ): PDFTextMarkupAnnotation {
    // Create the base annotation using PDFAnnotation.create()
    const baseAnnotation = PDFAnnotation.createBase(context, page, options);

    // Create a new PDFMarkupAnnotation with the same dictionary
    const textmarkupAnnotation = new PDFTextMarkupAnnotation(
      baseAnnotation.dict,
    );

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
    textmarkupAnnotation.dict.set(PDFName.of('QuadPoints'), quadPointsArray);

    return textmarkupAnnotation;
  }

  QuadPoints(): PDFNumber[] | undefined {
    const quadPoints = this.dict.lookup(PDFName.of('QuadPoints'));
    if (quadPoints instanceof PDFArray) {
      const numbers: PDFNumber[] = [];
      for (let idx = 0, len = quadPoints.size(); idx < len; idx++) {
        const num = quadPoints.lookup(idx);
        if (num instanceof PDFNumber) {
          numbers.push(num);
        } else {
          return undefined;
        }
      }
      return numbers;
    }
    return undefined;
  }
}
