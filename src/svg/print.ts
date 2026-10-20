import { el, toMarkup, type OverprintNode } from "./node.js";
import { plateNode } from "./plate.js";
import { DEFAULT_SIZE } from "./raster.js";
import { assertOverprint } from "./rules.js";
import type { Plate, Print } from "./../types.js";

type PrintOptions = { className?: string; id?: string; style?: string; tag?: string };

const ID = /^[A-Za-z][\w-]*$/u;

function idOf(value: string | undefined): string {
  const id = (value || "overprint").replace(/[^\w-]/gu, "");
  if (!ID.test(id)) throw new Error(`@trebired/overprint: "${value}" cannot start an element id; pass an id that begins with a letter`);
  return id;
}

function plateNodes(print: Print, id: string): OverprintNode[] {
  assertOverprint(print);
  const named = new Map<string, Plate>();
  print.plates.forEach((plate, index) => named.set(plate.name ?? String(index), plate));
  const context = { named, paper: print.paper || "light", size: print.size || DEFAULT_SIZE };
  return print.plates
  .map((plate, index) => ({ index, plate }))
  .filter((entry) => !entry.plate.hidden)
  .map((entry) => plateNode(entry.plate, { ...context, id: `${id}-${entry.index}` }));
}

function printTree(print: Print, options: PrintOptions = {}): OverprintNode {
  const style = ["isolation:isolate", options.style].filter(Boolean).join(";");
  return el(options.tag || "span", { "aria-hidden": "true", class: options.className, style }, plateNodes(print, idOf(options.id)));
}

function renderPrint(print: Print, options: PrintOptions = {}): string {
  return toMarkup(printTree(print, options));
}

export { idOf, plateNodes, printTree, renderPrint };
export type { PrintOptions };
