# Changelog

All notable changes to `@trebired/overprint` will be documented here.

This project follows semantic versioning once published.

## 0.1.1

- Fixed waves that never moved in Chromium. The sine map was an SVG image animating inside itself, and a browser does not re-render a filter when an image it reads changes; the map is now a still image whose position an `animate` on the filter slides by one wavelength in a loop, with the amplitude ramp as a second still image multiplied in, so the cloth ripples and its shading bands travel with it.
- Fixed tilted art losing its edges. A plate's ink and its screen filter covered only the root element's box, so whatever a rotation carried past that edge, such as a flag's finial, was cut away; flat and gradient tones and the screen filter now reach half a box past every side. Tones are placed in the root's coordinates, so they still map to the box, and an image tone stays on the box because it has no pixels beyond it.
- Changed `animatePrint()` to pause a print's SVG animations while it is off screen and resume them when it returns.

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
