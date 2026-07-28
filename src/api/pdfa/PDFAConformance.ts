/**
 * The PDF/A conformance level to target when converting a document with
 * [[PDFDocument.convertToPDFA]].
 *
 * The number denotes the PDF/A _part_:
 * - `1` — PDF/A-1 (ISO 19005-1, based on PDF 1.4)
 * - `2` — PDF/A-2 (ISO 19005-2, based on PDF 1.7)
 * - `3` — PDF/A-3 (ISO 19005-3, based on PDF 1.7, allows arbitrary attachments)
 *
 * The letter denotes the _conformance level_:
 * - `B` (Basic) — guarantees reliable visual reproduction.
 * - `U` (Unicode, parts 2 & 3 only) — like `B`, but additionally requires that
 *   all text has Unicode mappings.
 *
 * Level `A` (Accessible) is intentionally not offered: it requires a fully
 * tagged, logically structured document, which cannot be produced automatically
 * from an arbitrary PDF.
 */
export type PDFAConformanceLevel = '1B' | '2B' | '2U' | '3B' | '3U';

export interface ParsedConformance {
  part: 1 | 2 | 3;
  level: 'B' | 'U';
}

const CONFORMANCE_LEVELS: PDFAConformanceLevel[] = [
  '1B',
  '2B',
  '2U',
  '3B',
  '3U',
];

/**
 * Parse a [[PDFAConformanceLevel]] string into its part and level components,
 * throwing a descriptive error for unsupported values.
 */
export const parseConformance = (
  conformance: PDFAConformanceLevel,
): ParsedConformance => {
  if (!CONFORMANCE_LEVELS.includes(conformance)) {
    throw new Error(
      `Unsupported PDF/A conformance "${conformance}". ` +
        `Supported values are: ${CONFORMANCE_LEVELS.join(', ')}. ` +
        'Level "A" (accessible/tagged) conformance is not supported.',
    );
  }
  return {
    part: Number(conformance[0]) as 1 | 2 | 3,
    level: conformance[1] as 'B' | 'U',
  };
};
