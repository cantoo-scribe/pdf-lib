import { DocumentSnapshot } from './DocumentSnapshot';

export class DefaultDocumentSnapshot implements DocumentSnapshot {
  pdfSize = 0;
  prevStartXRef = 0;

  shouldSave(_objectNumber: number): boolean {
    return true;
  }
}

export const defaultDocumentSnapshot = new DefaultDocumentSnapshot();
