type FlagSource = { body: string; viewBox: string };

const NAMED: Record<string, string> = {
  black: "#000000",
  blue: "#0000ff",
  green: "#008000",
  navy: "#000080",
  red: "#ff0000",
  white: "#ffffff",
  yellow: "#ffff00",
};

const DEFAULT_INK = "#000000";

const COLOUR_ATTR = /\b(fill|stroke)="([^"]*)"/gu;

const SHAPE = /<(path|rect|circle|ellipse|polygon|polyline)\b([^>]*)>/gu;

function colourKey(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "none" || raw.startsWith("url(") || raw === "transparent") return null;
  const named = NAMED[raw];
  if (named) return named;
  if (/^#[0-9a-f]{3}$/u.test(raw)) return `#${[...raw.slice(1)].map((digit) => digit + digit).join("")}`;
  return /^#[0-9a-f]{6}$/u.test(raw) ? raw : DEFAULT_INK;
}

function sourceOf(markup: string): FlagSource {
  const open = /<svg\b[^>]*>/u.exec(markup);
  if (!open) throw new Error("@trebired/overprint: a flag needs <svg> markup");
  const viewBox = /viewBox="([^"]+)"/u.exec(open[0])?.[1] || "0 0 513 342";
  return { body: markup.slice(open.index + open[0].length, markup.lastIndexOf("</svg>")), viewBox };
}

function usesDefaultFill(body: string): boolean {
  if (/<g\b[^>]*\bfill="/u.test(body)) return false;
  return [...body.matchAll(SHAPE)].some((match) => !/\bfill="/u.test(match[2] || ""));
}

function coloursOf(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(COLOUR_ATTR)) {
    const key = colourKey(match[2] || "");
    if (key) found.add(key);
  }
  if (usesDefaultFill(body)) found.add(DEFAULT_INK);
  return [...found];
}

function lightness(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16)&255, (value >> 8)&255, value&255];
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
}

function separation(source: FlagSource, colour: string, id: string): string {
  const pick = (value: string) => (colourKey(value) === colour ? "#fff" : "#000");
  const body = source.body.replace(COLOUR_ATTR, (whole, name: string, value: string) => {
      return colourKey(value) === null && !value.startsWith("url(") ? whole : `${name}="${pick(value)}"`;
  });
  const [x, y, width, height] = source.viewBox.split(/[\s,]+/u);
  const area = `x="${x}" y="${y}" width="${width}" height="${height}"`;
  const mask = `<mask id="${id}" maskUnits="userSpaceOnUse" ${area}><g fill="${pick(DEFAULT_INK)}">${body}</g></mask>`;
  return `<defs>${mask}</defs><rect ${area} fill="#fff" mask="url(#${id})"/>`;
}

export { coloursOf, lightness, separation, sourceOf };
export type { FlagSource };
