import PDFDict from '../objects/PDFDict';
import PDFName from '../objects/PDFName';
import PDFAnnotation from './PDFAnnotation';
import PDFTextMarkupAnnotation from './PDFTextMarkupAnnotation';
import { AnnotationTypes } from './AnnotationTypes';

export default class AnnotationFactory {
  static fromDict = (dict: PDFDict): PDFAnnotation => {
    switch (this.getSubtype(dict)) {
      case AnnotationTypes.Highlight:
      case AnnotationTypes.Underline:
      case AnnotationTypes.Squiggly:
      case AnnotationTypes.StrikeOut:
        return PDFTextMarkupAnnotation.fromDict(dict);
      default:
        return PDFAnnotation.fromDict(dict);
    }
  };

  private static getSubtype(dict: PDFDict): AnnotationTypes | undefined {
    const subtypePdfName = dict.get(PDFName.of('Subtype'));
    if (subtypePdfName instanceof PDFName) {
      return subtypePdfName.toString() as AnnotationTypes;
    } else {
      return undefined;
    }
  }
}
