import { pathBounds, type Bounds } from "./bounds.js";
import { percent } from "./node.js";
import type { Art, Box, Point } from "./../types.js";

type Region = { height: string; width: string; x: string; y: string };

const WIDE: Region = { height: "200%", width: "200%", x: "-50%", y: "-50%" };

const LIMIT: Bounds = [-0.5, -0.5, 1.5, 1.5];

const MARGIN = 0.06;

const PAD_PX = 4;

const EDGE = 1e-6;

function boxBounds(box: Box = {}): Bounds {
  const [x, y] = [box.x ?? 0, box.y ?? 0];
  return [x, y, x + (box.width ?? 1), y + (box.height ?? 1)];
}

function union(all: (Bounds | null)[]): Bounds | null {
  if (all.length === 0 || all.some((bounds) => bounds === null)) return null;
  const known = all as Bounds[];
  return [
    Math.min(...known.map((bounds) => bounds[0])),
    Math.min(...known.map((bounds) => bounds[1])),
    Math.max(...known.map((bounds) => bounds[2])),
    Math.max(...known.map((bounds) => bounds[3])),
  ];
}

function pathReach(art: Extract<Art, {kind:"path"}>): Bounds | null {
  if (art.fit === "slice") return null;
  const [width, height] = art.viewBox || [1, 1];
  const drawn = pathBounds(art.d);
  if (!drawn || drawn[0] < -EDGE || drawn[1] < -EDGE || drawn[2] > width + EDGE || drawn[3] > height + EDGE) return null;
  return boxBounds(art.box);
}

function reachOf(art: Art): Bounds | null {
  if (art.kind === "fill") return [0, 0, 1, 1];
  if (art.kind === "text") return null;
  if (art.kind === "group") return art.rotate ? null : union(art.parts.map(reachOf));
  if (art.rotate) return null;
  if (art.kind === "image") return boxBounds(art.box);
  if (art.kind === "svg") return art.clip ? boxBounds(art.box) : null;
  return pathReach(art);
}

function plateReach(art: Art, size: Point): Bounds | null {
  const reach = reachOf(art);
  if (!reach) return null;
  const [mx, my] = [Math.max(MARGIN, PAD_PX / size[0]), Math.max(MARGIN, PAD_PX / size[1])];
  return [reach[0] - mx, reach[1] - my, reach[2] + mx, reach[3] + my];
}

function regionOf(reach: Bounds | null, size: Point, spread = 0): Region {
  if (!reach) return WIDE;
  const [gx, gy] = [spread / size[0], spread / size[1]];
  const x0 = Math.max(LIMIT[0], reach[0] - gx);
  const y0 = Math.max(LIMIT[1], reach[1] - gy);
  const x1 = Math.min(LIMIT[2], reach[2] + gx);
  const y1 = Math.min(LIMIT[3], reach[3] + gy);
  return { height: percent(y1 - y0), width: percent(x1 - x0), x: percent(x0), y: percent(y0) };
}

export { plateReach, regionOf, WIDE };
export type { Region };
