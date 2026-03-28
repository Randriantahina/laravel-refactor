import { PhpParser } from './phpParser';
import { RefactorService } from './refactorService';
import { FileUpdater, hasUseConflict } from './fileUpdater';
import { ProjectScanner } from './projectScanner';
import { isPHPFile, isLaravelFile } from '../../utils/pathUtils';
import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs';

export class HandleFileRename {
  private parser = new PhpParser();
  private refactor = new RefactorService();
  private updater = new FileUpdater();
  private scanner = new ProjectScanner();

  constructor(private output: vscode.OutputChannel) {}

  async execute(oldPath: string, newPath: string) {
    this.output.appendLine(
      `execute() called with oldPath=${oldPath} newPath=${newPath}`,
    );

    if (!isPHPFile(newPath)) {
      this.output.appendLine(`Skipped: not a PHP file: ${newPath}`);
      return;
    }
    if (!isLaravelFile(newPath)) {
      this.output.appendLine(
        `Skipped: not inside /app/ (laravel file): ${newPath}`,
      );
      return;
    }

    try {
      this.output.appendLine(`File checks passed: isPHPFile & isLaravelFile`);
      this.output.appendLine(
        `oldPath exists: ${fs.existsSync(oldPath)}; newPath exists: ${fs.existsSync(newPath)}`,
      );

      let oldClass = '';
      let oldNamespace = '';
      try {
        const ast = this.parser.parse(newPath);
        ({ namespace: oldNamespace, className: oldClass } =
          this.parser.getClassInfo(ast));
        this.output.appendLine(
          `Parsed new file: class=${oldClass} namespace=${oldNamespace}`,
        );
      } catch (e) {
        oldNamespace = this.refactor.getNamespaceFromPath(oldPath);
        oldClass = this.refactor.getClassNameFromPath(oldPath);
        this.output.appendLine(
          `Parse failed, derived from path: class=${oldClass} namespace=${oldNamespace}; error=${String(e)}`,
        );
      }

      const newNamespace = this.refactor.getNamespaceFromPath(newPath);
      const newClass = this.refactor.getClassNameFromPath(newPath);

      this.output.appendLine(`Computed values:`);
      this.output.appendLine(`oldPath=${oldPath}`);
      this.output.appendLine(`newPath=${newPath}`);
      this.output.appendLine(`oldNamespace=${oldNamespace}`);
      this.output.appendLine(`oldClass=${oldClass}`);
      this.output.appendLine(`newNamespace=${newNamespace}`);
      this.output.appendLine(`newClass=${newClass}`);

      const oldFull = this.refactor.buildFullClass(oldNamespace, oldClass);
      const newFull = this.refactor.buildFullClass(newNamespace, newClass);

      console.log('OLD:', oldFull);
      console.log('NEW:', newFull);

      const dryResults: {
        file: string;
        oldContent: string;
        newContent: string;
      }[] = [];

      this.output.appendLine(`Running dry-run for current file: ${newPath}`);
      const resCur = await this.updater.updateClassAndNamespace(
        newPath,
        oldNamespace,
        newNamespace,
        oldClass,
        newClass,
        true,
      );
      this.output.appendLine(
        `Dry-run current file returned ${Array.isArray(resCur) ? resCur.length : 0} results`,
      );
      if (resCur && resCur.length) {
        dryResults.push(...resCur);
      }

      const root = path.dirname(newPath).split('/app/')[0];
      this.output.appendLine(`SCANNER: project root determined as ${root}`);

      const files = this.scanner.getAllPHPFiles(root);
      this.output.appendLine(`SCANNER: found ${files.length} php files`);

      const newClassName = newFull.split('\\').pop()!;
      const conflictingFiles: string[] = [];

      for (const file of files) {
        try {
          this.output.appendLine(
            `UPDATER: dry-run updateReferences in ${file}`,
          );
          const fileDoc = await vscode.workspace.openTextDocument(
            vscode.Uri.file(file),
          );
          if (
            hasUseConflict(fileDoc.getText(), oldFull, newFull, newClassName)
          ) {
            conflictingFiles.push(path.basename(file));
            this.output.appendLine(
              `  [CONFLICT] ${path.basename(file)}: '${newClassName}' déjà importé d'un autre namespace.`,
            );
          }
          const res = await this.updater.updateReferences(
            file,
            oldFull,
            newFull,
            true,
          );
          if (res && res.length) {
            this.output.appendLine(
              `Dry-run found ${res.length} changes in ${file}`,
            );
            dryResults.push(...res);
          }
        } catch (err) {
          this.output.appendLine(
            `Error during dry-run updateReferences on ${file}: ${String(err)}`,
          );
        }
      }

      if (conflictingFiles.length > 0) {
        this.output.appendLine(
          `Conflict detected — reverting file rename: ${newPath} -> ${oldPath}`,
        );

        // Revert the physical rename so the workspace stays consistent
        const revertEdit = new vscode.WorkspaceEdit();
        revertEdit.renameFile(
          vscode.Uri.file(newPath),
          vscode.Uri.file(oldPath),
          { overwrite: false },
        );
        await vscode.workspace.applyEdit(revertEdit);

        await vscode.window.showWarningMessage(
          `Conflit de nommage : '${newClassName}' est déjà utilisé dans ${conflictingFiles.length} fichier(s). Le fichier a été remis à son ancien nom. Voir 'Laravel Refactor' output.`,
        );
        return;
      }

      if (dryResults.length === 0) {
        this.output.appendLine('Dry-run found no changes.');
        void vscode.window.showInformationMessage('Aucun changement détecté.');
        return;
      }

      this.output.clear();
      this.output.show(true);
      this.output.appendLine(
        `Dry-run results for rename ${oldPath} -> ${newPath}`,
      );
      dryResults.forEach((r) => {
        this.output.appendLine(`--- ${r.file}`);
        const oldLines = r.oldContent.split('\n');
        const newLines = r.newContent.split('\n');
        // show a small diff context
        for (
          let i = 0;
          i < Math.min(10, Math.max(oldLines.length, newLines.length));
          i++
        ) {
          const o = oldLines[i] || '';
          const n = newLines[i] || '';
          if (o !== n) {
            this.output.appendLine(`- ${o}`);
            this.output.appendLine(`+ ${n}`);
          }
        }
      });

      const summary = `Modifications détectées: ${dryResults.length} fichier(s). Voir 'Laravel Refactor' output pour détails. Appliquer les changements ?`;
      const choice = await vscode.window.showInformationMessage(
        summary,
        'Apply changes',
        'Cancel',
      );
      if (choice !== 'Apply changes') {
        this.output.appendLine('User cancelled applying changes');
        return;
      }

      console.log('UPDATER: apply update class and namespace for', newPath);

      this.output.appendLine('Applying changes...');
      await this.updater.updateClassAndNamespace(
        newPath,
        oldNamespace,
        newNamespace,
        oldClass,
        newClass,
        false,
      );
      this.output.appendLine(`Applied class/namespace change to ${newPath}`);

      for (const file of files) {
        try {
          await this.updater.updateReferences(file, oldFull, newFull, false);
          this.output.appendLine(`Applied references update to ${file}`);
        } catch (err) {
          this.output.appendLine(
            `Error applying references update to ${file}: ${String(err)}`,
          );
        }
      }

      this.output.appendLine('All apply attempts finished');
    } catch (error) {
      this.output.appendLine(`Refactor error: ${String(error)}`);
      console.error('Refactor error:', error);
    }
  }
}
