import { globSync } from 'glob';

export class ProjectScanner {
  getAllPHPFiles(rootPath: string): string[] {
    return globSync('**/*.php', {
      cwd: rootPath,
      absolute: true,
      ignore: ['vendor/**', 'node_modules/**'],
    });
  }
}
