import * as assert from 'assert';
import { PhpParser } from '../features/refactor/phpParser';
import path from 'path';

suite('PhpParser', () => {
  const parser = new PhpParser();

  test('extracts namespace and class when namespace exists', () => {
    const file = path.join(__dirname, 'fixtures/parser/WithNamespace.php');
    const ast = parser.parse(file);
    const info = parser.getClassInfo(ast);

    assert.strictEqual(info.namespace, 'App\\Services\\Test');
    assert.strictEqual(info.className, 'MyService');
  });

  test('extracts class name when no namespace', () => {
    const file = path.join(__dirname, 'fixtures/parser/NoNamespace.php');
    const ast = parser.parse(file);
    const info = parser.getClassInfo(ast);

    assert.strictEqual(info.namespace, '');
    assert.strictEqual(info.className, 'GlobalClass');
  });
});
