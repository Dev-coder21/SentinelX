// @ts-nocheck
// Shared 2D force-directed dependency graph (canvas). Used by the landing page and the app's Network page.
import { clamp, band, bandName, money, rCol, nCol, RM, anim } from './core'
export class Net{
  constructor(cv,o={},D={}){this.D=D;const S=D.S,PRODUCTS=D.PRODUCTS,DEPS=D.DEPS,REGIONS=D.REGIONS;const NS=S.length;this.NS=NS;this.cv=cv;this.ctx=cv.getContext('2d');this.o=o;this.hover=null;this.sel=o.sel??null;this.drag=null;this.focus=-1;this.regions=new Set(D.REGIONS);this.tiers=new Set([1,2,3]);this.t=0;this.alive=true;this.setDark(!!o.dark);this.z=1;this.px=0;this.py=0;this.bands=new Set([0,1,2]);
    this.nodes=[...S.map(s=>({s,id:s.id,kind:'s',r:6+Math.sqrt(s.spend/1e6)*4.4})),...PRODUCTS.map((p,i)=>({id:NS+i,name:p,kind:'p',pi:i,r:13}))];
    this.links=DEPS.map(([pi,si,w])=>({a:this.nodes[si],b:this.nodes[NS+pi],w,ph:Math.random()})).filter(l=>l.a&&l.b);
    this.adj=new Map();this.nodes.forEach(n=>this.adj.set(n,new Set()));this.links.forEach(l=>{this.adj.get(l.a).add(l.b);this.adj.get(l.b).add(l.a)});
    this.resize();this.place();this.ro=new ResizeObserver(()=>this.resize());this.ro.observe(cv);
    cv.addEventListener('pointermove',e=>this.move(e));cv.addEventListener('pointerleave',()=>{this.hover=null;this.D.hideTip()});
    cv.addEventListener('pointerdown',e=>{const n=this.pick(e);if(n){this.drag=n;this.moved=false;cv.setPointerCapture(e.pointerId)}else if(this.o.pan){this.pan={x:e.clientX,y:e.clientY,px:this.px,py:this.py};cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing'}});
    cv.addEventListener('pointerup',()=>{if(this.drag&&!this.moved){this.sel=this.drag;this.o.onSelect&&this.o.onSelect(this.drag)}this.drag=null;this.pan=null});
    if(o.wheel)cv.addEventListener('wheel',e=>{if(innerWidth<=1100&&!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const r=cv.getBoundingClientRect();this.zoomBy(e.deltaY<0?1.12:1/1.12,e.clientX-r.left,e.clientY-r.top,true)},{passive:false});
    this.vis=true;this.io=new IntersectionObserver(es=>this.vis=es[0].isIntersecting);this.io.observe(cv);this.loop=this.loop.bind(this);requestAnimationFrame(this.loop)}
  resize(){const r=this.cv.getBoundingClientRect();this.w=r.width;this.h=r.height;const pr=Math.min(devicePixelRatio,2);this.pr=pr;this.cv.width=this.w*pr;this.cv.height=this.h*pr;this.ctx.setTransform(pr,0,0,pr,0,0);this.k=Math.min(this.w,this.h);this.heat=1;this.anchors()}
  anchors(){const cx=this.w/2,cy=this.h/2,ax=this.w*.32,ay=this.h*.3;this.anc={"East Asia":[cx+ax,cy-ay],"Southeast Asia":[cx+ax,cy+ay],"North America":[cx-ax,cy+ay*.9],"Europe":[cx-ax,cy-ay]};(this.D.REGIONS||[]).forEach((r,i)=>{if(!this.anc[r]){const a=i*2.4;this.anc[r]=[cx+Math.cos(a)*ax,cy+Math.sin(a)*ay]}});const px=Math.max(70,this.w*.085),py=Math.max(50,this.h*.09);this.panc=[[cx-px,cy-py],[cx+px,cy-py],[cx-px,cy+py],[cx+px,cy+py]];if(this.nodes)this.nodes.forEach(n=>{if(n.kind==='p'){n.x=this.panc[n.pi][0];n.y=this.panc[n.pi][1]}})}
  place(){const cx=this.w/2,cy=this.h/2;this.nodes.forEach((n,i)=>{if(n.kind==='p'){n.x=this.panc[n.pi][0];n.y=this.panc[n.pi][1]}else{const[ax,ay]=this.anc[n.s.region];n.x=ax+(Math.random()-.5)*60;n.y=ay+(Math.random()-.5)*60}n.vx=n.vy=0})}
  shown(n){return n.kind==='p'||(this.regions.has(n.s.region)&&this.tiers.has(n.s.tier)&&this.bands.has(band(n.s.risk)))}
  setDark(d){this.o.dark=d;this.th=d?{hull:'rgba(220,228,255,.05)',mute:'#8C93A3',link:a=>`rgba(220,228,255,${a*1.1})`,dim:'rgba(220,228,255,.04)',prod:'#ECEEF2',bg:'#0F131B',fg:'#ECEEF2',col:nCol,glow:14}:{hull:'rgba(20,22,28,.045)',mute:'#5B5E66',link:a=>`rgba(20,22,28,${a})`,dim:'rgba(20,22,28,.035)',prod:'#14161C',bg:'#F7F6F1',fg:'#14161C',col:rCol,glow:0}}
  hl(){return this.hover||this.drag||(this.o.blast&&this.sel&&this.shown(this.sel)?this.sel:null)}
  zoomBy(f,cx=this.w/2,cy=this.h/2,now){const z=clamp(this.z*f,.5,4),px=cx-(cx-this.px)*z/this.z,py=cy-(cy-this.py)*z/this.z;this.tw({z,px,py},now)}
  tw(t,now){if(now||!anim||typeof gsap==='undefined'){Object.assign(this,t);return}gsap.to(this,{...t,duration:.6,ease:'power3.inOut',overwrite:true})}
  fit(){this.tw({z:1,px:0,py:0})}
  center(n){if(!n)return;const z=Math.max(this.z,1.7);this.tw({z,px:this.w/2-n.x*z,py:this.h/2-n.y*z})}
  lit(n){if(!this.shown(n))return false;if(this.focus>=0){const P=this.nodes[this.NS+this.focus];if(n!==P&&!this.adj.get(P).has(n))return false}const H=this.hl();if(!H)return true;return n===H||this.adj.get(H).has(n)}
  pick(e){const r=this.cv.getBoundingClientRect(),x=(e.clientX-r.left-this.px)/this.z,y=(e.clientY-r.top-this.py)/this.z;let b=null,bd=1e9;this.nodes.forEach(n=>{if(!this.shown(n))return;const d=Math.hypot(n.x-x,n.y-y);if(d<n.r+8&&d<bd){bd=d;b=n}});return b}
  move(e){const r=this.cv.getBoundingClientRect();if(this.pan){this.px=this.pan.px+e.clientX-this.pan.x;this.py=this.pan.py+e.clientY-this.pan.y;return}const x=(e.clientX-r.left-this.px)/this.z,y=(e.clientY-r.top-this.py)/this.z;if(this.drag){this.drag.x=x;this.drag.y=y;this.drag.vx=this.drag.vy=0;this.moved=true;this.heat=Math.max(this.heat,.5);return}
    const n=this.pick(e);this.hover=n;this.cv.style.cursor=n?'pointer':this.o.pan?'grab':'default';
    if(n){const html=n.kind==='s'?`<b>${n.s.name}</b>${n.s.country}, Tier ${n.s.tier}<br>Risk <span class="tv">${n.s.risk.toFixed(1)}</span>, ${bandName(n.s.risk).toLowerCase()}<br>Feeds ${n.s.deps.length} product line${n.s.deps.length>1?'s':''}, ${money(n.s.spend)} a year`:`<b>${n.name}</b>${this.adj.get(n).size} suppliers<br>Weighted risk <span class="tv">${this.D.prodRisk(n.pi).toFixed(0)}</span>`;this.D.showTip(html,e.clientX,e.clientY)}else this.D.hideTip()}
  step(){const N=this.nodes,h=this.heat;if(h<.02&&!this.drag)return;const k=this.k;
    for(let i=0;i<N.length;i++)for(let j=i+1;j<N.length;j++){const a=N[i],b=N[j];let dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy+.01,d=Math.sqrt(d2);const f=(k*k*.0011)/d2;dx/=d;dy/=d;a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;const md=a.r+b.r+14;if(d<md){const p=(md-d)*.3;a.vx+=dx*p;a.vy+=dy*p;b.vx-=dx*p;b.vy-=dy*p}}
    this.links.forEach(l=>{const L=k*(.36-l.w*.12);let dx=l.b.x-l.a.x,dy=l.b.y-l.a.y,d=Math.hypot(dx,dy)||1;const f=(d-L)*.004*l.w;dx/=d;dy/=d;l.a.vx+=dx*f;l.a.vy+=dy*f;l.b.vx-=dx*f*.25;l.b.vy-=dy*f*.25});
    N.forEach(n=>{if(n.kind==='p'){if(n!==this.drag){const[ax,ay]=this.panc[n.pi];n.x+=(ax-n.x)*.08;n.y+=(ay-n.y)*.08;n.vx=n.vy=0}return}else{const[ax,ay]=this.anc[n.s.region];n.vx+=(ax-n.x)*.012;n.vy+=(ay-n.y)*.012}
      if(n===this.drag)return;n.vx*=.8;n.vy*=.8;n.x+=n.vx*h;n.y+=n.vy*h;n.x=clamp(n.x,n.r+6,this.w-n.r-6);n.y=clamp(n.y,n.r+40,this.h-n.r-30)});this.heat*=.993}
  loop(){if(!this.alive)return;requestAnimationFrame(this.loop);if(!this.vis||!this.w||!document.body.contains(this.cv))return;this.step();this.t+=RM?0:.016;this.draw()}
  hull(pts){if(pts.length<3)return pts;pts=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[],up=[];for(const p of pts){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}for(const p of pts.slice().reverse()){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}return lo.slice(0,-1).concat(up.slice(0,-1))}
  draw(){const c=this.ctx,H=this.hl();c.setTransform(this.pr,0,0,this.pr,0,0);c.clearRect(0,0,this.w,this.h);c.setTransform(this.pr*this.z,0,0,this.pr*this.z,this.pr*this.px,this.pr*this.py);
    // corridor hulls
    this.D.REGIONS.forEach(r=>{if(!this.regions.has(r))return;const ns=this.nodes.filter(n=>n.kind==='s'&&n.s.region===r&&this.shown(n));if(!ns.length)return;const hp=this.hull(ns.map(n=>[n.x,n.y]));
      c.save();c.lineJoin='round';c.lineCap='round';c.beginPath();hp.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));if(hp.length>2)c.closePath();c.lineWidth=58;c.strokeStyle=this.th.hull;c.stroke();c.fillStyle=this.th.hull;if(hp.length>2)c.fill();c.restore();
      const top=ns.reduce((m,n)=>n.y<m.y?n:m,ns[0]);const cxr=ns.reduce((a,n)=>a+n.x,0)/ns.length;if(this.w<600)return;c.font='700 12.5px Archivo, Arial, sans-serif';c.fillStyle=this.th.mute;c.textAlign='center';c.fillText(r,cxr,top.y-top.r-26)});
    // links
    this.links.forEach(l=>{if(!this.shown(l.a))return;const on=this.lit(l.a)&&this.lit(l.b)&&(!H||l.a===H||l.b===H);const col=this.th.col(l.a.s.risk);
      const mx=(l.a.x+l.b.x)/2+(l.b.y-l.a.y)*.12,my=(l.a.y+l.b.y)/2-(l.b.x-l.a.x)*.12;c.beginPath();c.moveTo(l.a.x,l.a.y);c.quadraticCurveTo(mx,my,l.b.x,l.b.y);
      const strong=(H&&on)||(this.focus>=0&&on);c.strokeStyle=strong?col:on?this.th.link(.08+l.w*.18):this.th.dim;c.lineWidth=strong?1.2+l.w*2.4:.6+l.w*1.4;c.stroke();
      if(on&&!RM){const t=(this.t*(.22+l.w*.3)+l.ph)%1,u=1-t;const px=u*u*l.a.x+2*u*t*mx+t*t*l.b.x,py=u*u*l.a.y+2*u*t*my+t*t*l.b.y;c.beginPath();c.arc(px,py,1.6+l.w*1.4,0,7);c.fillStyle=col;c.fill()}});
    // nodes
    const order=this.nodes.filter(n=>n.kind==='s').sort((a,b)=>b.s.risk-a.s.risk).slice(0,this.w<600?3:5);const placed=[];
    this.nodes.forEach(n=>{if(!this.shown(n))return;const on=this.lit(n);c.globalAlpha=on?1:.18;
      if(n.kind==='p'){c.save();c.translate(n.x,n.y);c.rotate(Math.PI/4);c.fillStyle=this.th.prod;c.fillRect(-n.r*.72,-n.r*.72,n.r*1.44,n.r*1.44);if(this.focus===n.pi){c.strokeStyle='#FF4F00';c.lineWidth=3;c.strokeRect(-n.r,-n.r,n.r*2,n.r*2)}c.restore();
        c.font='700 13px Archivo, Arial, sans-serif';c.textAlign='center';c.lineWidth=4;c.strokeStyle=this.th.bg;c.strokeText(n.name,n.x,n.y+n.r+18);c.fillStyle=this.th.fg;c.fillText(n.name,n.x,n.y+n.r+18)}
      else{const col=this.th.col(n.s.risk);c.beginPath();c.arc(n.x,n.y,n.r,0,7);c.fillStyle=col;if(this.th.glow&&on){c.shadowColor=col;c.shadowBlur=this.th.glow}c.fill();c.shadowBlur=0;c.lineWidth=2;c.strokeStyle=this.th.bg;c.stroke();
        if(this.sel&&this.sel===n){c.beginPath();c.arc(n.x,n.y,n.r+6,0,7);c.strokeStyle=this.th.fg;c.lineWidth=2;c.stroke()}
        const want=n===H||(this.sel===n)||(H&&on)||(!H&&order.includes(n)&&this.focus<0)||(this.focus>=0&&on);
        if(want){c.font='600 12px Archivo, Arial, sans-serif';const t=n.s.name.split(' ').slice(0,2).join(' ')+'  '+n.s.risk.toFixed(0),tw=c.measureText(t).width;
          // flip the label to the node's left when it would run off the canvas edge
          const flip=(n.x+n.r+6+tw)*this.z+this.px>this.w-4;const lx=flip?n.x-n.r-6:n.x+n.r+6,ly=n.y+4,bx=flip?lx-tw:lx;
          if(n===H||!placed.some(p=>Math.abs(p[0]-bx)<120&&Math.abs(p[1]-ly)<16)){placed.push([bx,ly]);c.textAlign=flip?'right':'left';c.lineWidth=4;c.strokeStyle=this.th.bg;c.strokeText(t,lx,ly);c.fillStyle=this.th.fg;c.fillText(t,lx,ly)}}}
      c.globalAlpha=1})}
  destroy(){this.alive=false;this.ro.disconnect();this.io.disconnect();if(typeof gsap!=='undefined')gsap.killTweensOf(this)}
}
