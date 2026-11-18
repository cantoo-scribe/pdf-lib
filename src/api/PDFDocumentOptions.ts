import { EmbeddedFileOptions } from '../core/embedders/FileEmbedder';
import { TypeFeatures } from '../types/fontkit';

export enum ParseSpeeds {
  Fastest = Infinity,
  Fast = 1500,
  Medium = 500,
  Slow = 100,
}

export interface AttachmentOptions extends EmbeddedFileOptions {}

export interface SaveOptions {
  useObjectStreams?: boolean;
  addDefaultPage?: boolean;
  objectsPerTick?: number;
  updateFieldAppearances?: boolean;
  rewrite?: boolean;
}

export interface IncrementalSaveOptions {
  objectsPerTick?: number;
  useObjectStreams?: boolean;
}

export interface Base64SaveOptions extends SaveOptions {
  dataUri?: boolean;
}

export interface LoadOptions {
  ignoreEncryption?: boolean;
  parseSpeed?: ParseSpeeds | number;
  throwOnInvalidObject?: boolean;
  warnOnInvalidObjects?: boolean;
  updateMetadata?: boolean;
  capNumbers?: boolean;
  password?: string;
  forIncrementalUpdate?: boolean;
  preserveXFA?: boolean;
  /**
   * Copy each stream's bytes out of the input while parsing (the default).
   * With `false`, streams are views into the input instead, so a large PDF
   * is held in memory once rather than twice. The input must then not be
   * modified while the document is in use, and stays in memory as long as
   * the document does.
   */
  copyStreams?: boolean;
}

export interface CreateOptions {
  updateMetadata?: boolean;
}

export interface EmbedFontOptions {
  subset?: boolean;
  customName?: string;
  features?: TypeFeatures;
  /**
   * For font collections (`.ttc` / `.dfont`), select a face by PostScript name.
   * Ignored for single-font files.
   */
  postscriptName?: string;
}

export interface SetTitleOptions {
  showInWindowTitleBar: boolean;
}
