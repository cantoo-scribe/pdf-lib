import Embeddable from './Embeddable';
import PDFDocument from './PDFDocument';
import { PDFRef } from '../core';
import SeparationEmbedder from '../core/embedders/SeparationEmbedder';
import { assertIs } from '../utils';

export default class PDFSeparation implements Embeddable {
  static of = (ref: PDFRef, doc: PDFDocument, embedder: SeparationEmbedder) =>
    new PDFSeparation(ref, doc, embedder);

  readonly name: string;
  private alreadyEmbedded = false;

  private constructor(
    readonly ref: PDFRef,
    readonly doc: PDFDocument,
    private readonly embedder: SeparationEmbedder,
  ) {
    assertIs(ref, 'ref', [[PDFRef, 'PDFRef']]);
    assertIs(doc, 'doc', [[PDFDocument, 'PDFDocument']]);
    assertIs(embedder, 'embedder', [
      [SeparationEmbedder, 'SeparationEmbedder'],
    ]);
    this.name = embedder.separationName;
  }

  async embed(): Promise<void> {
    if (this.alreadyEmbedded) return;
    this.alreadyEmbedded = true;
    this.embedder.embedIntoContext(this.doc.context, this.ref);
  }
}
