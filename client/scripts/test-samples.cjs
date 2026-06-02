const iconv = require("iconv-lite");
const M = /[鐢鍒鏂瀛闄璇鎵瑙琛脳缂鍙鎺鍗涓灏濉鑷閿纭浠缁鏃鏍閫瀹闅鏄鎼鐪]/;
function fixText(s){return iconv.decode(iconv.encode(s,"gbk"),"utf8");}
const samples = [
  "閫夋嫨附件瀛楁浣滀负灏侀潰",
  "鎼滅储璁板綍",
  "排序瀛楁",
  "纭删除",
];
for (const s of samples) {
  const f = fixText(s);
  console.log(JSON.stringify({ s, f, changed: f!==s, bad: /\uFFFD/.test(f), m: M.test(s) }));
}