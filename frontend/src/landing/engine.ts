// @ts-nocheck
/* SentinelX landing page engine.
   The landing is a scroll story told with example data (it is labelled as such on the page).
   Everything is imperative for animation performance; mountLanding() returns a cleanup
   function so the page can be unmounted when the React router navigates into the app. */
import { makeWorld, setBeams } from '../shared/world'
import { Net } from '../shared/net'
import { tx, tz, ampOf } from '../shared/landMask'

// play the intro once per browser session, not on every reload
let introPlayed = (() => { try { return sessionStorage.getItem('sx-intro') === '1' } catch { return false } })()

export function mountLanding(root, opts) {
const offs = []; let DEAD = false; let nio = null;
const ON = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)) };
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const hasG=typeof gsap!=='undefined',anim=hasG&&!RM;if(hasG)gsap.ticker.lagSmoothing(0);
const hasT=typeof THREE!=='undefined';

/* ============ DATA (SentinelX seed) ============ */
const PRODUCTS=["Flagship Smartphone","Smart Wearable","Consumer Tablet","IoT Smart Hub"];
const S=[["Pacific Silicon Foundry","East Asia","Taiwan","Semiconductors",6.5e6,1,24.8,121.0],["Hanwa Microelectronics","East Asia","South Korea","Memory and storage",4.8e6,1,37.27,127.44],["Kyoto Opto-Display Corp","East Asia","Japan","Displays",5.2e6,1,35.0,135.77],["Formosa Advanced Substrates","East Asia","Taiwan","PCB and components",2.6e6,1,22.62,120.3],["Seoul Storage Solutions","East Asia","South Korea","Memory and storage",3.5e6,1,37.57,126.98],["Tokyo Nano-Capacitors","East Asia","Japan","PCB and components",9.2e5,3,35.68,139.69],["Shenzhen Precision Interconnect","East Asia","China","Connectors",7.8e5,3,22.54,114.06],["Osaka Thermal Technologies","East Asia","Japan","Mechanical",8.5e5,3,34.69,135.5],["Taipei Quartz Crystals","East Asia","Taiwan","PCB and components",4.8e5,3,25.03,121.56],["Zenith Power Dynamics","Southeast Asia","Vietnam","Batteries",3.4e6,1,21.03,105.85],["Bangkok Precision Optics","Southeast Asia","Thailand","Sensors",1.65e6,2,13.75,100.5],["Penang Micro Assembly","Southeast Asia","Malaysia","PCB and components",1.55e6,2,5.41,100.33],["Singapore Global Logistics Hub","Southeast Asia","Singapore","Logistics",2.25e6,2,1.35,103.82],["Manila Flex Circuits","Southeast Asia","Philippines","Connectors",6.5e5,3,14.6,120.98],["Silicon Valley RF Labs","North America","United States","Semiconductors",3.8e6,1,37.39,-122.08],["Austin Power Systems","North America","United States","Batteries",2.4e6,2,30.27,-97.74],["Guadalajara Mechatronics","North America","Mexico","Mechanical",1.35e6,2,20.67,-103.35],["Delta Maritime Express","North America","United States","Logistics",1.8e6,2,29.95,-90.07],["Monterrey Polymer Enclosures","North America","Mexico","Mechanical",5.6e5,3,25.69,-100.32],["Eindhoven Litho Circuits","Europe","Netherlands","Semiconductors",4.1e6,1,51.44,5.47],["Bavaria Sensor Dynamics","Europe","Germany","Sensors",2.1e6,2,48.14,11.58],["Zurich Micro-Acoustics","Europe","Germany","Sensors",1.15e6,2,47.66,9.17],["Nordic Green Packaging","Europe","Germany","Packaging",3.9e5,3,53.55,9.99],["EuroPac Sustainable Cartons","Europe","Netherlands","Packaging",2.8e5,3,51.92,4.48]].map((r,i)=>({id:i,name:r[0],region:r[1],country:r[2],category:r[3],spend:r[4],tier:r[5],lat:r[6],lon:r[7]}));
const DEPS=[[0,0,.95],[0,2,.9],[0,1,.85],[0,9,.8],[0,3,.75],[0,14,.85],[0,10,.85],[0,6,.45],[0,7,.55],[0,16,.7],[0,5,.4],[0,17,.65],[0,22,.25],[1,0,.85],[1,2,.8],[1,20,.9],[1,9,.75],[1,13,.5],[1,21,.7],[1,18,.55],[1,11,.6],[1,12,.7],[1,22,.2],[2,19,.85],[2,2,.9],[2,4,.85],[2,15,.75],[2,16,.75],[2,6,.4],[2,10,.6],[2,5,.45],[2,3,.7],[2,17,.7],[2,23,.25],[3,14,.9],[3,19,.8],[3,15,.6],[3,20,.75],[3,21,.8],[3,8,.5],[3,18,.5],[3,11,.65],[3,12,.6],[3,23,.3]];
const REGIONS=["East Asia","Southeast Asia","North America","Europe"];
const CATS=["weather","logistics","labor","supply","geopolitical","other"];
const CAT={weather:"#2a78d6",logistics:"#1baf7a",labor:"#e87ba4",supply:"#008300",geopolitical:"#8e5bd8",other:"#7A7D85"};
const SIG=[
 {cat:"weather",t:"Typhoon warning for the Kaohsiung and Hsinchu science parks",src:"Open-Meteo",region:"East Asia",country:"Taiwan",lat:22.6,lon:120.3,sev:60,sent:-.35,day:-1},
 {cat:"logistics",t:"Asia to Europe carriers keep routing around the Cape, adding 10 to 14 days",src:"GDELT",region:"Europe",lat:12.6,lon:43.3,sev:46,sent:-.55,day:-3},
 {cat:"labor",t:"Contract talks stall at US East and Gulf Coast container ports",src:"GDELT",region:"North America",country:"United States",lat:32.08,lon:-81.09,sev:54,sent:-.5,day:-2},
 {cat:"supply",t:"DRAM wafer allocations tighten as fabs shift capacity to HBM",src:"GDELT",region:"East Asia",country:"South Korea",lat:37.2,lon:127.1,sev:48,sent:-.3,day:-5},
 {cat:"geopolitical",t:"Export licence review widened for lithography tooling",src:"GDELT",region:"Europe",country:"Netherlands",lat:51.44,lon:5.47,sev:48,sent:-.45,day:-6},
 {cat:"weather",t:"Monsoon flooding closes roads around the Bayan Lepas industrial zone",src:"Open-Meteo",region:"Southeast Asia",country:"Malaysia",lat:5.3,lon:100.27,sev:57,sent:-.4,day:-4},
 {cat:"logistics",t:"Yard congestion lengthens berth waits in Singapore",src:"GDELT",region:"Southeast Asia",country:"Singapore",lat:1.26,lon:103.8,sev:42,sent:-.35,day:-2},
 {cat:"weather",t:"Heat advisory and rolling power cuts across Nuevo León",src:"Open-Meteo",region:"North America",country:"Mexico",lat:25.7,lon:-100.3,sev:40,sent:-.2,day:-7},
 {cat:"supply",t:"Cathode precursor prices jump after a refinery outage",src:"GDELT",region:"Southeast Asia",country:"Vietnam",lat:20.86,lon:106.68,sev:46,sent:-.4,day:-9},
 {cat:"labor",t:"Rail freight strike called across the German network",src:"GDELT",region:"Europe",country:"Germany",lat:50.11,lon:8.68,sev:44,sent:-.5,day:-8},
 {cat:"logistics",t:"Convoy delays build at the Suez Canal's southern entrance",src:"GDELT",region:"Europe",lat:30.0,lon:32.55,sev:38,sent:-.45,day:-24},
 {cat:"other",t:"Hualien earthquake prompts fab tool inspections",src:"GDELT",region:"East Asia",country:"Taiwan",lat:23.97,lon:121.6,sev:44,sent:-.5,day:-19},
 {cat:"weather",t:"Typhoon remnants flood low-lying Shenzhen districts",src:"Open-Meteo",region:"East Asia",country:"China",lat:22.54,lon:114.06,sev:52,sent:-.3,day:-15},
 {cat:"logistics",t:"Long Beach terminals report container dwell times rising",src:"GDELT",region:"North America",country:"United States",lat:33.75,lon:-118.2,sev:36,sent:-.3,day:-12}
];
const CASES=[
 {name:"Suez Canal",full:"Suez Canal obstruction",list:"Suez Canal obstruction",yr:2021,type:"Logistics",lat:30.0,lon:32.55,T:[["Eindhoven Litho Circuits",92.2,41.7,20.9],["Bavaria Sensor Dynamics",78.0,35.3,17.7],["Nordic Green Packaging",63.8,28.9,14.4]]},
 {name:"Red Sea",full:"Red Sea chokepoint crisis",list:"Red Sea chokepoint crisis",yr:2024,type:"Geopolitical",lat:12.6,lon:43.3,T:[["Eindhoven Litho Circuits",76.3,32.2,19.6],["Bavaria Sensor Dynamics",64.6,27.2,16.6],["Nordic Green Packaging",52.8,22.3,13.6]]},
 {name:"Typhoon Gaemi",full:"Typhoon Gaemi",list:"Typhoon Gaemi",yr:2024,type:"Weather",lat:22.6,lon:120.3,T:[["Pacific Silicon Foundry",100,52.8,26.4],null,["Tokyo Nano-Capacitors",75.9,36.6,18.3]]},
 {name:"US port strike",full:"US East and Gulf Coast port strike",list:"US port strike",yr:2024,type:"Labor",lat:40.67,lon:-74.04,T:[["Silicon Valley RF Labs",100,73.1,40.3],["Austin Power Systems",100,61.8,34.1],["Monterrey Polymer Enclosures",82.5,50.6,27.9]]}
];

/* ============ ENGINE (SentinelX fusion formula) ============ */
const LAMBDA=Math.log(2)/14,MULT={1:1.3,2:1.1,3:.9};
const eRisk=(cat,sev,sent)=>cat==='weather'?clamp(sev):clamp(.65*sev+.35*Math.max(0,-sent*100));
const rec=d=>Math.max(.1,Math.min(1,Math.exp(-LAMBDA*Math.max(0,d))));
S.forEach(s=>{s.deps=DEPS.filter(d=>d[1]===s.id).map(d=>({p:d[0],w:d[2]}));s.impact=Math.max(1,s.deps.reduce((a,d)=>a+d.w,0));s.cost=s.spend*({1:.08,2:.05,3:.02}[s.tier]);s.eff={1:.7,2:.78,3:.85}[s.tier]});
function computeAt(T){S.forEach(s=>{s.contrib=[];SIG.forEach((e,i)=>{if(e.day>T||e.region!==s.region)return;const f=!e.country||e.country===s.country?1:.45;const E=eRisk(e.cat,e.sev,e.sent),w=rec(T-e.day);s.contrib.push({i,E,w,f,c:E*w*f})});
  s.raw=100*(1-s.contrib.reduce((p,x)=>p*(1-x.c/100),1));s.risk=Math.min(100,s.raw*MULT[s.tier]);s.exposure=s.risk/100*s.impact*s.spend;s.protected=s.exposure*s.eff;s.roi=s.cost?s.protected/s.cost:0})}
const DAYS=[];for(let d=-30;d<=14;d++)DAYS.push(d);
const SERIES=[],SUPS=S.map(()=>[]),REGS=REGIONS.map(()=>[]);
DAYS.forEach(d=>{computeAt(d);SERIES.push({d,avg:S.reduce((a,s)=>a+s.risk,0)/24,crit:S.filter(s=>s.risk>=70).length,exp:S.reduce((a,s)=>a+s.exposure,0),act:SIG.filter(e=>e.day<=d&&d-e.day<=14).length});S.forEach((s,i)=>SUPS[i].push(s.risk));REGIONS.forEach((r,k)=>{const ss=S.filter(s=>s.region===r);REGS[k].push(ss.reduce((a,s)=>a+s.risk,0)/ss.length)})});
computeAt(0);const RISK0=S.map(s=>s.risk);
const band=r=>r>=70?2:r>=40?1:0,bandName=r=>['Low','Elevated','Critical'][band(r)];
const rCol=r=>['#1F3BFF','#DE9E00','#D93A12'][band(r)];
const nCol=r=>['#7B90FF','#FFB22E','#FF6A2B'][band(r)];
const money=v=>v>=1e6?'$'+(v/1e6).toFixed(v>=1e7?1:2).replace(/\.?0+$/,'')+'M':v>=1e3?'$'+Math.round(v/1e3)+'k':'$'+Math.round(v);
const bandChip=r=>`<span class="band"><i style="background:${rCol(r)}"></i>${bandName(r)}</span>`;
const scoreChip=r=>`<span class="score"><i style="background:${rCol(r)}"></i>${r.toFixed(1)}</span>`;
const catChip=c=>`<span class="cat"><i style="background:${CAT[c]}"></i>${c==='geopolitical'?'Geopolitical':c}</span>`;
function knap(Bk){Bk=Math.max(0,Math.round(Bk));const tot=S.filter(s=>s.protected>0).reduce((a,s)=>a+Math.max(1,Math.round(s.cost/1000)),0);if(Bk>=tot)return S.filter(s=>s.protected>0).sort((a,b)=>b.roi-a.roi);const it=S.filter(s=>s.protected>0).map(s=>({s,c:Math.max(1,Math.round(s.cost/1000)),v:s.protected}));const n=it.length,dp=new Float64Array(Bk+1),kp=new Uint8Array(n*(Bk+1));it.forEach((x,i)=>{for(let b=Bk;b>=x.c;b--){const v=dp[b-x.c]+x.v;if(v>dp[b]){dp[b]=v;kp[i*(Bk+1)+b]=1}}});let b=Bk;const pk=[];for(let i=n-1;i>=0;i--)if(kp[i*(Bk+1)+b]){pk.push(it[i].s);b-=it[i].c}return pk.sort((a,b)=>b.roi-a.roi)}
function countTo(el,to,f,dur=.8){if(!el)return;if(!anim){el.textContent=f(to);return}const o={v:+(el.dataset.v||0)};el.dataset.v=to;gsap.to(o,{v:to,duration:dur,ease:'power3.out',overwrite:true,onUpdate:()=>el.textContent=f(o.v)})}
const fmtDay=T=>{const r=Math.round(T);return r===0?'Today':r<0?`${-r} day${r===-1?'':'s'} ago`:`In ${r} days`};
const dateOf=T=>{const d=new Date();d.setDate(d.getDate()+Math.round(T));return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})};

/* tooltip */
const tip=$('#tip');
function showTip(html,x,y){tip.innerHTML=html;tip.style.opacity=1;const w=tip.offsetWidth,h=tip.offsetHeight;tip.style.transform=`translate(${Math.min(x+14,innerWidth-w-8)}px,${y-h-12<8?y+16:y-h-12}px)`}
function hideTip(){tip.style.opacity=0}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2600)}
ON(document,'pointermove',e=>{const t=e.target.closest&&e.target.closest('[data-tip]');if(t){showTip(t.dataset.tip,e.clientX,e.clientY)}else if(t===null&&tip._sticky!==true&&!e.target.closest('canvas,.hov'))hideTip()});

/* ============ 3D FIELD ============ */
const prodRisk=p=>{const ds=DEPS.filter(d=>d[0]===p);return ds.reduce((a,d)=>a+d[2]*S[d[1]].risk,0)/ds.reduce((a,d)=>a+d[2],0)};

/* ============ LANDING ============ */
let DARK=false,labUpd=null;
const lpal=()=>DARK?{mute:'#8C93A3',ink:'#ECEEF2',sheet:'#0F131B',rgb:'rgba(220,228,255,',hot:'#FF6A2B',cob:'#7B90FF',high:'#FF6A2B'}:{mute:'#5B5E66',ink:'#14161C',sheet:'#F7F6F1',rgb:'rgba(20,22,28,',hot:'#FF4F00',cob:'#1F3BFF',high:'#D93A12'};
const C=new Proxy({},{get:(t,k)=>lpal()[k]});const lc=r=>DARK?nCol(r):rCol(r);
try{DARK=localStorage.getItem('sx-mode')==='dark'}catch(e){}
document.documentElement.classList.toggle('dark',DARK);

const cv=$('#field');const W=makeWorld(cv,{products:true},{S,CASES,SIG,DEPS,RISK0});
const labelsEl=$('#labels');
const supLabels=S.map(s=>{const d=document.createElement('div');d.className='lab';d.style.opacity=0;d.innerHTML=`<div class="st"></div><div class="bx"><i></i><b class="num"></b><span>${s.name}</span></div>`;labelsEl.appendChild(d);return d});
const prodLabels=PRODUCTS.map(p=>{const d=document.createElement('div');d.className='lab prod';d.style.opacity=0;d.innerHTML=`<div class="bx" style="bottom:22px;left:0;transform:translateX(-50%)"><b>${p}</b></div>`;labelsEl.appendChild(d);return d});
const caseLabel=(()=>{const d=document.createElement('div');d.className='lab';d.style.opacity=0;d.innerHTML=`<div class="st"></div><div class="bx"><i style="background:var(--high)"></i><b class="num"></b><span></span></div>`;labelsEl.appendChild(d);return d})();
const K=[[tx(66),0,-.9,0,6.6,10.7],[tx(118),.4,tz(26),-1.6,3.4,5.2],[tx(70),1,tz(28),0,9.5,9.8],[tx(70),0,tz(26),-3.5,6.2,8.4],[tx(60),0,tz(26),0,10.5,5.5],[tx(66),0,-.9,0,8.4,13]];
const ST={ch:0,p:0,T1:-30,prod:0,fund:new Set(),caseI:2,caseClock:-6,lastT:-30,camT:hasT?new THREE.Vector3():null,camP:hasT?new THREE.Vector3():null,storyEnd:0};
let secs=[];function measure(){secs=$$('main [data-k]').map(el=>({k:+el.dataset.k,top:el.offsetTop,h:el.offsetHeight}));const n=$('#network');ST.storyEnd=n?n.offsetTop:1e9}
function storyPos(){const y=scrollY,vh=innerHeight;let ch=0,p=0;for(const s of secs){if(y+vh*.5>=s.top){ch=s.k;p=clamp((y+vh*.5-s.top)/s.h,0,1)}}return {ch,p}}
const vis=(c,ch,p)=>c===ch?1-sstep(.72,1,p):c===ch+1?sstep(.72,1,p):0;
const _rt={T:null,a:null},_base=S.map((s,i)=>ampOf(RISK0[i]));
function riskTargets(ch){if(ch===1){if(_rt.T!==ST.T1){computeAt(ST.T1);_rt.a=S.map(s=>ampOf(s.risk));computeAt(0);_rt.T=ST.T1}return _rt.a}if(ch===3)return S.map((s,i)=>ST.fund.has(s)?_base[i]*(1-s.eff):_base[i]);if(ch===4)return _base.map(v=>v*.18);return _base}
const _v1=hasT?new THREE.Vector3():null,_v2=hasT?new THREE.Vector3():null;
const setStyle=(el,k,v)=>{if(el['_'+k]!==v){el['_'+k]=v;el.style[k]=v}};
supLabels.forEach(el=>{el._b=el.querySelector('b');el._i=el.querySelector('i')});caseLabel._b=caseLabel.querySelector('b');
const meterA=$$('#meter a').map(a=>({a,c:+a.dataset.c,b:a.querySelector('b')})),meterEl=$('#meter'),meterDay=$('#meterDay');let _mk='';
function frameLanding(t){
  if(!W)return;
  if(scrollY>ST.storyEnd+40){setStyle(labelsEl,'opacity','0');setStyle(meterEl,'opacity','0');setStyle(cv,'visibility','hidden');return}
  setStyle(labelsEl,'opacity','1');setStyle(cv,'visibility','visible');
  const {ch,p}=storyPos();ST.ch=ch;ST.p=p;
  if(ch===1){const T=lerp(-30,0,sstep(.04,.68,p));if(Math.abs(T-ST.T1)>.05){ST.T1=T;updateC1()}}else if(ch>1&&ST.T1<0){ST.T1=0;updateC1()}else if(ch<1&&ST.T1>-30){ST.T1=-30;updateC1()}
  const bT=ch>=1?ST.T1:-30;setBeams(W,ch===1||(ch===2&&p<.2)?bT:-31,ST.lastT);ST.lastT=bT;
  const a1=riskTargets(ch),nx=Math.min(5,ch+1),a2=riskTargets(nx),bl=sstep(.72,1,p);for(let i=0;i<24;i++)W.tgt[i]=a1[i]+(a2[i]-a1[i])*bl;
  const vp=vis(4,ch,p);for(let i=0;i<4;i++)W.tgt[24+i]=0;
  if(vp>.05){if(!RM)ST.caseClock+=Math.min(.05,(t-(ST._lt||t)))*7;if(ST.caseClock>36)ST.caseClock=-6;const v=caseValue(CASES[ST.caseI].T[0],ST.caseClock);W.tgt[24+ST.caseI]=ampOf(v)*vp;W.cur[24+ST.caseI]=W.tgt[24+ST.caseI];updateCaseHud(v)}
  ST._lt=t;
  const vn=vis(2,ch,p);if(W.prods&&(vn>0||ST._vn>0)){W.prods.rings.forEach((r,i)=>{r.m.material.opacity=vn*(i===ST.prod?1:.35)});W.prods.links.forEach(l=>{l.m.uniforms.uA.value=vn*(l.pi===ST.prod?.95:.06)})}ST._vn=vn;
  const vd=vis(3,ch,p);W.shields.forEach((s,i)=>{s.t=ST.fund.has(S[i])?vd:0});W.laneU.uA.value=1-vn*.8-vp*.6;
  const A=K[ch],B=K[nx],e=sstep(.72,1,p);let txx=lerp(A[0],B[0],e),tyy=lerp(A[1],B[1],e),tzz=lerp(A[2],B[2],e),ox=lerp(A[3],B[3],e),oy=lerp(A[4],B[4],e),oz=lerp(A[5],B[5],e);
  if(vp>0){const c=CASES[ST.caseI];txx=lerp(txx,tx(c.lon),vp);tzz=lerp(tzz,tz(c.lat)+.6,vp)}
  if(innerWidth<900){ox*=1.25;oy*=1.3;oz*=1.35;if(ch===0||ch===5){txx=tx(108);tzz+=2.6}}
  // frame-rate independent easing for the camera
  const dt=Math.min(.05,t-(ST._ct||t));ST._ct=t;const k=1-Math.pow(.0015,dt||.016);
  ST.camT.lerp(_v1.set(txx,tyy,tzz),k);ST.camP.lerp(_v2.set(txx+ox,tyy+oy,tzz+oz),k);W.cam.position.copy(ST.camP);W.cam.lookAt(ST.camT);
  {const d=ST.camP.distanceTo(ST.camT);W.U.uFogN.value=d*1.05;W.U.uFogF.value=d*2.4}
  W.step(RM?0:t,1-Math.pow(.012,dt||.016));
  const vw=innerWidth,vh=innerHeight,placed=[];const order=S.slice().sort((a,b)=>W.cur[b.id]-W.cur[a.id]);const showSup=ch!==4&&!(ch===2&&p>.1&&p<.8);
  for(let rank=0;rank<order.length;rank++){const s=order[rank],el=supLabels[s.id];let show=false;const h=W.cur[s.id];
    if(showSup&&h>.55&&rank<5){const[x,y,z]=W.project(tx(s.lon),h+.04,tz(s.lat));if(z<1&&x>30&&x<vw-260&&y>120&&y<vh-40&&!placed.some(q=>Math.abs(q[0]-x)<220&&Math.abs(q[1]-y)<46)){placed.push([x,y]);show=true;el.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;const v=h/1.35*100,tv=v.toFixed(0);if(el._b.textContent!==tv)el._b.textContent=tv;setStyle(el._i,'background',lc(v))}}
    setStyle(el,'opacity',show?'1':'0')}
  prodLabels.forEach((el,i)=>{if(!W.prods||vn<.3){setStyle(el,'opacity','0');return}const r=W.prods.rings[i];const[x,y]=W.project(r.p.x,r.p.y+.05,r.p.z);el.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;setStyle(el,'opacity',String(vn*(i===ST.prod?1:.5)))});
  if(vp>.3){const c=CASES[ST.caseI];const h=W.cur[24+ST.caseI];const[x,y]=W.project(tx(c.lon),h+.04,tz(c.lat));caseLabel.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;setStyle(caseLabel,'opacity',String(vp))}else setStyle(caseLabel,'opacity','0');
  const mk=ch+':'+p.toFixed(3);if(mk!==_mk){_mk=mk;meterA.forEach(m=>{m.a.classList.toggle('on',m.c===ch);m.b.style.transform=`scaleX(${m.c<ch?1:m.c===ch?p:0})`});setStyle(meterEl,'opacity',ch>=1&&ch<=4?'1':'0');const md=ch===1?`${fmtDay(ST.T1)}, ${dateOf(ST.T1)}`:'';if(meterDay.textContent!==md)meterDay.textContent=md}
}
ON(window,'click',e=>{if(!W||scrollY>ST.storyEnd-innerHeight)return;if(e.target.closest('button,a,input,.card,.side,.plate,.outro,.nav'))return;const h=W.pick(e);if(h)W.shock(h.x,h.z,1)});
{const nav=$('#nav');let sol=null;ON(window,'scroll',()=>{const v=scrollY>ST.storyEnd-80;if(v!==sol){sol=v;nav.classList.toggle('solid',v)}},{passive:true})}

function updateC1(){const T=ST.T1;computeAt(T);const s=S[0];$('#c1date').textContent=`${fmtDay(T)}, ${dateOf(T)}`;$('#c1count').textContent=SIG.filter(e=>e.day<=T).length;$('#c1prog').style.transform=`scaleX(${(T+30)/30})`;
  $('#c1score').textContent=s.risk.toFixed(1);const rows=s.contrib.filter(c=>c.c>0).sort((a,b)=>SIG[b.i].day-SIG[a.i].day);
  $('#c1band').innerHTML=rows.length?`${bandChip(s.risk)} combined ${s.raw.toFixed(1)} × ${MULT[s.tier]}`:'No signals yet';
  $('#c1rows').innerHTML=rows.map(c=>{const e=SIG[c.i];return `<div class="lrow"><span>${e.t}<small>weight ${c.E.toFixed(0)}, fade ${c.w.toFixed(2)}${c.f<1?', neighbouring country at 45%':''}</small></span><b>+${c.c.toFixed(1)}</b></div>`}).join('');computeAt(0)}
function initC2(){$('#prodSeg').innerHTML=PRODUCTS.map((p,i)=>`<button aria-pressed="${i===0}" data-p="${i}">${p.replace('Flagship ','').replace('Consumer ','').replace('IoT Smart ','IoT ')}</button>`).join('');
  $$('#prodSeg button').forEach(b=>b.addEventListener('click',()=>{$$('#prodSeg button').forEach(x=>x.setAttribute('aria-pressed',x===b));ST.prod=+b.dataset.p;renderC2()}));renderC2()}
function renderC2(){const p=ST.prod,deps=DEPS.filter(d=>d[0]===p).map(d=>({s:S[d[1]],w:d[2]}));const pr=prodRisk(p);
  $('#prodTxt').innerHTML=`Weighted risk for ${PRODUCTS[p]}<br>${deps.length} suppliers, ${new Set(deps.map(d=>d.s.region)).size} corridors`;countTo($('#prodRisk'),pr,v=>v.toFixed(0));
  $('#prodRows').innerHTML=[...deps].sort((a,b)=>b.w*b.s.risk-a.w*a.s.risk).slice(0,4).map(d=>`<div class="lrow"><span>${d.s.name}<small>dependency ${d.w.toFixed(2)}, risk ${d.s.risk.toFixed(0)}</small></span><b>${(d.w*d.s.risk).toFixed(0)}</b></div>`).join('')}
function renderC3(){const r=$('#bud'),Bk=+r.value;r.style.setProperty('--p',((Bk-r.min)/(r.max-r.min)*100)+'%');$('#budV').textContent=money(Bk*1000);
  const pk=knap(Bk);ST.fund=new Set(pk);const cost=pk.reduce((a,s)=>a+s.cost,0),prot=pk.reduce((a,s)=>a+s.protected,0);
  countTo($('#fProt'),prot,money);countTo($('#fN'),pk.length,v=>Math.round(v));countTo($('#fRoi'),cost?prot/cost:0,v=>v.toFixed(1)+'×');
  $('#fundRows').innerHTML=pk.map(s=>`<div class="lrow"><span>${s.name}<small>${money(s.cost)} protects ${money(s.protected)}</small></span><b>${s.roi.toFixed(1)}×</b></div>`).join('')||'<p class="small">This budget is below the cheapest mitigation. Raise it to fund a supplier.</p>';
  if(W&&ST.ch===3)pk.forEach(s=>W.shock(tx(s.lon),tz(s.lat),.35))}
function caseValue(T1,d){const[_,pk,v14,v28]=T1;if(d<-2)return 0;if(d<0)return pk*sstep(-2,0,d);if(d<=14)return pk*Math.pow(v14/pk,d/14);if(d<=28)return v14*Math.pow(v28/v14,(d-14)/14);return v28}
function initC4(){$('#caseSeg').innerHTML=CASES.map((c,i)=>`<button aria-pressed="${i===ST.caseI}" data-i="${i}">${c.name}</button>`).join('');
  $$('#caseSeg button').forEach(b=>b.addEventListener('click',()=>{$$('#caseSeg button').forEach(x=>x.setAttribute('aria-pressed',x===b));ST.caseI=+b.dataset.i;ST.caseClock=-4;drawCaseSvg()}));drawCaseSvg()}
function drawCaseSvg(){const c=CASES[ST.caseI],X=d=>10+(d+6)/42*380,Y=v=>108-v*.95;let dd='';for(let d=-6;d<=36;d+=.5)dd+=(d===-6?'M':'L')+X(d).toFixed(1)+' '+Y(caseValue(c.T[0],d)).toFixed(1);
  $('#caseSvg').innerHTML=`<line x1="10" x2="390" y1="108" y2="108" stroke="${C.rgb}.2)"/><path d="${dd} L${X(36)} 108 L${X(-6)} 108Z" fill="${C.high}" opacity=".08"/><path d="${dd}" fill="none" stroke="${C.high}" stroke-width="2"/>${[0,14,28].map(d=>`<line x1="${X(d)}" x2="${X(d)}" y1="10" y2="108" stroke="${C.rgb}.12)" stroke-dasharray="2 3"/><text x="${X(d)}" y="119" font-size="10" text-anchor="middle" fill="${C.mute}" font-family="Archivo, Arial, sans-serif">${d===0?'peak':'+'+d+' days'}</text>`).join('')}<line id="caseCur" x1="0" x2="0" y1="6" y2="108" stroke="${C.ink}" stroke-width="1.5"/><circle id="caseDot" r="4" fill="${C.ink}"/>`;
  $('#caseSup').textContent=`${c.full}, ${c.yr}. ${c.T[0][0]}, Tier 1`;caseLabel.querySelector('span').textContent=c.T[0][0]}
function updateCaseHud(v){const d=ST.caseClock,X=10+(d+6)/42*380,Y=108-v*.95;const cl=$('#caseCur'),dt=$('#caseDot');if(cl){cl.setAttribute('x1',X);cl.setAttribute('x2',X);dt.setAttribute('cx',X);dt.setAttribute('cy',Y)}
  $('#caseDay').textContent=d<0?`${Math.ceil(-d)} days before`:`Day ${Math.floor(d)}`;$('#caseVal').textContent=v.toFixed(1);caseLabel.querySelector('b').textContent=v.toFixed(0)}

/* landing: network plate */
let netL=null;
function initNetL(){const f=$('#netFocus');f.innerHTML=`<button aria-pressed="true" data-p="-1">All products</button>`+PRODUCTS.map((p,i)=>`<button aria-pressed="false" data-p="${i}">${p.replace('Flagship ','').replace('Consumer ','').replace('IoT Smart ','IoT ')}</button>`).join('');
  netL=new Net($('#netL'),{dark:DARK,onSelect:n=>netSide(n)},{S,PRODUCTS,DEPS,REGIONS,prodRisk,showTip,hideTip});$$('#netFocus button').forEach(b=>b.addEventListener('click',()=>{$$('#netFocus button').forEach(x=>x.setAttribute('aria-pressed',x===b));netL.focus=+b.dataset.p;netL.heat=.4;netSide(netL.focus>=0?netL.nodes[24+netL.focus]:null)}));netSide(null)}
function netSide(n){const el=$('#netSide');if(!n){const top=[...S].sort((a,b)=>b.exposure-a.exposure).slice(0,3);el.innerHTML=`<span class="small">Most revenue exposed</span>${top.map(s=>`<div class="lrow"><span>${s.name}<small>${s.country}, risk ${s.risk.toFixed(0)}</small></span><b>${money(s.exposure)}</b></div>`).join('')}<span class="small">Click any node for details.</span>`;return}
  if(n.kind==='p'){const ds=DEPS.filter(d=>d[0]===n.pi).map(d=>({s:S[d[1]],w:d[2]})).sort((a,b)=>b.w*b.s.risk-a.w*a.s.risk);el.innerHTML=`<span class="small">Product line</span><h4>${n.name}</h4><div class="rowx"><span class="small">${ds.length} suppliers</span><span>Weighted risk <b class="num">${prodRisk(n.pi).toFixed(0)}</b></span></div>${ds.slice(0,3).map(d=>`<div class="lrow"><span>${d.s.name}<small>dependency ${d.w.toFixed(2)}</small></span>${scoreChip(d.s.risk)}</div>`).join('')}`;return}
  const s=n.s;el.innerHTML=`<span class="small">${s.region}, ${s.country}, Tier ${s.tier}</span><h4>${s.name}</h4><div class="rowx">${bandChip(s.risk)}<b class="big" style="font-size:48px">${s.risk.toFixed(1)}</b></div>${s.deps.map(d=>`<div class="lrow"><span>${PRODUCTS[d.p]}</span><b>${d.w.toFixed(2)}</b></div>`).join('')}<button class="b sm" data-sup="${s.id}">Open in the app</button>`;
  el.querySelector('[data-sup]').onclick=()=>opts.onOpen('supplier',s.name)}

/* landing: architecture */
function initArch(){const B=(x,y,w,h,t,s,dash)=>`<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.sheet}" stroke="${C.ink}" stroke-width="1.5" ${dash?'stroke-dasharray="4 4"':''}/><text x="${x+14}" y="${y+28}" font-size="15" font-weight="700" fill="${C.ink}" font-family="Archivo, Arial, sans-serif">${t}</text>${s.map((l,i)=>`<text x="${x+14}" y="${y+50+i*17}" font-size="12.5" fill="${C.mute}" font-family="Archivo, Arial, sans-serif">${l}</text>`).join('')}</g>`;
  const L=(x1,y1,x2,y2,d)=>{const mx=(x1+x2)/2;const p=`M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;return `<path d="${p}" fill="none" stroke="${C.rgb}.3)" stroke-width="1.5" ${d?'stroke-dasharray="4 4"':''}/><path class="flow" d="${p}" fill="none" stroke="${C.hot}" stroke-width="2" stroke-dasharray="6 22"/>`};
  const cols=[20,210,400,590,780,970],w=170;
  $('#archSvg').innerHTML=L(190,75,210,140)+L(190,185,210,150)+L(190,295,210,170,1)+L(380,140,400,75)+L(380,160,400,185)+L(570,295,590,185,1)+L(570,75,590,140)+L(570,185,590,160)+L(760,150,780,150)+L(950,150,970,75)+L(950,150,970,185)+L(950,150,970,295)+
    B(cols[0],40,w,70,'GDELT 2.0',['Global news'])+B(cols[0],150,w,70,'Open-Meteo',['Severe weather'])+B(cols[0],260,w,70,'APScheduler',['Timed refresh'],1)+
    B(cols[1],95,w,110,'Ingestion',['Retry with backoff','Response cache','SHA-256 dedupe'])+
    B(cols[2],40,w,70,'Classifier',['Gemini, 6 categories'])+B(cols[2],150,w,70,'Sentiment',['DistilRoBERTa'])+B(cols[2],260,w,70,'Rules fallback',['Works offline'],1)+
    B(cols[3],95,w,110,'Risk fusion',['14-day half-life','Diminishing returns','Tier multiplier'])+
    B(cols[4],95,w,110,'PostgreSQL 16',['Suppliers, events','Scores, plans','Alembic migrations'])+
    B(cols[5],40,w,70,'FastAPI',['REST, Pydantic v2'])+B(cols[5],150,w,70,'Optimizer',['PuLP, CBC knapsack'])+B(cols[5],260,w,70,'React app',['React 19, TypeScript'])}

/* landing: risk lab */
function initLab(){const st={type:'weather',tier:1};const sev=$('#lSev'),sen=$('#lSent'),age=$('#lAge');const fill=el=>el.style.setProperty('--p',((el.value-el.min)/(el.max-el.min)*100)+'%');
  function upd(){[sev,sen,age].forEach(fill);const s=+sev.value,se=sen.value/100,d=+age.value,M=MULT[st.tier];const E=eRisk(st.type==='weather'?'weather':'news',s,se),w=rec(d),raw=E*w,fin=Math.min(100,raw*M);
    $('#oSev').textContent=s;$('#oSent').textContent=(se<0?'−':'+')+Math.abs(se).toFixed(2);$('#oAge').textContent=d+(d===1?' day':' days');$('#sentF').style.opacity=st.type==='weather'?.4:1;sen.disabled=st.type==='weather';
    $('#lFormula').innerHTML=(st.type==='weather'?`<div>Event weight <b>E</b> = severity = <b>${E.toFixed(1)}</b></div>`:`<div>Event weight <b>E</b> = 0.65 × ${s} + 0.35 × ${Math.max(0,-se*100).toFixed(0)} = <b>${E.toFixed(1)}</b></div>`)+
     `<div>Fade <b>w</b> = e<sup>−λ × ${d}</sup>, floor 0.10 = <b>${w.toFixed(3)}</b></div><div>Raw score = E × w = <b>${raw.toFixed(1)}</b></div><div>Tier ${st.tier} multiplier = <b>×${M.toFixed(2)}</b></div><div style="border-top:1.5px solid ${C.ink};margin-top:6px;padding-top:4px">Final = min(100, raw × multiplier) = <b>${fin.toFixed(1)}</b></div>`;
    $('#lBand').innerHTML=bandChip(fin);countTo($('#lScore'),fin,v=>v.toFixed(0),.5);
    const X=v=>40+v/60*580,Y=v=>120-v*100;let dd='';for(let i=0;i<=60;i+=.5)dd+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(rec(i)).toFixed(1);
    $('#lDecay').innerHTML=[0,.5,1].map(v=>`<line x1="40" x2="620" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.rgb}.1)"/><text x="32" y="${Y(v)+4}" font-size="11" text-anchor="end" fill="${C.mute}" font-family="Archivo, Arial, sans-serif">${v.toFixed(1)}</text>`).join('')+[0,14,28,42,60].map(v=>`<text x="${X(v)}" y="142" font-size="11" text-anchor="middle" fill="${C.mute}" font-family="Archivo, Arial, sans-serif">${v} days</text>`).join('')+
     `<path d="${dd} L${X(60)} ${Y(0)} L${X(0)} ${Y(0)}Z" fill="${C.cob}" opacity=".07"/><path d="${dd}" fill="none" stroke="${C.cob}" stroke-width="2"/><line x1="${X(d)}" x2="${X(d)}" y1="${Y(0)}" y2="${Y(w)}" stroke="${C.ink}" stroke-dasharray="3 3"/><circle cx="${X(d)}" cy="${Y(w)}" r="6" fill="${C.hot}" stroke="${C.sheet}" stroke-width="2"/><text x="${Math.min(X(d)+10,560)}" y="${Y(w)-10}" font-size="12" font-weight="700" fill="${C.ink}" font-family="Archivo, Arial, sans-serif">w = ${w.toFixed(2)}</text>`}
  [sev,sen,age].forEach(el=>el.addEventListener('input',upd));
  const seg=(id,key,cast=v=>v)=>$$('#'+id+' button').forEach(b=>b.addEventListener('click',()=>{$$('#'+id+' button').forEach(x=>x.setAttribute('aria-pressed',x===b));st[key]=cast(b.dataset.v);upd()}));seg('lType','type');seg('lTier','tier',Number);labUpd=upd;upd()}

/* landing: validation table */
function initRecord(){const el=$('#idx');if(!el)return;
  el.innerHTML=CASES.map((c,i)=>`<button class="idx-row" data-i="${i}" aria-expanded="false" aria-controls="more${i}"><span class="nm">${c.list}</span><span class="yr">${c.yr}</span><span class="yr">${c.type}</span><span class="pk">${c.T[0][1].toFixed(1)}<small>peak, then ${c.T[0][3]} after 28 days</small></span></button><div class="idx-more" id="more${i}">${c.T.map((t,k)=>t?`<div><span class="small">Tier ${k+1}, ${t[0]}</span><b style="color:${['var(--hot)','var(--mid)','var(--cobalt)'][k]}">${t[1].toFixed(1)}</b><span class="small">${t[2]} after 14 days, ${t[3]} after 28</span></div>`:`<div><span class="small">Tier 2</span><b style="color:var(--mute)">None</b><span class="small">No Tier 2 supplier was exposed in this case</span></div>`).join('')}</div>`).join('');
  $$('.idx-row').forEach(b=>b.addEventListener('click',()=>{const m=$('#more'+b.dataset.i),open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',open);m.classList.toggle('open',open);if(open&&anim)gsap.from(m.children,{y:16,opacity:0,stagger:.06,duration:.45,ease:'power3.out',clearProps:'all'});if(typeof measure==='function')requestAnimationFrame(measure)}))
  const fc=$('#fcard');
  const cSvg=c=>{const dk=document.documentElement.classList.contains('dark'),X=i=>14+i*90,Y=v=>116-v*1.0,cols=dk?['#FF6A2B','#FFB22E','#7B90FF']:['#FF4F00','#B87A00','#1F3BFF'];
    return `<svg viewBox="0 0 290 130" aria-hidden="true"><line x1="14" x2="284" y1="116" y2="116" stroke="${dk?'rgba(220,228,255,.25)':'rgba(20,22,28,.2)'}"/>${c.T.map((t,k)=>{if(!t)return'';const q=[0,t[1],t[2],t[3]];return `<path d="M${X(0)} ${Y(0)} C ${X(.6)} ${Y(0)}, ${X(.6)} ${Y(q[1])}, ${X(1)} ${Y(q[1])} S ${X(1.6)} ${Y(q[2])}, ${X(2)} ${Y(q[2])} S ${X(2.6)} ${Y(q[3])}, ${X(3)} ${Y(q[3])}" fill="none" stroke="${cols[k]}" stroke-width="2"/>`}).join('')}${['before','peak','+14 days','+28 days'].map((l,i)=>`<text x="${X(i)}" y="129" font-size="10" text-anchor="${i?i===3?'end':'middle':'start'}" fill="${dk?'#8C93A3':'#5B5E66'}" font-family="Archivo, Arial, sans-serif">${l}</text>`).join('')}</svg>`};
  if(fc){let raf=0,mx=-1,my=-1,cur=-1,mouse=false;
    const place=()=>{const w=fc.offsetWidth||300,h=fc.offsetHeight||220;const x=Math.max(12,Math.min(mx+24,innerWidth-w-16)),y=Math.max(12,Math.min(my-90,innerHeight-h-16));fc.style.setProperty('--fx',x+'px');fc.style.setProperty('--fy',y+'px')};
    const show=i=>{const c=CASES[i];fc.innerHTML=`<div class="fc-t">${c.list}, ${c.yr}</div>${cSvg(c)}<div class="fc-n">Orange Tier 1, amber Tier 2, blue Tier 3</div>`};
    const tick=()=>{raf=0;if(!mouse||mx<0||false){if(cur!==-1){cur=-1;fc.classList.remove('on')}return}
      const hit=document.elementFromPoint(mx,my),row=hit&&hit.closest?hit.closest('.idx-row'):null,i=row?+row.dataset.i:-1;
      if(i!==cur){const was=cur;cur=i;if(i<0){fc.classList.remove('on');return}show(i);if(was<0){fc.classList.add('mv');place();fc.offsetWidth;fc.classList.remove('mv');fc.classList.add('on');return}}
      if(i>=0){fc.classList.add('mv');place()}};
    const req=()=>{if(!raf)raf=requestAnimationFrame(tick)};
    ON(window,'pointermove',e=>{mouse=e.pointerType!=='touch';mx=e.clientX;my=e.clientY;req()},{passive:true});
    ON(window,'scroll',req,{passive:true});ON(document,'pointerleave',()=>{mx=-1;req()});
    ON(window,'blur',()=>{mx=-1;req()})}
}
function initVT(){const sp=(t)=>{const v=[0,t[1],t[2],t[3]],X=i=>4+i*34,Y=x=>23-x*.2;return `<svg viewBox="0 0 110 26" aria-hidden="true"><path d="${v.map((x,i)=>(i?'L':'M')+X(i)+' '+Y(x)).join(' ')}" fill="none" stroke="${C.ink}" stroke-width="1.5"/><circle cx="${X(1)}" cy="${Y(t[1])}" r="3" fill="${lc(t[1])}"/></svg>`};
  $('#vt').innerHTML=`<thead><tr><th>Case</th><th>Representative supplier</th><th>Tier</th><th>Before</th><th>Peak</th><th>+14 days</th><th>+28 days</th><th>Shape</th></tr></thead><tbody>`+CASES.map(c=>c.T.map((t,k)=>t?`<tr class="${k===0?'grp':''}"><td>${k===0?`<b>${c.full}</b><br><span class="small">${c.yr}, ${c.type.toLowerCase()}</span>`:''}</td><td>${t[0]}</td><td><span class="tier">T${k+1}</span></td><td>0.0</td><td>${scoreChip(t[1])}</td><td>${t[2].toFixed(1)}</td><td>${t[3].toFixed(1)}</td><td>${sp(t)}</td></tr>`:'').join('')).join('')+'</tbody>'}

/* splits, intro */
$$('.split').forEach(h=>{h.innerHTML=h.textContent.split(' ').map(w=>`<span class="w"><span>${w}</span></span>`).join(' ')});
function reveals(){if(!anim)return;const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){gsap.from(e.target.querySelectorAll('.w>span'),{yPercent:110,duration:.9,ease:'expo.out',stagger:.05});io.unobserve(e.target)}}),{threshold:.5});$$('.split').forEach(h=>io.observe(h))}
function intro(done){const el=$('#intro');if(!el){done();return}
  const T=$('#introT'),B=$('#introBar'),Cc=$('#introC'),Cor=$('#introCor'),F=$('#introF'),Sx=$('#introS');
  const cnt={};S.forEach(x=>{const r=x.region||x[1];cnt[r]=(cnt[r]||0)+1});
  Cor.innerHTML=REGIONS.map(r=>`<li data-r="${r}"><span>${r}</span><b>${cnt[r]||0} suppliers</b></li>`).join('');
  const feed=SIG.slice().sort((a,b)=>b.sev-a.sev).slice(0,6);
  const steps=[["Surveying four manufacturing corridors","Reading the last 30 days of signals"],["Reading 14 news and weather signals","GDELT news and Open-Meteo forecasts"],["Scoring every supplier from 0 to 100","Severity × recency × tier"],["Tracing 44 links to 4 product lines","Finding what each failure takes down"],["Ready. Here is where risk is rising.","Opening the field"]];
  let si=-1,fi=-1,ci=-1;const setStep=i=>{if(i===si)return;si=i;const [h,sub]=steps[i];Sx.textContent=sub;
    if(anim){const sp=Cc.firstElementChild;gsap.to(sp,{y:-14,opacity:0,duration:.18,ease:'power2.in',onComplete:()=>{sp.textContent=h;gsap.fromTo(sp,{y:16,opacity:0},{y:0,opacity:1,duration:.32,ease:'power3.out'})}})}else Cc.firstElementChild.textContent=h};
  const setFeed=i=>{if(i===fi||!feed[i])return;fi=i;const g=feed[i];F.innerHTML=`<span class="lbl">Latest signal · ${g.src} · ${g.region}</span><b>${g.t}</b>`;if(anim)gsap.fromTo(F,{opacity:0,y:8},{opacity:1,y:0,duration:.3,ease:'power2.out'})};
  const upd=v=>{T.textContent=String(Math.round(v)).padStart(2,'0');B.style.transform=`scaleX(${v/24})`;const k=v/24;
    setStep(Math.min(4,Math.floor(k*4.6)));setFeed(Math.min(feed.length-1,Math.floor(k*feed.length)));
    const c=Math.min(4,Math.floor(k*4.4));if(c!==ci){ci=c;[...Cor.children].forEach((li,j)=>li.classList.toggle('on',j<c))}};
  if(!anim){upd(24);setTimeout(()=>{el.remove();done()},900);return}
  const o={v:0};upd(0);
  gsap.timeline().to(o,{v:24,duration:2.6,ease:'power1.inOut',onUpdate:()=>upd(o.v)})
   .to('#intro .in',{y:-28,opacity:0,duration:.45,ease:'power2.in'},'+=.35').to(el,{opacity:0,duration:.6,ease:'power2.inOut'},'-=.15').add(()=>el.remove()).add(done,'-=.45')}
function heroIn(){if(anim){gsap.from('#h1 .ln>span',{yPercent:105,duration:1.2,ease:'expo.out',stagger:.09});gsap.from('.hero .side',{y:20,opacity:0,duration:1,delay:.35,ease:'power3.out'});if(W)for(let i=0;i<24;i++)W.cur[i]=0}if(W)setTimeout(()=>W.shock(tx(66),tz(28),1.2),400)}
let lenis=null;try{if(!RM&&typeof Lenis!=='undefined'){lenis=new Lenis({lerp:.09,smoothWheel:true})}}catch(e){lenis=null}
const navH=()=>{const n=$('#nav');return n?n.getBoundingClientRect().height:0};
function secY(h){if(h==='#top'||h==='#c0')return 0;let el;try{el=document.querySelector(h)}catch(e){return null}if(!el||el.closest('#app'))return null;const top=el.getBoundingClientRect().top+scrollY;return Math.max(0,Math.round(el.classList.contains('ch')?top:top-navH()))}
let navTok=0;
function goSec(h){const y=secY(h);if(y==null)return false;const tok=++navTok;
  const settle=(n)=>{if(tok!==navTok)return;const y2=secY(h);if(y2==null)return;if(Math.abs(scrollY-y2)>1){if(lenis)lenis.scrollTo(y2,{immediate:true,force:true});else scrollTo(0,y2)}if(n>0)setTimeout(()=>settle(n-1),120)};
  if(lenis){lenis.scrollTo(y,{duration:Math.min(1.6,.7+Math.abs(scrollY-y)/6000),easing:t=>1-Math.pow(1-t,4),force:true,onComplete:()=>settle(2)})}
  else if(RM){scrollTo(0,y);settle(2)}
  else{scrollTo({top:y,behavior:'smooth'});let done=false;const fin=()=>{if(done)return;done=true;settle(2)};ON(window,'scrollend',fin,{once:true});setTimeout(fin,1400)}
  return true}
ON(document,'click',e=>{const a=e.target.closest('a[href^="#"]');if(!a||a.closest('#app,#pal'))return;const h=a.getAttribute('href');if(!h||h.length<2)return;if(secY(h)==null)return;e.preventDefault();goSec(h)});
const clock0=performance.now();let autoShock=6;
function loop(now){if(DEAD)return;requestAnimationFrame(loop);if(lenis)lenis.raf(now);if(document.hidden)return;const t=(now-clock0)/1000;
  if(W&&!RM&&t>autoShock&&ST.ch===0&&scrollY<innerHeight){const s=S[[19,0,14,11,2][Math.floor(t/6)%5]];W.shock(tx(s.lon),tz(s.lat),.8);autoShock=t+6}frameLanding(t)}
if(W){W.resize();ST.camT.set(K[0][0],K[0][1],K[0][2]);ST.camP.set(K[0][0]+K[0][3],K[0][4]+3,K[0][2]+K[0][5]+4)}
ON(window,'resize',()=>{W&&W.resize();measure()});


function setMode(d){DARK=d;document.documentElement.classList.toggle('dark',d);try{localStorage.setItem('sx-mode',d?'dark':'light')}catch(e){}
  const m=$('#mode');m.setAttribute('aria-checked',d);m.setAttribute('aria-label',d?'Switch to light mode':'Switch to dark mode');
  if(W)W.setNight(d);if(netL){netL.setDark(d)}initArch();if(labUpd)labUpd();drawCaseSvg();if(typeof updateC1==='function')updateC1()}
initC2();renderC3();initC4();updateC1();initArch();initLab();initRecord();
let bt;$('#bud').addEventListener('input',()=>{$('#budV').textContent=money($('#bud').value*1000);clearTimeout(bt);bt=setTimeout(renderC3,100)});
measure();ON(window,'load',measure);requestAnimationFrame(loop);
nio=new IntersectionObserver(es=>{if(es[0].isIntersecting&&!netL){initNetL();nio.disconnect()}},{rootMargin:'400px'});nio.observe($('#netFrame'));
$('#mode').addEventListener('click',()=>setMode(!DARK));if(DARK)setMode(true);
if(introPlayed){const el=$('#intro');if(el)el.remove();heroIn();reveals()}else{intro(()=>{if(!DEAD){introPlayed=true;try{sessionStorage.setItem('sx-intro','1')}catch{}heroIn();reveals()}})}
$$('[data-open]').forEach(b=>b.addEventListener('click',()=>opts.onOpen(b.dataset.open)));
// Fit the footer wordmark to the page width once the real font has loaded.
const wm=$('.wordmark');
function fitWM(){if(!wm||DEAD)return;wm.style.fontSize='';for(let i=0;i<2;i++){const avail=wm.parentElement.clientWidth,w=wm.scrollWidth;if(avail&&w)wm.style.fontSize=(parseFloat(getComputedStyle(wm).fontSize)*avail/w)+'px'}}
fitWM();ON(window,'resize',fitWM);if(document.fonts)document.fonts.ready.then(fitWM);
return () => {
  DEAD = true; offs.forEach(f => f());
  try { lenis && lenis.destroy() } catch (e) {}
  try { netL && netL.destroy() } catch (e) {}
  try { nio && nio.disconnect() } catch (e) {}
  try { W && W.dispose() } catch (e) {}
  // Kill landing tweens, but leave anything animating outside the landing (the page wipe).
  if (hasG) gsap.globalTimeline.getChildren(true, true, false).forEach(t => {
    const tg = t.targets ? t.targets() : [];
    const outside = tg.length && tg.every(x => x instanceof Element && !root.contains(x));
    if (!outside) t.kill();
  });
}
}
