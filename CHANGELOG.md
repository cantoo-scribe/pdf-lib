# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **PDF/A support** via `PDFDocument.convertToPDFA()` — adds a trailer `/ID`,
  an `OutputIntent` with a bundled sRGB ICC profile, uncompressed XMP metadata
  (`pdfaid` + Info-dict mirrors), and the correct PDF header version for parts
  1–3 (`1B`, `2B`, `2U`, `3B`, `3U`). Level `A` (tagged) is intentionally not
  offered.
- **Factur-X / ZUGFeRD helper** `embedFacturX()` — ensures PDF/A-3 (converts to
  3B if needed; keeps an existing 3U/3B level), writes the required `fx:` XMP
  properties and PDF/A extension schema, and attaches the invoice XML with an
  associated-file relationship.
- Optional `extensions` on `convertToPDFA()` for one-shot extra XMP
  `rdf:Description` fragments (preserved across later saves).
- `generateRandomFileId()` (internal to `PDFSecurity`) for trailer `/ID`
  generation.

### Changed

- `PDFWriter` / `PDFStreamWriter` now honor `context.header` instead of always
  writing `%PDF-1.7`. Loaded documents keep their original header version on
  save; newly created documents still default to 1.7.
- When saving with object streams (e.g. `rewrite: true`) from a pre-1.5 header,
  the header is bumped to 1.7 so the declared version matches the features
  written.
- After `convertToPDFA()`, XMP `/Metadata` is refreshed on save: the owned
  Info/`pdfaid` slice is rebuilt for PDF/A consistency, while strictly foreign
  `rdf:Description` blocks (Factur-X, custom schemas, …) are preserved and
  deduped against new `extensions`. The catalog `/Metadata` ref is reused so
  repeated saves do not orphan streams.
- Repeated `convertToPDFA()` calls skip reinstalling the OutputIntent unless a
  custom ICC profile / condition is supplied (also when the catalog already
  declares `pdfaid`).
- `save()` / `saveIncremental()` reject `useObjectStreams: true` for PDF/A-1
  documents (object streams are forbidden by that part).
- `encrypt()` refuses to encrypt a document that has been converted to PDF/A.

### Notes

- `convertToPDFA()` / `embedFacturX()` do not rewrite arbitrary page content.
  Drawn text must use an **embedded** font; validate output with
  [veraPDF](https://verapdf.org/) (and a Factur-X validator for e-invoices).
- `embedFacturX()` does not generate or validate Cross Industry Invoice XML.

[Unreleased]: https://github.com/cantoo-scribe/pdf-lib/compare/v2.7.4...HEAD
