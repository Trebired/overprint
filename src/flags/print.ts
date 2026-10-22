import { coloursOf, lightness, separation, sourceOf } from "./separate.js";
import { flagMarkup, type FlagCode } from "./codes.js";
import type { Paper, Plate, Point, Print, Screen } from "./../types.js";

type FlagPrintOptions = { misregistration?: number; paper?: Paper; size?: Point };

const PATTERNS: Screen[] = [
  { angle: 15, cells: 70, dot: "line", kind: "halftone" },
  { angle: 45, cells: 56, dot: "circle", kind: "halftone" },
  { angle: 30, cells: 48, dot: "cross", kind: "halftone" },
  { angle: 75, cells: 52, dot: "square", kind: "halftone" },
  { grain: 3, kind: "dither", mode: "bayer" },
  { angle: 60, cells: 56, dot: "ellipse", kind: "halftone" },
];

const PAPER_INK: Record<Paper, `#${string}`> = { dark: "#4a4844", light: "#cdc8bf" };

function paperColour(colour: string, paper: Paper): boolean {
  const light = lightness(colour);
  return paper === "dark" ? light <= 0.08 : light >= 0.94;
}

function platesFor(code: FlagCode, colour: string, index: number, options: FlagPrintOptions): Plate[] {
  const source = sourceOf(flagMarkup(code));
  const art = { clip: true, fit: "fill"as const, kind: "svg"as const, markup: separation(
      source,
      colour,
      `of${code}${colour.slice(1)}`
    ), viewBox: source.viewBox };
  const blank = paperColour(colour, options.paper || "light");
  const shift = options.misregistration ?? 3;
  const ink = blank ? PAPER_INK[options.paper || "light"] : (colour as `#${string}`);
  const turn = index % 2 === 0 ? 1 : -1;
  return [
    { art, ink, name: `${colour}-base`, offset: [-shift * turn, shift * 0.6], tone: { kind: "flat", level: blank ? 0.45 : 0.82 } },
    {
      art,
      ink,
      name: `${colour}-screen`,
      offset: [shift * turn * 0.5, -shift * 0.4],
      screen: PATTERNS[index % PATTERNS.length],
      tone: { kind: "flat", level: blank ? 0.5 : 0.55 },
    },
  ];
}

function flagPrint(code: FlagCode, options: FlagPrintOptions = {}): Print {
  const paper = options.paper || "light";
  const colours = coloursOf(sourceOf(flagMarkup(code)).body);
  const plates = colours.flatMap((colour, index) => platesFor(code, colour, index, options));
  return { paper, plates, size: options.size || [513, 342] };
}

export { flagPrint };
export type { FlagPrintOptions };
