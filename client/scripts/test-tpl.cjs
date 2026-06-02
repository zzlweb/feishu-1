const iconv = require("iconv-lite");
const M = /[鐢鍒鏂瀛闄璇鎵瑙琛脳缂鍙鎺鍗涓灏濉鑷閿纭浠缁鏃鏍閫瀹闅鏄鎼鐪]/;
function fix(s) { return iconv.decode(iconv.encode(s, "gbk"), "utf8"); }
const body = "纭\uE15F\uE18C删除 ${recordIds.length} 鏉¤\uE187褰曪紵";
const out = body.split(/(\$\{[^}]*\})/).map((p) => (p.startsWith("${") ? p : M.test(p) ? fix(p) : p)).join("");
console.log(out);