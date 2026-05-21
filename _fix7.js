const fs = require('fs');
const path = 'e:/2026/五月/word/client/src/components/Editor/FeishuTableOverlay.tsx';
let c = fs.readFileSync(path, 'utf8');

// Remove the "const selectionState = getSelectionState();" call
c = c.replace(/\r?\n  const selectionState = getSelectionState\(\);\r?\n/, '\n');

// Remove the entire getSelectionState function
// It starts at "  const getSelectionState = useCallback(() => {" and ends at matching "]);"
const startMarker = '  const getSelectionState = useCallback(() => {';
const startIdx = c.indexOf(startMarker);
if (startIdx === -1) {
  console.log('ERROR: getSelectionState not found');
  process.exit(1);
}

// Find the end: "  }, [tableHost]);"
const endMarker = '  }, [tableHost]);';
let searchFrom = startIdx + startMarker.length;
let endIdx = c.indexOf(endMarker, searchFrom);
if (endIdx === -1) {
  console.log('ERROR: end of getSelectionState not found');
  process.exit(1);
}
endIdx += endMarker.length;

// Remove including the trailing newline(s)
while (endIdx < c.length && (c[endIdx] === '\r' || c[endIdx] === '\n')) endIdx++;

c = c.substring(0, startIdx) + c.substring(endIdx);

console.log('getSelectionState removed:', !c.includes('getSelectionState'));
console.log('selectionState removed:', !c.includes('selectionState'));

fs.writeFileSync(path, c, 'utf8');
console.log('Done.');
