# Changelog

All notable changes to `@trebired/overprint` will be documented here.

This project follows semantic versioning once published.

## 0.1.0

- Added `renderPrint()` and `printTree()`, which render a print as one SVG layer per ink, overprinted with `multiply` on light paper and `screen` on dark paper, without a DOM.
- Added path, image, inline SVG, text and group art, placed and rotated in fractions of the print.
- Added flat, linear, radial, image and pixel tones.
- Added vector halftone screens with circle, ellipse, square, line and cross dots, and vector ordered and threshold dither.
- Added Atkinson and Floyd-Steinberg error diffusion, computed in Rust and embedded as one-bit PNG grain.
- Added knockouts with an optional spread, hidden mask plates, and cloth waves with moving shading that stop under reduced motion.
- Added the `Overprint` React component on `@trebired/overprint/react` and `animatePrint()` for drift and pointer pull.
- Added the standard risograph ink table as `inks` and `inkOf()` for names, hex strings and tuples.
- Added `coverage()`, `dither()`, `separate()`, `encodePng()` and `pngDataUri()` for canvas-free pixel work.
- Added the Rust pixel kernels, compiled to WebAssembly and embedded in `dist/native/kernels.js`.
