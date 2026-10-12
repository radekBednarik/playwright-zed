# playwright-zed-language-server

Language server behind the [Playwright for Zed](https://github.com/radekBednarik/playwright-zed)
extension. The Zed extension installs this package from npm at runtime; you do not need to
install it yourself.

It detects Playwright workspaces, discovers tests through `playwright test --list`, and runs
tests with the `@playwright/test` package installed in your project, reporting results back to
the editor over the Language Server Protocol.

Usage: `playwright-zed-language-server --stdio`.

This is an independent community project, not affiliated with, endorsed by, or maintained by
Microsoft or the Playwright team. "Playwright" is a trademark of Microsoft Corporation. The
package contains no Playwright code and does not bundle Playwright.

**Work in progress.** This is the first slice of the extension (detection, run at cursor,
run file, re-run last). Expect breaking changes between minor versions; the extension pins the
exact server version it was built against.

**Built with AI assistance.** The server, like the rest of the extension, is developed with
AI assistance throughout, using GitHub Spec Kit driven by Claude Code with the Claude models
Fable and Opus, with maintainer review and recorded verification for every feature.

License: MIT.
