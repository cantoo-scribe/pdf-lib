import { PDFObject, PDFRef } from '../../core';
import { DocumentSnapshot } from './DocumentSnapshot';

export class DefaultDocumentSnapshot implements DocumentSnapshot {
  pdfSize = 0;
  prevStartXRef = 0;

  shouldSave(_objectNumber: number): boolean {
    return true;
  }

  markRefForSave(_ref: PDFRef): void {
    throw new Error('This method should not be called.');
  }

  markRefsForSave(_refs: PDFRef[]): void {
    throw new Error('This method should not be called.');
  }

  markObjForSave(_obj: PDFObject): void {
    throw new Error('This method should not be called.');
  }

  markObjsForSave(_objs: PDFObject[]): void {
    throw new Error('This method should not be called.');
  }
}

export const defaultDocumentSnapshot = new DefaultDocumentSnapshot();
