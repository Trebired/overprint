import { inkOf } from "./../inks.js";
import { artNode } from "./art.js";
import { inkFilter } from "./ink.js";
import { el, round, type OverprintNode } from "./node.js";
import { screenContent } from "./screen.js";
import { waveParts } from "./wave.js";
import type { Knockout, Paper, Plate, Point } from "./../types.js";

type PlateContext = { id: string; named: Map<string, Plate>; paper: Paper; size: Point };

const WIDE = { height: "200%", width: "200%", x: "-50%", y: "-50%" };

const BLACK = "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0";

function silhouette(id: string, values: string, spread = 0): OverprintNode {
  const grow = spread > 0 ? el("feMorphology", { operator: "dilate", radius: round(spread), result: "grown" }) : null;
  return el("filter", { ...WIDE, "color-interpolation-filters": "sRGB", filterUnits: "userSpaceOnUse", id }, [
      grow,
      el("feColorMatrix", { in: grow ? "grown" : "SourceGraphic", type: "matrix", values }),
  ]);
}

function knockoutOf(entry: Knockout): { plate: string; spread: number } {
  return typeof entry === "string" ? { plate: entry, spread: 0 } : { plate: entry.plate, spread: entry.spread ?? 0 };
}

function maskOf(plate: Plate, context: PlateContext): OverprintNode[] {
  const { id, named } = context;
  const knocks = (plate.knockout || []).map(knockoutOf).map((knock, index) => {
      const source = named.get(knock.plate);
      if (!source) throw new Error(`@trebired/overprint: knockout names plate "${knock.plate}", which this print does not have`);
      return { filter: silhouette(`${id}k${index}`, BLACK, knock.spread), node: el("g", { filter: `url(#${id}k${index})` }, [artNode(source.art)]) };
  });
  const mask = el("mask", { ...WIDE, id: `${id}m`, maskUnits: "userSpaceOnUse" }, [
      el("g", { filter: `url(#${id}a)` }, [artNode(plate.art)]),
      ...knocks.map((knock) => knock.node),
  ]);
  return [inkFilter(`${id}a`, plate.texture), ...knocks.map((knock) => knock.filter), mask];
}

function layerStyle(plate: Plate, paper: Paper): string {
  const [x, y] = plate.offset || [0, 0];
  return [
    "position:absolute",
    "left:0",
    "top:0",
    "width:100%",
    "height:100%",
    "overflow:visible",
    "pointer-events:none",
    `mix-blend-mode:${paper === "dark" ? "screen" : "multiply"}`,
    `transform:translate(${round(x)}px,${round(y)}px)`,
  ].join(";");
}

function plateNode(plate: Plate, context: PlateContext): OverprintNode {
  const { id, paper, size } = context;
  const ink = inkOf(plate.ink);
  const screen = screenContent({ id: `${id}s`, ink, size }, plate.screen || { kind: "solid" }, plate.tone || { kind: "flat", level: 1 });
  const wave = waveParts(id, plate.wave);
  const masked = el("g", { mask: `url(#${id}m)` }, [screen.content]);
  const defs = el("defs", {}, [
      ...maskOf(plate, context),
      ...screen.defs,
      ...(wave?.defs || []),
      wave ? el("style", {}, [wave.style]) : null,
  ]);
  return el("svg", { "aria-hidden": "true", focusable: "false", style: layerStyle(plate, paper), xmlns: "http://www.w3.org/2000/svg" }, [
      defs,
      wave ? wave.wrap(masked) : masked,
  ]);
}

export { plateNode };
export type { PlateContext };
