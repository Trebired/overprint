# Changelog

All notable changes to `@trebired/overprint` will be documented here.

This project follows semantic versioning once published.

## 0.3.0

- Added `@trebired/overprint/flags`: `flagPrint(code)` prints one of 40 flags as an overprint, one ink per flag colour printed solid and through a screen, misregistered. Each colour of a flag takes the next screen in a fixed order, and the paper colour prints in a pale neutral ink on light paper and a dark one on dark paper. `waveFlag(root)` waves a rendered flag by baking it once into a bitmap and moving vertical strips with compositor transforms, so a waving flag costs no repaint or per-frame script. `polePrint()` prints the pole.
- Added `<Flag>` in `@trebired/overprint/flags/react`, with `pole` and `wave` options. The pole is about two and a half times the cloth's height, and the cloth hangs from the middle of its shaft.
- Added `country-flag-icons` as a dependency; only the flags `FLAG_CODES` lists are imported, so a bundler keeps the rest out.
- Fixed plates looking different on the first frame. A layer from `printFill` or `printLayers` now carries its own width, height and view box, so its percentage-sized screens resolve against the print instead of a default viewport.
- `animatePrint` now rests when the page is idle. About three seconds after the last pointer move, scroll, key or touch, the plates ease to a stop, the rAF loop ends and any wave animation pauses; the next interaction resumes both from where they stopped. An idle page with prints on it costs no CPU.
- `animatePrint` holds the plates still while the page scrolls and resumes 150 ms after scrolling stops, so moving prints add no work to every scroll frame.
- Fixed plates jumping when `animatePrint` starts. The drift now starts at zero on both axes, so the first animated frame matches the server markup.
- A plate's ink filter, mask and screen now cover only the area its art can reach, with a margin for the rough ink edge, instead of half a box past every side. Fill, image, path and clipped SVG art keep to their box, so the browser filters a fraction of the pixels; rotated art, text, sliced paths and SVG markup without `clip` keep the wide area.
- Added `clip` to SVG art. It cuts the markup at its box, which also keeps the plate's filters to the box. Flag prints use it.
- **Breaking: a layer from `renderPrint()`, `printTree()` or `<Overprint>` is no longer a standalone SVG.** Art that more than one plate prints, as its own art or as a knockout, is written once in the first layer and reused by the others with `<use>`, so a print's markup no longer repeats long path data per plate. Take standalone plates from `printLayers()`, which never shares art.
- `animatePrint` now runs every print on one shared clock and one set of input listeners. The clock ticks every frame only while a plate eases toward the pointer, ten times a second while only the drift moves, and not at all at rest. A layer whose plate has no motion is never written or promoted, and a moving layer is written only when its transform changes.
- `waveFlag` now bakes a flag only when it comes within a screen of the viewport, reads the size from the intersection instead of forcing a layout, encodes the bitmap asynchronously, and reuses one bitmap for every flag with the same plates, size, paper and pixel ratio. The strips share one style rule for the bitmap instead of each parsing it.

## 0.2.0

- Added ink texture to every plate: fine grain, density mottling and rough edges, seeded per plate, so ink is never flat and overlapping plates show through each other. A plate's `texture` sets the strength from 0.15 to 1, 0.4 by default.
- **Breaking: a print must be an overprint.** Every renderer refuses a print with fewer than two visible plates, or whose plates never print the same art (unless one is a `fill`), so one ink always lands on another. Hidden plates do not count.
- Added `printLayers()`, the plates of a print as data: each plate's image and offset, bottom first, with the blend of the paper.
- Added `printFill()` and `printFillCss()`. A print becomes a fill for an element's text: one vector layer per visible plate as a background, each plate's offset as its position, the plates blended by the paper, clipped to the text, with the text fill made transparent. They return a React style object and a CSS string.

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
