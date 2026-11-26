import * as THREE from 'three';
import {OrbitControls} from 'three/addons/OrbitControls.js';
import {SoftwareRenderer} from './software-renderer.js?v=1.2';
import {RAD,COLORS,NAMES,add,sub,mul,length,cameraPose,cameraRay,traceRay,contains,perimeterPoints,bodyBoxes,robotOrigin,worldPoint} from './geometry.js?v=1.2';

const v3=p=>new THREE.Vector3(...p);
const clampExport=(v,min,max)=>Math.min(max,Math.max(min,v));
function meshBox(w,h,l,color){return new THREE.Mesh(new THREE.BoxGeometry(w,h,l),new THREE.MeshStandardMaterial({color,roughness:.73,metalness:.24}));}
function lines(points,color,opacity=1){const g=new THREE.BufferGeometry().setFromPoints(points.map(v3));return new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));}
function disposeGroup(g){for(const c of [...g.children]){g.remove(c);c.traverse(o=>{o.geometry?.dispose();if(o.material){const m=Array.isArray(o.material)?o.material:[o.material];for(const mat of m){mat.map?.dispose();mat.dispose();}}});}}
function textSprite(text,color='#9cb0bd',size=.14){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.font='78px "Segoe UI","Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,512,64);
  const mat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthTest:false});const sprite=new THREE.Sprite(mat);sprite.scale.set(size*8,size,1);return sprite;
}

export class Simulator{
  constructor(container,preview,onCameraSelect){
    this.el=container;this.previewEl=preview;this.onCameraSelect=onCameraSelect;this.selected=1;this.dirty=true;this.previewDirty=true;this.view='orbit';
    const probe=document.createElement('canvas');let gpu=false;try{gpu=!!probe.getContext('webgl2');}catch{}
    this.software=!gpu;
    this.renderer=gpu?new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'}):new SoftwareRenderer({alpha:true});
    if(!gpu)document.querySelector('.version-tag').title='已启用兼容绘图模式（Canvas 2D 三维投影）';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0,0);
    container.prepend(this.renderer.domElement);
    this.previewRenderer=gpu?new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'}):new SoftwareRenderer({alpha:false});this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));this.previewRenderer.setClearColor('#23313b');this.previewRenderer.outputColorSpace=THREE.SRGBColorSpace;preview.append(this.previewRenderer.domElement);
    this.scene=new THREE.Scene();this.scene.add(new THREE.HemisphereLight('#d8e7ef','#44515d',2.0));
    const light=new THREE.DirectionalLight('#ffffff',2.3);light.position.set(3,6,5);this.scene.add(light);
    const fill=new THREE.DirectionalLight('#8da7bb',1);fill.position.set(-4,2,-3);this.scene.add(fill);
    this.perspective=new THREE.PerspectiveCamera(42,1,.02,100);this.ortho=new THREE.OrthographicCamera(-3,3,3,-3,.01,100);this.active=this.perspective;
    this.perspective.position.set(4.3,3.45,5.4);
    this.controls=new OrbitControls(this.perspective,this.renderer.domElement);this.controls.target.set(0,.85,0);this.controls.enableDamping=true;this.controls.dampingFactor=.12;this.controls.minDistance=.45;this.controls.maxDistance=26;this.controls.maxPolarAngle=Math.PI*.91;
    this.controls.addEventListener('change',()=>this.dirty=true);
    this.previewCamera=new THREE.PerspectiveCamera();
    this.tunnel=new THREE.Group();this.robot=new THREE.Group();this.cameraBodies=new THREE.Group();this.frusta=new THREE.Group();this.footprints=new THREE.Group();this.annotations=new THREE.Group();
    this.scene.add(this.tunnel,this.robot,this.cameraBodies,this.frusta,this.footprints,this.annotations);
    this.raycaster=new THREE.Raycaster();let down=null;
    this.renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
    this.renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=this.el.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.active);const hit=this.raycaster.intersectObjects(this.cameraBodies.children,true).find(h=>h.object.userData.cameraIndex!==undefined);if(hit)this.onCameraSelect(hit.object.userData.cameraIndex);});
    this.labels=NAMES.map((name,i)=>{const e=document.createElement('button');e.className='camera-label';e.style.setProperty('--c',COLORS[i]);e.textContent=name;e.addEventListener('click',()=>this.onCameraSelect(i));document.getElementById('camera-labels').append(e);return e;});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resizeObserver.observe(preview);this.resize();
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('webgl-error').hidden=false;document.getElementById('webgl-error').textContent='三维绘图连接暂时中断，请刷新页面。已保存的参数会自动恢复。';});
  }
  resize(){
    const w=this.el.clientWidth,h=this.el.clientHeight;if(w<=0||h<=0)return;
    this.renderer.setSize(w,h);this.perspective.aspect=w/h;this.perspective.updateProjectionMatrix();
    const span=this.orthoSpan||2.7;this.ortho.left=-span*w/h;this.ortho.right=span*w/h;this.ortho.top=span;this.ortho.bottom=-span;this.ortho.updateProjectionMatrix();
    const pw=this.previewEl.clientWidth,ph=this.previewEl.clientHeight;if(pw>0&&ph>0)this.previewRenderer.setSize(pw,ph);this.dirty=true;this.previewDirty=true;
  }
  setView(view){
    this.view=view;const s=this.state;if(!s)return;
    const origin=robotOrigin(s),target=v3([origin[0],s.tunnel.height/2,origin[2]]);
    if(view==='orbit'){
      this.active=this.perspective;this.controls.object=this.perspective;this.controls.enableRotate=true;this.controls.target.copy(target);this.perspective.position.copy(target.clone().add(new THREE.Vector3(4.3,2.5,5.4)));
    }else{
      this.active=this.ortho;this.controls.object=this.ortho;this.controls.enableRotate=false;
      this.orthoSpan=view==='front'?Math.max(s.tunnel.height*.85,s.tunnel.width*.85):Math.max(s.tunnel.height,s.tunnel.length*.48);
      this.controls.target.copy(target);this.ortho.up.set(0,1,0);
      if(view==='front')this.ortho.position.copy(target.clone().add(new THREE.Vector3(0,0,-12)));
      if(view==='side')this.ortho.position.copy(target.clone().add(new THREE.Vector3(12,0,0)));
      if(view==='top'){this.ortho.up.set(0,0,-1);this.ortho.position.copy(target.clone().add(new THREE.Vector3(0,12,0)));}
      this.ortho.zoom=1;this.resize();
    }
    this.controls.update();this.dirty=true;
  }
  rebuildTunnel(s){
    disposeGroup(this.tunnel);disposeGroup(this.annotations);this.wallMaterials=[];
    const t=s.tunnel,a=t.width/2,b=t.height-t.spring,L=t.length,curve=[[-a,0],[-a,t.spring]];
    for(let i=1;i<=96;i++){const q=Math.PI*(1-i/96);curve.push([a*Math.cos(q),t.spring+b*Math.sin(q)]);}curve.push([a,0]);
    const vertices=[];
    const segments=Math.ceil(L/.5);for(let j=0;j<segments;j++){const z0=-L/2+L*j/segments,z1=-L/2+L*(j+1)/segments;for(let i=0;i<curve.length-1;i++){const p=curve[i],q=curve[i+1];vertices.push(p[0],p[1],z0,p[0],p[1],z1,q[0],q[1],z1,p[0],p[1],z0,q[0],q[1],z1,q[0],q[1],z0);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
    this.wallMaterial=new THREE.MeshStandardMaterial({color:'#6c7d88',side:THREE.DoubleSide,roughness:1,transparent:true,opacity:s.display.cutaway?s.display.opacity:.83,depthWrite:!s.display.cutaway});this.wallMaterials.push(this.wallMaterial);this.tunnel.add(new THREE.Mesh(g,this.wallMaterial));
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(t.width,L,Math.ceil(t.width/.4),Math.ceil(L/.4)),new THREE.MeshStandardMaterial({color:'#35444f',roughness:1,side:THREE.DoubleSide}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;this.tunnel.add(floor);
    const ribs=[];for(let z=-L/2;z<=L/2+.001;z+=.5)for(let i=0;i<curve.length-1;i++)ribs.push([curve[i][0]*.998,curve[i][1]*.998,z],[curve[i+1][0]*.998,curve[i+1][1]*.998,z]);
    const {points}=perimeterPoints(t,Math.max(12,Math.round((2*t.spring+Math.PI*Math.max(a,b))/.25)));
    for(const p of points)ribs.push([p[0]*.998,p[1]*.998,-L/2],[p[0]*.998,p[1]*.998,L/2]);
    this.ribs=lines(ribs,'#8ba2b2',.15);this.tunnel.add(this.ribs);
    const ends=[];for(const z of [-L/2,L/2])for(let i=0;i<curve.length-1;i++)ends.push([curve[i][0],curve[i][1],z],[curve[i+1][0],curve[i+1][1],z]);this.tunnel.add(lines(ends,'#8194a2',.5));
    const grid=[];for(let x=-a;x<=a+.001;x+=.5)grid.push([x,.002,-L/2],[x,.002,L/2]);for(let z=-L/2;z<=L/2+.001;z+=.5)grid.push([-a,.002,z],[a,.002,z]);
    this.floorGrid=lines(grid,'#8193a1',.15);this.tunnel.add(this.floorGrid);
    const front=Math.min(L/2,1.7)+.1;
    const dim=lines([[-a,-.05,front],[a,-.05,front],[-a,-.08,front],[-a,.03,front],[a,-.08,front],[a,.03,front],[-a-.12,0,front],[-a-.12,t.height,front],[-a-.17,0,front],[-a-.07,0,front],[-a-.17,t.height,front],[-a-.07,t.height,front]],'#8296a4',.65);this.annotations.add(dim);
    const widthText=textSprite(`宽 ${t.width.toFixed(2)} m`,'#b2c4cd',.11);widthText.position.set(0,-.18,front+.01);this.annotations.add(widthText);
    const heightText=textSprite(`高 ${t.height.toFixed(2)} m`,'#b2c4cd',.11);heightText.position.set(-a-.5,t.height/2,front);this.annotations.add(heightText);
    const archText=textSprite(Math.abs(a-b)<.001?`半圆拱 R = ${a.toFixed(2)} m`:`椭圆拱 ${a.toFixed(2)} × ${b.toFixed(2)} m`,'#91a6b4',.10);archText.position.set(0,t.height+.18,front);this.annotations.add(archText);
    const wallText=textSprite(`直墙 ${t.spring.toFixed(2)} m`,'#8299a9',.09);wallText.position.set(a+.4,t.spring/2,front);this.annotations.add(wallText);
    // Small visual reference targets on the side walls; not real crack samples.
    this.targets=new THREE.Group();for(const sign of [-1,1])for(let z=-L/2+.5;z<L/2;z+=1){const tg=new THREE.Group();const board=new THREE.Mesh(new THREE.PlaneGeometry(.14,.14),new THREE.MeshBasicMaterial({color:'#b3b4a4',side:THREE.DoubleSide}));board.rotation.y=sign>0?-Math.PI/2:Math.PI/2;board.position.set(sign*(a-.008),Math.max(.15,t.spring*.68),z);tg.add(board);const mark=textSprite(sign<0?'L':'R','#252f32',.075);mark.position.copy(board.position);mark.position.x-=sign*.01;tg.add(mark);this.targets.add(tg);}this.tunnel.add(this.targets);
  }
  rebuildRobot(s){
    disposeGroup(this.robot);const r=s.robot;
    const body=meshBox(r.width*.72,r.height*.64,r.length*.94,'#7f8c8c');body.position.y=r.height*.68;this.robot.add(body);
    const deck=meshBox(r.width*.68,.035,r.length*.88,'#b5b9b1');deck.position.y=r.height+.014;this.robot.add(deck);
    const top=meshBox(r.width*.35,.08,r.length*.35,'#7c3a45');top.position.set(0,r.height+.055,-r.length*.12);this.robot.add(top);
    for(const side of [-1,1]){
      const track=meshBox(r.width*.19,r.height*.4-.015,r.length,'#1b242b');track.position.set(side*r.width*.405,r.height*.2+.0075,0);this.robot.add(track);
      for(let j=0;j<6;j++){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(r.height*.127,r.height*.127,r.width*.20,18),new THREE.MeshStandardMaterial({color:'#4a5b64',metalness:.6,roughness:.5}));wheel.rotation.z=Math.PI/2;wheel.position.set(side*r.width*.405,r.height*.205,r.length*(j/5-.5)*.79);this.robot.add(wheel);}
      for(let j=0;j<16;j++){const tread=meshBox(r.width*.21,.019,.022,'#3c4c57');tread.position.set(side*r.width*.405,r.height*.4+.006,r.length*(j/15-.5)*.95);this.robot.add(tread);}
    }
    const frontStripe=meshBox(r.width*.40,.04,.012,'#d9b875');frontStripe.position.set(0,r.height*.77,-r.length*.477);this.robot.add(frontStripe);
    const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,.025,-r.length*.65),.5,'#b4bec3',.12,.055);this.robot.add(arrow);
    const frontText=textSprite('车头','#bdcbd1',.065);frontText.position.set(0,.06,-r.length*.65-.54);this.robot.add(frontText);
    this.robot.position.copy(v3(robotOrigin(s)));this.robot.rotation.y=r.yaw*RAD;
  }
  rebuildCameras(s){
    disposeGroup(this.cameraBodies);disposeGroup(this.frusta);disposeGroup(this.footprints);this.poses=s.cameras.map(c=>cameraPose(c,s));
    s.cameras.forEach((c,i)=>{
      const pose=this.poses[i],color=COLORS[i],group=new THREE.Group();group.position.copy(v3(pose.position));
      const basis=new THREE.Matrix4().makeBasis(v3(pose.right),v3(pose.up),v3(mul(pose.forward,-1)));group.quaternion.setFromRotationMatrix(basis);
      const shell=meshBox(i===0?.11:.075,i===0?.09:.065,i===0?.11:.09,c.enabled?color:'#59656c');group.add(shell);
      const lens=new THREE.Mesh(new THREE.CylinderGeometry(.023,.028,.038,20),new THREE.MeshStandardMaterial({color:'#101f27',metalness:.7,roughness:.23}));lens.rotation.x=Math.PI/2;lens.position.z=-.061;group.add(lens);
      const lensGlass=new THREE.Mesh(new THREE.CircleGeometry(.018,20),new THREE.MeshBasicMaterial({color:'#7bc5db'}));lensGlass.rotation.y=Math.PI;lensGlass.position.z=-.081;group.add(lensGlass);
      group.traverse(o=>o.userData.cameraIndex=i);this.cameraBodies.add(group);
      const base=worldPoint(c.x,c.y,Math.min(s.robot.height*.85,c.z-.1),s);const support=lines([base,pose.position],'#b4c2c9',.75);this.cameraBodies.add(support);
      if(i===0){const ball=new THREE.Mesh(new THREE.SphereGeometry(.067,16,12),new THREE.MeshStandardMaterial({color:'#d8d8c9',roughness:.6}));ball.position.copy(v3(add(pose.position,[0,-.067,0])));this.cameraBodies.add(ball);}
      if(i===this.selected){const halo=new THREE.Mesh(new THREE.SphereGeometry(.10,16,12),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.3}));halo.position.copy(v3(pose.position));this.cameraBodies.add(halo);}
      this.labels[i].style.opacity=c.enabled?'1':'.4';
      if(!c.enabled||!contains(pose.position,s.tunnel))return;
      const outline=[],perimeter=[],n=16;
      for(let edge=0;edge<4;edge++)for(let j=0;j<n;j++){
        const f=j/n;let u,v;
        if(edge===0){u=-1+2*f;v=1;}if(edge===1){u=1;v=1-2*f;}if(edge===2){u=1-2*f;v=-1;}if(edge===3){u=-1;v=-1+2*f;}
        perimeter.push(traceRay(pose.position,cameraRay(pose,u,v),s,c.range).point);
      }
      for(let j=0;j<perimeter.length;j++)outline.push(perimeter[j],perimeter[(j+1)%perimeter.length]);
      for(const [u,v] of [[-1,-1],[-1,1],[1,-1],[1,1]])outline.push(pose.position,traceRay(pose.position,cameraRay(pose,u,v),s,c.range).point);
      const axis=traceRay(pose.position,pose.forward,s,c.range);const centerline=lines([pose.position,axis.point],color,.42);this.frusta.add(centerline);
      this.frusta.add(lines(outline,color,i===this.selected?.9:.52));
      const fan=[];for(let j=0;j<perimeter.length;j++)fan.push(...pose.position,...perimeter[j],...perimeter[(j+1)%perimeter.length]);
      const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(fan,3));const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:i===this.selected?.075:.025,depthWrite:false});this.frusta.add(new THREE.Mesh(fg,material));
      // Camera-ray grid clips the colored footprint to the first actual surface.
      const nx=32,ny=22,hits=[];for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)hits.push(traceRay(pose.position,cameraRay(pose,x/nx*2-1,y/ny*2-1),s,c.range));
      const verts=[];const pushTri=(a,b,d)=>{if([a,b,d].some(h=>h.miss||h.surface==='车体遮挡'))return;if(Math.max(length(sub(a.point,b.point)),length(sub(a.point,d.point)),length(sub(b.point,d.point)))>1.2)return;for(const h of [a,b,d])verts.push(...add(h.point,mul(h.normal,.008)));};
      for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const j=y*(nx+1)+x;pushTri(hits[j],hits[j+1],hits[j+nx+2]);pushTri(hits[j],hits[j+nx+2],hits[j+nx+1]);}
      const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));this.footprints.add(new THREE.Mesh(pg,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:i===this.selected?.35:.20,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1})));
      if(!axis.miss&&axis.surface!=='车体遮挡'){const marker=new THREE.Mesh(new THREE.SphereGeometry(.018,12,10),new THREE.MeshBasicMaterial({color}));marker.position.copy(v3(add(axis.point,mul(axis.normal,.01))));this.footprints.add(marker);}
    });
  }
  update(s,selected,kind='all'){
    const old=this.state;this.state=s;this.selected=selected;
    if(kind==='all'||kind==='tunnel'||!old)this.rebuildTunnel(s);
    if(kind==='all'||kind==='robot'||kind==='tunnel'||!old)this.rebuildRobot(s);
    else {this.robot.position.copy(v3(robotOrigin(s)));this.robot.rotation.y=s.robot.yaw*RAD;}
    this.rebuildCameras(s);
    this.frusta.visible=s.display.frusta;this.footprints.visible=s.display.footprints;this.annotations.visible=s.display.grid;this.floorGrid.visible=s.display.grid;
    this.wallMaterial.opacity=s.display.cutaway?s.display.opacity:1;this.wallMaterial.transparent=s.display.cutaway;this.wallMaterial.depthWrite=!s.display.cutaway;this.wallMaterial.needsUpdate=true;
    this.ribs.material.opacity=s.display.cutaway?.15:.4;
    this.dirty=true;this.previewDirty=true;
  }
  async exportImage({longEdge=3840,background='dark',cameraLabels=true}={}){
    const w=this.el.clientWidth,h=this.el.clientHeight;
    if(w<1||h<1)throw new Error('三维视图尺寸无效');
    const scale=longEdge/Math.max(w,h),camera=this.active.clone();camera.updateMatrixWorld();
    const renderer=this.software?new SoftwareRenderer({alpha:true,maxPixelRatio:scale}):new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.setPixelRatio(scale);renderer.setSize(w,h);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);
    const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
    const ctx=canvas.getContext('2d');
    if(background!=='transparent'){ctx.fillStyle=background==='white'?'#ffffff':'#1c242b';ctx.fillRect(0,0,canvas.width,canvas.height);}
    const annotationsVisible=this.annotations.visible;
    try{
      // Render the current camera directly; DOM overlays and dimension annotations never enter the image.
      this.annotations.visible=false;renderer.render(this.scene,camera);ctx.drawImage(renderer.domElement,0,0);
      if(cameraLabels&&this.poses){
        ctx.save();ctx.scale(canvas.width/w,canvas.height/h);ctx.font='12px "Segoe UI","Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        const placed=[];
        this.poses.forEach((pose,i)=>{
          const p=v3(pose.position).project(camera);if(p.z< -1||p.z>1||Math.abs(p.x)>1.05||Math.abs(p.y)>1.05)return;
          const anchorX=(p.x*.5+.5)*w,anchorY=(-p.y*.5+.5)*h,text=NAMES[i],width=ctx.measureText(text).width+18;
          const candidates=[];for(const dy of [-25,-55,25,-85,55,85])for(const dx of [0,-width*.9,width*.9,-width*1.6,width*1.6])candidates.push({x:clampExport(anchorX+dx,width/2+8,w-width/2-8),y:clampExport(anchorY+dy,18,h-18),cost:dx*dx+dy*dy});
          candidates.sort((a,b)=>a.cost-b.cost);
          const point=candidates.find(a=>!placed.some(b=>Math.abs(a.x-b.x)<(width+b.width)/2+7&&Math.abs(a.y-b.y)<31))||candidates[0];
          const {x,y}=point;placed.push({x,y,width});
          ctx.globalAlpha=this.state.cameras[i].enabled?1:.4;ctx.fillStyle='#172329ee';ctx.strokeStyle=COLORS[i];ctx.lineWidth=.8;
          ctx.beginPath();ctx.moveTo(clampExport(anchorX,x-width/2,x+width/2),clampExport(anchorY,y-12,y+12));ctx.lineTo(anchorX,anchorY);ctx.stroke();
          ctx.beginPath();ctx.roundRect(x-width/2,y-12,width,24,3);ctx.fill();ctx.stroke();ctx.fillStyle=COLORS[i];ctx.fillText(text,x,y);
        });ctx.restore();
      }
    }finally{this.annotations.visible=annotationsVisible;renderer.dispose?.();this.dirty=true;}
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('浏览器未能生成PNG图片');
    return {blob,width:canvas.width,height:canvas.height};
  }
  draw(){
    const moved=this.controls.update();if(this.dirty||moved){
      this.renderer.render(this.scene,this.active);this.dirty=false;
      if(this.poses){const r=this.el.getBoundingClientRect();this.poses.forEach((p,i)=>{const point=v3(p.position).project(this.active);const e=this.labels[i];e.hidden=point.z>1||point.z< -1||Math.abs(point.x)>1.1||Math.abs(point.y)>1.1;e.style.left=(point.x*.5+.5)*r.width+'px';e.style.top=(-point.y*.5+.5)*r.height+'px';});}
    }
    if(this.previewDirty&&this.state&&this.previewEl.clientWidth>0&&this.previewEl.clientHeight>0){
      const c=this.state.cameras[this.selected],p=this.poses[this.selected];this.previewCamera.position.copy(v3(p.position));
      const basis=new THREE.Matrix4().makeBasis(v3(p.right),v3(p.up),v3(mul(p.forward,-1)));this.previewCamera.quaternion.setFromRotationMatrix(basis);
      const near=.015;this.previewCamera.projectionMatrix.makePerspective(-p.tx*near,p.tx*near,p.ty*near,-p.ty*near,near,80);this.previewCamera.projectionMatrixInverse.copy(this.previewCamera.projectionMatrix).invert();
      const groups=[this.frusta,this.footprints,this.annotations,this.cameraBodies],visibility=groups.map(g=>g.visible);groups.forEach(g=>g.visible=false);
      this.robot.visible=this.state.display.occlusion;
      const m=this.wallMaterial,original={opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite};m.opacity=1;m.transparent=false;m.depthWrite=true;m.needsUpdate=true;
      const ribsOpacity=this.ribs.material.opacity;this.ribs.material.opacity=.4;this.previewRenderer.render(this.scene,this.previewCamera);this.ribs.material.opacity=ribsOpacity;
      Object.assign(m,original);m.needsUpdate=true;groups.forEach((g,i)=>g.visible=visibility[i]);this.robot.visible=true;this.previewDirty=false;
    }
  }
}
