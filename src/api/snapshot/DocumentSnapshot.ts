import type { PDFObject, PDFRef } from '../../core';

export interface DocumentSnapshot {
  pdfSize: number;
  prevStartXRef: number;
  deletedCount: number;

  shouldSave: (objectNumber: number) => boolean;

  markRefForSave: (ref: PDFRef) => void;
  markRefsForSave: (refs: PDFRef[]) => void;

  markObjForSave: (obj: PDFObject) => void;
  markObjsForSave: (objs: PDFObject[]) => void;

  markDeletedRef: (ref: PDFRef) => void;
  markDeletedObj: (obj: PDFObject) => void;

  deletedRef: (index: number) => PDFRef | null;
}
