import PDFDict from '../objects/PDFDict';
import PDFName from '../objects/PDFName';
import PDFStream from '../objects/PDFStream';
import PDFArray from '../objects/PDFArray';
import PDFRef from '../objects/PDFRef';
import PDFNumber from '../objects/PDFNumber';
import { AnnotationTypes } from './AnnotationTypes';
import PDFString from '../objects/PDFString';

class PDFAnnotation {
  readonly dict: PDFDict;

  static fromDict = (dict: PDFDict): PDFAnnotation => new PDFAnnotation(dict);

  protected constructor(dict: PDFDict) {
    this.dict = dict;
  }

  // entries common to all annotation dictionaries (See table 164)

  /**
   * annotation subtype
   * @returns The subtype as a PDFName or undefined if none.
   */
  Subtype(): PDFName | undefined {
    return this.dict.lookup(PDFName.of('Subtype'), PDFName);
  }

  /**
   * location of annotation on page
   * @returns The rectangle as a PDFArray or undefined if none.
   */
  Rect(): PDFArray | undefined {
    return this.dict.lookup(PDFName.of('Rect'), PDFArray);
  }

  /**
   * text to be displayed for the annotation.
   * @returns The text as a PDFString or undefined if none content)
   */
  Contents(): PDFString | undefined {
    return this.dict.lookup(PDFName.of('Contents'), PDFString);
  }

  /**
   * Indirect reference to the page object with which this annotation is associated.
   * @returns The page object as a PDFRef or undefined if none.
   */
  P(): PDFRef | undefined {
    return this.dict.lookup(PDFName.of('P'), PDFRef);
  }

  /**
   * Name of the annotation, typically an identifier.
   * @returns The name as a PDFString or undefined if none.
   */
  NM(): PDFString | undefined {
    return this.dict.lookup(PDFName.of('NM'), PDFString);
  }

  /**
   * Date and time when the annotation was created.
   * @returns The date as a PDFString or undefined if none.
   */
  M(): PDFString | undefined {
    return this.dict.lookup(PDFName.of('M'), PDFString);
  }

  /**
   * A set of flags specifying various characteristics of the annotation.
   * @returns The flags as a PDFNumber or undefined if none.
   */
  F(): PDFNumber | undefined {
    const numberOrRef = this.dict.lookup(PDFName.of('F'));
    return this.dict.context.lookupMaybe(numberOrRef, PDFNumber);
  }

  /**
   * appearance dictionary
   * @returns The appearance dictionary as a PDFDict or undefined if none.
   */
  AP(): PDFDict | undefined {
    return this.dict.lookupMaybe(PDFName.of('AP'), PDFDict);
  }

  /**
   * Annotation's appearance state
   * @returns The appearance state as a PDFName or undefined if none.
   */
  AS(): PDFName | undefined {
    return this.dict.lookupMaybe(PDFName.of('AS'), PDFName);
  }

  /**
   * Array specifying annotation's border characteristics
   * @returns The border characteristics as a PDFArray or undefined if none.
   */
  Boader(): PDFArray | undefined {
    return this.dict.lookup(PDFName.of('Boader'), PDFArray);
  }

  /**
   * The annotation's color
   * @returns The color as a PDFArray or undefined if none.
   */
  C(): PDFArray | undefined {
    return this.dict.lookup(PDFName.of('C'), PDFArray);
  }

  /**
   * Integer key of annotation's entry in structural parent tree
   * @returns
   */
  StructParent(): PDFNumber | undefined {
    return this.dict.lookup(PDFName.of('StructParent'), PDFNumber);
  }

  /**
   * Optional content group or optional content membership dictionary
   * @returns The optional content group as a PDFDict or undefined if none.
   */
  OC(): PDFDict | undefined {
    return this.dict.lookup(PDFName.of('OC'), PDFDict);
  }

  /**
   * Get the subtype enum.
   * This gives `undefined` if the subtype not written in the PDF.
   * @returns The subtype as AnnotationTypes or undefined
   */
  getSubtype(): AnnotationTypes | undefined {
    const subtypePdfName = this.Subtype();
    if (subtypePdfName instanceof PDFName)
      return subtypePdfName.toString() as AnnotationTypes;
    return undefined;
  }

  getRectangle(): { x: number; y: number; width: number; height: number } {
    const Rect = this.Rect();
    return Rect?.asRectangle() ?? { x: 0, y: 0, width: 0, height: 0 };
  }

  setRectangle(rect: { x: number; y: number; width: number; height: number }) {
    const { x, y, width, height } = rect;
    const Rect = this.dict.context.obj([x, y, x + width, y + height]);
    this.dict.set(PDFName.of('Rect'), Rect);
  }

  getAppearanceState(): PDFName | undefined {
    const AS = this.dict.lookup(PDFName.of('AS'));
    if (AS instanceof PDFName) return AS;
    return undefined;
  }

  setAppearanceState(state: PDFName) {
    this.dict.set(PDFName.of('AS'), state);
  }

  setAppearances(appearances: PDFDict) {
    this.dict.set(PDFName.of('AP'), appearances);
  }

  ensureAP(): PDFDict {
    let AP = this.AP();
    if (!AP) {
      AP = this.dict.context.obj({});
      this.dict.set(PDFName.of('AP'), AP);
    }
    return AP;
  }

  getNormalAppearance(): PDFRef | PDFDict {
    const AP = this.ensureAP();
    const N = AP.get(PDFName.of('N'));
    if (N instanceof PDFRef || N instanceof PDFDict) return N;

    throw new Error(`Unexpected N type: ${N?.constructor.name}`);
  }

  /** @param appearance A PDFDict or PDFStream (direct or ref) */
  setNormalAppearance(appearance: PDFRef | PDFDict) {
    const AP = this.ensureAP();
    AP.set(PDFName.of('N'), appearance);
  }

  /** @param appearance A PDFDict or PDFStream (direct or ref) */
  setRolloverAppearance(appearance: PDFRef | PDFDict) {
    const AP = this.ensureAP();
    AP.set(PDFName.of('R'), appearance);
  }

  /** @param appearance A PDFDict or PDFStream (direct or ref) */
  setDownAppearance(appearance: PDFRef | PDFDict) {
    const AP = this.ensureAP();
    AP.set(PDFName.of('D'), appearance);
  }

  removeRolloverAppearance() {
    const AP = this.AP();
    AP?.delete(PDFName.of('R'));
  }

  removeDownAppearance() {
    const AP = this.AP();
    AP?.delete(PDFName.of('D'));
  }

  getAppearances():
    | {
        normal: PDFStream | PDFDict;
        rollover?: PDFStream | PDFDict;
        down?: PDFStream | PDFDict;
      }
    | undefined {
    const AP = this.AP();

    if (!AP) return undefined;

    const N = AP.lookup(PDFName.of('N'), PDFDict, PDFStream);
    const R = AP.lookupMaybe(PDFName.of('R'), PDFDict, PDFStream);
    const D = AP.lookupMaybe(PDFName.of('D'), PDFDict, PDFStream);

    return { normal: N, rollover: R, down: D };
  }

  getFlags(): number {
    return this.F()?.asNumber() ?? 0;
  }

  setFlags(flags: number) {
    this.dict.set(PDFName.of('F'), PDFNumber.of(flags));
  }

  hasFlag(flag: number): boolean {
    const flags = this.getFlags();
    return (flags & flag) !== 0;
  }

  setFlag(flag: number) {
    const flags = this.getFlags();
    this.setFlags(flags | flag);
  }

  clearFlag(flag: number) {
    const flags = this.getFlags();
    this.setFlags(flags & ~flag);
  }

  setFlagTo(flag: number, enable: boolean) {
    if (enable) this.setFlag(flag);
    else this.clearFlag(flag);
  }
}

export default PDFAnnotation;
