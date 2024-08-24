// modify ./dist/index_bg.js to insert export class BaseClass {...} before the first export class
// and then update all exported classes to extend BaseClass

const fs = require('fs');
const path = require('path');

function readFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return data;
  } catch (error) {
    throw new Error(`Error reading ${filePath}: ${error.message}`);
  }
}

const guardedObjFile = readFile(path.join(__dirname, 'guardedobj.js'));
const guardedObjDFile = readFile(path.join(__dirname, 'guardedobj.d.ts'));
let guardedobjpath = path.join(__dirname, '../dist/guardedobj.js');
let guardedobjdpath = path.join(__dirname, '../dist/guardedobj.d.ts');
fs.writeFile(guardedobjpath, guardedObjFile, (err) => {
  if (err) throw new Error(`Error writing the modified file: ${err.message}`);
});
fs.writeFile(guardedobjdpath, guardedObjDFile, (err) => {
  if (err) throw new Error(`Error writing the modified file: ${err.message}`);
});

const rsObjectBaseClass =
  "import { EdvoObjRS } from './guardedobj'\n" + "export { EdvoError, GuardedObj } from './guardedobj'\n\n";
const rsObectBaseClassDeclaration =
  "import { EdvoObjRS } from './guardedobj'\n" + "export { EdvoError, GuardedObj } from './guardedobj'\n\n";
let indexpath = path.join(__dirname, '../dist/index_bg.js');
let indexdpath = path.join(__dirname, '../dist/index.d.ts');

const pattern = /export class (\w+)( extends EdvoObjRS)* {/gm;
const replacement = 'export class $1 extends EdvoObjRS {';

// Monkeypatch the index_bg.js file
fs.readFile(indexpath, { encoding: 'utf-8' }, (err, data) => {
  if (err) throw new Error(`Error reading ${indexpath}: ${err.message}`);

  if (!data.includes("import { EdvoObjRS } from './guardedobj'")) data = rsObjectBaseClass + data;

  data = data.replace(pattern, replacement);

  fs.writeFile(indexpath, data, (err) => {
    if (err) throw new Error(`Error writing the ${indexpath}: ${err.message}`);
  });
});

// Monkeypatch the index.d.ts file
fs.readFile(indexdpath, { encoding: 'utf-8' }, (err, data) => {
  if (err) throw new Error(`Error reading ${indexdpath}: ${err.message}`);

  if (!data.includes("import { EdvoObjRS } from './guardedobj'")) data = rsObectBaseClassDeclaration + data;

  data = data.replace(pattern, replacement);
  //.replace(/^(\s*)free\(\): void;/gm, '$1private free(): void;');

  fs.writeFile(indexdpath, data, (err) => {
    if (err) throw new Error(`Error writing ${indexdpath}: ${err.message}`);
  });
});
