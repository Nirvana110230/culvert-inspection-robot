import {DEFAULTS,COLORS,NAMES,copy,clamp,VFOV,cameraPose,cameraMetrics,coverageGrid,contains,validateConfig,worldPoint,bodyBoxes,toRobotLocal} from './geometry.js?v=1.2';
import {Simulator} from './scene.js?v=1.2';
import {advanceSliderDrag} from './slider.js';
import {setupWorkspace} from './workspace.js?v=1.2';

const $=id=>document.getElementById(id),KEY='culvert-field-lab-v1-20261023',STATE_KEY=KEY+'-uploaded-layout-145345';
let state=copy(DEFAULTS),selected=1,sim=null,playing=false,coverage=null,coverageTime=0,lastFrame=0,saveTimer=null;
try {const previous=localStorage.getItem(STATE_KEY);if(previous)state=validateConfig(JSON.parse(previous));}catch{$('save-state').textContent='已恢复默认参数';}
const controls=[];
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STATE_KEY,JSON.stringify(state));$('save-state').textContent='已自动保存至本机';}catch{$('save-state').textContent='可导出参数保存';}},300);}
const fmt=(v,step)=>step<1?Number(v).toFixed(step<.1?2:1):String(Math.round(v));
function control(parent,label,key,min,max,step,unit,group='camera',kind='camera'){
  const id=`control-${group}-${key}`;
  const el=document.createElement('div');el.className='control';
  el.innerHTML=`<div class="control-row"><label for="${id}">${label}</label><div class="value-controls"><button type="button" class="nudge-btn" data-nudge="-1" aria-label="${label}减少" title="减少 ${step}${unit}">−</button><div class="value-wrap"><input id="${id}" type="number" min="${min}" max="${max}" step="${step}" aria-label="${label}"><span>${unit}</span></div><button type="button" class="nudge-btn" data-nudge="1" aria-label="${label}增加" title="增加 ${step}${unit}">+</button></div></div><input type="range" id="${id}-range" min="${min}" max="${max}" step="${step}" aria-label="${label}滑块"><div class="range-limits"><span>${min}</span><span>${max}</span></div>`;
  $(parent).append(el);const number=el.querySelector('input[type=number]'),range=el.querySelector('input[type=range]');
  const target=()=>group==='camera'?state.cameras[selected]:state[group];
  const item={key,group,number,range,el,min,max,step,target};controls.push(item);
  const apply=value=>{
    let v=clamp(value,item.min,item.max);if(!Number.isFinite(v))return;
    if(group==='tunnel'&&key==='spring')v=Math.min(v,state.tunnel.height-.1);
    if(group==='tunnel'&&key==='height'&&state.tunnel.spring>v-.1)state.tunnel.spring=Number((v-.1).toFixed(2));
    target()[key]=v;
    const c=state.cameras[selected];
    if(group==='camera'&&(key==='hfov'||key==='vfov')){
      c.preset='custom';
      if(c.lock){if(key==='vfov')c.hfov=clamp(2*Math.atan(Math.tan(v*Math.PI/360)*16/9)*180/Math.PI,1,150);c.vfov=VFOV(c.hfov);}
    }
    refresh(kind);
  };
  range.addEventListener('input',()=>{apply(Number(range.value));number.value=fmt(target()[key],step);});
  const commit=v=>{apply(v);range.value=target()[key];number.value=fmt(target()[key],step);};
  el.querySelectorAll('[data-nudge]').forEach(b=>b.addEventListener('click',()=>commit(Number((target()[key]+Number(b.dataset.nudge)*step).toFixed(8)))));
  let drag=null;
  range.addEventListener('pointerdown',e=>{
    const factor=Number($('adjustment-speed').value);
    if(e.button!==0||(factor===1&&!e.shiftKey))return;
    e.preventDefault();range.focus({preventScroll:true});range.setPointerCapture(e.pointerId);
    const rect=range.getBoundingClientRect(),track=Math.max(1,rect.width-11),value=target()[key];
    drag={id:e.pointerId,startX:e.clientX,lastX:e.clientX,raw:value,value,track,factor,moved:false,thumbX:rect.left+5.5+(value-item.min)/(item.max-item.min)*track};
  });
  range.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;e.preventDefault();
    if(!drag.moved&&Math.abs(e.clientX-drag.startX)<2)return;
    drag.moved=true;
    const next=advanceSliderDrag(drag.raw,e.clientX-drag.lastX,drag.track,item.min,item.max,drag.factor*(e.shiftKey?.2:1),step);
    drag.lastX=e.clientX;drag.raw=next.raw;commit(next.value);
  });
  const finish=(e,cancel=false)=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(!cancel&&!drag.moved&&Math.abs(drag.startX-drag.thumbX)>12)commit(drag.value+Math.sign(drag.startX-drag.thumbX)*step);
    drag=null;if(range.hasPointerCapture(e.pointerId))range.releasePointerCapture(e.pointerId);
  };
  range.addEventListener('pointerup',e=>finish(e));range.addEventListener('pointercancel',e=>finish(e,true));
  number.addEventListener('input',()=>{const v=number.valueAsNumber;if(number.value!==''&&Number.isFinite(v)&&v>=item.min&&v<=item.max)apply(v);});
  number.addEventListener('change',()=>{apply(Number(number.value));number.value=fmt(target()[key],step);});
  number.addEventListener('keydown',e=>{if(e.key==='Enter'){number.blur();}});
  return item;
}
control('position-controls','前后 x','x',-3,3,.01,'m');
control('position-controls','左右 y','y',-3,3,.01,'m');
control('position-controls','安装高度 z','z',.05,3,.01,'m');
control('orientation-controls','偏航 · 左右转向','yaw',-180,180,.1,'°');
control('orientation-controls','俯仰 · 上下抬头','pitch',-90,90,.1,'°');
control('orientation-controls','滚转 · 画幅旋转','roll',-180,180,.1,'°');
control('fov-controls','水平视角 HFOV','hfov',1,150,.01,'°');
control('fov-controls','垂直视角 VFOV','vfov',.5,150,.01,'°');
control('range-control','可视化量程','range',.2,20,.1,'m');
control('tunnel-controls','涵洞宽度','width',.8,8,.01,'m','tunnel','tunnel');
control('tunnel-controls','涵洞总高','height',.7,6,.01,'m','tunnel','tunnel');
control('tunnel-controls','直墙高度','spring',0,5.8,.01,'m','tunnel','tunnel');
control('tunnel-controls','显示长度','length',2,30,.5,'m','tunnel','tunnel');
control('robot-size-controls','底盘长度','length',.3,3,.01,'m','robot','robot');
control('robot-size-controls','底盘宽度','width',.2,2.5,.01,'m','robot','robot');
control('robot-size-controls','底盘高度','height',.15,1.8,.01,'m','robot','robot');
control('robot-pose-controls','左右偏移 · + 向左','lateral',-3,3,.01,'m','robot','pose');
const positionControl=control('robot-pose-controls','沿线位置 · + 向前','position',-4,4,.01,'m','robot','pose');
control('robot-pose-controls','车体朝向','yaw',-180,180,1,'°','robot','pose');
control('robot-pose-controls','模拟车速','speed',0,1.5,.01,'m/s','robot','metrics');
control('opacity-control','洞壁透明度','opacity',.02,.7,.01,'','display','display');
try{const speed=localStorage.getItem(KEY+'-drag-speed');if(['1','0.2','0.05'].includes(speed))$('adjustment-speed').value=speed;}catch{}
$('adjustment-speed').addEventListener('change',()=>{try{localStorage.setItem(KEY+'-drag-speed',$('adjustment-speed').value);}catch{}});

function selectCamera(i){selected=i;document.documentElement.style.setProperty('--camera-color',COLORS[i]);refresh('camera');}
function syncControls(){
  const c=state.cameras[selected];
  const t=state.tunnel,round=Math.abs(t.width/2-(t.height-t.spring))<.001;
  $('section-dimensions').textContent=`宽 ${t.width.toFixed(2)} m · 高 ${t.height.toFixed(2)} m · 直墙 ${t.spring.toFixed(2)} m · ${round?'半圆 R '+(t.width/2).toFixed(2)+' m':'椭圆拱'}`;
  document.querySelector('.shape-note b').textContent=round?'直墙 + 半圆拱':'直墙 + 椭圆拱';
  const springCtrl=controls.find(v=>v.group==='tunnel'&&v.key==='spring');springCtrl.max=state.tunnel.height-.1;springCtrl.range.max=springCtrl.number.max=springCtrl.max;
  springCtrl.el.querySelector('.range-limits span:last-child').textContent=springCtrl.max.toFixed(1);
  positionControl.min=-state.tunnel.length/2;positionControl.max=state.tunnel.length/2;
  positionControl.range.min=positionControl.number.min=positionControl.min;positionControl.range.max=positionControl.number.max=positionControl.max;
  const poslimits=positionControl.el.querySelectorAll('.range-limits span');poslimits[0].textContent=positionControl.min;poslimits[1].textContent=positionControl.max;
  for(const q of controls){const v=q.target()[q.key];if(document.activeElement!==q.number)q.number.value=fmt(v,q.step);if(document.activeElement!==q.range)q.range.value=v;const p=clamp((v-q.min)/(q.max-q.min)*100,0,100);q.range.style.setProperty('--pct',p+'%');}
  document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',Number(b.dataset.camera)===selected));
  $('camera-index').textContent=`CAM 0${selected+1}`;$('camera-name').textContent=NAMES[selected];$('camera-enabled').checked=c.enabled;
  $('aspect-lock').checked=c.lock;$('lens-preset').value=c.preset;
  $('preset-note').textContent=c.preset==='candidate4'?'候选4视角暂按镜头表；仍需对应800万实物版本。':c.preset==='wide'?'90°用于比较宽窄视野，不对应已确认的商品镜头。':'可独立修改双向视角；开启16:9联动时按理想针孔模型换算。';
  for(const [id,key] of [['res-width','resW'],['res-height','resH'],['fps-input','fps'],['exposure-input','exposure']])if(document.activeElement!==$(id))$(id).value=c[key];
  for(const [id,key] of [['cutaway','cutaway'],['show-frusta','frusta'],['show-footprints','footprints'],['body-occlusion','occlusion'],['grid-toggle','grid']])$(id).checked=state.display[key];
  $('preview-title').textContent=NAMES[selected]+' · 相机视角';$('preview-fov').textContent=`${c.hfov.toFixed(1)}° × ${c.vfov.toFixed(1)}°`;
  $('preview-render').style.aspectRatio=(Math.tan(c.hfov*Math.PI/360)/Math.tan(c.vfov*Math.PI/360)).toFixed(5);
  $('preview-render').style.maxHeight='300px';
}
function updateMetrics(){
  const c=state.cameras[selected],m=cameraMetrics(c,state),ok=c.enabled&&contains(cameraPose(c,state).position,state.tunnel);
  $('metric-distance').textContent=ok&&!m.hit.miss?m.hit.t.toFixed(2)+' m':'—';
  $('metric-surface').textContent=!c.enabled?'相机未启用':!ok?'相机位于涵洞外':m.hit.surface;
  $('metric-density').textContent=m.density===null?'—':m.density.toFixed(2);
  $('metric-crack').textContent=m.density===null?'—':m.density.toFixed(2);
  $('motion-estimate').textContent=m.blur===null?'中心射线未命中有效壁面':`平移运动模糊 ≈ ${m.blur.toFixed(2)} px`;
  $('frame-estimate').textContent=`每帧前进 ${(state.robot.speed/c.fps*1000).toFixed(1)} mm · 曝光 ${(1000/c.exposure).toFixed(2)} ms`;
  const warnings=[];
  state.cameras.forEach((cam,i)=>{
    if(!cam.enabled)return;const p=cameraPose(cam,state).position;
    if(!contains(p,state.tunnel))warnings.push(NAMES[i]+'位于涵洞外');
    const local=toRobotLocal(p,state);if(bodyBoxes(state).some(b=>local.every((v,j)=>v>=b.min[j]&&v<=b.max[j])))warnings.push(NAMES[i]+'装在车体内部');
  });
  const r=state.robot;for(const x of [-r.length/2,r.length/2])for(const y of [-r.width/2,r.width/2])for(const z of [0,r.height])if(!contains(worldPoint(x,y,z,state),state.tunnel,.001)){warnings.push('车体超出涵洞边界');break;}
  const unique=[...new Set(warnings)];$('layout-status').textContent=unique.length?unique[0]:'参数已就绪';$('layout-status').title=unique.join('；');$('layout-status').style.color=unique.length?'#e6b87d':'';
}
function updateCoverage(){coverage=coverageGrid(state);$('metric-coverage').textContent=Math.round(coverage.percent)+'%';drawCoverage();coverageTime=performance.now();}
function drawCoverage(){
  if(!coverage)return;const canvas=$('coverage-map'),rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio,2),w=rect.width,h=rect.height;canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  ctx.fillStyle='#172028';ctx.fillRect(0,0,w,h);const left=47,right=12,top=8,bottom=16,pw=w-left-right,ph=h-top-bottom,dx=pw/coverage.columns,dy=ph/coverage.rows;
  const rgb=COLORS.map(c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]);
  for(let y=0;y<coverage.rows;y++)for(let x=0;x<coverage.columns;x++){const mask=coverage.cells[y*coverage.columns+x];if(!mask)continue;let cs=[0,0,0],count=0;for(let i=0;i<3;i++)if(mask&(1<<i)){cs=cs.map((v,j)=>v+rgb[i][j]);count++;}ctx.fillStyle=`rgba(${cs.map(v=>Math.round(v/count)).join(',')},${count>1?.87:.53})`;ctx.fillRect(left+x*dx,top+y*dy,dx+.3,dy+.3);}
  ctx.strokeStyle='#a4b9c61c';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<=8;i++){const x=left+i/8*pw;ctx.moveTo(x,top);ctx.lineTo(x,top+ph);}for(let j=0;j<=4;j++){const y=top+j/4*ph;ctx.moveTo(left,y);ctx.lineTo(left+pw,y);}ctx.stroke();
  ctx.font='9px "Segoe UI","Microsoft YaHei",sans-serif';ctx.fillStyle='#859ba9';ctx.textAlign='right';ctx.fillText('左墙',left-8,top+9);ctx.fillText('拱顶',left-8,top+ph/2+3);ctx.fillText('右墙',left-8,top+ph-2);
  ctx.textAlign='left';ctx.fillText('后方',left,h-3);ctx.textAlign='right';ctx.fillText('前方',w-right,h-3);
  const robotX=left+(state.robot.position/state.tunnel.length+.5)*pw;
  if(robotX>=left&&robotX<=w-right){ctx.strokeStyle='#dce8eb77';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(robotX,top);ctx.lineTo(robotX,top+ph);ctx.stroke();ctx.setLineDash([]);ctx.textAlign='center';ctx.fillText('车体',clamp(robotX,left+16,w-right-16),h-3);}
}
function refresh(kind='all',persist=true){
  syncControls();updateMetrics();
  sim?.update(state,selected,kind);
  if(kind!=='metrics'&&kind!=='display')updateCoverage();
  if(persist)save();
}
try{sim=new Simulator($('viewport'),$('preview-render'),selectCamera);}catch(error){$('webgl-error').hidden=false;$('webgl-error').textContent='浏览器未能启动三维绘图。请在支持WebGL的Chrome或Edge中打开，并启用图形加速。参数仍可编辑、导入和导出。';console.error(error);}
selectCamera(selected);
setupWorkspace({sim,notify,onResize:drawCoverage});

document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>selectCamera(Number(b.dataset.camera))));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el===b));sim?.setView(b.dataset.view);}));
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(el=>{el.classList.toggle('active',el===b);el.setAttribute('aria-selected',el===b?'true':'false');});$('camera-panel').hidden=b.dataset.tab!=='cameras';$('scene-panel').hidden=b.dataset.tab!=='scene';}));
$('camera-enabled').addEventListener('change',e=>{state.cameras[selected].enabled=e.target.checked;refresh('camera');});
$('aspect-lock').addEventListener('change',e=>{const c=state.cameras[selected];c.lock=e.target.checked;if(c.lock)c.vfov=VFOV(c.hfov);refresh('camera');});
$('lens-preset').addEventListener('change',e=>{const c=state.cameras[selected];c.preset=e.target.value;if(c.preset!=='custom'){c.hfov=c.preset==='candidate4'?58.3:90;c.vfov=VFOV(c.hfov);c.lock=true;}refresh('camera');});
$('aim-left').addEventListener('click',()=>{state.cameras[selected].yaw=90;refresh('camera');});
$('aim-rear-left').addEventListener('click',()=>{state.cameras[selected].yaw=135;refresh('camera');});
$('portrait-btn').addEventListener('click',()=>{state.cameras[selected].roll=Math.abs(state.cameras[selected].roll)<45?90:0;refresh('camera');});
for(const [id,key] of [['cutaway','cutaway'],['show-frusta','frusta'],['show-footprints','footprints'],['body-occlusion','occlusion'],['grid-toggle','grid']])$(id).addEventListener('change',e=>{state.display[key]=e.target.checked;refresh(key==='occlusion'?'camera':'display');});
for(const [id,key,min,max] of [['res-width','resW',320,16384],['res-height','resH',240,16384],['fps-input','fps',1,240],['exposure-input','exposure',1,100000]]){
  const apply=e=>{const val=e.target.valueAsNumber;if(e.type==='input'&&(!Number.isFinite(val)||val<min||val>max))return;state.cameras[selected][key]=clamp(Number.isFinite(val)?Math.round(val):min,min,max);refresh('metrics');};
  $(id).addEventListener('input',apply);$(id).addEventListener('change',apply);
}
$('reset-view').addEventListener('click',()=>{sim?.setView(sim?.view||'orbit');});
$('reset-all').addEventListener('click',()=>{state=copy(DEFAULTS);playing=false;$('play-btn').textContent='▶ 沿涵洞行进';refresh();sim?.setView('orbit');document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view==='orbit'));notify('已恢复你上传的默认布局');});
$('preview-expand').addEventListener('click',()=>{$('camera-preview').classList.toggle('expanded');setTimeout(()=>sim?.resize(),200);});
$('play-btn').addEventListener('click',()=>{
  if(!playing&&state.robot.speed===0){notify('请先设置大于0的模拟车速');return;}
  if(!playing&&state.robot.position>=state.tunnel.length/2-state.robot.length/2-.05)state.robot.position=-state.tunnel.length/2+state.robot.length/2+.05;
  playing=!playing;$('play-btn').textContent=playing?'Ⅱ 暂停行进':'▶ 沿涵洞行进';lastFrame=0;if(!playing)save();
});
$('export-btn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`culvert-camera-layout-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('已导出三台相机、涵洞与底盘的完整参数');});
$('import-btn').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>1024*1024)throw new Error('文件过大，请选择导出的JSON参数文件');const next=validateConfig(JSON.parse(await f.text()));state=next;playing=false;$('play-btn').textContent='▶ 沿涵洞行进';refresh();notify('已载入方案');}catch(error){notify('导入失败：'+error.message);}e.target.value='';});
const showHelp=()=>{if(!$('help-dialog').open)$('help-dialog').showModal();};
for(const id of ['help-btn','detail-btn'])$(id).addEventListener('click',showHelp);
for(const id of ['close-help','start-btn'])$(id).addEventListener('click',()=>$('help-dialog').close());
$('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const r=$('help-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('help-dialog').close();}});
window.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||e.target.getAttribute?.('role')==='separator'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
  const c=state.cameras[selected],step=e.shiftKey?5:1;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
    e.preventDefault();if(e.key==='ArrowUp')c.pitch=clamp(c.pitch+step,-90,90);if(e.key==='ArrowDown')c.pitch=clamp(c.pitch-step,-90,90);if(e.key==='ArrowLeft')c.yaw=c.yaw+step>180?-180:c.yaw+step;if(e.key==='ArrowRight')c.yaw=c.yaw-step< -180?180:c.yaw-step;refresh('camera');
  }else if(['1','2','3'].includes(e.key))selectCamera(Number(e.key)-1);
  else if(e.key.toLowerCase()==='r')sim?.setView(sim?.view||'orbit');
});
new ResizeObserver(()=>drawCoverage()).observe($('coverage-map'));
function frame(now){
  const dt=lastFrame?Math.min((now-lastFrame)/1000,1):0;lastFrame=now;
  if(playing){
    state.robot.position+=state.robot.speed*dt;
    const max=state.tunnel.length/2-state.robot.length/2-.05;
    if(state.robot.position>=max){state.robot.position=max;playing=false;$('play-btn').textContent='▶ 沿涵洞行进';notify('已到显示段端部');save();}
    // Keep animation responsive without continuously rebuilding camera ray meshes.
    if(now-coverageTime>90){syncControls();updateMetrics();sim?.update(state,selected,'pose');updateCoverage();}
  }
  sim?.draw();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
