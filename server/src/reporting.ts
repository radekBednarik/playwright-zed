import type { Connection } from 'vscode-languageserver/node';
import {
  CodeLensRefreshRequest,
  Diagnostic,
  DiagnosticSeverity,
  InlayHintRefreshRequest,
  MessageType,
  ShowDocumentRequest,
  ShowMessageNotification,
  WorkDoneProgress,
  WorkDoneProgressCreateRequest,
} from 'vscode-languageserver/node';
import { pathToFileURL } from 'node:url';
import type { Failure } from './types';

export const DIAGNOSTIC_SOURCE = 'playwright';
export const INLAY_HINT_REFRESH_MS = 100;

/** `[project] title` when the failure belongs to one of several projects, else the title. */
export function failureLabel(failure: Pick<Failure, 'title' | 'project'>): string {
  return failure.project ? `[${failure.project}] ${failure.title}` : failure.title;
}
export const DISCOVERY_RUN = 'Run discovery';
export const DISCOVERY_NOT_NOW = 'Not now';
export type DiscoveryAnswer = typeof DISCOVERY_RUN | typeof DISCOVERY_NOT_NOW;

/** Thin wrappers over the LSP channels Zed renders (progress, messages, diagnostics, log). */
export class Reporter {
  private inlayHintTimer: NodeJS.Timeout | null = null;

  constructor(private readonly connection: Connection) {}

  /**
   * Starts a `$/progress` sequence whose token is the run request id, as the contract states.
   * Returns false when the client refuses to create the token; progress is then skipped.
   */
  async progressBegin(token: string, testCount: number, file: string, projects: string[] = []): Promise<boolean> {
    try {
      await this.connection.sendRequest(WorkDoneProgressCreateRequest.type, { token });
    } catch {
      return false;
    }
    void this.connection.sendProgress(WorkDoneProgress.type, token, {
      kind: 'begin',
      title: 'Playwright',
      message: `Running ${testCount} test(s) in ${file}${projects.length > 0 ? ` (${projects.join(', ')})` : ''}`,
    });
    return true;
  }

  progressEnd(token: string, active: boolean, summary: string): void {
    if (!active) return;
    void this.connection.sendProgress(WorkDoneProgress.type, token, { kind: 'report', message: summary });
    void this.connection.sendProgress(WorkDoneProgress.type, token, { kind: 'end', message: summary });
  }

  /**
   * Asks, once per workspace per session, whether discovery may run (feature 002). Resolves to
   * the chosen action title, or null when the client answers without a selection. Rejects when
   * the client cannot show the request. Zed never answers a dismissed prompt, so callers must
   * not await this on the discovery path.
   */
  askDiscovery(folderName: string, folderPath: string): Promise<DiscoveryAnswer | null> {
    const message =
      `Playwright Runner found a Playwright configuration in ${folderName} (${folderPath}). ` +
      'Run test discovery? Discovery executes this workspace\'s Playwright configuration and test files with your user account. ' +
      'You can enable it later with "Playwright: Enable test discovery" from the code actions menu.';
    return this.connection.window
      .showWarningMessage(message, { title: DISCOVERY_RUN }, { title: DISCOVERY_NOT_NOW })
      .then((choice) => (choice ? (choice.title as DiscoveryAnswer) : null));
  }

  /** Sends the `window/showMessage` notification (the library helpers would send a request). */
  private showMessage(type: MessageType, message: string): void {
    void this.connection.sendNotification(ShowMessageNotification.type, { type, message });
  }

  showInfo(message: string): void {
    this.showMessage(MessageType.Info, message);
  }

  showWarning(message: string): void {
    this.showMessage(MessageType.Warning, message);
  }

  showError(message: string): void {
    this.showMessage(MessageType.Error, message);
  }

  /** Publishes one Error diagnostic per failure, grouped by file. */
  publishFailures(failures: Failure[]): string[] {
    const byFile = new Map<string, Diagnostic[]>();
    for (const failure of failures) {
      const line = Math.max(0, failure.line - 1);
      const character = Math.max(0, failure.column - 1);
      const diagnostic: Diagnostic = {
        range: { start: { line, character }, end: { line, character: character + 1 } },
        severity: DiagnosticSeverity.Error,
        source: DIAGNOSTIC_SOURCE,
        message: `${failureLabel(failure)}: ${failure.message}`,
      };
      const list = byFile.get(failure.file) ?? [];
      list.push(diagnostic);
      byFile.set(failure.file, list);
    }
    for (const [file, diagnostics] of byFile) {
      void this.connection.sendDiagnostics({ uri: pathToFileURL(file).toString(), diagnostics });
    }
    return Array.from(byFile.keys());
  }

  clearDiagnostics(files: Iterable<string>): void {
    for (const file of files) {
      void this.connection.sendDiagnostics({ uri: pathToFileURL(file).toString(), diagnostics: [] });
    }
  }

  clearDiagnosticsForUri(uri: string): void {
    void this.connection.sendDiagnostics({ uri, diagnostics: [] });
  }

  log(line: string): void {
    this.connection.console.log(line);
  }

  info(line: string): void {
    this.connection.console.info(line);
  }

  /**
   * Feature 006: asks the client to refetch inlay hints, at most once per 100 ms however many
   * step events arrive in between. Clients without support are ignored.
   */
  refreshInlayHints(): void {
    if (this.inlayHintTimer) return;
    this.inlayHintTimer = setTimeout(() => {
      this.inlayHintTimer = null;
      this.connection.sendRequest(InlayHintRefreshRequest.type).then(
        () => undefined,
        () => undefined,
      );
    }, INLAY_HINT_REFRESH_MS);
  }

  /** Feature 006: `window/showDocument` with focus; false when the client refuses or cannot. */
  async showDocument(uri: string): Promise<boolean> {
    try {
      const result = await this.connection.sendRequest(ShowDocumentRequest.type, { uri, takeFocus: true });
      return result.success === true;
    } catch {
      return false;
    }
  }

  async refreshCodeLenses(): Promise<void> {
    try {
      await this.connection.sendRequest(CodeLensRefreshRequest.type);
    } catch {
      // client without refresh support
    }
  }
}
