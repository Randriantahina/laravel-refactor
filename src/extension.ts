import * as vscode from 'vscode';
import { HandleFileRename } from './features/refactor/handleFileRename';

export function activate(context: vscode.ExtensionContext) {
  const handler = new HandleFileRename();

  vscode.workspace.onDidRenameFiles((event) => {
    for (const file of event.files) {
      handler.execute(file.oldUri.fsPath, file.newUri.fsPath);
    }
  });
}

export function deactivate() {}
