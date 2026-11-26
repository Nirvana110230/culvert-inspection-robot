// Geometry units: metres. World uses right/up/back; UI uses forward/left/up.
export const RAD = Math.PI / 180;
export const COLORS = ['#e1b564', '#4ec7c0', '#dc8376'];
export const NAMES = ['主云台', '上后摄', '下后摄'];
export const VFOV = h => 2 * Math.atan(Math.tan(h * RAD / 2) * 9 / 16) / RAD;
export const DEFAULTS = {
  "version": 1,
  "tunnel": {
    "width": 2,
    "height": 2,
    "spring": 1,
    "length": 10
  },
  "robot": {
    "length": 0.8,
    "width": 0.61,
    "height": 0.67,
    "lateral": 0,
    "position": 0,
    "yaw": 0,
    "speed": 0.2
  },
  "display": {
    "cutaway": true,
    "frusta": true,
    "footprints": true,
    "occlusion": true,
    "grid": true,
    "opacity": 0.11
  },
  "cameras": [
    {
      "enabled": true,
      "x": 0.16,
      "y": 0,
      "z": 0.87,
      "yaw": 35,
      "pitch": 20,
      "roll": 0,
      "hfov": 68.38,
      "vfov": 41.82682361225197,
      "lock": true,
      "range": 4,
      "resW": 3840,
      "resH": 2160,
      "fps": 25,
      "exposure": 500,
      "preset": "custom"
    },
    {
      "enabled": true,
      "x": -0.4,
      "y": 0,
      "z": 0.97,
      "yaw": 91.3,
      "pitch": -21.4,
      "roll": 0,
      "hfov": 58.3,
      "vfov": 34.83607203668699,
      "lock": true,
      "range": 4,
      "resW": 3840,
      "resH": 2160,
      "fps": 25,
      "exposure": 500,
      "preset": "candidate4"
    },
    {
      "enabled": true,
      "x": -0.4,
      "y": 0,
      "z": 0.75,
      "yaw": 120,
      "pitch": -50,
      "roll": 0,
      "hfov": 58.3,
      "vfov": 34.83607203668699,
      "lock": true,
      "range": 4,
      "resW": 3840,
      "resH": 2160,
      "fps": 25,
      "exposure": 500,
      "preset": "candidate4"
    }
  ]
};
export const copy = o => JSON.parse(JSON.stringify(o));
export const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
export const add = (a,b) => a.map((v,i)=>v+b[i]);
export const sub = (a,b) => a.map((v,i)=>v-b[i]);
export const mul = (a,s) => a.map(v=>v*s);
export const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const length = a => Math.hypot(...a);
export const normalize = a => mul(a,1/(length(a)||1));
export function rotateY(p,angle){const c=Math.cos(angle),s=Math.sin(angle);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];}
export function robotOrigin(s){return [-s.robot.lateral,0,-s.robot.position];}
export function toRobotLocal(p,s){return rotateY(sub(p,robotOrigin(s)),-s.robot.yaw*RAD);}
export function worldPoint(x,y,z,s){return add(rotateY([-y,z,-x],s.robot.yaw*RAD),robotOrigin(s));}
export function cameraPose(c,s){
  const yaw=(c.yaw+s.robot.yaw)*RAD,pitch=c.pitch*RAD,roll=c.roll*RAD;
  const forward=[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
  const right0=[Math.cos(yaw),0,-Math.sin(yaw)];
  const up0=cross(right0,forward);
  // Positive roll rotates the image's right vector toward its down direction.
  const right=add(mul(right0,Math.cos(roll)),mul(up0,-Math.sin(roll)));
  const up=add(mul(up0,Math.cos(roll)),mul(right0,Math.sin(roll)));
  return {position:worldPoint(c.x,c.y,c.z,s),forward,right,up,tx:Math.tan(c.hfov*RAD/2),ty:Math.tan(c.vfov*RAD/2)};
}
export function cameraRay(p,u,v){return normalize(add(p.forward,add(mul(p.right,u*p.tx),mul(p.up,v*p.ty))));}
export function contains(p,t,margin=0){
  if(Math.abs(p[0])>t.width/2+margin||p[1]<-margin||Math.abs(p[2])>t.length/2+margin)return false;
  if(p[1]<=t.spring)return true;
  return (p[0]/(t.width/2))**2+((p[1]-t.spring)/(t.height-t.spring))**2<=1+margin;
}
export function rayTunnel(origin,dir,t,maxRange=Infinity){
  let best=null;
  const accept=(dist,surface,normal)=>{
    if(!(dist>1e-6&&dist<=maxRange&&(!best||dist<best.t)))return;
    const p=add(origin,mul(dir,dist));
    if(Math.abs(p[2])>t.length/2+1e-7)return;
    best={t:dist,point:p,surface,normal};
  };
  if(Math.abs(dir[1])>1e-10){const d=-origin[1]/dir[1],x=origin[0]+d*dir[0];if(Math.abs(x)<=t.width/2+1e-8)accept(d,'地面',[0,1,0]);}
  if(Math.abs(dir[0])>1e-10){
    for(const sign of [-1,1]){const d=(sign*t.width/2-origin[0])/dir[0],y=origin[1]+d*dir[1];if(y>=-1e-8&&y<=t.spring+1e-8)accept(d,sign<0?'左侧壁':'右侧壁',[-sign,0,0]);}
  }
  const a=t.width/2,b=t.height-t.spring;
  const A=dir[0]**2/a**2+dir[1]**2/b**2;
  const B=2*(origin[0]*dir[0]/a**2+(origin[1]-t.spring)*dir[1]/b**2);
  const C=origin[0]**2/a**2+(origin[1]-t.spring)**2/b**2-1;
  const disc=B*B-4*A*C;
  if(A>1e-12&&disc>=0){
    for(const d of [(-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A)]){
      const p=add(origin,mul(dir,d));
      if(p[1]>=t.spring-1e-8)accept(d,'拱面',normalize([-p[0]/a**2,-(p[1]-t.spring)/b**2,0]));
    }
  }
  return best;
}
export function bodyBoxes(s){const r=s.robot;return [
  {min:[-r.width*.36,r.height*.36,-r.length*.47],max:[r.width*.36,r.height,r.length*.47]},
  {min:[-r.width/2,.015,-r.length/2],max:[-r.width*.31,r.height*.4,r.length/2]},
  {min:[r.width*.31,.015,-r.length/2],max:[r.width/2,r.height*.4,r.length/2]}
];}
function rayBox(o,d,b,maxRange){
  let near=-Infinity,far=Infinity;
  for(let i=0;i<3;i++){
    if(Math.abs(d[i])<1e-10){if(o[i]<b.min[i]||o[i]>b.max[i])return null;continue;}
    let lo=(b.min[i]-o[i])/d[i],hi=(b.max[i]-o[i])/d[i];if(lo>hi)[lo,hi]=[hi,lo];
    near=Math.max(near,lo);far=Math.min(far,hi);if(near>far)return null;
  }
  if(far<1e-5)return null;
  // Cameras embedded in chassis are flagged separately; the body blocks their rays.
  const dist=Math.max(near,1e-5);
  return dist<=maxRange?dist:null;
}
export function rayRobot(origin,dir,s,maxRange){
  const o=toRobotLocal(origin,s),d=rotateY(dir,-s.robot.yaw*RAD);
  let best=null;for(const b of bodyBoxes(s)){const t=rayBox(o,d,b,maxRange);if(t!==null&&(best===null||t<best))best=t;}
  return best===null?null:{t:best,point:add(origin,mul(dir,best)),surface:'车体遮挡',normal:mul(dir,-1)};
}
export function traceRay(origin,dir,s,maxRange){
  const wall=rayTunnel(origin,dir,s.tunnel,maxRange);
  const robot=s.display.occlusion?rayRobot(origin,dir,s,wall?wall.t:maxRange):null;
  return robot||wall||{t:maxRange,point:add(origin,mul(dir,maxRange)),surface:'量程内未命中',normal:mul(dir,-1),miss:true};
}
export function project(p,pose){const rel=sub(p,pose.position),depth=dot(rel,pose.forward);return {u:dot(rel,pose.right)/(depth*pose.tx),v:dot(rel,pose.up)/(depth*pose.ty),depth};}
export function visiblePoint(p,c,pose,s){
  if(!c.enabled)return false;const rel=sub(p,pose.position),dist=length(rel);if(dist>c.range||dist<1e-6)return false;
  const q=project(p,pose);if(q.depth<=0.005||Math.abs(q.u)>1||Math.abs(q.v)>1)return false;
  if(s.display.occlusion&&rayRobot(pose.position,mul(rel,1/dist),s,dist-0.008))return false;
  return true;
}
export function perimeterPoints(t,n=120){
  // Arc-length resampling keeps physical scale consistent in the unwrapped map.
  const raw=[[-t.width/2,0]];
  for(let i=1;i<=40;i++)raw.push([-t.width/2,t.spring*i/40]);
  for(let i=1;i<=400;i++){const a=Math.PI*(1-i/400);raw.push([t.width/2*Math.cos(a),t.spring+(t.height-t.spring)*Math.sin(a)]);}
  for(let i=1;i<=40;i++)raw.push([t.width/2,t.spring*(1-i/40)]);
  const cumulative=[0];for(let i=1;i<raw.length;i++)cumulative.push(cumulative[i-1]+Math.hypot(raw[i][0]-raw[i-1][0],raw[i][1]-raw[i-1][1]));
  const total=cumulative.at(-1),out=[];let cursor=1;
  for(let j=0;j<n;j++){const at=total*(j+.5)/n;while(cumulative[cursor]<at)cursor++;const f=(at-cumulative[cursor-1])/(cumulative[cursor]-cumulative[cursor-1]);out.push([raw[cursor-1][0]*(1-f)+raw[cursor][0]*f,raw[cursor-1][1]*(1-f)+raw[cursor][1]*f]);}
  return {points:out,total};
}
export function coverageGrid(s,columns=112,rows=64){
  const {points,total}=perimeterPoints(s.tunnel,rows),poses=s.cameras.map(c=>cameraPose(c,s));
  const valid=poses.map(p=>contains(p.position,s.tunnel)),cells=new Uint8Array(columns*rows),rowCovered=new Uint8Array(rows);
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const point=[points[y][0],points[y][1],s.tunnel.length*(.5-(x+.5)/columns)];let mask=0;
    for(let i=0;i<3;i++)if(valid[i]&&visiblePoint(point,s.cameras[i],poses[i],s))mask|=1<<i;
    cells[y*columns+x]=mask;if(mask)rowCovered[y]=1;
  }
  return {cells,columns,rows,total,percent:rowCovered.reduce((a,b)=>a+b,0)/rows*100};
}
function projectedPixel(p,pose,c){const q=project(p,pose);return [q.u*c.resW/2,q.v*c.resH/2];}
export function cameraMetrics(c,s){
  const pose=cameraPose(c,s),hit=traceRay(pose.position,pose.forward,s,c.range);
  if(!c.enabled||hit.miss||hit.surface==='车体遮挡'||!contains(pose.position,s.tunnel))return {hit,density:null,blur:null};
  const n=hit.normal,t1=normalize(cross(n,Math.abs(n[1])>.9?[1,0,0]:[0,1,0])),t2=normalize(cross(n,t1));
  const eps=0.0005;
  const deriv=t=>mul(sub(projectedPixel(add(hit.point,mul(t,eps)),pose,c),projectedPixel(add(hit.point,mul(t,-eps)),pose,c)),1/(2*eps*1000));
  const a=deriv(t1),b=deriv(t2),aa=dot(a,a),bb=dot(b,b),ab=dot(a,b);
  const density=Math.sqrt(Math.max(0,(aa+bb-Math.sqrt((aa-bb)**2+4*ab*ab))/2));
  // Stationary wall point under pure vehicle translation; no angular vibration modeled.
  const travel=[0,0,-s.robot.speed/c.exposure];
  const blur=length(sub(projectedPixel(sub(hit.point,travel),pose,c),projectedPixel(hit.point,pose,c)));
  return {hit,density,blur};
}
export function validateConfig(input){
  if(!input||input.version!==1||!input.tunnel||!input.robot||!Array.isArray(input.cameras)||input.cameras.length!==3)throw new Error('不是有效的视场实验室方案文件');
  const out=copy(DEFAULTS);
  const numeric=(target,src,key,lo,hi)=>{const v=src[key];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new Error('参数超出范围：'+key);target[key]=v;};
  for(const [k,lo,hi] of [['width',.8,8],['height',.7,6],['spring',0,5.8],['length',2,30]])numeric(out.tunnel,input.tunnel,k,lo,hi);
  if(out.tunnel.spring>out.tunnel.height-.1)throw new Error('直墙高必须小于总高，至少保留0.1 m拱高');
  for(const [k,lo,hi] of [['length',.3,3],['width',.2,2.5],['height',.15,1.8],['lateral',-3,3],['position',-15,15],['yaw',-180,180],['speed',0,1.5]])numeric(out.robot,input.robot,k,lo,hi);
  out.cameras.forEach((c,i)=>{const src=input.cameras[i];for(const [k,lo,hi] of [['x',-3,3],['y',-3,3],['z',.05,3],['yaw',-180,180],['pitch',-90,90],['roll',-180,180],['hfov',1,150],['vfov',.5,150],['range',.2,20],['resW',320,16384],['resH',240,16384],['fps',1,240],['exposure',1,100000]])numeric(c,src,k,lo,hi);c.enabled=src.enabled!==false;c.lock=src.lock===true;c.preset=['custom','candidate4','wide'].includes(src.preset)?src.preset:'custom';if(c.lock)c.vfov=VFOV(c.hfov);});
  if(input.display)for(const k of ['cutaway','frusta','footprints','occlusion','grid'])out.display[k]=input.display[k]!==false;
  if(input.display&&typeof input.display.opacity==='number')out.display.opacity=clamp(input.display.opacity,.02,.7);
  return out;
}
