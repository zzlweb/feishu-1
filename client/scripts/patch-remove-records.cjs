const fs = require("fs");
const p = "src/components/Editor/BitableBlockView.tsx";
let c = fs.readFileSync(p, "utf8");
const bad = `removeRecords = (recordIds: string[], requireConfirm = false) => {
  const ganttOrigin = offsetDate(new Date(Math.min(...ganttExtent.map(date => date.getTime()))), -10);
    mutate(current => ({ ...current, records: current.records.filter(record => !recordIds.includes(record.id)) }));
    setSelectedIds(new Set());
    return true;
  };`;
const good = `removeRecords = (recordIds: string[], requireConfirm = false) => {
    if (requireConfirm && !window.confirm(\`确认删除 \${recordIds.length} 条记录？\`)) return false;
    mutate(current => ({ ...current, records: current.records.filter(record => !recordIds.includes(record.id)) }));
    setSelectedIds(new Set());
    return true;
  };`;
if (!c.includes(bad)) { console.log("bad block not found"); process.exit(1); }
c = c.replace(bad, good);
fs.writeFileSync(p, c, "utf8");
console.log("patched removeRecords");