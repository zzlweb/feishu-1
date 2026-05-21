const fs = require('fs');

// Fix 1: SelectionBubble z-index lower than table chrome rail
// The rail-top/rail-left have z-index: 12 inside .feishu-table-chrome (z-index: 210)
// The BubbleMenu tippy has zIndex: 10020 which covers the rail
// Fix: lower the bubble z-index to be below the table chrome (< 210)
// Actually the proper fix: the bubble should NOT block the rail. Since the bubble
// appears only when there's a selection, and the rail shows when hovering the table,
// they shouldn't conflict normally. BUT during CellSelection, both show simultaneously.
// The best fix: raise the table-chrome z-index above the bubble when visible.
// But that would make the chrome cover other things. Instead: set bubble z-index lower.
// Actually, the simplest fix: the bubble z-index should be below the rail z-index.
// But changing z-index of a well-known UI is risky.
// Better approach: when BubbleMenu is for a table selection, add an offset to push it higher.
// Let's add offset: [0, 12] to push the bubble 12px further from the selection reference.

const bubblePath = 'e:/2026/五月/word/client/src/components/Editor/SelectionBubble.tsx';
let bubble = fs.readFileSync(bubblePath, 'utf8');

// Add offset to tippyOptions to push bubble above the rail area
bubble = bubble.replace(
  "placement: 'top',\r\n        duration: [120, 80],\r\n        zIndex: 10020,",
  "placement: 'top',\r\n        duration: [120, 80],\r\n        zIndex: 200,\r\n        offset: [0, 12],"
);

if (!bubble.includes('zIndex: 200')) {
  // Try LF
  bubble = bubble.replace(
    "placement: 'top',\n        duration: [120, 80],\n        zIndex: 10020,",
    "placement: 'top',\n        duration: [120, 80],\n        zIndex: 200,\n        offset: [0, 12],"
  );
}

console.log('Bubble z-index fixed:', bubble.includes('zIndex: 200'));
fs.writeFileSync(bubblePath, bubble, 'utf8');

// Fix 2: Remove selectionState.selectedCols/selectedRows from isSel
// Only show blue rail header when selectedRail is explicitly set
const overlayPath = 'e:/2026/五月/word/client/src/components/Editor/FeishuTableOverlay.tsx';
let overlay = fs.readFileSync(overlayPath, 'utf8');

// Fix column isSel - remove selectionState.selectedCols.has(index) part
overlay = overlay.replace(
  "const isSel = selectionState.selectedCols.has(index)\r\n            || (selectedRail?.type === 'col' && selectedRail.index === index);",
  "const isSel = selectedRail?.type === 'col' && selectedRail.index === index;"
);

// Fix row isSel - remove selectionState.selectedRows.has(index) part
overlay = overlay.replace(
  "const isSel = selectionState.selectedRows.has(index)\r\n            || (selectedRail?.type === 'row' && selectedRail.index === index);",
  "const isSel = selectedRail?.type === 'row' && selectedRail.index === index;"
);

// Try LF versions if CRLF didn't match
if (overlay.includes('selectionState.selectedCols.has')) {
  overlay = overlay.replace(
    "const isSel = selectionState.selectedCols.has(index)\n            || (selectedRail?.type === 'col' && selectedRail.index === index);",
    "const isSel = selectedRail?.type === 'col' && selectedRail.index === index;"
  );
}
if (overlay.includes('selectionState.selectedRows.has')) {
  overlay = overlay.replace(
    "const isSel = selectionState.selectedRows.has(index)\n            || (selectedRail?.type === 'row' && selectedRail.index === index);",
    "const isSel = selectedRail?.type === 'row' && selectedRail.index === index;"
  );
}

console.log('isSel fixed (no selectionState):', !overlay.includes('selectionState.selectedCols.has') && !overlay.includes('selectionState.selectedRows.has'));

fs.writeFileSync(overlayPath, overlay, 'utf8');
console.log('All fixes applied.');
