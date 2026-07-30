# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.1]

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

[2.8.1]: https://github.com/cantoo-scribe/pdf-lib/compare/v2.8.0...HEAD
[2.8.0]: https://github.com/cantoo-scribe/pdf-lib/compare/v2.7.4...v2.8.0
