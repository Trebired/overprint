# Changelog

All notable changes to `@trebired/overprint` will be documented here.

This project follows semantic versioning once published.

## 0.1.0

- Added `createPrint()` with one plate per ink, `multiply` and `screen` overprint, per-plate offsets, and a `shift` callback for misregistration over time.
- Added solid, halftone, and dither screens, knockouts, hidden mask plates, and per-drum separations.
- Added the standard risograph ink table as `inks` and `inkOf()` for names, hex strings, and tuples.
- Added `coverage()`, `dither()`, and `separate()` for canvas-free pixel work.
- Added the Rust pixel kernels, compiled to WebAssembly and embedded in `dist/native/kernels.js`.
