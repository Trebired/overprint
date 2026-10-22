import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLogger } from "@package/logger-adapter";

const log = resolveLogger({ source: "@trebired/overprint" });

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const overprint = await import(path.join(rootDir, "dist", "index.js"));

const failures = [];

function check(name, condition, detail = "") {
  if (condition) return;
  failures.push(detail ? `${name}: ${detail}` : name);
}

function ramp(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    const value = Math.round(((index % width) / (width - 1)) * 255);
    data.set([value, value, value, 255], index * 4);
  }
  return { data, height, width };
}

function solid(rgba, width = 4, height = 4) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) data.set(rgba, index * 4);
  return { data, height, width };
}

const share = (pixels) => {
  let inked = 0;
  for (let index = 3; index < pixels.data.length; index += 4) if (pixels.data[index] === 255) inked++;
  return inked / (pixels.width * pixels.height);
};

function verifyInks() {
  check("ink table carries the standard blue", overprint.inks.blue.join() === "0,120,191", overprint.inks.blue.join());
  check("ink names resolve", overprint.inkOf("fluorescentPink").join() === "255,72,176");
  check("short hex resolves", overprint.inkOf("#abc").join() === "170,187,204");
  check("rgb input clamps", overprint.inkOf([300, -4, 2.4]).join() === "255,0,2");
  let refused = false;
  try {
    overprint.inkOf("not-an-ink");
  } catch {
    refused = true;
  }
  check("unknown inks are refused", refused);
}

function verifyCoverage() {
  const tone = ramp(32, 2);
  const covered = overprint.coverage(tone, { ink: "blue" });
  check("coverage leaves the source untouched", tone.data[3] === 255 && tone.data[0] === 0);
  check("black becomes full coverage", covered.data[3] === 255, String(covered.data[3]));
  check("white becomes no coverage", covered.data[31 * 4 + 3] === 0, String(covered.data[31 * 4 + 3]));
  check("coverage is tinted with the ink", [...covered.data.slice(0, 3)].join() === "0,120,191");
  const clear = overprint.coverage(solid([0, 0, 0, 0]));
  check("transparent pixels carry no ink", clear.data[3] === 0);
}

function verifyDither() {
  const flat = solid([128, 128, 128, 255], 8, 8);
  check("threshold inks a grey darker than the cut", share(overprint.dither(flat, { mode: "threshold", threshold: 129 })) === 1);
  check("threshold leaves a grey lighter than the cut", share(overprint.dither(flat, { mode: "threshold", threshold: 127 })) === 0);
  for (const mode of ["atkinson", "floyd-steinberg", "bayer"]) {
    const grey = overprint.dither(solid([128, 128, 128, 255], 64, 64), { mode });
    check(`${mode} keeps mid grey near half coverage`, Math.abs(share(grey) - 0.5) < 0.1, String(share(grey)));
    const binary = [...grey.data].every((value, index) => index % 4 !== 3 || value === 0 || value === 255);
    check(`${mode} prints only full dots`, binary);
  }
  const dark = overprint.dither(ramp(128, 16), { mode: "atkinson", threshold: 200 });
  const light = overprint.dither(ramp(128, 16), { mode: "atkinson", threshold: 60 });
  check("a higher threshold inks more", share(dark) > share(light), `${share(dark)} vs ${share(light)}`);
}

function verifySeparation() {
  const cyan = solid([0, 255, 255, 255]);
  check("cyan lands on the cyan drum", overprint.separate(cyan, "cyan").data[3] === 255);
  check("cyan leaves the magenta drum empty", overprint.separate(cyan, "magenta").data[3] === 0);
  check("black lands on the key drum", overprint.separate(solid([0, 0, 0, 255]), "black").data[3] === 255);
  check("red channel reads intensity", overprint.separate(solid([255, 0, 0, 255]), "red").data[3] === 255);
}

const SUN = "M0.98 0.5A0.48 0.48 0 1 1 0.02 0.5A0.48 0.48 0 1 1 0.98 0.5Z";

const PRINT = {
  plates: [
    {
      art: { d: SUN, kind: "path" },
      ink: "blue",
      name: "disc",
      screen: { angle: 30, cell: 9, kind: "halftone" },
      tone: { at: [0.5, 0.5], kind: "radial", reach: 0.6 },
    },
    { art: { kind: "fill" }, ink: "fluorescentPink", knockout: [{ plate: "disc", spread: 6 }], screen: { kind: "dither", mode: "atkinson" } },
    { art: { kind: "text", text: "<b>&" }, hidden: true, ink: "yellow", name: "mask" },
    { art: { kind: "fill" }, ink: "teal", screen: { grain: 2, kind: "dither", mode: "bayer" }, wave: { shade: 0.5 } },
  ],
  size: [200, 120],
};

const count = (text, pattern) => (text.match(pattern) || []).length;

function verifyMarkup() {
  const markup = overprint.renderPrint(PRINT, { className: "print", id: "demo" });
  check("markup opens with the root span", markup.startsWith('<span aria-hidden="true" class="print"'), markup.slice(0, 60));
  check("one svg layer per visible plate", count(markup, /<svg aria-hidden/gu) === 3, String(count(markup, /<svg aria-hidden/gu)));
  check("ids carry the caller prefix", markup.includes('id="demo-0m"') && !markup.includes('id="overprint'));
  check("halftone thresholds into the ink", markup.includes("feColorMatrix") && markup.includes("0 0 0 0 0 0 0 0 0 0.471 0 0 0 0 0.749"));
  check("knockout spreads the named plate", markup.includes('operator="dilate" radius="6"'));
  check("error diffusion embeds a PNG mask", markup.includes("data:image/png;base64,"));
  check("bayer dither stays vector", count(markup, /<rect fill="#[0-9a-f]{2}0000"/gu) === 64);
  check("waves displace and respect reduced motion", markup.includes("feDisplacementMap") && markup.includes("prefers-reduced-motion"));
  check("waves move the map with an animate on the filter image, which browsers re-render", markup.includes('<animate attributeName="x"'));
  check("art that stays in its box keeps its filters to the box", markup.includes('height="112%" width="112%" x="-6%" y="-6%"'));
  check("art used by two plates prints once and is reused", count(markup, /d="M0\.98 0\.5A/gu) === 1 && markup.includes('<use href="#demo-r0">'));
  check("rendering is deterministic", markup === overprint.renderPrint(PRINT, { className: "print", id: "demo" }));
  check(
    "every plate prints ink with grain, mottling and rough edges, never flat",
    count(markup, /<feTurbulence/gu) === 9 && count(markup, /result="rough"/gu) === 3
  );
  const words = { kind: "text", text: "<b>&" };
  const text = overprint.renderPrint({ plates: [{ art: words, ink: "black" }, { art: words, ink: "blue", offset: [2, 1] }] }, { id: "t" });
  check("text art is escaped", text.includes("&lt;b&gt;&amp;") && !text.includes("<b>&"));
}

function verifyRegions() {
  const tilted = { box: { height: 0.5, width: 0.5, x: 0.25, y: 0.25 }, d: SUN, kind: "path", rotate: 30 };
  const turned = overprint.renderPrint({ plates: [{ art: tilted, ink: "blue" }, { art: tilted, ink: "yellow" }] }, { id: "r" });
  check("tilted art reaches past the box so it keeps its edges", turned.includes('height="200%" width="200%" x="-50%" y="-50%"'));
  const loose = { d: "M0 0L1.4 0L1.4 1Z", kind: "path" };
  const spilled = overprint.renderPrint({ plates: [{ art: loose, ink: "blue" }, { art: loose, ink: "yellow" }] }, { id: "s" });
  check("a path drawn past its view box reaches past the box", spilled.includes('x="-50%"'));
  const markup = { kind: "svg", markup: "<rect width=\"10\" height=\"10\"/>", viewBox: "0 0 10 10" };
  const open = overprint.renderPrint({ plates: [{ art: markup, ink: "blue" }, { art: markup, ink: "yellow" }] }, { id: "o" });
  const clipped = overprint.renderPrint({ plates: [
        { art: { ...markup, clip: true }, ink: "blue" },
        { art: { ...markup, clip: true }, ink: "yellow" }
      ] }, { id: "c" });
  check(
    "svg markup reaches past the box unless clipped",
    open.includes('x="-50%"') && clipped.includes('x="-6%"') && clipped.includes('overflow="hidden"')
  );
  const layers = overprint.printLayers(PRINT, { id: "l" }).layers.map((layer) => decodeURIComponent(layer.image));
  check("printLayers keeps every plate a standalone image", layers.every((image) => !image.includes("<use")));
}

function verifyRefusals() {
  const refused = (work) => {
    try {
      work();
      return false;
    } catch {
      return true;
    }
  };
  const unknown = { plates: [{ art: { kind: "fill" }, ink: "blue", knockout: ["nope"] }, { art: { kind: "fill" }, ink: "yellow" }] };
  check("an unknown knockout is refused", refused(() => overprint.renderPrint(unknown)));
  check("an id that cannot start an element id is refused", refused(() => overprint.renderPrint(PRINT, { id: "9x" })));
  check("an image tone cannot feed error diffusion", refused(() => overprint.renderPrint({
          plates: [
            { art: { kind: "fill" }, ink: "blue", screen: { kind: "dither", mode: "atkinson" }, tone: { href: "/a.png", kind: "image" } },
            { art: { kind: "fill" }, ink: "yellow" },
          ],
  })));
  verifyOverprintRule(refused);
}

function verifyOverprintRule(refused) {
  const disc = { d: SUN, kind: "path" };
  const lone = { plates: [{ art: disc, ink: "blue" }] };
  check("a single plate is refused: one ink is not an overprint", refused(() => overprint.renderPrint(lone)));
  check("a single plate cannot become a fill either", refused(() => overprint.printFill(lone)));
  const apart = { plates: [{ art: disc, ink: "blue" }, { art: { d: "M0 0H1V1Z", kind: "path" }, ink: "yellow" }] };
  check("plates that never print the same art are refused", refused(() => overprint.renderPrint(apart)));
  const hiddenOnly = { plates: [{ art: disc, ink: "blue" }, { art: disc, hidden: true, ink: "yellow" }] };
  check("a hidden plate does not count as an ink", refused(() => overprint.renderPrint(hiddenOnly)));
  const pair = { plates: [{ art: disc, ink: "blue" }, { art: disc, ink: "yellow", offset: [3, 2] }] };
  check("two plates on the same art overprint", !refused(() => overprint.renderPrint(pair)));
}

function verifyPng() {
  const bytes = overprint.encodePng(solid([0, 120, 191, 255], 9, 3), { mask: true });
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  check("png carries its signature", bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71);
  check("png header records the size", view.getUint32(16) === 9 && view.getUint32(20) === 3);
  check("mask png is one bit per pixel", bytes[24] === 1 && bytes[25] === 3);
}

function verifyFill() {
  const print = {
    paper: "dark",
    plates: [
      { art: { kind: "fill" }, ink: "blue", offset: [4, -3], screen: { cell: 6, kind: "halftone" } },
      { art: { kind: "fill" }, hidden: true, ink: "yellow" },
      { art: { kind: "fill" }, ink: "fluorescentPink", screen: { angle: 45, cell: 5, dot: "line", kind: "halftone" } },
    ],
  };
  const fill = overprint.printFill(print);
  const layers = fill.backgroundImage.split("url(\"data:").length - 1;
  check("printFill makes one background layer per visible plate", layers === 2, `got ${layers}`);
  check("printFill puts the last plate on top", fill.backgroundPosition === "0px 0px, 4px -3px", fill.backgroundPosition);
  check("printFill blends dark paper by screen", fill.backgroundBlendMode === "screen, screen", fill.backgroundBlendMode);
  const clipped = fill.backgroundClip === "text" && fill.WebkitBackgroundClip === "text" && fill.color === "transparent";
  check("printFill clips to text and empties the fill", clipped);
  const first = decodeURIComponent(fill.backgroundImage.slice(fill.backgroundImage.indexOf(",") + 1));
  check("printFill layers are standalone SVG without layer positioning", first.startsWith("<svg") && !first.includes("position:absolute"));
  const light = { plates: [print.plates[0], print.plates[2]] };
  check("printFillCss carries the same layers", overprint.printFillCss(light).includes("background-blend-mode:multiply, multiply"));
  const layered = overprint.printLayers(print);
  check("printLayers returns every visible plate bottom first with its offset", layered.layers.length === 2 && layered.layers[0].offset[0] === 4);
  check("printLayers names the blend of the paper", layered.blend === "screen");
}

async function verifyReact() {
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { Overprint } = await import(path.join(rootDir, "dist", "react", "index.js"));
  const markup = renderToString(createElement(Overprint, { className: "print", print: PRINT }));
  check("react renders one svg layer per visible plate", count(markup, /<svg aria-hidden/gu) === 3, String(count(markup, /<svg aria-hidden/gu)));
  const kebab = markup.includes("color-interpolation-filters") && markup.includes("stop-color");
  check("react keeps svg attribute names", kebab && !markup.includes("stopColor"));
  check("react inlines the root isolation", markup.includes("isolation:isolate"));
}

await overprint.prepareKernels();
verifyInks();
verifyCoverage();
verifyDither();
verifySeparation();
verifyMarkup();
verifyRegions();
verifyRefusals();
verifyPng();
verifyFill();
await verifyReact();

if (failures.length > 0) {
  for (const failure of failures) log.error("verify.overprint", failure);
  process.exit(1);
}

log.info("verify.overprint", "Overprint verification succeeded.");
