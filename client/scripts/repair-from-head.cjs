const fs = require("fs");
const { execSync } = require("child_process");
const head = execSync('git show HEAD:client/src/components/Editor/BitableBlockView.tsx', { encoding: 'utf8', cwd: 'e:/2026/五月/word' });
const cur = fs.readFileSync('src/components/Editor/BitableBlockView.tsx', 'utf8');
const headLines = head.split(/\n/);
const curLines = cur.split(/\n/);
const MARKER = /[\uFFFD]|ɾ|鏉/;
let fixes = 0;
const out = curLines.map((line, i) => {
  if (!MARKER.test(line) && !/字段/.test(line) && line.indexOf('\uFFFD') < 0) return line;
  const hl = headLines[i];
  if (!hl) return line;
  if (line !== hl && hl && !MARKER.test(hl)) { fixes++; return hl; }
  return line;
});
fs.writeFileSync('src/components/Editor/BitableBlockView.tsx', out.join('\n'), 'utf8');
console.log('restored from HEAD lines', fixes);