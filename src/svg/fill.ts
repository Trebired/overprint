import { round, toMarkup, type OverprintNode } from "./node.js";
import { registered } from "./registration.js";
import { blendOf } from "./plate.js";
import { idOf, plateNodes } from "./print.js";
import { DEFAULT_SIZE } from "./raster.js";
import type { Point, Print } from "./../types.js";

type PrintFill = {
  WebkitBackgroundClip: "text";
  backgroundBlendMode: string;
  backgroundClip: "text";
  backgroundImage: string;
  backgroundPosition: string;
  backgroundRepeat: string;
  backgroundSize: string;
  color: "transparent";
};

type FillOptions = { id?: string };

type PrintLayer = { blend: "multiply" | "normal" | "screen"; image: string; offset: [number, number] };

type PrintLayers = { blend: "multiply" | "screen"; layers: PrintLayer[] };

function standalone(node: OverprintNode, size: Point): OverprintNode {
  const { style: _style, ...attrs } = node.attrs;
  return { ...node, attrs: { ...attrs, height: size[1], preserveAspectRatio: "none", viewBox: `0 0 ${size[0]} ${size[1]}`, width: size[0] } };
}

function imageOf(node: OverprintNode, size: Point): string {
  return `url("data:image/svg+xml,${encodeURIComponent(toMarkup(standalone(node, size)))}")`;
}

function printLayers(print: Print, options: FillOptions = {}): PrintLayers {
  const plates = print.plates.filter((plate) => !plate.hidden);
  const nodes = plateNodes(print, idOf(options.id || "fill"));
  return {
    blend: print.paper === "dark" ? "screen" : "multiply",
    layers: plates.map((plate, index) => {
        const [x, y] = plate.offset || [0, 0];
        const image = imageOf(nodes[index] as OverprintNode, print.size || DEFAULT_SIZE);
        return { blend: blendOf(plate, print.paper || "light"), image, offset: [round(x), round(y)] };
    }),
  };
}

function printFill(print: Print, options: FillOptions = {}): PrintFill {
  const { layers } = printLayers(print, options);
  const top = [...layers].reverse();
  return {
    WebkitBackgroundClip: "text",
    backgroundBlendMode: top.map((layer) => layer.blend).join(", "),
    backgroundClip: "text",
    backgroundImage: top.map((layer) => layer.image).join(", "),
    backgroundPosition: top.map((layer) => `${registered(layer.offset[0])} ${registered(layer.offset[1])}`).join(", "),
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    color: "transparent",
  };
}

function printFillCss(print: Print, options: FillOptions = {}): string {
  const fill = printFill(print, options);
  return [
    `color:${fill.color}`,
    `background-image:${fill.backgroundImage}`,
    `background-position:${fill.backgroundPosition}`,
    `background-size:${fill.backgroundSize}`,
    `background-repeat:${fill.backgroundRepeat}`,
    `background-blend-mode:${fill.backgroundBlendMode}`,
    `-webkit-background-clip:${fill.WebkitBackgroundClip}`,
    `background-clip:${fill.backgroundClip}`,
  ].join(";");
}

export { printFill, printFillCss, printLayers };
export type { FillOptions, PrintFill, PrintLayer, PrintLayers };
