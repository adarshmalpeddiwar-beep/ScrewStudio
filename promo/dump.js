const fs=require('fs');
// reuse page harness to get drawSheet
const els={};function el(id){ if(!els[id]) els[id]={id,innerHTML:'',textContent:'',hidden:false,disabled:false,style:{},value:'',children:[],classList:{toggle(){}},getAttribute(){return null},setAttribute(k,v){this[k]=v},appendChild(c){this.children.push(c)},addEventListener(){},className:''}; return els[id]; }
global.document={getElementById:el,createElement:()=>el('x'+Math.random()),documentElement:{getAttribute(){return null},setAttribute(){}}};
global.window=global; global.matchMedia=()=>({matches:false}); global.MutationObserver=function(){this.observe=()=>{}}; global.ResizeObserver=function(){this.observe=()=>{}};
global.getComputedStyle=()=>({getPropertyValue:()=>'#999'}); global.performance={now:Date.now}; global.setTimeout=()=>0;
const html=fs.readFileSync('../index.html','utf8'); const sc=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
eval(sc[0]); eval(sc[1].replace("/* ---------- boot ---------- */","window.__t={drawSheet};"));
const K=window.ScrewKit, T=window.__t;
const mesh=(c)=>{const s=K.resolve(c);const m=K.buildMesh(s);return {name:s.designation,std:s.stdId,title:s.std.title,zTop:(c.head==='csks'||c.head==='cskf')?0:s.k,L:s.L,dk:s.head==='hex'?s.dk:s.dk,pos:Array.from(m.pos,v=>+v.toFixed(4)),idx:Array.from(m.idx)}};
const out={
 hero:mesh({head:'cap',drive:'hex',d:6,L:20}),
 sizes:[[3,8],[4,10],[5,12],[6,16],[8,20],[10,25],[12,30]].map(([d,L])=>mesh({head:'cap',drive:'hex',d,L})),
 heads:[['cap','hex'],['button','hex'],['pan','ph'],['cheese','slot'],['csks','hex'],['cskf','torx'],['hex','none']].map(([head,drive])=>mesh({head,drive,d:6,L:16})),
 drives:[['cap','hex'],['pan','torx'],['pan','ph'],['pan','pz'],['cheese','slot']].map(([head,drive])=>({...mesh({head,drive,d:8,L:10}),drive:K.DRIVES[drive]})),
 helix:mesh({head:'cap',drive:'hex',d:8,L:30,helix:true}),
 dl:mesh({head:'button',drive:'hex',d:6,L:16,helix:true}),
};
const C={ink:'#F5F5F7',ink2:'#8E8E93',dim:'#64B5FF',fill:'#2C2C2E',sheet:'#1C1C1E',font:'Inter',mass:null};
out.svgA=T.drawSheet(K.resolve({head:'cap',drive:'hex',d:5,L:20}),{...C,mass:'4.94'});
out.svgB=T.drawSheet(K.resolve({head:'cap',drive:'hex',d:5,L:30}),{...C,mass:'6.84'});
fs.writeFileSync('scene.json',JSON.stringify(out));
console.log(Object.entries(out).map(([k,v])=>k+':'+(Array.isArray(v)?v.map(x=>x.idx.length/3).join('/'):v.idx?v.idx.length/3:v.length)).join('  '));
