const fs=require("fs");const path=require("path");
function walk(d,f=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,f);else if(/\.(tsx?|jsx?)$/.test(e.name))f.push(p);}return f;}
const bad=[];
for(const file of walk("src")){const lines=fs.readFileSync(file,"utf8").split(/\n/);lines.forEach((l,i)=>{if(/[\uFFFD]|ȷ|\?\?\?|ɾ/.test(l))bad.push({file,line:i+1,text:l.trim().slice(0,100)});});}
console.log(JSON.stringify(bad,null,2));