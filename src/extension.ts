import * as vscode from 'vscode';
import { HandleFileRename } from './features/refactor/handleFileRename';
import { PhpRenameProvider } from './features/refactor/phpRenameProvider';
import { globSync } from 'glob';
import fs from 'fs';

const output = vscode.window.createOutputChannel('Laravel Refactor');

export function activate(context: vscode.ExtensionContext) {
  output.appendLine('EXTENSION ACTIVE - Laravel Refactor activated');
  output.show(true);

  const handler = new HandleFileRename(output);

  const phpRenameProvider = new PhpRenameProvider(output);

  const renameFileDisposable = vscode.workspace.onDidRenameFiles((event) => {
    output.appendLine(`RENAME EVENT - ${event.files.length} fichier(s)`);
    for (const file of event.files) {
      if (phpRenameProvider.isPendingRename(file.oldUri)) {
        output.appendLine(
          `  Skipping programmatic rename: ${file.oldUri.fsPath} -> ${file.newUri.fsPath}`,
        );
        continue;
      }
      output.appendLine(`  ${file.oldUri.fsPath} -> ${file.newUri.fsPath}`);

      const newFsPath = file.newUri.fsPath;
      const oldFsPath = file.oldUri.fsPath;

      // If a folder was renamed, expand to all PHP files inside it
      if (fs.existsSync(newFsPath) && fs.statSync(newFsPath).isDirectory()) {
        output.appendLine(
          `  Detected folder rename — expanding to PHP files inside`,
        );
        const phpFiles = globSync('**/*.php', {
          cwd: newFsPath,
          absolute: true,
          ignore: ['vendor/**'],
        });
        output.appendLine(
          `  Found ${phpFiles.length} PHP file(s) in renamed folder`,
        );
        for (const newFilePath of phpFiles) {
          const relative = newFilePath.slice(newFsPath.length);
          const oldFilePath = oldFsPath + relative;
          void handler.execute(oldFilePath, newFilePath);
        }
      } else {
        void handler.execute(oldFsPath, newFsPath);
      }
    }
  });

  const renameProviderDisposable = vscode.languages.registerRenameProvider(
    { language: 'php' },
    phpRenameProvider,
  );

  context.subscriptions.push(renameFileDisposable, renameProviderDisposable);
}

export function deactivate() {}
