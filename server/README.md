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

License: MIT.
