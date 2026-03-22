import * as vscode from 'vscode';
import { HandleFileRename } from './features/refactor/handleFileRename';
import { PhpRenameProvider } from './features/refactor/phpRenameProvider';

const output = vscode.window.createOutputChannel('Laravel Refactor');

export function activate(context: vscode.ExtensionContext) {
  output.appendLine('EXTENSION ACTIVE 🔥 Laravel Refactor activated');
  output.show(true);

  const handler = new HandleFileRename(output);

  // Feature 2: renommer une CLASSE (F2 sur le nom de classe) → renomme le fichier + tous les imports
  const phpRenameProvider = new PhpRenameProvider(output);

  // Feature 1: renommer un FICHIER → met à jour classe + namespace + tous les imports
  const renameFileDisposable = vscode.workspace.onDidRenameFiles((event) => {
    output.appendLine(`RENAME EVENT 🔥 — ${event.files.length} fichier(s)`);
    for (const file of event.files) {
      // Skip renames triggered programmatically by the class rename provider
      if (phpRenameProvider.isPendingRename(file.oldUri)) {
        output.appendLine(
          `  Skipping programmatic rename: ${file.oldUri.fsPath} -> ${file.newUri.fsPath}`,
        );
        continue;
      }
      output.appendLine(`  ${file.oldUri.fsPath} -> ${file.newUri.fsPath}`);
      void handler.execute(file.oldUri.fsPath, file.newUri.fsPath);
    }
  });

  const renameProviderDisposable = vscode.languages.registerRenameProvider(
    { language: 'php' },
    phpRenameProvider,
  );

  context.subscriptions.push(renameFileDisposable, renameProviderDisposable);
}

export function deactivate() {}
