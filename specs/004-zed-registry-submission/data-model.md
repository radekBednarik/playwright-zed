# Data Model: Zed Registry Submission

No runtime data. The entities are files and git objects whose consistency the registry
validates. Rules are quoted from the registry's `src/lib/validation.js` and the publishing
docs as read on 2026-10-13.

## Extension manifest (`extension.toml` in this repository)

| Field | Value at submission | Validation |
|-------|---------------------|------------|
| `id` | `playwright-runner` | `^[a-z0-9-]+$`; not starting `zed-`; not ending `-zed`; not containing `extension`; must equal the `extensions.toml` table key |
| `name` | `Playwright Runner` | not starting `Zed `; not ending ` Zed`; not containing `extension` (any case) |
| `version` | `0.4.0` | plain `major.minor.patch`; equals `extensions.toml` `version` at the submodule commit; equals `Cargo.toml` `version` (project rule) |
| `schema_version` | `1` | must be 1 when present |
| `authors`, `description`, `repository` | unchanged | required by the constitution; description keeps the non-affiliation notice |
| `capabilities` | `npm:install playwright-zed-language-server` only | prerequisite: no bundled server |
| `language_servers.playwright` | unchanged | internal key, not validated |

Derived: the built `manifest.json` carries `provides: ["language-servers"]`, which is what
the prerequisite's "only provides a language server" reading is based on. The id choice
`playwright-runner` is the owner's decision; see spec FR-003.

## Registry entry (in `../zed-extensions`)

| Artefact | Content | Validation |
|----------|---------|------------|
| `extensions.toml` table | `[playwright-runner]` with `submodule = "extensions/playwright-runner"` and `version = "0.4.0"` | submodule name equals `extensions/<id>` and equals the submodule path; version rules as above; file sorted |
| `.gitmodules` entry | path `extensions/playwright-runner`, url `https://github.com/radekBednarik/playwright-zed.git` | HTTPS scheme; file sorted |
| submodule gitlink | commit tagged `v0.4.0`, reachable from `main` | commit must be on a branch; no Git LFS in the submodule |

Relationship: entry key equals manifest `id`; entry version equals manifest `version` at
the gitlink commit. Both are checked by `package-extensions`.

## Submission commit (in this repository)

- Identity: the commit tagged `v0.4.0` on `main`.
- Invariants: `extension.toml` and `Cargo.toml` say 0.4.0; `LICENSE` at the root matches
  the registry's MIT pattern; builds with Rust 1.90 on `wasm32-wasip2` through the
  registry CLI; manual quickstart passed at this exact commit; `src/lib.rs` pins
  `playwright-zed-language-server` 0.3.0, which exists on npm.

## Licence file

- `LICENSE` at the repository root, MIT, copyright 2026 Radek Bednarik. Recognised by the
  registry matcher (verified by reading the matcher's required patterns). The language
  server has its own `server/LICENSE`; not required by the registry.

## Fact sheet and owner to-do list (`owner-handover.md`)

Structure and prohibitions are in [contracts/owner-handover.md](contracts/owner-handover.md).

State machine for the submission, tracked in `.claude/memory/playwright-zed-project.md`
and the README install section:

```text
prepared (hand-over written, registry clone ready)
  -> pr-open (owner pushed and opened the PR; PR number recorded)
  -> merged (listing live; README install section switches to registry-first)
  -> closed (owner fixes cause, opens a fresh PR; back to pr-open)
```

Transitions after "prepared" are reported by the owner; the agent records them.

## Verification record (`verification.md`)

Same shape as feature 003: date, environment, automated output blocks, manual scenario
table with outcomes, registry local-check output, and an explicit list of anything skipped
with the reason.
