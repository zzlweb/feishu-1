const fs = require("fs");
const iconv = require("iconv-lite");
const MARKER_RE = /[鐢鍒鏂瀛闄璇鎵瑙琛脳缂鍙鎺鍗涓灏濉鑷閿纭浠缁鏃鏍閫瀹闅鏄鎼鐪]/;
function fixSegment(s) { return iconv.decode(iconv.encode(s, "gbk"), "utf8"); }
const c = fs.readFileSync("src/components/Editor/BitableBlockView.tsx", "utf8");
let n = 0;
const re = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
c.replace(re, (m, q, b) => {
  if (MARKER_RE.test(b)) {
    const f = fixSegment(b);
    if (f !== b) { n++; if (n <= 5) console.log(JSON.stringify({ before: b.slice(0, 40), after: f.slice(0, 40) })); }
  }
  return m;
});
console.log("would change", n);