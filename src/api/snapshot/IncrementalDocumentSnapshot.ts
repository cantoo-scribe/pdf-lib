import { DocumentSnapshot } from './DocumentSnapshot';

export class IncrementalDocumentSnapshot implements DocumentSnapshot {
  pdfSize: number;
  prevStartXRef: number;

  private lastObjectNumber: number;
  private indirectObjects: number[];

  constructor(
    lastObjectNumber: number,
    indirectObjects: number[],
    pdfSize: number,
    prevStartXRef: number,
  ) {
    this.lastObjectNumber = lastObjectNumber;
    this.indirectObjects = indirectObjects;
    this.pdfSize = pdfSize;
    this.prevStartXRef = prevStartXRef;
  }

  shouldSave(objectNumber: number): boolean {
    if (objectNumber > this.lastObjectNumber) {
      return true;
    }
    if (this.indirectObjects.includes(objectNumber)) {
      return true;
    }

    return false;
  }
}
