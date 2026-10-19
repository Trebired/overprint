import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveLogger } from "@package/logger-adapter";

const log = resolveLogger({ source: "@trebired/overprint" });

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tempRoot = path.join(rootDir, ".tmp", "verify-pack");
const consumerDir = path.join(tempRoot, "consumer");
const packageVersion = JSON.parse(
  await fs.readFile(path.join(rootDir, "package.json"), "utf8"),
).version;

async function main() {
  await fs.rm(tempRoot, { force: true, recursive: true });
  await fs.mkdir(consumerDir, { recursive: true });

  const tarball = packPackage();
  const entries = listTarEntries(tarball);

  assertPackedFiles(entries, tarball);
  await runConsumerSmokeTest(tarball);

  log.info("verify.pack", "Pack verification succeeded.");
}

function packPackage() {
  execFileSync("bun", ["pm", "pack", "--destination", tempRoot], {
      cwd: rootDir,
      stdio: "inherit",
  });
  const created = execFileSync("ls", [tempRoot], { encoding: "utf8" })
  .split("\n")
  .find((name) => name.endsWith(".tgz"));
  if (!created) throw new Error("pack produced no tarball");
  return path.join(tempRoot, created);
}

function listTarEntries(tarball) {
  return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
  .split("\n")
  .map((line) => line.replace(/^package\//u, "").trim())
  .filter(Boolean);
}

function assertPackedFiles(entries, tarball) {
  const required = [
    "package.json",
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/native/kernels.js",
  ];
  for (const file of required) {
    if (!entries.includes(file)) throw new Error(`packed tarball is missing ${file}`);
  }
  const loader = execFileSync("tar", ["-xzOf", tarball, "package/dist/native/kernels.js"], { encoding: "utf8" });
  if (loader.includes("@trebired/overprint:wasm")) throw new Error("packed kernels.js still carries the wasm placeholder");
  const leaked = entries.filter((entry) => ["src/", "scripts/", "native/"].some((prefix) => entry.startsWith(prefix)));
  if (leaked.length) throw new Error(`packed tarball leaks source files: ${leaked.join(", ")}`);
}

async function runConsumerSmokeTest(tarball) {
  await fs.writeFile(
    path.join(consumerDir, "package.json"),
    `${JSON.stringify({ name: "overprint-consumer", private: true, type: "module", version: "0.0.0" }, null, 2)}\n`,
  );

  execFileSync("bun", ["add", tarball], { cwd: consumerDir, stdio: "inherit" });

  await fs.writeFile(
    path.join(consumerDir, "smoke.mjs"),
    [
      'import { coverage, dither, inks } from "@trebired/overprint";',
      "const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);",
      "const covered = coverage({ data, height: 1, width: 2 }, { ink: inks.teal });",
      'if (covered.data[3] !== 255 || covered.data[7] !== 0) throw new Error("bad coverage");',
      'const dotted = dither({ data, height: 1, width: 2 }, { mode: "atkinson" });',
      'if (dotted.data[3] !== 255 || dotted.data[7] !== 0) throw new Error("bad dither");',
      'console.log("consumer smoke test succeeded.");',
    ].join("\n"),
  );

  execFileSync("bun", ["smoke.mjs"], { cwd: consumerDir, stdio: "inherit" });
}

await main();
