import { PhpParser } from './phpParser';
import { RefactorService } from './refactorService';
import { FileUpdater } from './fileUpdater';
import { ProjectScanner } from './projectScanner';
import { isPHPFile, isLaravelFile } from '../../utils/pathUtils';
import * as vscode from 'vscode';
import path from 'path';

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
      // Try to parse the old file to get previous namespace/class.
      // Note: onDidRenameFiles fires after the file is moved, so oldPath may not exist.
      let oldNamespace = '';
      let oldClass = '';
      try {
        const astOld = this.parser.parse(oldPath);
        ({ namespace: oldNamespace, className: oldClass } =
          this.parser.getClassInfo(astOld));
      } catch (e) {
        // Fallback: derive from path (PSR-4) when old file content isn't available
        oldNamespace = this.refactor.getNamespaceFromPath(oldPath);
        oldClass = this.refactor.getClassNameFromPath(oldPath);
        this.output.appendLine(
          `Could not parse old file content; derived from path: namespace=${oldNamespace}, class=${oldClass}`,
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

      // 🌍 Scan project
      const root = path.dirname(newPath).split('/app/')[0];
      const files = this.scanner.getAllPHPFiles(root);

      for (const file of files) {
        const res = await this.updater.updateReferences(
          file,
          oldFull,
          newFull,
          true,
        );
        if (res && res.length) {
          dryResults.push(...res);
        }
      }

      if (dryResults.length === 0) {
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
        return;
      }

      // Apply changes
      await this.updater.updateClassAndNamespace(
        newPath,
        oldNamespace,
        newNamespace,
        oldClass,
        newClass,
        false,
      );

      for (const file of files) {
        await this.updater.updateReferences(file, oldFull, newFull, false);
      }
    } catch (error) {
      // prefer VS Code error display in future improvements
      console.error('Refactor error:', error);
    }
  }
}
