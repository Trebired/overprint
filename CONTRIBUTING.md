# Contributing

Expected runtime: Bun. This repository never uses npm and never commits a `package-lock.json`.

The pixel kernels are Rust. Building them needs a Rust toolchain with the WebAssembly target:

```sh
rustup target add wasm32-unknown-unknown
```

Install:

```sh
bun i
```

Checks maintainers run before publishing:

```sh
bunx code-discipline check
bun run typecheck
bun run build
bun run verify:native
bun run verify:overprint
bun run verify:pack
```

`bun run prepublishOnly` chains the typecheck, `verify:native`, `verify:overprint`, and `verify:pack` gate.

`bun run build` compiles the TypeScript, then builds the crate in `native/` and embeds the module into `dist/native/kernels.js`. The source in `src/` carries only a placeholder for it.

Generated output stays out of Git: `dist/`, `native/target/`, `*.tgz`, `.tmp/`, and discipline report files.

Code Discipline owns alias consistency, file and function size limits, comment removal, and formatting, Rust files included. Run `bunx code-discipline fix <rule>` for a single rule and re-run `bun run typecheck` afterwards. Never run a bare `code-discipline fix`.

This repository has no test suite beyond the crate's own unit tests. Verification is executable and lives in `scripts/verify/`.
