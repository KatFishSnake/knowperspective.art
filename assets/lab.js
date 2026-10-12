(function(){
'use strict';
const U = 160, EPS = 2;
const DEFAULTS = {D:300,cone:60,tilt:0,eye:1.5,rot:45,corner:90,w:1.5,d:1,h:1,x0:-60};
const SENSORS = {
  ff:   {name:'Full frame 36 × 24 mm', w:36, h:24},
  apsc: {name:'APS-C 23.6 × 15.7 mm', w:23.6, h:15.7},
  m43:  {name:'Micro Four Thirds 17.3 × 13 mm', w:17.3, h:13},
  phone:{name:'Phone main camera 9.8 × 7.3 mm', w:9.8, h:7.3},
  mf:   {name:'Medium format 44 × 33 mm', w:44, h:33}
};
let hiMul=1;
const S = Object.assign({
  hi:null, pin:null, adv:false, zoom:1, cx:0, cy:-120,
  lens:{on:false, f:50, sensor:'ff', frame:560},
  show:{cone:true, rays:true, legs:true, labels:true, ext:true, grid:true, hidden:true, footprint:false, visual:false, frame:true}
}, DEFAULTS);

const SLIDERS = [
  {group:'Viewer', key:'D', label:'Viewing distance D', min:80, max:1500, step:5, unit:' px',
   hint:'Eye-to-window distance. SP sits this far below the horizon. Increase D and convergence flattens, the VPs move out and the cone circle grows.'},
  {group:'Viewer', key:'cone', label:'Cone of vision', min:20, max:130, step:1, unit:'°',
   hint:'Comfort zone around the line of sight. This only sets the circle radius, D·tan(half angle). The drawing does not change.'},
  {group:'Viewer', key:'tilt', label:'Tilt of line of sight', min:-45, max:45, step:1, unit:'°',
   hint:'Tilt your gaze up or down. Verticals converge to VP3 and the horizon moves off CV.'},
  {group:'Viewer', key:'eye', label:'Eye height', min:-1, max:4, step:0.05, unit:' u',
   hint:'Height of your eye above the ground. 1 u is the default box height, 160 px on the window. This moves the box against the horizon. The construction stays put.'},
  {group:'Box', key:'rot', label:'Rotation', min:0, max:90, step:1, unit:'°',
   hint:'Turn the box. At 0° or 90°, one edge set runs parallel to the sheet and its VP goes to infinity, which gives one-point. At 45°, the two VPs are symmetric.'},
  {group:'Box', key:'w', label:'Width', min:0.3, max:3, step:0.1, unit:' u', hint:''},
  {group:'Box', key:'d', label:'Depth', min:0.3, max:3, step:0.1, unit:' u', hint:''},
  {group:'Box', key:'h', label:'Height', min:0.3, max:3, step:0.1, unit:' u', hint:''},
  {group:'Box', key:'x0', label:'Sideways position', min:-400, max:400, step:5, unit:' px', hint:'Slide the box along the window.'},
  {group:'Advanced', key:'corner', label:'Box corner angle', min:60, max:120, step:1, unit:'°',
   hint:'Angle between the two legs from SP. A box uses 90°. Change the angle and you are drawing a rhombic prism.'}
];
const SHOW = [
  {cat:'Construction', items:[['cone','Cone of vision circle'],['rays','Cone rays from SP'],['legs','Legs from SP to the VPs'],['labels','Labels']]},
  {cat:'Drawing', items:[['ext','Edge lines running to the VPs'],['grid','Ground grid'],['hidden','Hidden edges, dashed']]},
  {cat:'Plan method', items:[['footprint','Plan of the box on the sheet'],['visual','Visual rays SP → plan corners']]},
  {cat:'Lens', adv:true, items:[['frame','Camera frame on the sheet']]}
];
const PRESETS = [
  {name:'One-point', vals:{rot:0, x0:-120, w:1.5, d:1}},
  {name:'Two-point', vals:{rot:45, x0:0, w:1.2, d:1.2, D:320}},
  {name:'Three-point, looking up', vals:{rot:40, tilt:25, eye:0.3, w:0.6, d:0.6, h:2.2, x0:0}},
  {name:'Three-point, looking down', vals:{rot:40, tilt:-35, eye:3, w:1, d:1, x0:0}},
  {name:'Wide-angle (small D)', vals:{rot:45, D:140, x0:0, w:1.5, d:1.5}},
  {name:'Telephoto (big D)', vals:{rot:45, D:700, x0:0, w:1.5, d:1.5}},
  {name:'Cone too wide', vals:{rot:45, D:250, cone:100, x0:0, w:1.5, d:1}}
];
const PRESETS_ADV = [
  {name:'Two-point 30 / 60', vals:{rot:30, x0:0, w:1.5, d:1}},
  {name:'Eye on the ground', vals:{rot:45, eye:0, x0:0, w:1.2, d:1.2}},
  {name:'Worm’s eye', vals:{rot:40, tilt:40, eye:0.2, w:0.6, d:0.6, h:2.5, x0:0}},
  {name:'Rhombic prism', vals:{rot:30, corner:60, x0:0, w:1.2, d:1.2}},
  {name:'24 mm lens', vals:{rot:45, x0:0, w:1.5, d:1.5}, lens:{f:24, sensor:'ff', frame:560}},
  {name:'50 mm lens', vals:{rot:45, x0:0, w:1.5, d:1.5}, lens:{f:50, sensor:'ff', frame:560}},
  {name:'85 mm lens', vals:{rot:45, x0:0, w:1.5, d:1.5}, lens:{f:85, sensor:'ff', frame:560}},
  {name:'Phone main camera', vals:{rot:45, x0:0, w:1.5, d:1.5}, lens:{f:6.9, sensor:'phone', frame:560}}
];

const deg = a => a*Math.PI/180;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scl=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const hyp=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
const signed = n => (n>0?'+':'') + Math.round(n);

/* ---------- lens: focal length and sensor set D and the cone ---------- */
function lensInfo(){
  const s=SENSORS[S.lens.sensor], diag=Math.hypot(s.w,s.h);
  return {sensor:s, diag, aov:2*Math.atan(diag/(2*S.lens.f))*180/Math.PI, D:S.lens.f*S.lens.frame/s.w, eq:S.lens.f*43.27/diag, frameH:S.lens.frame*s.h/s.w};
}
function lensApply(){ if (!S.lens.on) return; const L=lensInfo(); S.D=L.D; S.cone=L.aov; }

/* ---------- geometry: everything on the sheet comes from one projection ---------- */
function geom(){
  const phi = deg(S.tilt), c = Math.cos(phi), s = Math.sin(phi);
  const t1 = deg(S.rot), t2 = deg(S.rot + S.corner);
  const e1 = scl([Math.cos(t1),0,Math.sin(t1)], S.w*U);
  const e2 = scl([Math.cos(t2),0,Math.sin(t2)], S.d*U);
  const e3 = [0,S.h*U,0];
  const zmin = Math.min(0,e1[2]) + Math.min(0,e2[2]);
  const C0 = [S.x0, -S.eye*U, S.D - zmin];
  const yH = -S.D*Math.tan(phi);
  const vp = ang => { const sn=Math.sin(ang), cs=Math.cos(ang); return Math.abs(sn)<1e-6 ? null : {x:S.D*cs/sn/c, y:yH}; };
  const VP1 = vp(t1), VP2 = vp(t2);
  const VP3 = Math.abs(s)<1e-6 ? null : {x:0, y:S.D*c/s};
  const r = S.D*Math.tan(deg(S.cone)/2);
  const Dh = S.D/c;
  return {phi,c,s,t1,t2,e1,e2,e3,C0,yH,VP1,VP2,VP3,r,Dh,SP:{x:0,y:yH-Dh}};
}
function cam(P,g){ return {x:P[0], y:g.c*P[1]-g.s*P[2], z:g.s*P[1]+g.c*P[2]}; }
function proj(q){ return {x:S.D*q.x/q.z, y:S.D*q.y/q.z}; }
function seg(Pw,Qw,g){
  let a=cam(Pw,g), b=cam(Qw,g);
  if (a.z<=EPS && b.z<=EPS) return null;
  if (a.z<=EPS || b.z<=EPS){
    const t=(EPS-a.z)/(b.z-a.z);
    const m={x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t, z:EPS};
    if (a.z<=EPS) a=m; else b=m;
  }
  return [proj(a),proj(b)];
}
function corners(g){
  const out=[];
  for (let i=0;i<8;i++){
    const a=i&1, b=(i>>1)&1, c=(i>>2)&1;
    out.push(add(g.C0, add(scl(g.e1,a), add(scl(g.e2,b), scl(g.e3,c)))));
  }
  return out;
}
function projectedCorners(g){
  const out=[]; for (const P of corners(g)){ const q=cam(P,g); if (q.z>EPS) out.push(proj(q)); } return out;
}
function faceVisible(g,bit,val){
  const E=[g.e1,g.e2,g.e3], i=(bit+1)%3, j=(bit+2)%3;
  const center = add(g.C0, scl(add(E[0],add(E[1],E[2])),0.5));
  const fp = add(add(g.C0, scl(E[bit],val)), scl(add(E[i],E[j]),0.5));
  let n = cross(E[i],E[j]);
  if (dot3(n, sub(fp,center))<0) n=scl(n,-1);
  return dot3(n, scl(fp,-1))>0;
}
function boxInsideCone(D){
  const saved=S.D; S.D=D; const g=geom(); let ok=true;
  for (const P of corners(g)){ const q=cam(P,g); if (q.z<=EPS){ ok=false; break; } const p=proj(q); if (Math.hypot(p.x,p.y)>g.r){ ok=false; break; } }
  S.D=saved; return ok;
}
function deriveD(){
  let lo=40, hi=1500;
  if (!boxInsideCone(hi)) return hi;
  for (let i=0;i<40;i++){ const m=(lo+hi)/2; if (boxInsideCone(m)) hi=m; else lo=m; }
  return Math.min(1500, Math.ceil(hi/5)*5);
}

/* ---------- canvas ---------- */
const canvas = document.getElementById('sheet');
const ctx = canvas.getContext('2d');
let W=800, H=600, dpr=1, C={};
const F = { label:'12px "IBM Plex Sans Condensed","Arial Narrow",sans-serif', num:'11.5px "IBM Plex Mono",ui-monospace,monospace', big:'600 13px "IBM Plex Sans Condensed","Arial Narrow",sans-serif' };
function colors(){
  const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
  return {paper:v('--paper'), ink:v('--ink'), ink2:v('--ink-2'), ink3:v('--ink-3'), red:v('--red'), redSoft:v('--red-soft'),
          green:v('--green'), greenSoft:v('--green-soft'), blue:v('--blue'), blueSoft:v('--blue-soft'),
          graphite:v('--graphite'), graphiteSoft:v('--graphite-soft'), grid:v('--grid'), amber:v('--amber')};
}
const toS = p => ({x: W/2 + (p.x-S.cx)*S.zoom, y: H/2 - (p.y-S.cy)*S.zoom});
const toP = (sx,sy) => ({x: S.cx + (sx-W/2)/S.zoom, y: S.cy - (sy-H/2)/S.zoom});
function sline(a,b,color,w,dash){
  ctx.beginPath(); ctx.setLineDash(dash||[]); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
  ctx.strokeStyle=color; ctx.lineWidth=(w||1)*hiMul; ctx.stroke(); ctx.setLineDash([]);
}
function el(key,fn){ const on=S.hi===key; ctx.globalAlpha=(S.hi&&!on)?0.38:1; hiMul=on?2.4:1; fn(); ctx.globalAlpha=1; hiMul=1; }
const pline = (p,q,color,w,dash) => sline(toS(p),toS(q),color,w,dash);
function hline(yPaper,color,w,dash){ const y=toS({x:0,y:yPaper}).y; sline({x:0,y},{x:W,y},color,w,dash); }
function vline(xPaper,color,w,dash){ const x=toS({x:xPaper,y:0}).x; sline({x,y:0},{x,y:H},color,w,dash); }
function dotAt(s,color,r){ ctx.beginPath(); ctx.arc(s.x,s.y,r||3.5,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); }
function text(str,x,y,o){
  if (!S.show.labels) return;
  o=o||{}; ctx.font=o.font||F.label; ctx.textAlign=o.align||'left'; ctx.textBaseline=o.base||'middle';
  ctx.lineJoin='round'; ctx.lineWidth=3.5; ctx.strokeStyle=C.paper; ctx.strokeText(str,x,y);
  ctx.fillStyle=o.color||C.ink; ctx.fillText(str,x,y);
}
function onScreen(s,m){ m=m||18; return s.x>=m && s.x<=W-m && s.y>=m && s.y<=H-m; }
function marker(p,name,color,sub){
  const s=toS(p);
  if (onScreen(s)){
    const flip=s.x>W-110, lx=flip?s.x-7:s.x+7, align=flip?'right':'left';
    dotAt(s,color,4); text(name, lx, s.y-9, {color, align, font:F.big});
    if (sub) text(sub, lx, s.y+6, {color:C.ink2, align, font:F.num});
    return;
  }
  const m=22, cx=W/2, cy=H/2, dx=s.x-cx, dy=s.y-cy;
  const tx = dx>0 ? (W-m-cx)/dx : dx<0 ? (m-cx)/dx : Infinity;
  const ty = dy>0 ? (H-m-cy)/dy : dy<0 ? (m-cy)/dy : Infinity;
  const t=Math.min(tx,ty), ex=cx+dx*t, ey=cy+dy*t, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L;
  ctx.beginPath(); ctx.moveTo(ex+ux*9, ey+uy*9); ctx.lineTo(ex-uy*5-ux*3, ey+ux*5-uy*3); ctx.lineTo(ex+uy*5-ux*3, ey-ux*5-uy*3); ctx.closePath(); ctx.fillStyle=color; ctx.fill();
  const align = ex>W-80 ? 'right' : ex<80 ? 'left' : 'center';
  const ly = ey<40 ? ey+16 : ey-14;
  text(name+' · off the sheet', clamp(ex,10,W-10), ly, {color, align, font:F.big});
  if (sub) text(sub, clamp(ex,10,W-10), ly + (ey<40 ? 14 : -14), {color:C.ink2, align, font:F.num});
}
function arcLabel(center, r, a0, a1, label, color){
  const s=toS(center);
  ctx.beginPath(); ctx.arc(s.x, s.y, r, -Math.max(a0,a1), -Math.min(a0,a1), false); ctx.strokeStyle=color; ctx.lineWidth=hiMul; ctx.stroke();
  const mid=(a0+a1)/2; text(label, s.x+Math.cos(mid)*(r+13), s.y-Math.sin(mid)*(r+13), {color, align:'center', font:F.num});
}

function drawGrid(g){
  const u1=scl(g.e1,1/S.w), u2=scl(g.e2,1/S.d);
  const a0=-2, a1=Math.ceil(S.w)+2, b0=-2, b1=Math.ceil(S.d)+2;
  for (let b=b0;b<=b1;b++){ const P=add(g.C0,add(scl(u2,b),scl(u1,a0))), Q=add(g.C0,add(scl(u2,b),scl(u1,a1))); const sg=seg(P,Q,g); if (sg) pline(sg[0],sg[1],C.grid,1); }
  for (let a=a0;a<=a1;a++){ const P=add(g.C0,add(scl(u1,a),scl(u2,b0))), Q=add(g.C0,add(scl(u1,a),scl(u2,b1))); const sg=seg(P,Q,g); if (sg) pline(sg[0],sg[1],C.grid,1); }
}
function planCorners(g){
  const out=[];
  for (const [a,b] of [[0,0],[1,0],[1,1],[0,1]]) out.push({x:g.C0[0]+a*g.e1[0]+b*g.e2[0], y:(g.C0[2]-S.D)+a*g.e1[2]+b*g.e2[2]});
  return out;
}
function drawPlan(g){
  if (!S.show.footprint && !S.show.visual) return;
  const pc=planCorners(g);
  if (S.show.footprint){
    ctx.beginPath(); pc.forEach((p,i)=>{ const s=toS(p); if (i) ctx.lineTo(s.x,s.y); else ctx.moveTo(s.x,s.y); }); ctx.closePath();
    ctx.setLineDash([4,3]); ctx.strokeStyle=C.ink2; ctx.lineWidth=1; ctx.stroke(); ctx.setLineDash([]);
    const top=pc.reduce((m,p)=>p.y>m.y?p:m, pc[0]); const ts=toS(top);
    text('plan of the box · up the page = away from you', ts.x, ts.y-10, {color:C.ink2, align:'center', font:F.num});
  }
  if (S.show.visual){
    const bottom = -S.eye*U - 40;
    for (const p of pc){
      pline(g.SP, p, C.blue, 0.9);
      const t = S.D/(p.y+S.D); if (!(t>0)) continue;
      const hit={x:p.x*t, y:0};
      dotAt(toS(hit), C.blue, 3);
      pline(hit, {x:hit.x, y:Math.min(bottom, hit.y-20)}, C.blueSoft, 1, [2,4]);
    }
  }
}
function drawFrame(){
  if (!S.lens.on || !S.show.frame) return;
  const L=lensInfo(), c=toS({x:0,y:0}), w=S.lens.frame*S.zoom, h=L.frameH*S.zoom;
  el('frame', ()=>{
    ctx.setLineDash([7,4]); ctx.strokeStyle=C.amber; ctx.lineWidth=1.2; ctx.strokeRect(c.x-w/2, c.y-h/2, w, h); ctx.setLineDash([]);
    text(S.lens.f+' mm · '+L.sensor.name+' · '+Math.round(L.aov)+'° diagonal', c.x-w/2+8, c.y+h/2-11, {color:C.amber, font:F.num});
  });
}
function legDir(ang){ let x=Math.cos(ang), y=Math.sin(ang); if (y<0){x=-x;y=-y;} return {x,y}; }
function drawConstruction(g){
  const hs=toS({x:0,y:g.yH});
  el('horizon', ()=>{ hline(g.yH, C.red, 1); text('horizon · eye level', W-10, hs.y+20, {color:C.red, align:'right'}); });
  const cv=toS({x:0,y:0});
  el('axis', ()=>{ vline(0, C.red, 0.8, [6,4]); dotAt(cv, C.red, 3.5); text('CV', cv.x+7, cv.y+9, {color:C.red, font:F.big}); });
  if (S.show.cone) el('cone', ()=>{
    ctx.beginPath(); ctx.arc(cv.x,cv.y,g.r*S.zoom,0,Math.PI*2); ctx.strokeStyle=C.red; ctx.lineWidth=1.2*hiMul; ctx.stroke();
    text('cone of vision '+Math.round(S.cone)+'°  ·  r = D·tan('+(Math.round(S.cone)/2)+'°) = '+Math.round(g.r), cv.x, cv.y-g.r*S.zoom-9, {color:C.red, align:'center'});
  });
  const sp=toS(g.SP);
  if (S.show.rays && S.tilt===0) el('rays', ()=>{
    pline(g.SP,{x:-g.r,y:g.yH},C.red,0.8); pline(g.SP,{x:g.r,y:g.yH},C.red,0.8);
    const h=deg(S.cone)/2; arcLabel(g.SP, 58, Math.PI/2-h, Math.PI/2+h, Math.round(S.cone)+'°', C.red);
  });
  if (S.show.legs) el('legs', ()=>{
    const dirs=[g.t1,g.t2].map(legDir);
    dirs.forEach((d,i)=>{
      if (d.y<1e-6){
        const y=sp.y; sline({x:0,y},{x:W,y},C.red,0.8,[8,5]);
        text('leg '+(i+1)+' is parallel to the horizon → VP'+(i+1)+' at infinity', sp.x+(i?-12:12), y-10, {color:C.red, align:i?'right':'left', font:F.num});
      } else {
        const vp=[g.VP1,g.VP2][i]; pline(g.SP, vp, C.red, 1);
      }
    });
    const a0=Math.atan2(dirs[0].y,dirs[0].x), a1=Math.atan2(dirs[1].y,dirs[1].x);
    arcLabel(g.SP, 34, a0, a1, Math.round(Math.abs(a1-a0)*180/Math.PI)+'°', C.red);
  });
  el('sp', ()=>{
    const mid={x:sp.x, y:(sp.y+hs.y)/2};
    text(S.tilt===0 ? 'D = '+Math.round(S.D) : 'D / cos '+Math.abs(S.tilt)+'° = '+Math.round(g.Dh), mid.x+8, mid.y, {color:C.red, font:F.num});
    sline({x:sp.x-6,y:hs.y},{x:sp.x+6,y:hs.y},C.red,1); sline({x:sp.x-6,y:sp.y},{x:sp.x+6,y:sp.y},C.red,1);
    marker(g.SP, 'SP', C.red, S.tilt===0 ? 'your eye, folded onto the sheet' : 'folded about the horizon');
  });
}
function drawBox(g){
  const P=corners(g), VPs=[g.VP1,g.VP2,g.VP3];
  const vis=[0,1,2].map(bit=>[faceVisible(g,bit,0),faceVisible(g,bit,1)]);
  const edges=[];
  for (let i=0;i<8;i++) for (let bit=0;bit<3;bit++){
    const j=i|(1<<bit); if (j===i) continue;
    const k1=(bit+1)%3, k2=(bit+2)%3;
    const v = vis[k1][(i>>k1)&1] || vis[k2][(i>>k2)&1];
    const sg=seg(P[i],P[j],g); if (!sg) continue;
    edges.push({sg,bit,v});
  }
  if (S.show.ext) el('vps', ()=>{ for (const e of edges){
    const vp=VPs[e.bit];
    if (vp){ const [a,b]=e.sg; const near = hyp(a,vp)<hyp(b,vp) ? a : b; pline(near, vp, C.greenSoft, 1); }
    else if (e.bit<2){ const y=toS(e.sg[0]).y; sline({x:0,y},{x:W,y},C.greenSoft,1); }
  } });
  if (S.show.hidden) for (const e of edges) if (!e.v) pline(e.sg[0],e.sg[1],C.graphiteSoft,1,[5,4]);
  for (const e of edges) if (e.v) pline(e.sg[0],e.sg[1],C.graphite,1.8);
}
function drawVPs(g){ el('vps', ()=>{
  if (g.VP1) marker(g.VP1,'VP1',C.green, signed(g.VP1.x)+' from CV');
  if (g.VP2) marker(g.VP2,'VP2',C.green, signed(g.VP2.x)+' from CV');
  if (g.VP3) marker(g.VP3,'VP3',C.green, (g.VP3.y>0?'+':'')+Math.round(g.VP3.y)+' from CV, verticals meet here');
}); }
function draw(){
  C=colors(); const g=geom();
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  ctx.fillStyle=C.paper; ctx.fillRect(0,0,W,H);
  if (S.show.grid) drawGrid(g);
  if (S.tilt===0) drawPlan(g);
  drawFrame();
  drawConstruction(g);
  drawBox(g);
  drawVPs(g);
  reading(g);
}

/* ---------- reading panel ---------- */
const $ = id => document.getElementById(id);
function reading(g){
  const onePoint = S.tilt===0 && (!g.VP1 || !g.VP2);
  const three = S.tilt!==0;
  const name = three ? 'Three-point perspective' : onePoint ? 'One-point perspective' : 'Two-point perspective';
  const sub = three ? 'line of sight tilted '+Math.abs(S.tilt)+'° '+(S.tilt>0?'up':'down')+', verticals converge'
            : onePoint ? 'one set of horizontal edges is parallel to the sheet'
            : 'both horizontal edge sets recede, verticals stay vertical';
  $('mode-name').textContent=name; $('mode-sub').textContent=sub;
  const vpTxt = vp => vp ? signed(vp.x)+' px on the horizon' : 'at infinity (edges stay parallel to the horizon)';
  const half = Math.round(S.cone*10)/20;
  const rows = [
    ['Viewing distance D', Math.round(S.D)+' px'],
    ['Cone radius', Math.round(g.r)+' px = D · tan('+half+'°)'],
    ['Horizon', S.tilt===0 ? 'through CV' : Math.round(Math.abs(g.yH))+' px '+(g.yH<0?'below':'above')+' CV'],
    ['SP below horizon', Math.round(g.Dh)+' px'+(S.tilt===0?'':' = D / cos '+Math.abs(S.tilt)+'°')],
    ['VP1', vpTxt(g.VP1)],
    ['VP2', vpTxt(g.VP2)],
    ['VP3', g.VP3 ? Math.round(Math.abs(g.VP3.y))+' px '+(g.VP3.y>0?'above':'below')+' CV' : 'none, line of sight is level'],
    ['VP1 to VP2', g.VP1&&g.VP2 ? Math.round(Math.abs(g.VP1.x-g.VP2.x))+' px' : 'infinite']
  ];
  if (S.lens.on){ const L=lensInfo(); rows.push(['Lens', S.lens.f+' mm on '+L.sensor.name.split(' ')[0].toLowerCase()+(L.sensor===SENSORS.ff?' frame':'')+', '+Math.round(L.aov)+'° diagonal, '+Math.round(L.eq)+' mm equivalent']); }
  $('stats').innerHTML = rows.map(([k,v])=>'<dt>'+k+'</dt><dd>'+v+'</dd>').join('');

  const notes=[];
  const push=(lvl,t)=>notes.push({lvl,t});
  const coneR=Math.round(S.cone);
  if (S.cone>=90) push('bad','Cone is '+coneR+'°. At 90°, the two VPs of a 45° box sit on the circle. Wider than that puts them inside it, and the circle no longer warns you about stretching. About 60° is the usual comfort limit.');
  [['VP1',g.VP1],['VP2',g.VP2],['VP3',g.VP3]].forEach(([n,vp])=>{
    if (vp && Math.hypot(vp.x,vp.y)<g.r) push('bad', n+' is inside the cone of vision ('+Math.round(Math.hypot(vp.x,vp.y))+' px from CV, circle radius '+Math.round(g.r)+'). Edges heading there converge so fast that the box looks warped. Increase D, or turn the box so this VP moves out.');
  });
  const pc=projectedCorners(g), outside=pc.filter(p=>Math.hypot(p.x,p.y)>g.r).length;
  if (outside>0) push('warn', outside+' of '+pc.length+' box corners lie outside the cone. Those parts will look stretched. Increase D, shrink the box, or slide it toward CV. Advanced can find the smallest D that fits.');
  else push('good','The whole box sits inside the cone of vision.');
  [['VP1',g.VP1],['VP2',g.VP2],['VP3',g.VP3]].forEach(([n,vp])=>{
    if (vp && !onScreen(toS(vp))) push('info', n+' is '+Math.round(Math.hypot(vp.x,vp.y))+' px from CV, beyond the visible sheet. On paper, tape on an extension or use a long straightedge. Zoom out to see it.');
  });
  if (S.lens.on){ const L=lensInfo(); push('info','Lens mode sets D = focal length × frame width ÷ sensor width = '+S.lens.f+' × '+S.lens.frame+' ÷ '+L.sensor.w+' = '+Math.round(L.D)+' px. The cone is the lens’s diagonal angle of view, '+Math.round(L.aov)+'°. The frame sits inscribed in the circle. A 60° cone is about a 37 mm lens on full frame.'); }
  if (three) push('info','Looking '+(S.tilt>0?'up':'down')+' by '+Math.abs(S.tilt)+'°: the window tilts with your line of sight, so verticals converge to VP3 at D / tan '+Math.abs(S.tilt)+'° = '+Math.round(Math.abs(g.VP3.y))+' px '+(g.VP3.y>0?'above':'below')+' CV, and the horizon moves to D · tan '+Math.abs(S.tilt)+'° = '+Math.round(Math.abs(g.yH))+' px on the other side. The horizontal VPs spread by 1 / cos '+Math.abs(S.tilt)+'° = '+(1/g.c).toFixed(2)+'.');
  if (onePoint) push('info','Rotation '+S.rot+'°: one edge direction runs parallel to the sheet, so its VP is at infinity and those edges stay parallel to the horizon. The other direction points straight at CV, which is its VP.');
  if (S.corner!==90) push('info','The legs are '+S.corner+'° apart, so this is a prism with '+S.corner+'° corners. A rectangular box uses 90° corners.');
  if (S.eye<0) push('info','Your eye is below the ground plane. You are looking at the ground from underneath.');
  else if (S.eye===0) push('info','Your eye is exactly on the ground. The ground plane collapses onto the horizon.');
  else if (S.eye<S.h) push('info','Eye level cuts through the box, so you see neither its top nor its bottom face.');
  if (S.tilt!==0 && (S.show.footprint||S.show.visual)) push('info','The plan overlay is hidden while the line of sight is tilted. Folding a plan onto the sheet only works when the window is vertical.');
  $('notes').innerHTML = notes.map(n=>'<li class="'+n.lvl+'">'+n.t+'</li>').join('');
}

/* ---------- controls ---------- */
function buildControls(){
  const root=$('controls'), groups={};
  const groupEl = name => {
    if (!groups[name]){ const gEl=document.createElement('div'); gEl.className='group'+(name==='Advanced'?' adv':''); if (name==='Advanced') gEl.hidden=true; gEl.innerHTML='<div class="eyebrow">'+name+'</div>'; root.appendChild(gEl); groups[name]=gEl; }
    return groups[name];
  };
  for (const s of SLIDERS){
    if (s.group==='Advanced') continue;
    const el=document.createElement('div'); el.className='ctl'; el.id='ctl-row-'+s.key;
    el.innerHTML='<label for="ctl-'+s.key+'">'+s.label+'</label><span class="val" id="val-'+s.key+'"></span>'+
      '<input type="range" id="ctl-'+s.key+'" min="'+s.min+'" max="'+s.max+'" step="'+s.step+'" value="'+S[s.key]+'">'+
      (s.hint?'<div class="hint" id="hint-'+s.key+'">'+s.hint+'</div>':'');
    groupEl(s.group).appendChild(el);
    el.querySelector('input').addEventListener('input', e=>{ S[s.key]=parseFloat(e.target.value); setActivePreset(null); syncVals(); draw(); });
  }
  const showG=groupEl('Show');
  for (const cat of SHOW){
    const sc=document.createElement('div'); sc.className='subcat'+(cat.adv?' adv':''); sc.textContent=cat.cat; if (cat.adv) sc.hidden=true;
    const list=document.createElement('div'); list.className='toggles'+(cat.adv?' adv':''); if (cat.adv) list.hidden=true;
    for (const [k,label] of cat.items){
      const l=document.createElement('label'); l.innerHTML='<input type="checkbox" id="tog-'+k+'"'+(S.show[k]?' checked':'')+'><span>'+label+'</span>';
      l.querySelector('input').addEventListener('change', e=>{ S.show[k]=e.target.checked; draw(); });
      list.appendChild(l);
    }
    showG.appendChild(sc); showG.appendChild(list);
  }
  const advG=groupEl('Advanced');
  advG.innerHTML='<div class="eyebrow">Advanced</div>'+
    '<div class="subcat">Camera lens</div>'+
    '<label class="check"><input type="checkbox" id="lens-on"><span>Use a camera lens. Focal length and sensor set D and the cone. Those two sliders lock.</span></label>'+
    '<div class="ctl"><label for="lens-f">Focal length</label><span class="val" id="val-lens-f"></span><input type="range" id="lens-f" min="4" max="200" step="0.1" value="'+S.lens.f+'"><div class="hint">Real focal length of the lens. D = focal length × frame width ÷ sensor width.</div></div>'+
    '<div class="ctl"><label for="lens-sensor">Sensor format</label><select id="lens-sensor">'+Object.entries(SENSORS).map(([k,v])=>'<option value="'+k+'">'+v.name+'</option>').join('')+'</select><div class="hint">The cone becomes the lens’s diagonal angle of view, so the frame sits inscribed in the circle.</div></div>'+
    '<div class="ctl"><label for="lens-frame">Frame width on the sheet</label><span class="val" id="val-lens-frame"></span><input type="range" id="lens-frame" min="240" max="900" step="10" value="'+S.lens.frame+'"><div class="hint">How wide the photo is on the sheet. D scales with this size.</div></div>'+
    '<div class="lens-out" id="lens-out"></div>'+
    '<div class="subcat">Paper workflow</div>'+
    '<div class="ctl"><label>Find D from the cone</label><button class="btn" id="derive-d" type="button">Fit D to the box</button><div class="hint">On paper, circle the composition first. Then place SP so that circle is the cone. This sets the smallest D that keeps every box corner inside the circle.</div></div>'+
    '<div class="subcat">Object</div>';
  const cs=SLIDERS.find(s=>s.key==='corner');
  const cel=document.createElement('div'); cel.className='ctl'; cel.id='ctl-row-corner';
  cel.innerHTML='<label for="ctl-corner">'+cs.label+'</label><span class="val" id="val-corner"></span><input type="range" id="ctl-corner" min="'+cs.min+'" max="'+cs.max+'" step="'+cs.step+'" value="'+S.corner+'"><div class="hint">'+cs.hint+'</div>';
  advG.appendChild(cel);
  cel.querySelector('input').addEventListener('input', e=>{ S.corner=parseFloat(e.target.value); setActivePreset(null); syncVals(); draw(); });
  const advBtn=document.createElement('button'); advBtn.type='button'; advBtn.className='btn'; advBtn.id='adv-rail'; advBtn.textContent='Show advanced controls';
  root.appendChild(advBtn); advBtn.addEventListener('click', ()=>setAdv(!S.adv));

  $('lens-on').addEventListener('change', e=>{ S.lens.on=e.target.checked; lensApply(); setActivePreset(null); syncVals(); fit(); });
  $('lens-f').addEventListener('input', e=>{ S.lens.f=parseFloat(e.target.value); lensApply(); setActivePreset(null); syncVals(); draw(); });
  $('lens-sensor').addEventListener('change', e=>{ S.lens.sensor=e.target.value; lensApply(); setActivePreset(null); syncVals(); draw(); });
  $('lens-frame').addEventListener('input', e=>{ S.lens.frame=parseFloat(e.target.value); lensApply(); setActivePreset(null); syncVals(); draw(); });
  $('derive-d').addEventListener('click', ()=>{ S.D=deriveD(); setActivePreset(null); syncVals(); fit(); });

  const makeChips=(host,list,prefix)=>{
    list.forEach((p,i)=>{
      const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=p.name; b.dataset.id=prefix+i;
      b.addEventListener('click', ()=>applyPreset(p, prefix+i));
      host.appendChild(b);
    });
  };
  makeChips($('presets'), PRESETS, 'p');
  makeChips($('presets-adv'), PRESETS_ADV, 'a');
  const advChip=document.createElement('button'); advChip.type='button'; advChip.className='chip adv-btn'; advChip.id='adv-chip'; advChip.textContent='Advanced';
  advChip.addEventListener('click', ()=>setAdv(!S.adv)); $('presets').appendChild(advChip);
}
function applyPreset(p,id){
  Object.assign(S, DEFAULTS, p.vals);
  S.lens.on=!!p.lens; if (p.lens) Object.assign(S.lens, p.lens);
  lensApply(); setActivePreset(id); syncVals(); fit();
}
function setActivePreset(id){ document.querySelectorAll('.chip:not(.adv-btn)').forEach(b=>b.classList.toggle('active', b.dataset.id===id)); }
function setAdv(on){
  S.adv=on;
  document.querySelectorAll('.adv').forEach(x=>{ x.hidden=!on; });
  $('presets-adv').hidden=!on;
  $('adv-chip').classList.toggle('on', on);
  $('adv-rail').textContent = on ? 'Hide advanced controls' : 'Show advanced controls';
  try{ localStorage.setItem('pl-adv', on?'1':'0'); }catch(e){}
}
function syncVals(){
  for (const s of SLIDERS){
    const v=S[s.key], inp=$('ctl-'+s.key);
    inp.value=v;
    $('val-'+s.key).textContent=(s.step<1 ? (+v).toFixed(s.step<0.1?2:1) : Math.round(v))+s.unit;
    const locked = S.lens.on && (s.key==='D' || s.key==='cone');
    inp.disabled=locked; $('ctl-row-'+s.key).classList.toggle('locked', locked);
    if (s.key==='D'||s.key==='cone'){ const h=$('hint-'+s.key); if (h) h.textContent = locked ? 'Set by the lens. Turn the lens off to move it.' : s.hint; }
  }
  $('lens-on').checked=S.lens.on;
  $('lens-f').value=S.lens.f; $('val-lens-f').textContent=S.lens.f+' mm';
  $('lens-sensor').value=S.lens.sensor;
  $('lens-frame').value=S.lens.frame; $('val-lens-frame').textContent=S.lens.frame+' px';
  const L=lensInfo();
  $('lens-out').textContent = (S.lens.on?'':'(off) ')+Math.round(L.aov)+'° diagonal angle of view · '+Math.round(L.eq)+' mm full-frame equivalent · D = '+Math.round(L.D)+' px · cone radius '+Math.round(S.lens.frame*L.diag/(2*L.sensor.w))+' px';
  $('derive-d').disabled=S.lens.on;
  $('zoom').value=S.zoom;
}
function fit(){
  const g=geom();
  const pts=[{x:0,y:0},{x:-g.r,y:0},{x:g.r,y:0},{x:0,y:g.r},{x:0,y:-g.r}, ...projectedCorners(g)];
  const near = p => p && Math.hypot(p.x,p.y) <= 2.4*g.r;
  for (const p of [g.SP,g.VP1,g.VP2,g.VP3]) if (near(p)) pts.push(p);
  if (S.tilt===0 && S.show.footprint) pts.push(...planCorners(g));
  if (S.lens.on && S.show.frame){ const L=lensInfo(); pts.push({x:-S.lens.frame/2,y:-L.frameH/2},{x:S.lens.frame/2,y:L.frameH/2}); }
  let hw=1, y0=Infinity, y1=-Infinity;
  for (const p of pts){ hw=Math.max(hw,Math.abs(p.x)); y0=Math.min(y0,p.y); y1=Math.max(y1,p.y); }
  const pad=70;
  S.zoom=clamp(Math.min((W-pad)/(2*hw),(H-pad)/Math.max(y1-y0,1)),0.12,2);
  S.cx=0; S.cy=(y0+y1)/2;
  $('zoom').value=S.zoom; draw();
}
function resize(){
  const rect=canvas.parentElement.getBoundingClientRect();
  W=Math.max(200,Math.round(rect.width)); H=Math.max(200,Math.round(rect.height)); dpr=Math.min(window.devicePixelRatio||1,3);
  canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
  draw();
}

/* ---------- pan and zoom ---------- */
let drag=null;
canvas.addEventListener('pointerdown', e=>{ drag={x:e.clientX,y:e.clientY,cx:S.cx,cy:S.cy}; canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging'); });
canvas.addEventListener('pointermove', e=>{ if (!drag) return; S.cx=drag.cx-(e.clientX-drag.x)/S.zoom; S.cy=drag.cy+(e.clientY-drag.y)/S.zoom; draw(); });
const endDrag=()=>{ drag=null; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const rect=canvas.getBoundingClientRect(), mx=e.clientX-rect.left, my=e.clientY-rect.top;
  const p=toP(mx,my), f=Math.exp(-e.deltaY*0.0015);
  S.zoom=clamp(S.zoom*f,0.12,2);
  S.cx=p.x-(mx-W/2)/S.zoom; S.cy=p.y+(my-H/2)/S.zoom;
  $('zoom').value=S.zoom; draw();
}, {passive:false});
$('zoom').addEventListener('input', e=>{ S.zoom=parseFloat(e.target.value); draw(); });
$('fit').addEventListener('click', fit);
$('reset').addEventListener('click', ()=>{ Object.assign(S, DEFAULTS); S.lens.on=false; setActivePreset(null); syncVals(); fit(); });

document.querySelectorAll('.el').forEach(b=>{
  const k=b.dataset.key;
  b.addEventListener('mouseenter', ()=>{ if (!S.pin){ S.hi=k; draw(); } });
  b.addEventListener('mouseleave', ()=>{ if (!S.pin){ S.hi=null; draw(); } });
  b.addEventListener('focus', ()=>{ if (!S.pin){ S.hi=k; draw(); } });
  b.addEventListener('blur', ()=>{ if (!S.pin){ S.hi=null; draw(); } });
  b.addEventListener('click', ()=>{
    S.pin = S.pin===k ? null : k; S.hi = S.pin;
    document.querySelectorAll('.el').forEach(x=>x.classList.toggle('pinned', x.dataset.key===S.pin));
    draw();
  });
});
buildControls(); syncVals();
let advSaved=false; try{ advSaved = localStorage.getItem('pl-adv')==='1'; }catch(e){}
setAdv(advSaved);
new ResizeObserver(()=>{ resize(); }).observe(canvas.parentElement);
resize(); fit();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
const mq=window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', draw);
new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
})();
