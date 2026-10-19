type Rgb = readonly [number, number, number];

type Point = readonly [number, number];

type Pixels = { data: Uint8ClampedArray; height: number; width: number };

type DitherMode = "atkinson" | "bayer" | "floyd-steinberg" | "threshold";

type Channel = "black" | "blue" | "cyan" | "green" | "magenta" | "red" | "yellow";

type DotShape = "circle" | "cross" | "ellipse" | "line" | "square";

type Blend = "multiply" | "screen";

type Context2D = CanvasRenderingContext2D;

type Surface = HTMLCanvasElement | OffscreenCanvas;

type SurfaceFactory = (width: number, height: number) => Surface;

type ToneSize = { height: number; scale: number; width: number };

type ToneSource = CanvasImageSource | ((context: Context2D, size: ToneSize) => void);

type SolidScreen = { kind: "solid" };

type HalftoneScreen = { angle?: number; cell: number; gain?: number; kind: "halftone"; shape?: DotShape };

type DitherScreen = { kind: "dither"; mode?: DitherMode; scale?: number; threshold?: number };

type Screen = DitherScreen | HalftoneScreen | SolidScreen;

export type {
  Blend,
  Channel,
  Context2D,
  DitherMode,
  DitherScreen,
  DotShape,
  HalftoneScreen,
  Pixels,
  Point,
  Rgb,
  Screen,
  SolidScreen,
  Surface,
  SurfaceFactory,
  ToneSize,
  ToneSource,
};
