import * as vscode from 'vscode';
import { HandleFileRename } from './features/refactor/handleFileRename';

export function activate(context: vscode.ExtensionContext) {
  const handler = new HandleFileRename();

  const disposable = vscode.workspace.onDidRenameFiles((event) => {
    console.log(
      'onDidRenameFiles event received, files:',
      event.files.map((f) => f.oldUri.fsPath + ' -> ' + f.newUri.fsPath),
    );
    for (const file of event.files) {
      void handler.execute(file.oldUri.fsPath, file.newUri.fsPath);
    }
  });

  context.subscriptions.push(disposable);
  console.log('Laravel Refactor extension activated');
}

export function deactivate() {}
