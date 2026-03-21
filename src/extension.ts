import * as vscode from 'vscode';
import { HandleFileRename } from './features/refactor/handleFileRename';

export function activate(context: vscode.ExtensionContext) {
  const handler = new HandleFileRename();
  const disposable = vscode.workspace.onDidRenameFiles((event) => {
    for (const file of event.files) {
      void handler.execute(file.oldUri.fsPath, file.newUri.fsPath);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
