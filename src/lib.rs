//! Zed extension shell for Playwright.
//!
//! The shell has one job: make sure the `playwright-zed-language-server` npm package is
//! installed in the extension's work directory and tell Zed how to start it for TypeScript,
//! TSX and JavaScript worktrees. All Playwright logic lives in that server.
//!
//! Pure helpers (`version_differs`, `server_entry`, `dev_server_entry_from_env`) are covered
//! by `cargo test` on the host; the `zed_extension_api` crate compiles on the host as well.

/// npm package that contains the language server.
pub const SERVER_PACKAGE: &str = "playwright-zed-language-server";

/// Server version this shell was built against. Bump together with `server/package.json`.
pub const PINNED_SERVER_VERSION: &str = "0.1.0";

/// Environment variable that points at a local server entry during development.
pub const DEV_SERVER_ENTRY_VAR: &str = "PLAYWRIGHT_ZED_SERVER_ENTRY";

/// Returns true when the installed server version is missing or differs from the pin.
pub fn version_differs(installed: Option<&str>, pinned: &str) -> bool {
    match installed {
        None => true,
        Some(v) => v != pinned,
    }
}

/// Path of the server entry script inside the extension work directory.
pub fn server_entry(workdir: &str) -> String {
    let workdir = workdir.trim_end_matches('/');
    format!(
        "{workdir}/node_modules/{SERVER_PACKAGE}/bin/{SERVER_PACKAGE}.js"
    )
}

/// Extracts the development override from a shell environment, ignoring empty values.
pub fn dev_server_entry_from_env(env: &[(String, String)]) -> Option<String> {
    env.iter()
        .find(|(key, _)| key == DEV_SERVER_ENTRY_VAR)
        .map(|(_, value)| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_differs_when_nothing_installed() {
        assert!(version_differs(None, "0.1.0"));
    }

    #[test]
    fn version_does_not_differ_when_equal() {
        assert!(!version_differs(Some("0.1.0"), "0.1.0"));
    }

    #[test]
    fn version_differs_when_other_version_installed() {
        assert!(version_differs(Some("0.0.9"), "0.1.0"));
    }

    #[test]
    fn server_entry_points_into_node_modules() {
        assert_eq!(
            server_entry("/work/dir"),
            "/work/dir/node_modules/playwright-zed-language-server/bin/playwright-zed-language-server.js"
        );
    }

    #[test]
    fn server_entry_tolerates_trailing_slash() {
        assert_eq!(server_entry("/work/dir/"), server_entry("/work/dir"));
    }

    #[test]
    fn dev_override_is_read_from_shell_env() {
        let env = vec![
            ("PATH".to_string(), "/usr/bin".to_string()),
            (DEV_SERVER_ENTRY_VAR.to_string(), " /repo/server/bin/x.js ".to_string()),
        ];
        assert_eq!(
            dev_server_entry_from_env(&env).as_deref(),
            Some("/repo/server/bin/x.js")
        );
    }

    #[test]
    fn dev_override_ignores_empty_value() {
        let env = vec![(DEV_SERVER_ENTRY_VAR.to_string(), "   ".to_string())];
        assert_eq!(dev_server_entry_from_env(&env), None);
        assert_eq!(dev_server_entry_from_env(&[]), None);
    }
}

mod extension {
    use super::{
        dev_server_entry_from_env, server_entry, version_differs, PINNED_SERVER_VERSION,
        SERVER_PACKAGE,
    };
    use std::fs;
    use zed_extension_api::{self as zed, LanguageServerId, LanguageServerInstallationStatus, Result};

    struct PlaywrightExtension {
        server_entry: Option<String>,
        checked_latest: bool,
    }

    impl PlaywrightExtension {
        fn node_path(&self, worktree: &zed::Worktree) -> Result<String> {
            if let Ok(path) = zed::node_binary_path() {
                return Ok(path);
            }
            worktree.which("node").ok_or_else(|| {
                "Node.js was not found on PATH; Playwright needs Node to run".to_string()
            })
        }

        fn resolve_server_entry(
            &mut self,
            id: &LanguageServerId,
            worktree: &zed::Worktree,
        ) -> Result<String> {
            // The WASI sandbox only preopens the extension work directory, so the override
            // path cannot be inspected from here. Pass it through; a wrong path surfaces as
            // Node's own "Cannot find module" error in Zed's language server status.
            if let Some(entry) = dev_server_entry_from_env(&worktree.shell_env()) {
                println!(
                    "playwright: using development language server from {} ({entry})",
                    super::DEV_SERVER_ENTRY_VAR
                );
                return Ok(entry);
            }

            if let Some(entry) = &self.server_entry {
                if fs::metadata(entry).is_ok() {
                    return Ok(entry.clone());
                }
            }

            zed::set_language_server_installation_status(
                id,
                &LanguageServerInstallationStatus::CheckingForUpdate,
            );
            let installed = zed::npm_package_installed_version(SERVER_PACKAGE)?;
            if version_differs(installed.as_deref(), PINNED_SERVER_VERSION) {
                zed::set_language_server_installation_status(
                    id,
                    &LanguageServerInstallationStatus::Downloading,
                );
                if let Err(error) = zed::npm_install_package(SERVER_PACKAGE, PINNED_SERVER_VERSION)
                {
                    let message = format!(
                        "npm install {SERVER_PACKAGE}@{PINNED_SERVER_VERSION} failed: {error}"
                    );
                    zed::set_language_server_installation_status(
                        id,
                        &LanguageServerInstallationStatus::Failed(message.clone()),
                    );
                    return Err(message);
                }
            }
            zed::set_language_server_installation_status(id, &LanguageServerInstallationStatus::None);

            if !self.checked_latest {
                self.checked_latest = true;
                if let Ok(latest) = zed::npm_package_latest_version(SERVER_PACKAGE) {
                    if latest != PINNED_SERVER_VERSION {
                        println!(
                            "playwright: server {SERVER_PACKAGE}@{latest} is available; this extension pins {PINNED_SERVER_VERSION}"
                        );
                    }
                }
            }

            let workdir = std::env::current_dir()
                .map_err(|e| format!("cannot determine extension work directory: {e}"))?;
            let entry = server_entry(&workdir.to_string_lossy());
            if fs::metadata(&entry).is_err() {
                return Err(format!(
                    "language server entry {entry} is missing after npm install {SERVER_PACKAGE}@{PINNED_SERVER_VERSION}"
                ));
            }
            self.server_entry = Some(entry.clone());
            Ok(entry)
        }
    }

    impl zed::Extension for PlaywrightExtension {
        fn new() -> Self {
            PlaywrightExtension {
                server_entry: None,
                checked_latest: false,
            }
        }

        fn language_server_command(
            &mut self,
            language_server_id: &LanguageServerId,
            worktree: &zed::Worktree,
        ) -> Result<zed::Command> {
            let node = self.node_path(worktree)?;
            let entry = self.resolve_server_entry(language_server_id, worktree)?;
            Ok(zed::Command {
                command: node,
                args: vec![entry, "--stdio".to_string()],
                env: Vec::new(),
            })
        }
    }

    zed::register_extension!(PlaywrightExtension);
}
