import { inkOf } from "./../inks.js";
import { artNode } from "./art.js";
import { inkFilter } from "./ink.js";
import { el, round, type OverprintNode } from "./node.js";
import { plateReach, regionOf, type Region } from "./region.js";
import { screenContent } from "./screen.js";
import { waveParts } from "./wave.js";
import type { Bounds } from "./bounds.js";
import type { Art, Knockout, Paper, Plate, Point } from "./../types.js";

type PlateContext = { arts?: Map<string, string>; id: string; named: Map<string, Plate>; paper: Paper; size: Point };

const BLACK = "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0";

function silhouette(id: string, values: string, region: Region, spread = 0): OverprintNode {
  const grow = spread > 0 ? el("feMorphology", { operator: "dilate", radius: round(spread), result: "grown" }) : null;
  return el("filter", { ...region, "color-interpolation-filters": "sRGB", filterUnits: "userSpaceOnUse", id }, [
      grow,
      el("feColorMatrix", { in: grow ? "grown" : "SourceGraphic", type: "matrix", values }),
  ]);
}

function artOf(art: Art, context: PlateContext): OverprintNode {
  const shared = context.arts?.get(JSON.stringify(art));
  return shared ? el("use", { href: `#${shared}` }) : artNode(art);
}

function knockoutOf(entry: Knockout): { plate: string; spread: number } {
  return typeof entry === "string" ? { plate: entry, spread: 0 } : { plate: entry.plate, spread: entry.spread ?? 0 };
}

function maskOf(plate: Plate, context: PlateContext, reach: Bounds | null): OverprintNode[] {
  const { id, named, size } = context;
  const region = regionOf(reach, size);
  const knocks = (plate.knockout || []).map(knockoutOf).map((knock, index) => {
      const source = named.get(knock.plate);
      if (!source) throw new Error(`@trebired/overprint: knockout names plate "${knock.plate}", which this print does not have`);
      const grown = regionOf(reach, size, knock.spread);
      const node = el("g", { filter: `url(#${id}k${index})` }, [artOf(source.art, context)]);
      return { filter: silhouette(`${id}k${index}`, BLACK, grown, knock.spread), node };
  });
  const mask = el("mask", { ...region, id: `${id}m`, maskUnits: "userSpaceOnUse" }, [
      el("g", { filter: `url(#${id}a)` }, [artOf(plate.art, context)]),
      ...knocks.map((knock) => knock.node),
  ]);
  return [inkFilter(`${id}a`, plate.texture, region), ...knocks.map((knock) => knock.filter), mask];
}

function blendOf(plate: Plate, paper: Paper): "multiply" | "normal" | "screen" {
  if (plate.opaque) return "normal";
  return paper === "dark" ? "screen" : "multiply";
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
    `mix-blend-mode:${blendOf(plate, paper)}`,
    `transform:translate(${round(x)}px,${round(y)}px)`,
  ].join(";");
}

function plateNode(plate: Plate, context: PlateContext): OverprintNode {
  const { id, paper, size } = context;
  const ink = inkOf(plate.ink);
  const reach = plateReach(plate.art, size);
  const screenContext = { id: `${id}s`, ink, region: regionOf(reach, size), size };
  const screen = screenContent(screenContext, plate.screen || { kind: "solid" }, plate.tone || { kind: "flat", level: 1 });
  const wave = waveParts(id, plate.wave);
  const masked = el("g", { mask: `url(#${id}m)` }, [screen.content]);
  const defs = el("defs", {}, [
      ...maskOf(plate, context, reach),
      ...screen.defs,
      ...(wave?.defs || []),
      wave ? el("style", {}, [wave.style]) : null,
  ]);
  return el("svg", { "aria-hidden": "true", focusable: "false", style: layerStyle(plate, paper), xmlns: "http://www.w3.org/2000/svg" }, [
      defs,
      wave ? wave.wrap(masked) : masked,
  ]);
}

export { blendOf, knockoutOf, plateNode };
export type { PlateContext };
