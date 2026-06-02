const fs = require("fs");
const path = require("path");
const MARKER_RE = /[鐢鍒鏂瀛闄璇鎵瑙琛脳缂鍙鎺鍗涓灏濉鑷閿纭浠缁鏃鏍閫瀹闅鏄鎼鐪]/g;
function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(fp, files);
    else if (/\.(tsx?|jsx?|less|css|json|md)$/.test(ent.name)) files.push(fp);
  }
  return files;
}
const root = process.argv[2] || "src";
const hits = [];
for (const file of walk(root)) {
  const c = fs.readFileSync(file, "utf8");
  const m = c.match(MARKER_RE);
  if (m) hits.push({ file, count: m.length });
}
console.log(JSON.stringify({ files: hits.length, hits }, null, 2));