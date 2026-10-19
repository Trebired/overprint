import { inkOf, type InkInput } from "./inks.js";
import { runKernel } from "./native/kernels.js";
import type { Channel, DitherMode, Pixels } from "./types.js";

type InkOption = { ink?: InkInput };

const DITHER_MODES: Record<DitherMode, number> = { atkinson: 3, bayer: 1, "floyd-steinberg": 2, threshold: 0 };

const CHANNELS: Record<Channel, number> = { black: 6, blue: 2, cyan: 3, green: 1, magenta: 4, red: 0, yellow: 5 };

function coverage(pixels: Pixels, options: InkOption = {}): Pixels {
  return runKernel(pixels, inkOf(options.ink || "black"), (native) => native.coverage(pixels.width, pixels.height));
}

function dither(pixels: Pixels, options: InkOption& { mode?: DitherMode; threshold?: number } = {}): Pixels {
  const mode = DITHER_MODES[options.mode || "atkinson"];
  if (mode === undefined) throw new Error(`@trebired/overprint: unknown dither mode "${options.mode}"`);
  const threshold = options.threshold ?? 128;
  return runKernel(pixels, inkOf(options.ink || "black"), (native) => native.dither(pixels.width, pixels.height, mode, threshold));
}

function separate(pixels: Pixels, channel: Channel, options: InkOption = {}): Pixels {
  const code = CHANNELS[channel];
  if (code === undefined) throw new Error(`@trebired/overprint: unknown channel "${channel}"`);
  return runKernel(pixels, inkOf(options.ink || "black"), (native) => native.separate(pixels.width, pixels.height, code));
}

export { coverage, dither, separate };
