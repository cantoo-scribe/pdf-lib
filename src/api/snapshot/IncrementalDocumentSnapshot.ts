import type { PDFContext, PDFObject, PDFRef } from '../../core';
import { DocumentSnapshot } from './DocumentSnapshot';

export class IncrementalDocumentSnapshot implements DocumentSnapshot {
  pdfSize: number;
  prevStartXRef: number;

  private lastObjectNumber: number;
  private changedObjects: number[];

  context: PDFContext;

  constructor(
    lastObjectNumber: number,
    indirectObjects: number[],
    pdfSize: number,
    prevStartXRef: number,
    context: PDFContext,
  ) {
    this.lastObjectNumber = lastObjectNumber;
    this.changedObjects = indirectObjects;
    this.pdfSize = pdfSize;
    this.prevStartXRef = prevStartXRef;
    this.context = context;
  }

  shouldSave(objectNumber: number): boolean {
    if (objectNumber > this.lastObjectNumber) {
      return true;
    }
    if (this.changedObjects.includes(objectNumber)) {
      return true;
    }

    return false;
  }

  markRefForSave(ref: PDFRef): void {
    this.markRefsForSave([ref]);
  }

  markRefsForSave(refs: PDFRef[]): void {
    refs.forEach((ref) => {
      if (ref) this.changedObjects.push(ref.objectNumber);
    });
  }

  markObjForSave(obj: PDFObject): void {
    this.markObjsForSave([obj]);
  }

  markObjsForSave(objs: PDFObject[]): void {
    this.markRefsForSave(
      objs
        .map((obj) => this.context.getRef(obj))
        .filter((ref) => ref !== undefined) as PDFRef[],
    );
  }
}
