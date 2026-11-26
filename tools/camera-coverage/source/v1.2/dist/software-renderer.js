// Canvas 2D fallback uses the same Three scene, camera projection and ray geometry.
// It needs no GPU context and keeps the model interactive on restricted browsers.
import * as THREE from 'three';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const planes=[p=>p[3]+p[0],p=>p[3]-p[0],p=>p[3]+p[1],p=>p[3]-p[1],p=>p[3]+p[2],p=>p[3]-p[2]];
function clipPolygon(poly){
  for(const plane of planes){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a),db=plane(b);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const f=da/(da-db);out.push(a.map((v,j)=>v+(b[j]-v)*f));}}poly=out;if(!poly.length)break;}return poly;
}
const point=(m,x,y,z)=>{const e=m.elements;return [e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14],e[3]*x+e[7]*y+e[11]*z+e[15]];};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export class SoftwareRenderer{
  constructor(options={}){this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d',{alpha:options.alpha!==false});this.alpha=options.alpha!==false;this.maxPixelRatio=options.maxPixelRatio||1.5;this.pixelRatio=1;this.width=1;this.height=1;this.clearColor='#23313b';this.info={render:{triangles:0}};this.shadowMap={enabled:false};}
  setPixelRatio(r){this.pixelRatio=Math.min(r,this.maxPixelRatio);}
  setClearColor(color,alpha){this.clearColor=typeof color==='string'?color:'#23313b';if(alpha===0)this.alpha=true;}
  setSize(w,h){this.width=Math.max(1,w);this.height=Math.max(1,h);this.domElement.width=Math.round(this.width*this.pixelRatio);this.domElement.height=Math.round(this.height*this.pixelRatio);this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';}
  render(scene,camera){
    const ctx=this.ctx,w=this.width,h=this.height;ctx.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);ctx.clearRect(0,0,w,h);if(!this.alpha){ctx.fillStyle=this.clearColor;ctx.fillRect(0,0,w,h);}
    scene.updateMatrixWorld();camera.updateMatrixWorld();camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),commands=[],overlays=[];
    const screen=p=>[(p[0]/p[3]*.5+.5)*w,(-p[1]/p[3]*.5+.5)*h];
    const camPos=new THREE.Vector3();camera.getWorldPosition(camPos);
    const drawNode=node=>{
      if(!node.visible)return;
      if(node.isMesh){
        const g=node.geometry,positions=g.attributes.position,index=g.index,mat=Array.isArray(node.material)?node.material[0]:node.material;if(!positions||!mat||mat.opacity<=.001)return;
        const view=new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse,node.matrixWorld),mvp=new THREE.Matrix4().multiplyMatrices(projection,node.matrixWorld),world=node.matrixWorld;
        const projected=[],worlds=[],depths=[];for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);projected.push(point(mvp,x,y,z));worlds.push(point(world,x,y,z));depths.push(-point(view,x,y,z)[2]);}
        const count=index?index.count:positions.count,color=mat.color||new THREE.Color('#aabbcc');
        for(let i=0;i<count;i+=3){
          const ids=index?[index.getX(i),index.getX(i+1),index.getX(i+2)]:[i,i+1,i+2];const a=worlds[ids[0]],b=worlds[ids[1]],c=worlds[ids[2]];if(!a||!b||!c)continue;
          const normal=cross(b.slice(0,3).map((v,j)=>v-a[j]),c.slice(0,3).map((v,j)=>v-a[j]));const normalLength=Math.hypot(...normal)||1;
          const facing=normal[0]*(camPos.x-a[0])+normal[1]*(camPos.y-a[1])+normal[2]*(camPos.z-a[2]);if(mat.side===THREE.FrontSide&&facing<0)continue;if(mat.side===THREE.BackSide&&facing>0)continue;
          const poly=clipPolygon(ids.map(j=>projected[j]));if(poly.length<3)continue;
          let shade=1;if(!mat.isMeshBasicMaterial){const sign=facing>=0?1:-1,n=normal.map(v=>v/normalLength*sign);shade=.58+.28*Math.max(0,n[0]*.42+n[1]*.8+n[2]*.42)+.14*Math.max(0,n[1]);}
          const srgb=color.clone().convertLinearToSRGB();const fill=`rgb(${Math.round(clamp(srgb.r*shade,0,1)*255)},${Math.round(clamp(srgb.g*shade,0,1)*255)},${Math.round(clamp(srgb.b*shade,0,1)*255)})`;
          commands.push({type:mat.wireframe?'wire':'face',points:poly.map(screen),depth:ids.reduce((v,j)=>v+depths[j],0)/3,color:fill,opacity:mat.opacity??1});
        }
      }else if(node.isLine||node.isLineSegments){
        const positions=node.geometry?.attributes.position,mat=node.material;if(!positions||!mat)return;const mvp=new THREE.Matrix4().multiplyMatrices(projection,node.matrixWorld),view=new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse,node.matrixWorld),step=node.isLineSegments?2:1;
        for(let i=0;i<positions.count-1;i+=step){let a=point(mvp,positions.getX(i),positions.getY(i),positions.getZ(i)),b=point(mvp,positions.getX(i+1),positions.getY(i+1),positions.getZ(i+1));let rejected=false;
          for(const plane of planes){const da=plane(a),db=plane(b);if(da<0&&db<0){rejected=true;break;}if((da<0)!==(db<0)){const f=da/(da-db),mid=a.map((v,j)=>v+(b[j]-v)*f);if(da<0)a=mid;else b=mid;}}
          if(rejected)continue;const depth=-(point(view,positions.getX(i),positions.getY(i),positions.getZ(i))[2]+point(view,positions.getX(i+1),positions.getY(i+1),positions.getZ(i+1))[2])/2;
          const cmd={type:'line',points:[screen(a),screen(b)],color:mat.color.getStyle(),opacity:mat.opacity??1,depth:depth-.002};(mat.depthTest===false?overlays:commands).push(cmd);
        }
      }else if(node.isSprite&&node.material.map?.image){
        const pos=new THREE.Vector3();node.getWorldPosition(pos);const p=point(projection,pos.x,pos.y,pos.z);if(p[3]>0&&planes.every(f=>f(p)>=0)){
          const viewPos=pos.clone().applyMatrix4(camera.matrixWorldInverse),scale=new THREE.Vector3();node.getWorldScale(scale);const denom=camera.isOrthographicCamera?1:Math.max(.001,-viewPos.z),sh=scale.y*Math.abs(camera.projectionMatrix.elements[5])*h/2/denom,sw=scale.x*Math.abs(camera.projectionMatrix.elements[0])*w/2/denom;
          const cmd={type:'sprite',point:screen(p),w:sw,h:sh,image:node.material.map.image,opacity:node.material.opacity??1,depth:-viewPos.z};(node.material.depthTest===false?overlays:commands).push(cmd);
        }
      }
      for(const child of node.children)drawNode(child);
    };
    drawNode(scene);commands.sort((a,b)=>b.depth-a.depth);this.info.render.triangles=commands.length;
    ctx.lineJoin='round';ctx.lineCap='round';
    for(const cmd of [...commands,...overlays]){
      ctx.globalAlpha=cmd.opacity;
      if(cmd.type==='sprite'){if(cmd.w>0&&cmd.h>0)ctx.drawImage(cmd.image,cmd.point[0]-cmd.w/2,cmd.point[1]-cmd.h/2,cmd.w,cmd.h);continue;}
      const points=cmd.points;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
      if(cmd.type==='face'){ctx.closePath();ctx.fillStyle=cmd.color;ctx.fill();}
      else{ctx.strokeStyle=cmd.color;ctx.lineWidth=cmd.type==='line'?.8:.4;if(cmd.type==='wire')ctx.closePath();ctx.stroke();}
    }
    ctx.globalAlpha=1;
  }
}
