import { bayer } from "./bayer.js";
import { el, round, type OverprintNode } from "./node.js";
import { rasterDither } from "./raster.js";
import { tonePaint } from "./tone.js";
import type { DitherScreen, DotShape, HalftoneScreen, Point, Rgb, Screen, Tone } from "./../types.js";

type ScreenContext = { id: string; ink: Rgb; size: Point };

type ScreenResult = { content: OverprintNode; defs: OverprintNode[] };

type Metric = { axis: "x" | "y"; id: string; node: OverprintNode };

const BLEND = "mix-blend-mode:screen";

function bars(id: string, channel: string, vertical: boolean): OverprintNode {
  const ends = vertical ? { x1: 0, x2: 0, y1: 0, y2: 1 } : { x1: 0, x2: 1, y1: 0, y2: 0 };
  return el("linearGradient", { id, ...ends }, [
      el("stop", { offset: 0, "stop-color": channel }),
      el("stop", { offset: 0.5, "stop-color": "#000" }),
      el("stop", { offset: 1, "stop-color": channel }),
  ]);
}

function dotGradient(id: string, dot: DotShape): OverprintNode[] {
  if (dot === "line") return [bars(id, "#f00", true)];
  if (dot === "square" || dot === "cross") return [bars(id, "#f00", false), bars(`${id}y`, "#00f", true)];
  const stretch = dot === "ellipse" ? "translate(0.5 0.5) scale(0.7 1) translate(-0.5 -0.5)" : undefined;
  return [el("radialGradient", { cx: 0.5, cy: 0.5, gradientTransform: stretch, id, r: 0.5 }, [
        el("stop", { offset: 0, "stop-color": "#000" }),
        el("stop", { offset: 1, "stop-color": "#f00" }),
  ])];
}

function tile(id: string, gradient: string, screen: HalftoneScreen): OverprintNode {
  const turn = `rotate(${round(-(screen.angle ?? 45))})`;
  if (screen.cells) {
    const size = `${round(100 / screen.cells)}%`;
    return el("pattern", { height: size, id, patternTransform: turn, patternUnits: "userSpaceOnUse", width: size }, [
        el("rect", { fill: `url(#${gradient})`, height: size, width: size }),
    ]);
  }
  const cell = Math.max(1, screen.cell ?? 8);
  return el("pattern", { height: cell, id, patternTransform: turn, patternUnits: "userSpaceOnUse", width: cell }, [
      el("rect", { fill: `url(#${gradient})`, height: cell, width: cell }),
  ]);
}

function threshold(id: string, ink: Rgb, rows: string[], combine?: "in" | "over"): OverprintNode {
  const [red, green, blue] = ink.map((channel) => round(channel / 255));
  const color = `0 0 0 0 ${red} 0 0 0 0 ${green} 0 0 0 0 ${blue}`;
  const primitives = rows.map((row, index) => el("feColorMatrix", {
        in: "SourceGraphic",
        result: `m${index}`,
        type: "matrix",
        values: `${color} ${row}`,
  }));
  if (combine) primitives.push(el("feComposite", { in: "m0", in2: "m1", operator: combine }));
  const region = { height: "200%", width: "200%", x: "-50%", y: "-50%" };
  return el("filter", { ...region, "color-interpolation-filters": "sRGB", filterUnits: "userSpaceOnUse", id }, primitives);
}

function halftone(context: ScreenContext, screen: HalftoneScreen, tone: Tone): ScreenResult {
  const { id, ink } = context;
  const dot = screen.dot || "circle";
  const paint = tonePaint(`${id}t`, tone, "channel", ink);
  const sharp = round(screen.cells ? 12 : Math.max(6, (screen.cell ?? 8) * 0.8));
  const gain = round(Math.max(0, screen.gain ?? 1));
  const metrics: Metric[] = [{ axis: "x", id: `${id}p`, node: tile(`${id}p`, `${id}g`, screen) }];
  if (dot === "square" || dot === "cross") metrics.push({ axis: "y", id: `${id}q`, node: tile(`${id}q`, `${id}gy`, screen) });
  const [shade, full] = [round(-sharp * gain), round(sharp * gain)];
  const rows = metrics.map((metric) => (metric.axis === "x" ? `${-sharp} ${shade} 0 0 ${full}` : `0 ${shade} ${-sharp} 0 ${full}`));
  const filter = threshold(`${id}f`, ink, rows, metrics.length > 1 ? (dot === "square" ? "in" : "over") : undefined);
  const layers = metrics.map((metric, index) => el("rect", { ...paint.extent, fill: `url(#${metric.id})`, style: index ? BLEND : undefined }));
  return {
    content: el("g", { filter: `url(#${id}f)` }, [...layers, paint.layer({ style: BLEND })]),
    defs: [...dotGradient(`${id}g`, dot), ...metrics.map((metric) => metric.node), ...paint.defs, filter],
  };
}

function ordered(context: ScreenContext, screen: DitherScreen, tone: Tone): ScreenResult {
  const { id, ink } = context;
  const paint = tonePaint(`${id}t`, tone, "channel", ink);
  const shift = round(((screen.threshold ?? 128) - 128) / 255);
  if (screen.mode === "threshold") {
    const filter = threshold(`${id}f`, ink, [`0 -255 0 0 ${round(255 * (0.5 + shift))}`]);
    return { content: el("g", { filter: `url(#${id}f)` }, [paint.layer({})]), defs: [...paint.defs, filter] };
  }
  const filter = threshold(`${id}f`, ink, [`-255 -255 0 0 ${round(255 * (1 + shift))}`]);
  const layers = [el("rect", { ...paint.extent, fill: `url(#${id}p)` }), paint.layer({ style: BLEND })];
  return { content: el("g", { filter: `url(#${id}f)` }, layers), defs: [bayer(`${id}p`, screen.grain ?? 2), ...paint.defs, filter] };
}

function screenContent(context: ScreenContext, screen: Screen, tone: Tone): ScreenResult {
  if (screen.kind === "halftone") return halftone(context, screen, tone);
  if (screen.kind === "dither") {
    if (screen.mode === "bayer" || screen.mode === "threshold") return ordered(context, screen, tone);
    return rasterDither(context, screen, tone);
  }
  const paint = tonePaint(`${context.id}t`, tone, "ink", context.ink);
  return { content: paint.layer({}), defs: paint.defs };
}

export { screenContent };
export type { ScreenContext, ScreenResult };
