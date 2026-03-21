import { PhpParser } from './phpParser';
import { RefactorService } from './refactorService';
import { FileUpdater } from './fileUpdater';
import { ProjectScanner } from './projectScanner';
import { isPHPFile, isLaravelFile } from '../../utils/pathUtils';
import path from 'path';

export class HandleFileRename {
  private parser = new PhpParser();
  private refactor = new RefactorService();
  private updater = new FileUpdater();
  private scanner = new ProjectScanner();

  execute(oldPath: string, newPath: string) {
    if (!isPHPFile(newPath)) {return;}
    if (!isLaravelFile(newPath)) {return;}

    try {
      const ast = this.parser.parse(newPath);

      const { namespace: oldNamespace, className: oldClass } =
        this.parser.getClassInfo(ast);

      const newNamespace = this.refactor.getNamespaceFromPath(newPath);
      const newClass = this.refactor.getClassNameFromPath(newPath);

      const oldFull = this.refactor.buildFullClass(oldNamespace, oldClass);
      const newFull = this.refactor.buildFullClass(newNamespace, newClass);

      console.log('OLD:', oldFull);
      console.log('NEW:', newFull);

      // 🔥 Update fichier actuel
      this.updater.updateClassAndNamespace(
        newPath,
        oldNamespace,
        newNamespace,
        oldClass,
        newClass,
      );

      // 🌍 Update tout le projet
      const root = path.dirname(newPath).split('/app/')[0];

      const files = this.scanner.getAllPHPFiles(root);

      files.forEach((file) => {
        this.updater.updateReferences(file, oldFull, newFull);
      });
    } catch (error) {
      console.error('Refactor error:', error);
    }
  }
}
