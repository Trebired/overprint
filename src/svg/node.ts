type Attrs = Record<string, number|string|undefined>;

type OverprintNode = { attrs: Attrs; children: (OverprintNode | string)[]; raw?: string; tag: string };

const ESCAPES: Record<string, string> = { "\"": "&quot;", "&": "&amp;", "'": "&#39;", "<": "&lt;", ">": "&gt;" };

function escape(value: string): string {
  return value.replace(/["&'<>]/gu, (letter) => ESCAPES[letter] || letter);
}

function el(tag: string, attrs: Attrs = {}, children: (OverprintNode | string | null | undefined | false)[] = []): OverprintNode {
  return { attrs, children: children.filter((child): child is OverprintNode | string => Boolean(child)), tag };
}

function raw(tag: string, attrs: Attrs, markup: string): OverprintNode {
  return { attrs, children: [], raw: markup, tag };
}

function attributes(attrs: Attrs): string {
  return Object.entries(attrs)
  .filter((entry): entry is[string, number | string] => entry[1] !== undefined)
  .map(([name, value]) => ` ${name}="${escape(String(value))}"`)
  .join("");
}

function toMarkup(node: OverprintNode | string): string {
  if (typeof node === "string") return escape(node);
  const inner = node.raw ?? node.children.map(toMarkup).join("");
  return `<${node.tag}${attributes(node.attrs)}>${inner}</${node.tag}>`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function percent(value: number): string {
  return `${round(value * 100)}%`;
}

export { el, escape, percent, raw, round, toMarkup };
export type { Attrs, OverprintNode };
