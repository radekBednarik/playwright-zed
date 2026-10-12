# Playwright for Zed

Zed extension that mirrors the Playwright VS Code extension. Rust/WASM shell at the root,
Node language server in `server/`, sample project in `fixtures/sample-project/`.

## Governance and workflow

- Constitution: `.specify/memory/constitution.md` (binding; Zed publishing rules win).
- Features follow Spec Kit: `specs/<nnn>-<name>/` holds spec, plan, research, contracts,
  tasks, quickstart and the verification record. Parity with upstream is tracked in
  `docs/parity.md`.
- Never bundle the language server; the shell installs `playwright-zed-language-server`
  from npm. `npm publish` and anything else outward-facing needs the owner's explicit OK.

## Commands

```sh
cargo test && cargo build --release --target wasm32-wasip2
cd server && npm run lint && npm test && npm run build     # needs Chromium + network for fixture
```

## Memory

@.claude/memory/playwright-zed-project.md
@.claude/memory/dev-environment-wsl-zed.md
