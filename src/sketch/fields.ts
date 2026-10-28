import { runKernel } from "./../native/kernels.js";
import type { Pixels } from "./../types.js";

type SketchFields = {
  edge: (index: number) => boolean;
  height: number;
  leafy: (x: number, y: number) => boolean;
  tone: (x: number, y: number) => number;
  width: number;
};

const INK: readonly [number, number, number] = [0, 0, 0];

function readFields(pixels: Pixels, detail: number, blankSky: boolean): SketchFields {
  const { width, height } = pixels;
  if (width < 8 || height < 8) throw new Error("@trebired/overprint: a sketch needs at least 8 x 8 pixels");
  const share = Math.min(0.98, Math.max(0.6, 1 - 0.28 * detail));
  const fields = runKernel(pixels, INK, (native) => native.sketch(width, height, share, blankSky ? 1 : 0));
  const data = fields.data;
  const clamp = (value: number, size: number) => Math.min(size - 1, Math.max(0, Math.round(value)));
  const at = (x: number, y: number) => (clamp(y, height) * width + clamp(x, width)) * 4;
  return {
    edge: (index) => data[index * 4] === 255,
    height,
    leafy: (x, y) => data[at(x, y) + 3] === 255,
    tone: (x, y) => data[at(x, y) + 1] / 255,
    width,
  };
}

export { readFields };
export type { SketchFields };
