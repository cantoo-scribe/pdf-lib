# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Drop the discontinued `crypto-js` dependency (and `@types/crypto-js`).
  Document encryption now uses the AES / RC4 / MD5 / SHA-256 implementations
  already vendored in `src/core/crypto.ts` for decryption, plus the Web Crypto
  API (`crypto.getRandomValues`) for secure randomness. No public API changed,
  and output is byte-for-byte identical given the same randomness.
- **`PDFDocument.encrypt()` now requires `crypto.getRandomValues`** — available
  in modern browsers, Node >= 18, Deno, and Bun. On Node < 18, or in React
  Native without a polyfill such as `react-native-get-random-values`,
  `encrypt()` throws a descriptive error instead of silently working (`crypto-js`
  4.2 fell back to `require('crypto')`). Nothing else in `pdf-lib` is affected.

## [2.8.4]

### Added

- `EmbedFontOptions.postscriptName` to select a face from TrueType/DFont
  collections (`.ttc` / `.dfont`) when embedding with fontkit.

### Changed

- Harden custom-font / fontkit interop for upstream `fontkit` v2 and
  `@types/fontkit` (font collections, optional font tables, subset
  `includeGlyph` return values).

## [2.8.2]

### Added

- Optional content (PDF layers) helpers: `PDFDocument.getOptionalContentGroups()`
  and `PDFDocument.setOptionalContentGroupVisibility()` update the default
  `/OCProperties` `/D` configuration (`/ON`, `/OFF`, `/BaseState`) so viewers
  open layers in the requested state. Also available via
  `catalog.getOCProperties()`.

## [2.8.1]

### Added

- `PDFPage.extractContents()` returns typed `PdfAsset[]` (text, images, and
  approximate vector `graphics` as SVG) from page content streams. Text is
  decoded via ToUnicode / WinAnsi and includes `x`, `y`, `fontSize`, and
  `fontFamily`. Image XObjects become JPEG or PNG bytes with page-space
  position. Painted paths become `kind: 'graphics'` with `getSvg()`. Form
  XObjects are traversed. Path-outlined text is not extracted as text.

### Fixed

- Keep catalog name trees for embedded files and document JavaScript in PDF
  lexical order by re-sorting flat `/Names` entries on insert (required by
  ISO 32000). Existing `/Kids` trees and other incompatible name-tree shapes
  are left untouched instead of creating an invalid sibling `/Names` array.
- `PDFForm.flatten()` now also flattens orphaned widget annotations that carry
  field properties (`/FT`, `/V`, …) on the page `Annots` entry but are not
  registered in `AcroForm.Fields` (text fields and stateful checkboxes / radios).

### Changed

- Prefer maintained upstream [`fontkit`](https://www.npmjs.com/package/fontkit) v2 for custom
  font embedding. Subsetting now supports both `subset.encode()` (fontkit v2+) and
  `subset.encodeStream()` (`@pdf-lib/fontkit`), so existing registrations keep working.
- Upgrade direct `pako` dependency from v1 to v2, and force transitive
  `pako` installs to `^2.2.0` via Yarn `resolutions` / npm `overrides`
  (consumers should mirror this in their own root `package.json`).

## [2.8.0]

### Added

- Convert documents to PDF/A-1/2/3 (`1B`, `2B`, `2U`, `3B`, `3U`) with
  `PDFDocument.convertToPDFA()` — OutputIntent (bundled sRGB), `/ID`, and XMP
  kept in sync with the Info dictionary on save.
- Embed Factur-X / ZUGFeRD invoice XML with `embedFacturX()` (PDF/A-3 hybrid +
  required XMP).
- Work with XFA forms: read signature fields, scripts, and related helpers on
  `PDFForm`.

### Fixed

- HTML closing tags that span multiple lines are parsed correctly.
- Saved PDFs keep their original `%PDF-x.y` header (writers no longer always
  force 1.7). Object streams on older files bump the header to 1.7 when needed.

### Notes

- PDF/A / Factur-X helpers add the structural pieces only — they do not rewrite
  page content or generate/validate invoice XML. Use embedded fonts and validate
  with veraPDF (and a Factur-X checker for e-invoices).

[2.8.2]: https://github.com/cantoo-scribe/pdf-lib/compare/v2.8.1...HEAD
[2.8.1]: https://github.com/cantoo-scribe/pdf-lib/compare/v2.8.0...v2.8.1
[2.8.0]: https://github.com/cantoo-scribe/pdf-lib/compare/v2.7.4...v2.8.0
