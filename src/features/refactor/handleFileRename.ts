import { PhpParser } from './phpParser';
import { RefactorService } from './refactorService';
import { FileUpdater, hasUseConflict } from './fileUpdater';
import { ProjectScanner } from './projectScanner';
import { isPHPFile, isLaravelFile } from '../../utils/pathUtils';
import * as vscode from 'vscode';
import path from 'path';

export class HandleFileRename {
  private parser = new PhpParser();
  private refactor = new RefactorService();
  private updater = new FileUpdater();
  private scanner = new ProjectScanner();

  constructor(private output: vscode.OutputChannel) {}

  async execute(oldPath: string, newPath: string) {
    if (!isPHPFile(newPath) || !isLaravelFile(newPath)) {
      return;
    }

    try {
      let oldClass = '';
      let oldNamespace = '';
      try {
        const ast = this.parser.parse(newPath);
        ({ namespace: oldNamespace, className: oldClass } =
          this.parser.getClassInfo(ast));
      } catch (e) {
        oldNamespace = this.refactor.getNamespaceFromPath(oldPath);
        oldClass = this.refactor.getClassNameFromPath(oldPath);
        this.output.appendLine(
          `Parse failed, derived from path: class=${oldClass} namespace=${oldNamespace}; error=${String(e)}`,
        );
      }

      const newNamespace = this.refactor.getNamespaceFromPath(newPath);
      const newClass = this.refactor.getClassNameFromPath(newPath);

      const oldFull = this.refactor.buildFullClass(oldNamespace, oldClass);
      const newFull = this.refactor.buildFullClass(newNamespace, newClass);

      const dryResults: {
        file: string;
        oldContent: string;
        newContent: string;
      }[] = [];

      const resCur = await this.updater.updateClassAndNamespace(
        newPath,
        oldNamespace,
        newNamespace,
        oldClass,
        newClass,
        true,
      );
      if (resCur && resCur.length) {
        dryResults.push(...resCur);
      }

      const root = path.dirname(newPath).split('/app/')[0];

      const files = this.scanner.getAllPHPFiles(root);

      const newClassName = newFull.split('\\').pop()!;
      const conflictingFiles: string[] = [];

      for (const file of files) {
        try {
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
        return;
      }

      this.output.clear();
      this.output.show(true);
      this.output.appendLine(
        `Modifications détectées pour : ${path.basename(newPath)}`,
      );
      dryResults.forEach((r) => {
        this.output.appendLine(`--- ${r.file}`);
        const oldLines = r.oldContent.split('\n');
        const newLines = r.newContent.split('\n');
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

      this.output.appendLine('Applying changes...');
      await this.updater.updateClassAndNamespace(
        newPath,
        oldNamespace,
        newNamespace,
        oldClass,
        newClass,
        false,
      );

      for (const file of files) {
        try {
          await this.updater.updateReferences(file, oldFull, newFull, false);
        } catch (err) {
          this.output.appendLine(
            `Error updating references in ${path.basename(file)}: ${String(err)}`,
          );
        }
      }

      this.output.appendLine(
        `Done: ${dryResults.length} fichier(s) mis à jour.`,
      );
    } catch (error) {
      this.output.appendLine(`Refactor error: ${String(error)}`);
    }
  }
}
