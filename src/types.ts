import type { InkInput } from "./inks.js";

type Rgb = readonly [number, number, number];

type Point = readonly [number, number];

type Pixels = { data: Uint8ClampedArray; height: number; width: number };

type DitherMode = "atkinson" | "bayer" | "floyd-steinberg" | "threshold";

type Channel = "black" | "blue" | "cyan" | "green" | "magenta" | "red" | "yellow";

type DotShape = "circle" | "cross" | "ellipse" | "line" | "square";

type Paper = "dark" | "light";

type Box = { height?: number; width?: number; x?: number; y?: number };

type Fit = "fill" | "meet" | "slice";

type Align = "center" | "end" | "start";

type Placement = { align?: Align; box?: Box; fit?: Fit; rotate?: number };

type FillArt = { kind: "fill" };

type PathArt = Placement& { d: string; kind: "path"; rule?: "evenodd" | "nonzero"; viewBox?: Point };

type ImageArt = Placement& { href: string; kind: "image" };

type SvgArt = Placement& { kind: "svg"; markup: string; viewBox: string };

type TextArt = { anchor?: "end" | "middle" | "start"; kind: "text"; size?: string; text: string; x?: number; y?: number };

type GroupArt = { kind: "group"; parts: readonly Art[]; rotate?: number };

type Art = FillArt | GroupArt | ImageArt | PathArt | SvgArt | TextArt;

type FlatTone = { kind: "flat"; level: number };

type LinearTone = { from: Point; kind: "linear"; range?: Point; to: Point };

type RadialTone = { at: Point; kind: "radial"; range?: Point; reach: number };

type ImageTone = { href: string; kind: "image" };

type PixelTone = { kind: "pixels"; pixels: Pixels };

type Tone = FlatTone | ImageTone | LinearTone | PixelTone | RadialTone;

type SolidScreen = { kind: "solid" };

type HalftoneScreen = { angle?: number; cell?: number; cells?: number; dot?: DotShape; gain?: number; kind: "halftone" };

type DitherScreen = { grain?: number; kind: "dither"; mode?: DitherMode; threshold?: number };

type Screen = DitherScreen | HalftoneScreen | SolidScreen;

type Knockout = string | { plate: string; spread?: number };

type Wave = { amplitude?: number; along?: Point; length?: number; period?: number; shade?: number };

type PlateMotion = { drift?: number; pull?: number };

type Plate = {
  art: Art;
  hidden?: boolean;
  ink: InkInput;
  knockout?: readonly Knockout[];
  motion?: PlateMotion;
  name?: string;
  offset?: Point;
  screen?: Screen;
  tone?: Tone;
  wave?: Wave;
};

type Print = { paper?: Paper; plates: readonly Plate[]; size?: Point };

export type {
  Align,
  Art,
  Box,
  Channel,
  DitherMode,
  DitherScreen,
  DotShape,
  FillArt,
  Fit,
  FlatTone,
  GroupArt,
  HalftoneScreen,
  ImageArt,
  ImageTone,
  Knockout,
  LinearTone,
  Paper,
  PathArt,
  PixelTone,
  Pixels,
  Placement,
  Plate,
  PlateMotion,
  Point,
  Print,
  RadialTone,
  Rgb,
  Screen,
  SolidScreen,
  SvgArt,
  TextArt,
  Tone,
  Wave,
};
