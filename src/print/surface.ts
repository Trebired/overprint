import type { Context2D, Surface, SurfaceFactory } from "./../types.js";

function defaultSurface(width: number, height: number): Surface {
  if (typeof document !== "undefined") return Object.assign(document.createElement("canvas"), { height, width });
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  throw new Error("@trebired/overprint: no canvas is available here; pass a surface factory to createPrint()");
}

function contextOf(surface: Surface, readback = false): Context2D {
  const context = surface.getContext("2d", readback ? { willReadFrequently: true } : undefined);
  if (!context) throw new Error("@trebired/overprint: the surface has no 2d context");
  return context as Context2D;
}

function sized(factory: SurfaceFactory, width: number, height: number): Surface {
  return factory(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
}

function wipe(surface: Surface): Context2D {
  const context = contextOf(surface);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, surface.width, surface.height);
  return context;
}

export { contextOf, defaultSurface, sized, wipe };
