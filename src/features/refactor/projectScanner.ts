import { globSync } from 'glob';

export class ProjectScanner {
  getAllPHPFiles(rootPath: string): string[] {
    const files = globSync('**/*.php', {
      cwd: rootPath,
      absolute: true,
      ignore: ['vendor/**', 'node_modules/**'],
    });
    console.log('SCANNER: found', files.length, 'php files under', rootPath);
    return files;
  }
}
