import type { Context2D, DotShape, HalftoneScreen, Pixels } from "./../types.js";

const FAINT = 0.02;

function darknessOf(tone: Pixels, width: number, height: number) {
  const ratioX = tone.width / width;
  const ratioY = tone.height / height;
  return (x: number, y: number) => {
    const column = Math.min(tone.width - 1, Math.max(0, Math.floor(x * ratioX)));
    const row = Math.min(tone.height - 1, Math.max(0, Math.floor(y * ratioY)));
    const at = (row * tone.width + column) * 4;
    const luma = 0.299 * (tone.data[at] ?? 255) + 0.587 * (tone.data[at + 1] ?? 255) + 0.114 * (tone.data[at + 2] ?? 255);
    return (1 - luma / 255) * ((tone.data[at + 3] ?? 255) / 255);
  };
}

function dot(context: Context2D, shape: DotShape, u: number, v: number, cell: number, depth: number) {
  const size = cell * depth;
  if (shape === "circle") {
    context.moveTo(u + size / 2, v);
    context.arc(u, v, size / 2, 0, Math.PI * 2);
  } else if (shape === "ellipse") {
    context.moveTo(u + size * 0.35, v);
    context.ellipse(u, v, size * 0.35, size / 2, 0, 0, Math.PI * 2);
  } else if (shape === "square") {
    context.rect(u - size / 2, v - size / 2, size, size);
  } else {
    context.rect(u - cell / 2, v - size / 2, cell, size);
    if (shape === "cross") context.rect(u - size / 2, v - cell / 2, size, cell);
  }
}

function halftone(context: Context2D, tone: Pixels, screen: HalftoneScreen) {
  const { height, width } = context.canvas;
  const cell = Math.max(1, screen.cell);
  const darkness = darknessOf(tone, width, height);
  const gain = Math.max(0, screen.gain ?? 1);
  const turn = (-(screen.angle ?? 45) * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const reach = Math.hypot(width, height) / 2 + cell;
  context.save();
  context.setTransform(cos, sin, -sin, cos, width / 2, height / 2);
  context.beginPath();
  for (let u = -reach; u <= reach; u += cell) {
    for (let v = -reach; v <= reach; v += cell) {
      const across = width / 2 + u * cos - v * sin;
      const down = height / 2 + u * sin + v * cos;
      if (across < -cell || down < -cell || across > width + cell || down > height + cell) continue;
      const depth = darkness(across, down);
      if (depth > FAINT) dot(context, screen.shape || "circle", u, v, cell, depth * gain);
    }
  }
  context.fill();
  context.restore();
}

export { halftone };
