export interface DocumentSnapshot {
  pdfSize: number;
  prevStartXRef: number;

  shouldSave: (objectNumber: number) => boolean;
}
