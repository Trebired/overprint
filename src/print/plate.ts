import { inkCss } from "./../inks.js";
import { coverage, dither } from "./../pixels.js";
import { halftone } from "./halftone.js";
import { contextOf, sized, wipe } from "./surface.js";
import type { Context2D, Pixels, Point, Rgb, Screen, Surface, SurfaceFactory, ToneSource } from "./../types.js";

type PlateHost = { factory: SurfaceFactory; height: number; scratch: () => Surface; width: number };

type PlateOptions = { hidden?: boolean; name?: string; offset?: Point };

const SAMPLES_PER_CELL = 3;

function toneOf(host: PlateHost, source: ToneSource, scale: number): Pixels {
  const surface = sized(host.factory, host.width * scale, host.height * scale);
  const context = contextOf(surface, true);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, surface.width, surface.height);
  if (typeof source === "function") {
    context.save();
    context.scale(surface.width / host.width, surface.height / host.height);
    source(context, { height: host.height, scale, width: host.width });
    context.restore();
  } else {
    context.drawImage(source, 0, 0, surface.width, surface.height);
  }
  return context.getImageData(0, 0, surface.width, surface.height);
}

function stamp(host: PlateHost, target: Context2D, pixels: Pixels, smooth: boolean) {
  const sheet = sized(host.factory, pixels.width, pixels.height);
  contextOf(sheet).putImageData(new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height), 0, 0);
  target.save();
  target.imageSmoothingEnabled = smooth;
  target.drawImage(sheet, 0, 0, host.width, host.height);
  target.restore();
}

class Plate {
  readonly canvas: Surface;
  hidden: boolean;
  readonly ink: Rgb;
  readonly name: string | undefined;
  offset: Point;
  readonly #host: PlateHost;

  constructor(host: PlateHost, ink: Rgb, options: PlateOptions = {}) {
    this.#host = host;
    this.ink = ink;
    this.canvas = sized(host.factory, host.width, host.height);
    this.hidden = options.hidden || false;
    this.name = options.name;
    this.offset = options.offset || [0, 0];
  }

  get context(): Context2D {
    return contextOf(this.canvas);
  }

  draw(paint: (context: Context2D) => void, options: { level?: number } = {}): this {
    const scratch = this.#host.scratch();
    const context = wipe(scratch);
    context.save();
    paint(context);
    context.restore();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = inkCss(this.ink, options.level ?? 1);
    context.fillRect(0, 0, scratch.width, scratch.height);
    this.context.drawImage(scratch, 0, 0);
    return this;
  }

  screen(source: ToneSource, screen: Screen): this {
    const host = this.#host;
    if (screen.kind === "halftone") {
      const tone = toneOf(host, source, Math.min(1, SAMPLES_PER_CELL / Math.max(1, screen.cell)));
      this.context.fillStyle = inkCss(this.ink);
      halftone(this.context, tone, screen);
    } else if (screen.kind === "dither") {
      const tone = toneOf(host, source, screen.scale ?? 1);
      stamp(host, this.context, dither(tone, { ink: this.ink, mode: screen.mode, threshold: screen.threshold }), false);
    } else {
      stamp(host, this.context, coverage(toneOf(host, source, 1), { ink: this.ink }), true);
    }
    return this;
  }

  knockout(by: Plate): this {
    const context = this.context;
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.drawImage(by.canvas, 0, 0);
    context.restore();
    return this;
  }

  clear(): this {
    wipe(this.canvas);
    return this;
  }

  separation(): Surface {
    const scratch = this.#host.scratch();
    const tinted = wipe(scratch);
    tinted.drawImage(this.canvas, 0, 0);
    tinted.globalCompositeOperation = "source-in";
    tinted.fillStyle = "#000";
    tinted.fillRect(0, 0, scratch.width, scratch.height);
    const master = sized(this.#host.factory, this.#host.width, this.#host.height);
    const context = contextOf(master);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, master.width, master.height);
    context.drawImage(scratch, 0, 0);
    return master;
  }
}

export { Plate };
export type { PlateHost, PlateOptions };
