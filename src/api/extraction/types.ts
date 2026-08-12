/**
 * A content asset extracted from a PDF page.
 *
 * Text comes from show-text operators (`Tj` / `TJ` / …), decoded via ToUnicode
 * or a simple font encoding when available. Path-outlined “text” is not included.
 *
 * Images come from Image XObjects painted with `Do`, converted to usable file bytes.
 *
 * Coordinates are in PDF user space (origin bottom-left of the page MediaBox,
 * unless a crop/transform applies).
 */
export type PdfAsset =
  | {
      kind: 'text';
      getText(): string;
      /** Baseline origin x in page user space */
      x: number;
      /** Baseline origin y in page user space */
      y: number;
      fontSize: number;
      /** Font name from `/BaseFont` (subset prefix stripped when present) */
      fontFamily: string;
    }
  | {
      kind: 'image';
      /** Lower-left x of the image’s unit square after CTM */
      x: number;
      /** Lower-left y of the image’s unit square after CTM */
      y: number;
      /** Intrinsic pixel width */
      width: number;
      /** Intrinsic pixel height */
      height: number;
      /** Drawn width in page user space (from CTM) */
      drawWidth: number;
      /** Drawn height in page user space (from CTM) */
      drawHeight: number;
      mimeType: 'image/jpeg' | 'image/png';
      getBytes(): Uint8Array;
    }
  | {
      kind: 'graphics';
      /** Bounding-box min x in page user space */
      x: number;
      /** Bounding-box min y in page user space */
      y: number;
      width: number;
      height: number;
      /**
       * Approximate SVG markup for this painted path (fill/stroke/colors).
       * Path numbers are in PDF user space; the SVG flips Y for normal viewing.
       */
      getSvg(): string;
    };

export type ContentStreamOperand =
  | number
  | string
  | NameOperand
  | HexStringOperand
  | LiteralStringOperand
  | ContentStreamOperand[]
  | { [key: string]: ContentStreamOperand };

export type NameOperand = { type: 'name'; value: string };
export type HexStringOperand = { type: 'hexString'; bytes: Uint8Array };
export type LiteralStringOperand = { type: 'string'; bytes: Uint8Array };

export type ContentStreamOperation = {
  name: string;
  args: ContentStreamOperand[];
};
