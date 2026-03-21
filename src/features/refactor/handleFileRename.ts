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
  async execute(oldPath: string, newPath: string) {
    if (!isPHPFile(newPath)) {
      return;
    }
    if (!isLaravelFile(newPath)) {
      return;
    }

    try {
      // Try to parse the old file to get previous namespace/class; fallback to newPath if old not available
      let astOld: any;
      try {
        astOld = this.parser.parse(oldPath);
      } catch (e) {
        astOld = this.parser.parse(newPath);
      }

      const { namespace: oldNamespace, className: oldClass } =
        this.parser.getClassInfo(astOld);

      const newNamespace = this.refactor.getNamespaceFromPath(newPath);
      const newClass = this.refactor.getClassNameFromPath(newPath);

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
      if (resCur && resCur.length) dryResults.push(...resCur);

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
        if (res && res.length) dryResults.push(...res);
      }

      if (dryResults.length === 0) {
        void vscode.window.showInformationMessage('Aucun changement détecté.');
        return;
      }

      // Prepare summary and ask confirmation
      const summary = `Modifications détectées: ${dryResults.length} fichier(s). Appliquer les changements ?`;
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
