import { createElement, useEffect, useId, useMemo, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { animatePrint, type AnimateOptions } from "./../motion/animate.js";
import { plateNodes } from "./../svg/print.js";
import type { OverprintNode } from "./../svg/node.js";
import type { Print } from "./../types.js";

type OverprintProps = {
  as?: "div" | "span";
  className?: string;
  motion?: AnimateOptions | false;
  print: Print;
  style?: CSSProperties;
};

function camel(name: string): string {
  if (name.startsWith("aria-") || name.startsWith("data-") || name.startsWith("--")) return name;
  return name.replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
}

function styleObject(value: string): Record<string, string> {
  const entries = value.split(";").map((rule) => {
      const at = rule.indexOf(":");
      return at < 0 ? null : [camel(rule.slice(0, at).trim()), rule.slice(at + 1).trim()] as const;
  });
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

function propsOf(node: OverprintNode, key: number): Record<string, unknown> {
  const props: Record<string, unknown> = { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    if (value === undefined) continue;
    if (name === "class") props.className = value;
    else if (name === "style") props.style = styleObject(String(value));
    else props[camel(name)] = value;
  }
  if (node.raw !== undefined) props.dangerouslySetInnerHTML = { __html: node.raw };
  return props;
}

function toReact(node: OverprintNode | string, key: number): ReactNode {
  if (typeof node === "string") return node;
  const children = node.raw === undefined ? node.children.map(toReact) : undefined;
  return createElement(node.tag, propsOf(node, key), ...(children || []));
}

function Overprint({ as = "span", className, motion, print, style }: OverprintProps) {
  const id = `op${useId().replace(/[^\w-]/gu, "")}`;
  const root = useRef<HTMLElement>(null);
  const plates = useMemo(() => plateNodes(print, id, { share: true }).map(toReact), [id, print]);

  useEffect(() => (motion === false ? undefined : animatePrint(root.current, print, motion)), [motion, print]);

  return createElement(as, { "aria-hidden": true, className, ref: root, style: { isolation: "isolate", ...style } }, plates);
}

export { Overprint };
export type { OverprintProps };
