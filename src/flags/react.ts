import { createElement, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { Overprint } from "./../react/index.js";
import { polePrint } from "./pole.js";
import { flagPrint, type FlagPrintOptions } from "./print.js";
import { waveFlag, type FlagWaveOptions } from "./wave.js";
import type { FlagCode } from "./codes.js";

type FlagProps = FlagPrintOptions& {
  className?: string;
  code: FlagCode;
  pole?: boolean;
  style?: CSSProperties;
  wave?: FlagWaveOptions | false;
};

const CLOTH: CSSProperties = { aspectRatio: "3 / 2", display: "block", position: "relative", width: "100%" };

const HOISTED: CSSProperties = { ...CLOTH, gridColumn: "2 / span 2", gridRow: "2" };

const POLE: CSSProperties = {
  display: "block",
  gridColumn: "1 / span 2",
  gridRow: "1 / span 3",
  height: "100%",
  position: "relative",
  width: "100%",
  zIndex: 1,
};

const FINIAL: CSSProperties = { aspectRatio: "20 / 1", display: "block", gridColumn: "2 / span 2", gridRow: "1" };

const SHAFT: CSSProperties = { aspectRatio: "5 / 6", display: "block", gridColumn: "2 / span 2", gridRow: "3" };

function Flag({ className, code, misregistration, paper, pole, size, style, wave }: FlagProps) {
  const host = useRef<HTMLSpanElement>(null);
  const print = useMemo(() => flagPrint(code, { misregistration, paper, size }), [code, misregistration, paper, size]);
  const staff = useMemo(() => (pole ? polePrint(paper) : null), [paper, pole]);
  const waveKey = wave === false ? "" : JSON.stringify(wave || {});

  useEffect(() => {
      if (wave === false) return undefined;
      const cloth = host.current?.querySelector<HTMLElement>("[data-overprint-flag] > span") || null;
      return waveFlag(cloth, { ...(wave || {}), paper });
    }, [print, waveKey]);

  const layout: CSSProperties = pole
  ? { display: "grid", gridTemplateColumns: "3% 3% 1fr", gridTemplateRows: "auto auto auto", ...style }
  : { display: "block", ...style };
  return createElement(
    "span",
    { "aria-hidden": true, className, ref: host, style: layout },
    pole ? createElement("span", { style: FINIAL }) : null,
    createElement("span", { "data-overprint-flag": "", style: pole ? HOISTED : CLOTH },
      createElement(Overprint, { motion: false, print, style: { display: "block", inset: "0", position: "absolute" } })),
    pole ? createElement("span", { style: SHAFT }) : null,
    staff ? createElement(Overprint, { motion: false, print: staff, style: POLE }) : null,
  );
}

export { Flag };
export type { FlagProps };
