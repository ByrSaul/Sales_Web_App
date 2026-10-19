import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import parser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import ts from 'typescript';

// Local rule evidence only: this does not reproduce a server's Quality Profile or New Code period.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['node_modules', 'dist', 'coverage', '.git', '.scannerwork', 'playwright-report', 'test-results']);
const files = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute);
    else if (/\.(?:[cm]?js|jsx|ts|tsx)$/.test(entry.name)) files.push(absolute);
  }
}
collect(root);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sales4app-quality-'));
const project = path.join(temporary, 'tsconfig.json');
fs.writeFileSync(project, JSON.stringify({
  extends: path.join(root, 'tsconfig.json'), compilerOptions: { allowJs: true, checkJs: false },
  files, include: [], references: [],
}));
const rules = {
  'sonarjs/cognitive-complexity': ['error', 15],
  'sonarjs/no-nested-conditional': 'error',
  'sonarjs/pseudo-random': 'error',
  'sonarjs/unused-import': 'error',
  'sonarjs/no-dead-store': 'error',
  'sonarjs/no-duplicated-branches': 'error',
  'sonarjs/no-all-duplicated-branches': 'error',
};
const linter = new Linter();
const findings = [];
const report = (file, source, node, rule, message) => findings.push({
  file: path.relative(root, file).replaceAll('\\', '/'),
  line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, rule, message,
});

function checkJsxIdentity(file, source, node) {
  if (!ts.isJsxAttribute(node) || !node.initializer) return;
  const attribute = node.name.getText(source);
  if (attribute === 'role' && ts.isStringLiteral(node.initializer) && node.initializer.text === 'status')
    report(file, source, node, 'audit/native-status', 'Review native output semantics');
  if (attribute !== 'key' || !ts.isJsxExpression(node.initializer) || !node.initializer.expression) return;
  const key = node.initializer.expression;
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (!(ts.isArrowFunction(ancestor) || ts.isFunctionExpression(ancestor))) continue;
    const call = ancestor.parent;
    if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'map') continue;
    const indexName = ancestor.parameters[1]?.name.getText(source);
    if (!indexName) continue;
    const referencesIndex = (child) => (ts.isIdentifier(child) && child.text === indexName) || ts.forEachChild(child, referencesIndex);
    if (referencesIndex(key)) report(file, source, node, 'audit/index-key', key.getText(source));
  }
}

try {
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const typed = /\.tsx?$/.test(file);
    const messages = linter.verify(code, [{
      files: ['**/*.{js,cjs,mjs,jsx,ts,tsx}'],
      languageOptions: { parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, ...(typed ? { project } : {}) } },
      plugins: { sonarjs, ts: tsPlugin },
      rules: { ...rules, ...(typed ? {
        'ts/no-floating-promises': ['error', { ignoreVoid: true }],
        'ts/no-misused-promises': 'error',
      } : {}) },
    }], { filename: file });
    findings.push(...messages.map((message) => ({ file: path.relative(root, file).replaceAll('\\', '/'), line: message.line, rule: message.ruleId, message: message.message })));
    const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    const visit = (node) => { checkJsxIdentity(file, source, node); ts.forEachChild(node, visit); };
    visit(source);
  }
  const result = { scope: 'Local selected rules; not a SonarQube server analysis', files: files.map((file) => path.relative(root, file).replaceAll('\\', '/')).sort(), fileCount: files.length, findings };
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex !== -1) fs.writeFileSync(path.resolve(root, process.argv[outputIndex + 1]), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ fileCount: files.length, findingCount: findings.length, findings }, null, 2));
  process.exitCode = findings.length ? 1 : 0;
} finally {
  fs.unlinkSync(project);
  fs.rmdirSync(temporary);
}
