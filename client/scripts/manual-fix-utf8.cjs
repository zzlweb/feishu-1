const fs = require("fs");
const p = "src/components/Editor/BitableBlockView.tsx";
let c = fs.readFileSync(p, "utf8");
const reps = [
  ["<label>字段", "<label>排序字段"],
  ["aria-label=\"方向\"", "aria-label=\"排序方向\""],
  ["<label>字段\n", "<label>分组字段\n"],
  ["})}>创建字段</button>", "})}>创建附件字段</button>"],
  ["<label>字段<select", "<label>分组字段<select"],
  ["<label>字段<select disabled={view.locked} value={view.sorts", "<label>排序字段<select disabled={view.locked} value={view.sorts"],
  ["创建?{new Date", "创建于 {new Date"],
];
// global replace for broken UTF-8 replacement char sequences
c = c.replace(/\uFFFD+/g, (m, off) => {
  const ctx = c.slice(Math.max(0, off - 40), off + 40);
  if (ctx.includes("排序") && ctx.includes("label")) return "排序";
  if (ctx.includes("方向")) return "排序";
  if (ctx.includes("分组")) return "分组";
  if (ctx.includes("创建") && ctx.includes("button")) return "附件";
  if (ctx.includes("创建于") || ctx.includes("createdAt")) return "于";
  if (ctx.includes("label")) return "";
  return "";
});
// targeted line fixes via regex
c = c.replace(/<label>\uFFFD+字段/g, "<label>排序字段");
c = c.replace(/aria-label=\"\uFFFD+方向\"/g, 'aria-label="排序方向"');
c = c.replace(/<label>分组\uFFFD+字段/g, "<label>分组字段");
c = c.replace(/创建\uFFFD+字段<\/button>/g, "创建附件字段</button>");
c = c.replace(/<label>分组字段<select/g, "<label>分组字段<select");
c = c.replace(/<label>排序字段<select disabled=\{view\.locked\} value=\{view\.sorts/g, "<label>排序字段<select disabled={view.locked} value={view.sorts");
c = c.replace(/创建\uFFFD+\{new Date/g, "创建于 {new Date");
c = c.replace(/placeholder=\"\uFFFD+当前视图\"/g, 'placeholder="搜索当前视图"');
fs.writeFileSync(p, c, "utf8");
console.log("done");