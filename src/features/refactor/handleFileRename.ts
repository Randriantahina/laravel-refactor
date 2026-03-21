import { PhpParser } from './phpParser';
import { RefactorService } from './refactorService';
import { FileUpdater } from './fileUpdater';
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
  private output = vscode.window.createOutputChannel('Laravel Refactor');
  async execute(oldPath: string, newPath: string) {
    if (!isPHPFile(newPath)) {
      return;
    }
    if (!isLaravelFile(newPath)) {
      return;
    }

    try {
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

      this.output.appendLine(`File checks passed: isPHPFile & isLaravelFile`);
      this.output.appendLine(
        `oldPath exists: ${fs.existsSync(oldPath)}; newPath exists: ${fs.existsSync(newPath)}`,
      );

      // Note: onDidRenameFiles fires after the file is moved, so oldPath may not exist.
      let oldNamespace = '';
      let oldClass = '';
      try {
        if (fs.existsSync(oldPath)) {
          const astOld = this.parser.parse(oldPath);
          ({ namespace: oldNamespace, className: oldClass } =
            this.parser.getClassInfo(astOld));
          this.output.appendLine(`Parsed old file content for ${oldPath}`);
        } else {
          throw new Error('oldPath does not exist');
        }
      } catch (e) {
        // Fallback: derive from path (PSR-4) when old file content isn't available
        oldNamespace = this.refactor.getNamespaceFromPath(oldPath);
        oldClass = this.refactor.getClassNameFromPath(oldPath);
        this.output.appendLine(
          `Could not parse old file content; derived from path: namespace=${oldNamespace}, class=${oldClass}; error=${String(e)}`,
        );
      }

      const newNamespace = this.refactor.getNamespaceFromPath(newPath);
      const newClass = this.refactor.getClassNameFromPath(newPath);

      // Log computed values for debugging
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

      // Dry-run: collect changes for current file and project references
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

      // 🌍 Scan project
      const root = path.dirname(newPath).split('/app/')[0];
      const files = this.scanner.getAllPHPFiles(root);
      this.output.appendLine(
        `Scanning project root ${root}, found ${files.length} PHP files`,
      );

      for (const file of files) {
        try {
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

      if (dryResults.length === 0) {
        this.output.appendLine('Dry-run found no changes.');
        void vscode.window.showInformationMessage('Aucun changement détecté.');
        return;
      }

      // Log details to output channel for inspection
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

      // Prepare summary and ask confirmation (user can inspect output panel)
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

      // Apply changes
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
      // prefer VS Code error display in future improvements
      console.error('Refactor error:', error);
    }
  }
}
