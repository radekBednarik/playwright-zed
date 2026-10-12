# Contract: Zed Extension Manifest and Rust Surface

## extension.toml

```toml
id = "playwright"
name = "Playwright"
version = "0.1.0"
schema_version = 1
authors = ["Radek Bednarik <radek.bednarik@tesena.com>"]
description = "Run and manage Playwright end-to-end tests from Zed, mirroring the Playwright VS Code extension."
repository = "https://github.com/radekBednarik/playwright-zed"

capabilities = [
  { kind = "npm:install", package = "playwright-zed-language-server" },
]

[language_servers.playwright]
name = "Playwright"
languages = ["TypeScript", "TSX", "JavaScript"]

[language_servers.playwright.language_ids]
"TypeScript" = "typescript"
"TSX" = "typescriptreact"
"JavaScript" = "javascript"
```

`capabilities` MUST appear before the first `[table]` header: a top-level key placed after a
table header belongs to that table, and Zed then rejects the manifest ("invalid type:
sequence, expected a string").

Rules: no `grammars`, no `languages` directory, no `slash_commands`, no bundled binaries.
`version` here must equal the `version` entry in `zed-industries/extensions/extensions.toml`
at the submitted commit.

## Cargo.toml

```toml
[package]
name = "playwright-zed"
version = "0.1.0"
edition = "2021"
license = "MIT"

[lib]
crate-type = ["cdylib"]

[dependencies]
zed_extension_api = "0.7.0"
```

## Rust surface (src/lib.rs)

| Item | Contract |
|------|----------|
| `struct PlaywrightExtension` | Holds `server_entry: Option<String>` (cached path) and `checked_latest: bool`. |
| `Extension::new` | Returns defaults; no I/O. |
| `Extension::language_server_command(id, worktree)` | Ensures `playwright-zed-language-server@<PINNED>` is installed via `npm_install_package` when `npm_package_installed_version` differs; sets installation status `CheckingForUpdate` / `Downloading` / `None` / `Failed(msg)`; returns `Command { command: node, args: [entry, "--stdio"], env: [] }`. Never returns `Err` for "not a Playwright workspace". Returns `Err` with the npm or node error text when installation or node resolution fails. |
| `PINNED_SERVER_VERSION` | `const &str`, bumped together with the server package. |
| `fn node_path(worktree) -> Result<String>` | `zed::node_binary_path()` first, then `worktree.which("node")`, else `Err("Node.js was not found on PATH; Playwright needs Node to run")`. |
| `fn dev_server_entry(worktree) -> Option<String>` | Reads `PLAYWRIGHT_ZED_SERVER_ENTRY` from `worktree.shell_env()` (never `std::env::var`, which is empty in WASM). When set and non-empty, that path is used as the server entry verbatim and npm install is skipped. The path is not checked for existence: Zed's WASI sandbox preopens only the extension work directory (`crates/extension_host/src/wasm_host.rs`, `build_wasi_ctx`), so `fs::metadata` on any outside path fails. A wrong path shows up as Node's "Cannot find module" error in Zed's language server status. Development-only; documented in README and quickstart. |
| `fn server_entry(workdir) -> String` | `node_modules/playwright-zed-language-server/bin/playwright-zed-language-server.js` under the extension work dir. |

Pure helpers (`version_differs(installed: Option<&str>, pinned: &str) -> bool`,
`server_entry`) are unit-tested on the host with `cargo test`.

## Build and verification commands

```sh
rustup target add wasm32-wasip2
cargo test
cargo build --release --target wasm32-wasip2
```
