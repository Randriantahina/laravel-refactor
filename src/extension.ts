import * as vscode from 'vscode';
import { HandleFileRename } from './features/refactor/handleFileRename';

const output = vscode.window.createOutputChannel('Laravel Refactor');

export function activate(context: vscode.ExtensionContext) {
  output.appendLine('EXTENSION ACTIVE 🔥 Laravel Refactor activated');
  output.show(true);

  const handler = new HandleFileRename();

  const disposable = vscode.workspace.onDidRenameFiles((event) => {
    output.appendLine(`RENAME EVENT 🔥 — ${event.files.length} fichier(s)`);
    for (const file of event.files) {
      output.appendLine(`  ${file.oldUri.fsPath} -> ${file.newUri.fsPath}`);
      void handler.execute(file.oldUri.fsPath, file.newUri.fsPath);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
