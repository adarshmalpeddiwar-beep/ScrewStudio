require('../src/kernel.js'); const K=globalThis.ScrewKit;
let fails=0, n=0;
for (const [id,S] of Object.entries(K.STD)) for (const dv of S.drives) for (const d of Object.keys(S.data).map(Number)) {
  const Ls=K.lengthsFor(id,d); for (const L of [Ls[0], Ls[Ls.length-1]]) for (const helix of [false,true]) {
    for (const pitch of [K.COARSE[d], K.FINE[d][0]]) {
    n++;
    try { const sp=K.resolve({head:S.head,drive:dv,d,L,pitch,helix}); if(sp.error) throw new Error(sp.error);
      const m=K.buildMesh(sp), c=K.checkManifold(m);
      if (c.nonManifold||c.misoriented) { fails++; console.log('BAD',id,dv,d,L,helix,pitch,c); }
    } catch(e){ fails++; console.log('ERR',id,dv,d,L,helix,e.message); }
  }}
}
console.log('cases',n,'fails',fails);
const sp=K.resolve({head:'cap',drive:'hex',d:5,L:20,helix:false}); const m=K.buildMesh(sp);
console.log(sp.designation,'tris',m.idx.length/3,'vol',m.volume.toFixed(1),'mass g',(m.volume*7.85e-3).toFixed(2));
const sp2=K.resolve({head:'cap',drive:'hex',d:12,L:120,helix:true}); const t0=Date.now(); const m2=K.buildMesh(sp2); const st=K.toSTEP(m2,{id:'x',name:'x',desc:'x',file:'x.step'});
console.log('helix M12x120 tris',m2.idx.length/3,'ms',Date.now()-t0,'step MB',(st.length/1e6).toFixed(1));
