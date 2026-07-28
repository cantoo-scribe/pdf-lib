import { PDFAConformanceLevel } from './PDFAConformance';

export * from './PDFAConformance';
export * from './srgbProfile';
export * from './xmp';

/**
 * Options for [[PDFDocument.convertToPDFA]].
 */
export interface ConvertToPDFAOptions {
  /**
   * The PDF/A conformance level to target. Defaults to `'3B'`.
   *
   * See [[PDFAConformanceLevel]] for the list of supported values.
   */
  conformance?: PDFAConformanceLevel;

  /**
   * The raw bytes of the ICC color profile to embed as the document's output
   * intent. Defaults to the bundled sRGB IEC61966-2.1 profile.
   *
   * When you supply your own profile, make sure the color data used throughout
   * the document matches its color space (e.g. an RGB profile for RGB colors).
   */
  iccProfile?: Uint8Array;

  /**
   * A human-readable name identifying the output condition — i.e. the intended
   * output device or production process the `iccProfile` characterizes.
   * Defaults to `'sRGB IEC61966-2.1'`.
   */
  outputConditionIdentifier?: string;

  /**
   * The number of color components described by `iccProfile` (`1` for
   * grayscale, `3` for RGB, `4` for CMYK). Defaults to `3`, matching the
   * default sRGB profile.
   */
  colorComponents?: 1 | 3 | 4;
}
