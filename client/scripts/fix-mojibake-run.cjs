const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
const MARKER_RE = /[鐢鍒鏂瀛闄璇鎵瑙琛脳缂鍙鎺鍗涓灏濉鑷閿纭浠缁鏃鏍閫瀹闅鏄鎼鐪]/;
function looks(s) { return MARKER_RE.test(s); }
function fixText(s) {
  try { return iconv.decode(iconv.encode(s, "gbk"), "utf8"); }
  catch { return s; }
}
function fixContent(content) {
  content = content.replace(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g, (match, q, body) => {
    if (!looks(body)) return match;
    let fixed = body;
    if (q === "`" && body.includes("${")) {
      fixed = body.split(/(\$\{[^}]*\})/).map((p) => (p.startsWith("${") ? p : looks(p) ? fixText(p) : p)).join("");
    } else {
      fixed = fixText(body);
    }
    if (fixed === body) return match;
    return q + fixed + q;
  });
  content = content.replace(/>([^<]+?)(?=\s*(?:\r?\n|<))/g, (match, body) => {
    if (!looks(body)) return match;
    const lead = body.match(/^\s*/)[0];
    const core = body.trim();
    const trail = body.slice(lead.length + core.length);
    const fixed = fixText(core);
    if (fixed === core) return match;
    return ">" + lead + fixed + trail;
  });
  content = content.replace(/>([^<>{}\n]+)</g, (match, body) => {
    if (!looks(body.trim())) return match;
    const lead = body.match(/^\s*/)[0];
    const core = body.trim();
    const trail = body.match(/\s*$/)[0];
    const fixed = fixText(core);
    if (fixed === core) return match;
    return ">" + lead + fixed + trail + "<";
  });
  return content;
}
function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(fp, files);
    else if (/\.(tsx?|jsx?|less|css)$/.test(ent.name)) files.push(fp);
  }
  return files;
}
const root = process.argv[2];
const fixedFiles = [];
for (const file of walk(root)) {
  let content = fs.readFileSync(file, "utf8");
  if (!looks(content)) continue;
  const before = content;
  let next = before;
  for (let i = 0; i < 8; i++) {
    const n = fixContent(next);
    if (n === next) break;
    next = n;
  }
  if (next !== before) { fs.writeFileSync(file, next, "utf8"); fixedFiles.push(file); }
}
console.log(JSON.stringify({ fixedFiles, count: fixedFiles.length }));