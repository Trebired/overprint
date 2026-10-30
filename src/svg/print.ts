import { artNode } from "./art.js";
import { el, toMarkup, type OverprintNode } from "./node.js";
import { knockoutOf, plateNode } from "./plate.js";
import { DEFAULT_SIZE } from "./raster.js";
import { assertOverprint } from "./rules.js";
import type { Art, Plate, Print } from "./../types.js";

type PrintOptions = { className?: string; id?: string; style?: string; tag?: string };

type Shared = { arts: Map<string, string>; defs: OverprintNode | null };

type PlateOptions = { share?: boolean };

const ID = /^[A-Za-z][\w-]*$/u;

const SHARE_MIN = 120;

function idOf(value: string | undefined): string {
  const id = (value || "overprint").replace(/[^\w-]/gu, "");
  if (!ID.test(id)) throw new Error(`@trebired/overprint: "${value}" cannot start an element id; pass an id that begins with a letter`);
  return id;
}

function sharedArts(plates: Plate[], named: Map<string, Plate>, id: string): Shared {
  const uses = new Map<string, {art:Art;count:number}>();
  const note = (art: Art) => {
    const key = JSON.stringify(art);
    const seen = uses.get(key);
    if (seen) seen.count++;
    else uses.set(key, { art, count: 1 });
  };
  for (const plate of plates) {
    note(plate.art);
    for (const knock of(plate.knockout || []).map(knockoutOf)) {
      const source = named.get(knock.plate);
      if (source) note(source.art);
    }
  }
  const arts = new Map<string, string>();
  const nodes: OverprintNode[] = [];
  for (const [key, { art, count }] of uses) {
    const node = artNode(art);
    if (count < 2 || toMarkup(node).length < SHARE_MIN) continue;
    const ref = `${id}-r${arts.size}`;
    arts.set(key, ref);
    nodes.push(el("g", { id: ref }, [node]));
  }
  return { arts, defs: nodes.length > 0 ? el("defs", {}, nodes) : null };
}

function plateNodes(print: Print, id: string, options: PlateOptions = {}): OverprintNode[] {
  assertOverprint(print);
  const named = new Map<string, Plate>();
  print.plates.forEach((plate, index) => named.set(plate.name ?? String(index), plate));
  const visible = print.plates.map((plate, index) => ({ index, plate })).filter((entry) => !entry.plate.hidden);
  const shared = options.share ? sharedArts(visible.map((entry) => entry.plate), named, id) : null;
  const context = { arts: shared?.arts, named, paper: print.paper || "light", size: print.size || DEFAULT_SIZE };
  const nodes = visible.map((entry) => plateNode(entry.plate, { ...context, id: `${id}-${entry.index}` }));
  const [first, ...rest] = nodes;
  if (!first || !shared?.defs) return nodes;
  return [{ ...first, children: [shared.defs, ...first.children] }, ...rest];
}

function printTree(print: Print, options: PrintOptions = {}): OverprintNode {
  const style = ["isolation:isolate", options.style].filter(Boolean).join(";");
  const attrs = { "aria-hidden": "true", class: options.className, "data-overprint": "", style };
  return el(options.tag || "span", attrs, plateNodes(print, idOf(options.id), { share: true }));
}

function renderPrint(print: Print, options: PrintOptions = {}): string {
  return toMarkup(printTree(print, options));
}

export { idOf, plateNodes, printTree, renderPrint };
export type { PlateOptions, PrintOptions };
