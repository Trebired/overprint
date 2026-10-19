import type { Rgb } from "./types.js";

const INK_HEX = {
  apricot: "#f6a04d",
  aqua: "#5ec8e5",
  bisque: "#f2cdcf",
  black: "#000000",
  blue: "#0078bf",
  brick: "#a75154",
  brightGold: "#ba8032",
  brightOlive: "#b49f29",
  brightRed: "#f15060",
  brown: "#925f52",
  bubbleGum: "#f984ca",
  burgundy: "#914e72",
  charcoal: "#70747c",
  copper: "#bd6439",
  coral: "#ff8e91",
  cornflower: "#62a8e5",
  cranberry: "#d1517a",
  crimson: "#e45d50",
  darkMauve: "#bd8ca6",
  emerald: "#19975d",
  federalBlue: "#3d5588",
  flatGold: "#bb8b41",
  fluorescentGreen: "#44d62c",
  fluorescentOrange: "#ff7477",
  fluorescentPink: "#ff48b0",
  fluorescentRed: "#ff4c65",
  fluorescentYellow: "#ffe916",
  forest: "#516e5a",
  grape: "#6c5d80",
  granite: "#a5aaa8",
  grass: "#397e58",
  gray: "#928d88",
  hunterGreen: "#407060",
  indigo: "#484d7a",
  ivy: "#169b62",
  kellyGreen: "#67b346",
  lagoon: "#2f6165",
  lake: "#235ba8",
  lightGray: "#88898a",
  lightLime: "#e3ed55",
  lightMauve: "#e6b5c9",
  lightTeal: "#009da5",
  mahogany: "#8e595a",
  marineRed: "#d2515e",
  maroon: "#9e4c6e",
  mediumBlue: "#3255a4",
  melon: "#ffae3b",
  metallicGold: "#ac936e",
  midnight: "#435060",
  mint: "#82d8d5",
  mist: "#d5e4c0",
  moss: "#68724d",
  orange: "#ff6c2f",
  orchid: "#aa60bf",
  paprika: "#ee7f4b",
  pine: "#237e74",
  plum: "#845991",
  pumpkin: "#ff6f4c",
  purple: "#765ba7",
  raisin: "#775d7a",
  raspberryRed: "#d1517a",
  red: "#ff665e",
  scarlet: "#f65058",
  seaBlue: "#0074a2",
  seaFoam: "#62c2b1",
  skyBlue: "#4982cf",
  slate: "#5e695e",
  smokyTeal: "#5f8289",
  spruce: "#4a635d",
  steel: "#375e77",
  sunflower: "#ffb511",
  teal: "#00838a",
  tomato: "#d2515e",
  turquoise: "#00aa93",
  violet: "#9d7ad2",
  white: "#ffffff",
  wine: "#914e72",
  yellow: "#ffe800",
} as const;

type InkName = keyof typeof INK_HEX;

type InkInput = InkName | Rgb | `#${string}`;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;

function fromHex(hex: string): Rgb {
  if (!HEX.test(hex)) throw new Error(`@trebired/overprint: "${hex}" is not an ink name or a #rgb / #rrggbb colour`);
  const digits = hex.length === 4 ? [...hex.slice(1)].map((digit) => digit + digit).join("") : hex.slice(1);
  const value = Number.parseInt(digits, 16);
  return [(value >> 16)&255, (value >> 8)&255, value&255];
}

const inks = Object.fromEntries(Object.entries(INK_HEX).map(([name, hex]) => [name, fromHex(hex)])) as Record<InkName, Rgb>;

function inkOf(input: InkInput): Rgb {
  if (Array.isArray(input)) return input.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))) as unknown as Rgb;
  const named = (inks as Record<string, Rgb|undefined>)[input as string];
  return named || fromHex(input as string);
}

function inkCss(ink: Rgb, alpha = 1): string {
  return `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, ${alpha})`;
}

export { inkCss, inkOf, inks };
export type { InkInput, InkName };
