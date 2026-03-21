import fs from 'fs';
// @ts-ignore
import parser from 'php-parser';

const engine = new parser.Engine({
  parser: {
    extractDoc: true,
    php7: true,
  },
  ast: {
    withPositions: true,
  },
});

export class PhpParser {
  parse(filePath: string) {
    const code = fs.readFileSync(filePath, 'utf-8');
    return engine.parseCode(code, filePath);
  }

  getClassInfo(ast: any) {
    let namespace = '';
    let className = '';

    ast.children.forEach((node: any) => {
      if (node.kind === 'namespace') {
        namespace = node.name;

        node.children?.forEach((child: any) => {
          if (child.kind === 'class') {
            className = child.name.name;
          }
        });
      }

      if (node.kind === 'class') {
        className = node.name.name;
      }
    });

    return { namespace, className };
  }
}
