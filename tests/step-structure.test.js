require('../src/kernel.js'); const K=globalThis.ScrewKit;
for (const c of [{head:'pan',drive:'pz',d:4,L:12},{head:'cheese',drive:'slot',d:3,L:10,helix:true},{head:'hex',drive:'none',d:8,L:30}]) {
const sp=K.resolve(c), m=K.buildMesh(sp), s=K.toSTEP(m,{id:'a',name:'b',desc:'c',file:'d.step'});
const defs=new Set([...s.matchAll(/^#(\d+)=/gm)].map(x=>x[1])), refs=[...s.matchAll(/#(\d+)/g)].map(x=>x[1]);
const missing=refs.filter(r=>!defs.has(r)).length, loops=[...s.matchAll(/POLY_LOOP\('',\(([^)]*)\)\)/g)].map(x=>x[1].split(',').length);
console.log(sp.designation,'entities',defs.size,'missing refs',missing,'faces',loops.length,'quads',loops.filter(n=>n==4).length,'bytes',s.length);
require('fs').writeFileSync('./'+c.head+'.step',s); require('fs').writeFileSync('./'+c.head+'.stl',Buffer.from(K.toSTL(m,'x')));
}
