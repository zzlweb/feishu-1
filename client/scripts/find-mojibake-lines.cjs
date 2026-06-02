const fs = require("fs");
const iconv = require("iconv-lite");
const MARKER_RE = /[鐢鍒鏂瀛闄璇鎵瑙琛脳缂鍙鎺鍗涓灏濉鑷閿纭浠缁鏃鏍閫瀹闅鏄鎼鐪]/;
const c = fs.readFileSync("src/components/Editor/BitableBlockView.tsx", "utf8");
const lines = c.split(/\n/);
let n = 0;
for (let i = 0; i < lines.length; i++) {
  if (MARKER_RE.test(lines[i])) {
    n++;
    if (n <= 15) console.log((i+1) + ": " + lines[i].trim().slice(0, 120));
  }
}
console.log("lines with markers", n);