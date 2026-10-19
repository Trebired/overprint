import { inkOf, type InkInput } from "./../inks.js";
import { Plate, type PlateHost, type PlateOptions } from "./plate.js";
import { defaultSurface, sized } from "./surface.js";
import type { Blend, Context2D, Point, Rgb, Surface, SurfaceFactory } from "./../types.js";

type PrintOptions = { blend?: Blend; height: number; surface?: SurfaceFactory; width: number };

type RenderOptions = { clear?: boolean; shift?: (plate: Plate, index: number) => Point };

type Separation = { ink: Rgb; name: string | undefined; surface: Surface };

class Print {
  readonly blend: Blend;
  readonly height: number;
  readonly plates: Plate[] = [];
  readonly width: number;
  readonly #host: PlateHost;
  #scratch: Surface | null = null;

  constructor(options: PrintOptions) {
    if (!(options.width > 0 && options.height > 0)) throw new Error("@trebired/overprint: a print needs a positive width and height");
    this.blend = options.blend || "multiply";
    this.width = Math.round(options.width);
    this.height = Math.round(options.height);
    const factory = options.surface || defaultSurface;
    this.#host = {
      factory,
      height: this.height,
      scratch: () => (this.#scratch ??= sized(factory, this.width, this.height)),
      width: this.width,
    };
  }

  plate(ink: InkInput, options: PlateOptions = {}): Plate {
    const plate = new Plate(this.#host, inkOf(ink), options);
    this.plates.push(plate);
    return plate;
  }

  render(target: Context2D, options: RenderOptions = {}) {
    target.save();
    if (options.clear !== false) target.clearRect(0, 0, target.canvas.width, target.canvas.height);
    target.globalCompositeOperation = this.blend;
    this.plates.forEach((plate, index) => {
        if (plate.hidden) return;
        const [x, y] = options.shift ? options.shift(plate, index) : plate.offset;
        target.drawImage(plate.canvas, x, y);
    });
    target.restore();
  }

  separations(): Separation[] {
    return this.plates.filter((plate) => !plate.hidden).map((plate) => ({ ink: plate.ink, name: plate.name, surface: plate.separation() }));
  }

  dispose() {
    for (const surface of [...this.plates.map((plate) => plate.canvas), this.#scratch]) {
      if (!surface) continue;
      surface.width = 0;
      surface.height = 0;
    }
    this.plates.length = 0;
    this.#scratch = null;
  }
}

function createPrint(options: PrintOptions): Print {
  return new Print(options);
}

export { createPrint, Print };
export type { PrintOptions, RenderOptions, Separation };
