const STORAGE='culvert-field-lab-workspace-v12';
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const $=id=>document.getElementById(id);

export function setupWorkspace({sim,notify,onResize}){
  const ui={sidebarWidth:354,bottomHeight:276,previewVisible:true,resolution:3840,background:'dark',cameraLabels:true};
  try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved&&typeof saved==='object')for(const key of Object.keys(ui))if(typeof saved[key]===typeof ui[key])ui[key]=saved[key];}catch{}
  if(![1920,3840,5760].includes(ui.resolution))ui.resolution=3840;
  if(!['dark','white','transparent'].includes(ui.background))ui.background='dark';
  const save=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(ui));}catch{}};
  const sidebarBounds=()=>[260,Math.max(260,Math.min(760,window.innerWidth-360))];
  const bottomBounds=()=>[130,Math.max(130,document.querySelector('.visual-workspace').clientHeight-document.querySelector('.scene-toolbar').offsetHeight-220)];
  function applySizes(){
    ui.sidebarWidth=clamp(Number.isFinite(ui.sidebarWidth)?ui.sidebarWidth:354,...sidebarBounds());
    ui.bottomHeight=clamp(Number.isFinite(ui.bottomHeight)?ui.bottomHeight:276,...bottomBounds());
    document.documentElement.style.setProperty('--inspector-width',Math.round(ui.sidebarWidth)+'px');
    document.documentElement.style.setProperty('--bottom-height',Math.round(ui.bottomHeight)+'px');
    for(const [id,value,bounds] of [['sidebar-resizer',ui.sidebarWidth,sidebarBounds()],['bottom-resizer',ui.bottomHeight,bottomBounds()]]){
      const el=$(id);el.setAttribute('aria-valuenow',Math.round(value));el.setAttribute('aria-valuetext',Math.round(value)+'像素');el.setAttribute('aria-valuemin',Math.round(bounds[0]));el.setAttribute('aria-valuemax',Math.round(bounds[1]));
    }
    requestAnimationFrame(()=>{sim?.resize();onResize?.();});
  }
  function attachResizer(id,key,axis,defaults){
    const el=$(id);let dragging=null;
    el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();el.focus({preventScroll:true});el.setPointerCapture(e.pointerId);dragging={id:e.pointerId,start:axis==='x'?e.clientX:e.clientY,value:ui[key]};document.body.classList.add(axis==='x'?'resizing-sidebar':'resizing-bottom');});
    el.addEventListener('pointermove',e=>{if(!dragging||dragging.id!==e.pointerId)return;e.preventDefault();ui[key]=dragging.value+dragging.start-(axis==='x'?e.clientX:e.clientY);applySizes();});
    const finish=e=>{if(!dragging||dragging.id!==e.pointerId)return;dragging=null;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);document.body.classList.remove('resizing-sidebar','resizing-bottom');save();};
    el.addEventListener('pointerup',finish);el.addEventListener('pointercancel',finish);
    el.addEventListener('dblclick',()=>{ui[key]=defaults;applySizes();save();});
    el.addEventListener('keydown',e=>{
      const decrease=axis==='x'?'ArrowRight':'ArrowDown',increase=axis==='x'?'ArrowLeft':'ArrowUp';
      if(![decrease,increase,'Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();
      const bounds=axis==='x'?sidebarBounds():bottomBounds();
      ui[key]=e.key==='Home'?bounds[0]:e.key==='End'?bounds[1]:ui[key]+(e.key===increase?1:-1)*(e.shiftKey?5:20);applySizes();save();
    });
  }
  attachResizer('sidebar-resizer','sidebarWidth','x',354);attachResizer('bottom-resizer','bottomHeight','y',276);
  window.addEventListener('resize',applySizes);applySizes();
  new ResizeObserver(applySizes).observe(document.querySelector('.scene-toolbar'));
  const applyPreview=()=>{$('camera-preview').hidden=!ui.previewVisible;$('show-preview').checked=ui.previewVisible;sim?.resize();};
  applyPreview();$('show-preview').addEventListener('change',e=>{ui.previewVisible=e.target.checked;applyPreview();save();});
  const applyExportSettings=()=>{$('image-resolution').value=ui.resolution;$('image-background').value=ui.background;$('image-camera-labels').checked=ui.cameraLabels;};
  applyExportSettings();
  $('export-settings-btn').addEventListener('click',()=>{$('export-settings-dialog').showModal();});
  $('close-export-settings').addEventListener('click',()=>$('export-settings-dialog').close());
  $('apply-export-settings').addEventListener('click',()=>{ui.resolution=Number($('image-resolution').value);ui.background=$('image-background').value;ui.cameraLabels=$('image-camera-labels').checked;save();$('export-settings-dialog').close();});
  let lastExportUrl=null;
  $('hide-export-result').addEventListener('click',()=>$('export-result').hidden=true);
  window.addEventListener('pagehide',()=>{if(lastExportUrl)URL.revokeObjectURL(lastExportUrl);});
  $('export-image-btn').addEventListener('click',async()=>{
    if(!sim){notify('三维场景尚未就绪');return;}const button=$('export-image-btn');button.disabled=true;button.textContent='正在生成…';
    try{
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const result=await sim.exportImage({longEdge:ui.resolution,background:ui.background,cameraLabels:ui.cameraLabels});
      if(lastExportUrl)URL.revokeObjectURL(lastExportUrl);lastExportUrl=URL.createObjectURL(result.blob);
      const link=$('export-image-download');link.href=lastExportUrl;link.download=`culvert-camera-view-${result.width}x${result.height}-${Date.now()}.png`;
      $('export-preview-link').href=lastExportUrl;$('export-result-caption').textContent=`${result.width} × ${result.height} PNG`;$('export-result').hidden=false;link.click();
      notify(`已导出 ${result.width} × ${result.height} 高清PNG`);
    }catch(error){notify('图片导出失败：'+error.message);}finally{button.disabled=false;button.textContent='导出高清图';}
  });
}
