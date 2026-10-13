// @ts-nocheck
// Shared 3D contour field (Three.js, loaded from the CDN in index.html as the global THREE).
import { MASK, LW, LH, tx, tz, ampOf, radOf } from './landMask'
import { CAT, clamp, rec, rCol, nCol } from './core'
const hasT = () => typeof THREE !== 'undefined'
export function makeWorld(cv,opts={},D={}){
  const S=D.S||[],CASES=D.CASES||[],SIG=D.SIG||[],DEPS=D.DEPS||[],RISK0=D.RISK0||S.map(s=>s.risk||0);
  if(!hasT())return null;let R;try{R=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'})}catch(e){return null}
  const narrow=innerWidth<900;const PR=Math.min(devicePixelRatio,opts.pr||(narrow?1.25:1.5));R.setPixelRatio(PR);
  const NI=!!opts.night;const P=NI?{bg:0x07090D,ink:0x2A3142,low:0x7B90FF,mid:0xFFB22E,high:0xFF6A2B,cob:0x7B90FF,line:0xECEEF2}:{bg:opts.bg||0xE3E3DC,ink:0x14161C,low:0x1F3BFF,mid:0xDE9E00,high:0xD93A12,cob:0x1F3BFF,line:0x14161C};
  R.setClearColor(P.bg,1);const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(40,1,.1,200);
  const tex=new THREE.DataTexture(MASK,LW,LH,THREE.LuminanceFormat,THREE.UnsignedByteType);tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearFilter;tex.needsUpdate=true;
  const NB=Math.max(28,S.length+CASES.length),uB=[];for(let i=0;i<NB;i++)uB.push(new THREE.Vector4(0,0,0,.5));
  S.forEach((s,i)=>uB[i].set(tx(s.lon),tz(s.lat),0,radOf(s)));CASES.forEach((c,i)=>uB[S.length+i].set(tx(c.lon),tz(c.lat),0,.85));
  const rips=[0,1,2,3,4,5].map(()=>new THREE.Vector4(0,0,-100,0));const C3=h=>new THREE.Color(h);
  const U={uT:{value:0},uB:{value:uB},uRip:{value:rips},uMask:{value:tex},uBg:{value:C3(P.bg)},uInk:{value:C3(P.ink)},uLow:{value:C3(P.low)},uMid:{value:C3(P.mid)},uHigh:{value:C3(P.high)},uCob:{value:C3(P.cob)},uFogN:{value:12},uFogF:{value:30},uNight:{value:NI?1:0}};
  const seg=narrow?[360,142]:[560,221];const geo=new THREE.PlaneGeometry(36,14.2,seg[0],seg[1]);geo.rotateX(-Math.PI/2);geo.translate(-2,0,.1);
  const mat=new THREE.ShaderMaterial({uniforms:U,extensions:{derivatives:true},
    vertexShader:`uniform float uT;uniform vec4 uB[${NB}];uniform vec4 uRip[6];varying vec2 vXZ;varying float vH;varying float vRip;varying float vDepth;
      void main(){vec3 p=position;float h=0.;for(int i=0;i<${NB};i++){vec2 d=p.xz-uB[i].xy;h+=uB[i].z*exp(-dot(d,d)/(uB[i].w*uB[i].w));}
       float rp=0.;for(int i=0;i<6;i++){float age=uT-uRip[i].z;if(age>0.&&age<6.){float d=distance(p.xz,uRip[i].xy);rp+=exp(-pow(d-age*3.,2.)*5.)*exp(-age*.6)*uRip[i].w;}}
       p.y=h+rp*.45;vXZ=p.xz;vH=h;vRip=rp;vec4 mv=modelViewMatrix*vec4(p,1.);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform sampler2D uMask;uniform vec3 uBg,uInk,uLow,uMid,uHigh,uCob;uniform float uFogN,uFogF,uNight;varying vec2 vXZ;varying float vH;varying float vRip;varying float vDepth;
      vec3 ramp(float h){return h<.55?mix(uLow,uMid,smoothstep(.08,.55,h)):mix(uMid,uHigh,smoothstep(.55,1.05,h));}
      void main(){float lon=vXZ.x/.1+20.,lat=14.-vXZ.y/.1;vec2 uv=vec2((lon+180.)/360.,(84.-lat)/142.);
       float land=(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)?0.:texture2D(uMask,uv).r;
       vec2 q=vXZ/.075;vec2 f=fract(q)-.5;float dl=length(f);float aa=fwidth(dl)*1.2+.001;
       float hl=clamp(vH,0.,1.4);float r=mix(.1,.27+hl*.1,smoothstep(.25,.75,land));float dotA=1.-smoothstep(r-aa,r+aa,dl);
       float dotO=mix(.22+uNight*.1,.88+uNight*.12,smoothstep(.25,.75,land));
       vec3 dc=mix(uInk,ramp(vH),uNight>.5?smoothstep(.06,.4,vH):smoothstep(.12,.5,vH)*.4+smoothstep(.45,1.,vH)*.6);
       vec3 col=mix(uBg,dc,dotA*dotO);
       float k=vH*10.;float cl=abs(fract(k-.5)-.5)/max(fwidth(k),.0001);float line=(1.-min(cl,1.))*smoothstep(.03,.1,vH);
       float km=vH*2.;float cm=abs(fract(km-.5)-.5)/max(fwidth(km),.0001);float major=(1.-min(cm/1.6,1.))*smoothstep(.2,.3,vH);
       float glow=(1.-min(cl/3.5,1.))*smoothstep(.03,.1,vH)*.35*uNight;col=mix(col,ramp(vH),clamp(line*(.75+uNight*.25)+major*.9+glow,0.,1.));col+=ramp(vH)*smoothstep(.2,1.2,vH)*.10*uNight;
       float gx=lon/15.,gz=lat/15.;float gl=min(abs(fract(gx-.5)-.5)/fwidth(gx),abs(fract(gz-.5)-.5)/fwidth(gz));col=mix(col,uInk,(1.-min(gl,1.))*.06);
       col=mix(col,uCob,clamp(vRip,0.,1.)*.85);col=mix(col,uBg,smoothstep(uFogN,uFogF,vDepth));gl_FragColor=vec4(col,1.);}`});
  scene.add(new THREE.Mesh(geo,mat));
  const lanes=(D.lanes||[[0,14],[6,17],[12,19],[4,15],[2,19],[9,22],[11,16],[1,20],[13,18],[3,23]]).filter(([a,b])=>S[a]&&S[b]),laneU={uA:{value:1}};
  lanes.forEach(([a,b],i)=>{const A=new THREE.Vector3(tx(S[a].lon),0,tz(S[a].lat)),B=new THREE.Vector3(tx(S[b].lon),0,tz(S[b].lat));const pts=[],ts=[],N=100,L=A.distanceTo(B);
    for(let k=0;k<=N;k++){const t=k/N;const v=A.clone().lerp(B,t);v.y=Math.sin(Math.PI*t)*(.5+L*.07)+.05;pts.push(v.x,v.y,v.z);ts.push(t)}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.setAttribute('aT',new THREE.Float32BufferAttribute(ts,1));
    scene.add(new THREE.Line(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uT:U.uT,uO:{value:i*.173},uA:laneU.uA,uC:{value:C3(P.cob)}},
      vertexShader:`attribute float aT;varying float t;void main(){t=aT;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uT,uO,uA;uniform vec3 uC;varying float t;void main(){float h=fract(uT*.08+uO)*1.3-.15;float d=t-h;float tr=(d<0.&&d>-.18)?pow(1.+d/.18,2.):0.;gl_FragColor=vec4(uC,(.16+tr*.8)*uA);}`})))});
  const beams=SIG.map(e=>{const x=tx(e.lon),z=tz(e.lat);const lm=new THREE.LineBasicMaterial({color:NI?C3(CAT[e.cat]||CAT.other):0x14161C,transparent:true,opacity:0});scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,0,z),new THREE.Vector3(x,2.6,z)]),lm));
    const dm=new THREE.Mesh(new THREE.OctahedronGeometry(.07),new THREE.MeshBasicMaterial({color:C3(CAT[e.cat]||CAT.other),transparent:true,opacity:0}));dm.position.set(x,2.6,z);scene.add(dm);return {e,x,z,lm,dm,arr:-1,on:false}});
  const shields=S.map(s=>{const m=new THREE.Mesh(new THREE.RingGeometry(.3,.36,48),new THREE.MeshBasicMaterial({color:P.cob,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(tx(s.lon),.03,tz(s.lat));m.scale.setScalar(.001);scene.add(m);return {m,k:0,t:0}});
  let prods=null;
  if(opts.products){prods={rings:[],links:[]};const PP=[[42,22],[62,28],[82,22],[62,10]].map(([lo,la])=>new THREE.Vector3(tx(lo),2.5,tz(la)));
    PP.forEach(p=>{const m=new THREE.Mesh(new THREE.RingGeometry(.32,.42,64),new THREE.MeshBasicMaterial({color:P.line,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.copy(p);scene.add(m);prods.rings.push({m,p})});
    DEPS.forEach(([pi,si,w])=>{const s=S[si];const a=new THREE.Vector3(tx(s.lon),ampOf(RISK0[si]),tz(s.lat)),b=PP[pi];const mid=a.clone().lerp(b,.5);mid.y=Math.max(a.y,b.y)+1.2;
      const pts=new THREE.QuadraticBezierCurve3(a,mid,b).getPoints(48);const g=new THREE.BufferGeometry().setFromPoints(pts);g.setAttribute('aT',new THREE.Float32BufferAttribute(pts.map((_,k)=>k/48),1));
      const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uT:U.uT,uA:{value:0},uC:{value:C3(NI?nCol(RISK0[si]):rCol(RISK0[si]))},uO:{value:Math.random()},uS:{value:.2+w*.35}},
        vertexShader:`attribute float aT;varying float t;void main(){t=aT;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`uniform float uT,uA,uO,uS;uniform vec3 uC;varying float t;void main(){float h=fract(uT*uS+uO);float d=t-h;float tr=(d<0.&&d>-.25)?pow(1.+d/.25,2.):0.;gl_FragColor=vec4(uC,(.25+tr*.75)*uA);}`});
      scene.add(new THREE.Line(g,m));prods.links.push({pi,si,w,m})})}
  const cur=new Float32Array(NB),tgt=new Float32Array(NB);let ri=0;const shock=(x,z,s=1)=>{rips[ri%6].set(x,z,U.uT.value,s);ri++};
  function resize(){const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
  function pick(ev){const r=cv.getBoundingClientRect();ray.setFromCamera({x:(ev.clientX-r.left)/r.width*2-1,y:-(ev.clientY-r.top)/r.height*2+1},cam);return ray.ray.intersectPlane(plane,hit)?hit.clone():null}
  const tmp=new THREE.Vector3();function project(x,y,z){tmp.set(x,y,z).project(cam);return [(tmp.x*.5+.5)*cv.clientWidth,(-tmp.y*.5+.5)*cv.clientHeight,tmp.z]}
  function step(t,k=.07){U.uT.value=t;for(let i=0;i<NB;i++){cur[i]+=(tgt[i]-cur[i])*k;uB[i].z=cur[i]}
    shields.forEach(s=>{s.k+=(s.t-s.k)*.08;s.m.scale.setScalar(Math.max(.001,s.k*(1+Math.sin(t*3)*.04)))});
    beams.forEach(b=>{b.lm.opacity+=((b.on?b.o:0)*.5-b.lm.opacity)*.1;if(b.arr>=0){const k=clamp((t-b.arr)/.7,0,1);b.dm.position.y=2.6*(1-k*k);b.dm.material.opacity=k<1?1:Math.max(0,b.dm.material.opacity-.03);b.dm.rotation.y=t*3;if(k>=1&&!b.landed){b.landed=true;shock(b.x,b.z,.9)}}else b.dm.material.opacity=0});
    R.render(scene,cam)}
  function setNight(n){const Q=n?{bg:0x07090D,ink:0x2A3142,low:0x7B90FF,mid:0xFFB22E,high:0xFF6A2B,cob:0x7B90FF}:{bg:opts.bg||0xE3E3DC,ink:0x14161C,low:0x1F3BFF,mid:0xDE9E00,high:0xD93A12,cob:0x1F3BFF};R.setClearColor(Q.bg,1);U.uBg.value.set(Q.bg);U.uInk.value.set(Q.ink);U.uLow.value.set(Q.low);U.uMid.value.set(Q.mid);U.uHigh.value.set(Q.high);U.uCob.value.set(Q.cob);U.uNight.value=n?1:0;
    scene.traverse(o=>{const u=o.material&&o.material.uniforms;if(u&&u.uC&&!u.uS)u.uC.value.set(Q.cob)});beams.forEach(b=>{b.lm.color.set(n?(CAT[b.e.cat]||CAT.other):0x14161C)});shields.forEach(s=>s.m.material.color.set(Q.cob));
    if(prods){prods.rings.forEach(r=>r.m.material.color.set(n?0xECEEF2:0x14161C));prods.links.forEach(l=>l.m.uniforms.uC.value.set(n?nCol(RISK0[l.si]):rCol(RISK0[l.si])))}}
  function dispose(){try{scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});tex.dispose();R.dispose();R.forceContextLoss&&R.forceContextLoss()}catch(e){}}
  return {R,cam,U,cur,tgt,shock,resize,pick,project,step,beams,shields,prods,laneU,setNight,dispose};
}
export function setBeams(W,T,prevT){W.beams.forEach(b=>{const on=b.e.day<=T;b.on=on;b.o=on?rec(T-b.e.day):0;if(on&&prevT!==undefined&&b.e.day>prevT&&b.arr<0){b.arr=W.U.uT.value;b.landed=false}if(!on){b.arr=-1;b.landed=false}})}

