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
- **Factur-X / ZUGFeRD helper** `embedFacturX()` — converts the document to
  PDF/A-3B, writes the required `fx:` XMP properties and PDF/A extension schema,
  and attaches the invoice XML with an associated-file relationship.
- Optional `extensions` on `convertToPDFA()` for one-shot extra XMP
  `rdf:Description` fragments (preserved across later saves).
- `generateRandomFileId()` helper in `PDFSecurity` for trailer `/ID` generation.

### Changed

- `PDFWriter` / `PDFStreamWriter` now honor `context.header` instead of always
  writing `%PDF-1.7`. Loaded documents keep their original header version on
  save; newly created documents still default to 1.7.
- When saving with object streams (e.g. `rewrite: true`) from a pre-1.5 header,
  the header is bumped to 1.7 so the declared version matches the features
  written.
- After `convertToPDFA()`, XMP `/Metadata` is refreshed on save: the owned
  Info/`pdfaid` slice is rebuilt for PDF/A consistency, while foreign
  `rdf:Description` blocks (Factur-X, custom schemas, …) are preserved.
- `encrypt()` refuses to encrypt a document that has been converted to PDF/A.

### Notes

- `convertToPDFA()` / `embedFacturX()` do not rewrite arbitrary page content.
  Drawn text must use an **embedded** font; validate output with
  [veraPDF](https://verapdf.org/) (and a Factur-X validator for e-invoices).
- `embedFacturX()` does not generate or validate Cross Industry Invoice XML.

[Unreleased]: https://github.com/cantoo-scribe/pdf-lib/compare/v2.7.4...HEAD
