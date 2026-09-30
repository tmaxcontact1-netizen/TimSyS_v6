import React,{useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {title,encoding} from './model.mjs';
import {visibleEdges,nodeColor,relationshipClass} from './semantic-layout.mjs';

export default function Network3D({graph,geography,model,selected,onSelect,onEdge,onGap,cameraMemory,action,flat=false,onUnavailable,colourBy='role',showCompanionLines=false}) {
  const host=useRef(),live=useRef(),callbacks=useRef();callbacks.current={onSelect,onEdge,onGap};
  const [failed,setFailed]=useState(''),[hover,setHover]=useState('');
  useEffect(()=>{
    const element=host.current;let renderer,controls,scene,observer,frame=null;
    try {
      renderer=new T.WebGLRenderer({antialias:graph.edges.length<=10000,alpha:false});renderer.setPixelRatio(graph.edges.length>10000?.75:Math.min(devicePixelRatio,2));renderer.setClearColor('#0c1522');
      renderer.domElement.setAttribute('aria-label',flat?'2D responsibility network':'3D responsibility network');renderer.domElement.tabIndex=0;element.appendChild(renderer.domElement);
      const labelLayer=document.createElement('div');labelLayer.className='l1-spatial-labels';element.appendChild(labelLayer);scene=new T.Scene();const camera=flat?new T.OrthographicCamera(-700,700,700,-700,.1,15000):new T.PerspectiveCamera(48,1,.1,15000);camera.position.set(1500,flat?0:1300,flat?6000:2100);camera.up.set(0,1,0);
      controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=12;controls.maxDistance=30000;controls.screenSpacePanning=true;controls.enableRotate=!flat;if(flat){controls.mouseButtons.LEFT=T.MOUSE.PAN;controls.minZoom=.0001;controls.maxZoom=40;}
      if(cameraMemory.current){camera.position.fromArray(cameraMemory.current.position);controls.target.fromArray(cameraMemory.current.target);if(flat)camera.zoom=cameraMemory.current.zoom||1;}controls.update();
      const render=()=>{if(frame!==null)return;frame=requestAnimationFrame(()=>{frame=null;const started=performance.now();renderer.render(scene,camera);live.current?.refreshDetailLabels?.();const w=element.clientWidth,h=element.clientHeight,occupied=[];
        // Labels are callouts, never new graph positions. Keep them near their
        // anchors vertically so collision avoidance cannot suggest another level.
        const labels=(live.current?.labels||[]).filter(item=>item.active!==false).map(item=>{const p=item.anchor.clone().project(camera);return {...item,ax:(p.x+1)*w/2,ay:(1-p.y)*h/2,depth:p.z};});
        const priority={level:0,node:1,guide:2,family:3,edge:4};
        labels.sort((a,b)=>priority[a.kind]-priority[b.kind]||a.ay-b.ay||a.ax-b.ax);
        for(const item of labels){const {ax,ay}=item,width=item.width,height=item.height;let visible=item.depth<1&&item.depth>-1&&ax>-100&&ax<w+100&&ay>-100&&ay<h+100;
          let x=Math.max(4,Math.min(w-width-4,ax-width/2)),y=Math.max(4,Math.min(h-height-25,ay-height-8));
          const overlaps=(cx,cy)=>occupied.some(r=>cx<r.x+r.w+4&&cx+width+4>r.x&&cy<r.y+r.h+3&&cy+height+3>r.y);
          if(item.kind==='level')x=4;
          const smallNodes=live.current.smallScope&&item.kind==='node';
          if(smallNodes){const peers=labels.filter(l=>l.kind==='node'&&l.band===item.band).sort((a,b)=>a.ax-b.ax||a.full.localeCompare(b.full)),cols=Math.max(1,Math.floor((w-195)/(width+8))),index=peers.findIndex(l=>l.el===item.el),rows=Math.ceil(peers.length/cols),anchor=peers.reduce((sum,l)=>sum+l.ay,0)/peers.length;x=190+(index%cols)*(width+8);y=Math.max(4,Math.min(h-rows*(height+6)-30,anchor-rows*(height+6)-12))+Math.floor(index/cols)*(height+6);}
          if(visible&&!smallNodes&&overlaps(x,y)){
            let found=false;
            // Horizontal fan-out first. Vertical offsets stay within 16px.
            for(const dy of [0,-16,16]){for(const dx of [width+8,-width-8,2*(width+8),-2*(width+8),3*(width+8),-3*(width+8)]){
              const cx=Math.max(4,Math.min(w-width-4,x+dx)),cy=Math.max(4,Math.min(h-height-25,y+dy));
              if(!overlaps(cx,cy)){x=cx;y=cy;found=true;break;}
            }if(found)break;}
            // Secondary annotations yield to responsibility wording.
            if(!found&&item.kind!=='node')visible=false;
          }
          item.el.hidden=!visible;item.leader.style.display=visible?'':'none';if(!visible)continue;
          occupied.push({x,y,w:width,h:height});item.el.style.transform='translate('+x+'px,'+y+'px)';item.el.title=item.full;
          item.leader.setAttribute('x1',ax);item.leader.setAttribute('y1',ay);item.leader.setAttribute('x2',Math.max(x,Math.min(x+width,ax)));item.leader.setAttribute('y2',y+height);item.leader.style.opacity=Math.hypot(ax-(x+width/2),ay-y-height)>18?'.45':'0';
        }
renderer.domElement.dataset.renderMs=String(performance.now()-started);renderer.domElement.dataset.camera=camera.position.toArray().map(x=>x.toFixed(2)).join(',')+':'+camera.zoom;});};
      controls.addEventListener('change',()=>{cameraMemory.current={position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom};render();});
      const resize=()=>{const w=element.clientWidth,h=element.clientHeight;renderer.setSize(w,h);if(flat){camera.left=-700*w/h;camera.right=700*w/h;}else camera.aspect=w/h;camera.updateProjectionMatrix();render();};observer=new ResizeObserver(resize);observer.observe(element);
      const ray=new T.Raycaster();ray.params.Line.threshold=2;let down=null;
      const pick=e=>{const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const state=live.current;if(!state)return;const hit=(ray.intersectObjects(state.pickable.filter(o=>o.userData.kind!=='edge'),false)[0]||ray.intersectObjects(state.pickable.filter(o=>o.userData.kind==='edge'),false)[0]);if(!hit)return null;return hit.object.userData.kind==='edge'?{kind:'edge',id:hit.object.userData.ids[Math.floor(hit.index/2)]}:{kind:hit.object.userData.kind,id:hit.object.userData.ids[hit.instanceId]};};
      const move=e=>{if(e.buttons)return;const hit=pick(e);const n=hit?.kind==='node'?live.current.model.byId.get(hit.id):null;setHover(n?`${n.id} · ${title(n)} · ${live.current.model.label(n.data.role_id)}`:hit?.kind==='gap'?`Unresolved handoff ${hit.id} · no receiving responsibility`:hit?.kind==='edge'?`Connection ${hit.id} · select to inspect`:'');};
      const pointerDown=e=>{down={x:e.clientX,y:e.clientY};};
      const up=e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5){const hit=pick(e);if(hit?.kind==='node')callbacks.current.onSelect(hit.id);if(hit?.kind==='edge')callbacks.current.onEdge(hit.id);if(hit?.kind==='gap')callbacks.current.onGap(hit.id);}down=null;};
      const key=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(flat){const move=new T.Vector3(e.key==='ArrowLeft'?30:e.key==='ArrowRight'?-30:0,e.key==='ArrowUp'?-30:e.key==='ArrowDown'?30:0,0).multiplyScalar(1/camera.zoom);camera.position.add(move);controls.target.add(move);controls.update();render();return;}const delta=camera.position.clone().sub(controls.target);delta.applyAxisAngle(new T.Vector3(0,1,0),e.key==='ArrowLeft'?.12:e.key==='ArrowRight'?-.12:0);if(e.key==='ArrowUp')delta.multiplyScalar(.9);if(e.key==='ArrowDown')delta.multiplyScalar(1.1);camera.position.copy(controls.target).add(delta);controls.update();render();}};
      const lost=e=>{e.preventDefault();onUnavailable?.();setFailed('3D graphics became unavailable. Continue in 2D Network or List.');};
      renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('keydown',key);renderer.domElement.addEventListener('webglcontextlost',lost);
      live.current={renderer,scene,camera,controls,render,pickable:[],model,content:null,labels:[],labelLayer};resize();
    }catch{onUnavailable?.();setFailed('3D graphics are unavailable in this browser. Your data remains accessible in 2D Network and List.');}
    return()=>{if(frame!==null)cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();if(scene)scene.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});renderer?.dispose();renderer?.domElement.remove();live.current?.labelLayer.remove();live.current=null;};
  },[]);
  useEffect(()=>{
    const s=live.current;if(!s)return;const start=performance.now();s.model=model;const position=id=>{const p=(flat?geography.positions2d:geography.positions).get(id);return p;};
    if(s.content){s.scene.remove(s.content);s.content.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});}
    const content=new T.Group();s.content=content;s.scene.add(content);s.pickable=[];s.labels=[];const bandCounts=new Map();for(const id of graph.trail.nodes){const band=geography.meta.get(id).band;bandCounts.set(band,(bandCounts.get(band)||0)+1);}s.smallScope=(!geography.focused&&graph.nodes.length<=25)||(geography.focused&&Math.max(0,...bandCounts.values())>6);s.labelLayer.replaceChildren();const leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');leaders.classList.add('l1-label-leaders');s.labelLayer.appendChild(leaders);
    const trailNodes=new Set(graph.trail.nodes),trailEdges=new Set(graph.trail.edges),focused=!!selected&&!graph.selectedExcluded;
    const matrix=new T.Matrix4(),color=new T.Color(),dummy=new T.Object3D();
    const nodes=new T.InstancedMesh(new T.IcosahedronGeometry(1,graph.edges.length>10000?0:1),new T.MeshBasicMaterial(),Math.max(1,graph.nodes.length));nodes.count=graph.nodes.length;
    nodes.userData={kind:'node',ids:graph.nodes.map(n=>n.id)};
    graph.nodes.forEach((n,i)=>{const p=position(n.id);const active=!focused||trailNodes.has(n.id);const size=n.id===selected?6:active?3.2:2.1;matrix.makeScale(size,size,size);matrix.setPosition(p.x,p.y,p.z);nodes.setMatrixAt(i,matrix);nodes.setColorAt(i,color.set(n.id===selected?'#ffffff':active?nodeColor(model,n,colourBy):'#182737'));});nodes.instanceMatrix.needsUpdate=true;content.add(nodes);s.pickable.push(nodes);
    const vertices=[],colors=[],edgeIds=[],arrows=[];
    function segment(a,b,c,id){vertices.push(a.x,a.y,a.z,b.x,b.y,b.z);color.set(c);colors.push(color.r,color.g,color.b,color.r,color.g,color.b);edgeIds.push(id);}
    const displayedEdges=visibleEdges(graph,selected,showCompanionLines);
    for(const e of displayedEdges){const a=new T.Vector3(...Object.values(position(e.data.from_id))),b=new T.Vector3(...Object.values(position(e.data.to_id))),style=encoding(e),active=!focused||trailEdges.has(e.id),c=active?(style.companion?(focused?'#79c9df':'#274757'):({lateral:'#83c7d4',referral:'#c7a5df',accountability:'#edbd7d',support:'#edbd7d',related:'#ceba91'}[relationshipClass(e)]||'#edbd7d')):'#142130';
      const curve=flat&&!style.companion?new T.CubicBezierCurve3(a,new T.Vector3(a.x,(a.y+b.y)/2,0),new T.Vector3(b.x,(a.y+b.y)/2,0),b):null;const at=t=>curve?curve.getPoint(t):a.clone().lerp(b,t);
      const pieces=style.draft?(graph.edges.length>10000?2:8):curve?(graph.edges.length>10000?4:12):1;for(let j=0;j<pieces;j++)segment(at(j/pieces),at((j+(style.draft?.55:1))/pieces),c,e.id);
      if(!style.symmetric&&(!geography.focused||active)){arrows.push({a:at(.70),b:at(.78),c});if(graph.edges.length>10000){const tip=at(.76),direction=at(.78).sub(at(.70)).normalize(),side=new T.Vector3().crossVectors(direction,Math.abs(direction.y)>.9?new T.Vector3(0,0,1):new T.Vector3(0,1,0)).normalize().multiplyScalar(2.5),back=tip.clone().addScaledVector(direction,-6);segment(tip,back.clone().add(side),c,e.id);segment(tip,back.clone().sub(side),c,e.id);}}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));const lines=new T.LineSegments(geometry,new T.LineBasicMaterial({vertexColors:true}));lines.userData={kind:'edge',ids:edgeIds};content.add(lines);s.pickable.push(lines);
    const arrowMesh=new T.InstancedMesh(new T.ConeGeometry(2.2,6,graph.edges.length>10000?3:5),new T.MeshBasicMaterial(),Math.max(1,graph.edges.length>10000?0:arrows.length));arrowMesh.count=graph.edges.length>10000?0:arrows.length;(graph.edges.length>10000?[]:arrows).forEach(({a,b,c},i)=>{dummy.position.copy(a).lerp(b,.76);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());dummy.scale.set(1,1,1);dummy.updateMatrix();arrowMesh.setMatrixAt(i,dummy.matrix);arrowMesh.setColorAt(i,color.set(c));});content.add(arrowMesh);
    const gapMesh=new T.InstancedMesh(new T.OctahedronGeometry(5),new T.MeshBasicMaterial({color:'#f2b8dc',wireframe:true}),Math.max(1,graph.gaps.length));gapMesh.count=graph.gaps.length;gapMesh.userData={kind:'gap',ids:graph.gaps.map(g=>g.id)};const gapVertices=[];
    graph.gaps.forEach((g,i)=>{const a=position(g.responsibility_id),angle=i*2.399963,b={x:a.x+45+20*(i%3),y:a.y,z:flat?0:a.z+25};matrix.identity().setPosition(b.x,b.y,b.z);gapMesh.setMatrixAt(i,matrix);for(let j=0;j<4;j++){const p=new T.Vector3(a.x,a.y,a.z).lerp(new T.Vector3(b.x,b.y,b.z),j/4),q=new T.Vector3(a.x,a.y,a.z).lerp(new T.Vector3(b.x,b.y,b.z),(j+.5)/4);gapVertices.push(...p.toArray(),...q.toArray());}});content.add(gapMesh);s.pickable.unshift(gapMesh);const gg=new T.BufferGeometry();gg.setAttribute('position',new T.Float32BufferAttribute(gapVertices,3));content.add(new T.LineSegments(gg,new T.LineBasicMaterial({color:'#f2b8dc'})));
    function label(text,p,width=180,height=38,opacity=1,kind='guide',id=''){const el=document.createElement(id?'button':'span');el.className='l1-spatial-label '+kind;el.textContent=text;const w=kind==='node'?130:kind==='level'?175:135,h=kind==='node'?40:kind==='level'?42:34;el.style.width=w+'px';el.style.opacity=String(opacity);if(id){el.addEventListener('click',()=>kind==='edge'?callbacks.current.onEdge(entry.id):callbacks.current.onSelect(entry.id));el.setAttribute('aria-label','Inspect '+id);}s.labelLayer.appendChild(el);const leader=document.createElementNS('http://www.w3.org/2000/svg','line');leader.setAttribute('stroke','#6b8394');leader.setAttribute('stroke-width','0.7');leaders.appendChild(leader);const entry={el,leader,kind,id,band:geography.meta.get(id)?.band,anchor:new T.Vector3(p.x,p.y,p.z),width:w,height:h,full:text};s.labels.push(entry);return entry;}
    const guideVertices=[],familyVertices=[],guideColor='#294558';
    const addGuide=(a,b,arr=guideVertices)=>arr.push(a.x,a.y,a.z,b.x,b.y,b.z);
    const centres=flat?geography.centers2d:geography.centers,base=-geography.levelSpacing*.45;
    const visibleIds=new Set(graph.nodes.map(n=>n.id)),visibleDomains=new Set(graph.nodes.map(n=>geography.meta.get(n.id).domain));
    for(const [id,p] of centres){const r=geography.span*.48;const y=flat?geography.levelSpacing*4.7:base;
      if(!geography.focused&&visibleDomains.has(id))label(model.label(id)==='Unknown'?'Unknown / Unclassified domain':model.label(id),{x:p.x,y,z:flat?0:p.z},geography.span*.85,geography.span*.15,geography.focused?.18:.85);
      if(!flat){for(let i=0;i<6;i++){const a=i*Math.PI/3,b=(i+1)*Math.PI/3;addGuide({x:p.x+Math.cos(a)*r,y:base,z:p.z+Math.sin(a)*r},{x:p.x+Math.cos(b)*r,y:base,z:p.z+Math.sin(b)*r});}}
      else {addGuide({x:p.x-r,y:base,z:0},{x:p.x-r,y:geography.levelSpacing*4.4,z:0});}
    }
    const all=[...centres.values()],minX=Math.min(0,...all.map(p=>p.x))-geography.span,maxX=Math.max(0,...all.map(p=>p.x))+geography.span,minZ=Math.min(0,...all.map(p=>p.z))-geography.span;
    const bands=[...new Set(geography.levels.map(l=>l.band))];for(const band of bands){const y=band*geography.levelSpacing;addGuide({x:minX,y,z:flat?0:minZ},{x:maxX,y,z:flat?0:minZ});if(!geography.focused&&flat)label(geography.levels.filter(l=>l.band===band).map(l=>l.label).join(' / '),{x:minX+geography.span*.4,y:y+25,z:flat?0:minZ},geography.span,geography.span*.14,.8,'level');}
    for(const family of geography.segments){const members=family.ids.filter(id=>visibleIds.has(id));if(members.length<2)continue;const points=members.map(position),xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);const x1=Math.min(...xs)-10,x2=Math.max(...xs)+10,y1=Math.min(...ys)-12,y2=Math.max(...ys)+12,z1=Math.min(...zs)-12,z2=Math.max(...zs)+12;const corners=flat?[{x:x1,y:y1,z:0},{x:x2,y:y1,z:0},{x:x2,y:y2,z:0},{x:x1,y:y2,z:0}]:[{x:x1,y:y1,z:z1},{x:x2,y:y1,z:z1},{x:x2,y:y1,z:z2},{x:x1,y:y1,z:z2}];corners.forEach((p,i)=>addGuide(p,corners[(i+1)%4],familyVertices));if(geography.focused&&(geography.segments.length<=30||family.ids.includes(selected)))label(family.family.split(':')[0],{x:(x1+x2)/2,y:y2+12,z:flat?0:(z1+z2)/2},65,16,.65,'family');}
    for(const [v,c] of [[guideVertices,guideColor],[familyVertices,'#477783']]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));content.add(new T.LineSegments(g,new T.LineBasicMaterial({color:c,transparent:true,opacity:geography.focused&&v===guideVertices?.25:.65})));}
    if(geography.focused){const ghosts=new T.InstancedMesh(new T.IcosahedronGeometry(2,0),new T.MeshBasicMaterial({color:'#344555',transparent:true,opacity:.25}),graph.trail.nodes.length);graph.trail.nodes.forEach((id,i)=>{const p=(flat?geography.globalPositions2d:geography.globalPositions).get(id);matrix.identity().setPosition(p.x,p.y,p.z);ghosts.setMatrixAt(i,matrix);});content.add(ghosts);}
    if(geography.focused)for(const e of displayedEdges.filter(e=>trailEdges.has(e.id)&&e.semantics.grouping!=='source_statement').slice(0,35)){const a=position(e.data.from_id),b=position(e.data.to_id);label(model.label(e.data.relationship_type_id)+' · '+e.data.evidence+' / '+e.data.review_status,{x:(a.x+b.x)/2+30,y:(a.y+b.y)/2,z:(a.z+b.z)/2},100,30,.9,'edge',e.id);}
    const labelIds=geography.focused?graph.trail.nodes:graph.nodes.length<=25?graph.nodes.map(n=>n.id):selected?[selected]:[];
    [...new Set([...(selected?[selected]:[]),...labelIds])].slice(0,80).forEach(id=>{const p=position(id);if(p)label(id+' · '+title(model.byId.get(id)),{x:p.x,y:p.y+8,z:p.z},96,24,1,'node',id);});
    s.refreshDetailLabels=null;
    if(!geography.focused&&graph.nodes.length>25){
      const pool=Array.from({length:60},()=>label('',{x:0,y:0,z:0},96,24,1,'node',graph.nodes[0].id));
      s.refreshDetailLabels=()=>{const h=s.renderer.domElement.clientHeight,pixelsPerUnit=flat?h*s.camera.zoom/1400:h/(2*Math.tan(T.MathUtils.degToRad(24))*s.camera.position.distanceTo(s.controls.target));
        const candidates=pixelsPerUnit>.9?graph.nodes.filter(n=>n.id!==selected).map(n=>({n,p:new T.Vector3(...Object.values(position(n.id))).project(s.camera)})).filter(({p})=>p.z>-1&&p.z<1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.9).sort((a,b)=>a.p.x*a.p.x+a.p.y*a.p.y-b.p.x*b.p.x-b.p.y*b.p.y).slice(0,pool.length):[];
        pool.forEach((entry,i)=>{entry.active=!!candidates[i];if(!entry.active){entry.el.hidden=true;entry.leader.style.display='none';return;}const n=candidates[i].n,p=position(n.id);entry.id=n.id;entry.band=geography.meta.get(n.id).band;entry.anchor.set(p.x,p.y+8,p.z);entry.full=n.id+' · '+title(n);if(entry.el.textContent!==entry.full){entry.el.textContent=entry.full;entry.el.setAttribute('aria-label','Inspect '+n.id);}});
      };
    }
    if(selected&&!graph.selectedExcluded){const p=position(selected);const halo=new T.Mesh(new T.IcosahedronGeometry(7,1),new T.MeshBasicMaterial({color:'#ffffff',wireframe:true,depthTest:false}));halo.position.set(p.x,p.y,p.z);halo.renderOrder=10;content.add(halo);}
    if(geography.focused){const points=graph.trail.nodes.map(id=>position(id));const min=Math.min(...points.map(p=>p.x));for(const band of [...new Set(graph.trail.nodes.map(id=>geography.meta.get(id).band))]){const group=graph.trail.nodes.filter(id=>geography.meta.get(id).band===band),y=Math.max(...group.map(id=>position(id).y));label([...new Set(group.map(id=>model.label(geography.meta.get(id).level)))].join(' / '),{x:min-180,y:y+10,z:flat?0:position(group[0]).z},180,40,.9,'level');}}
    s.renderer.domElement.dataset.nodes=String(graph.nodes.length);s.renderer.domElement.dataset.edges=String(graph.edges.length);s.renderer.domElement.dataset.drawnEdges=String(displayedEdges.length);s.renderer.domElement.dataset.families=String(geography.families.size);s.renderer.domElement.dataset.symmetric=String(graph.edges.filter(e=>encoding(e).symmetric).length);s.renderer.domElement.dataset.arrows=String(arrows.length);s.render();s.renderer.domElement.dataset.updateMs=String(performance.now()-start);
  },[graph,geography,model,selected,colourBy,showCompanionLines]);
  useEffect(()=>{setHover('');const s=live.current;if(!s)return;const positions=flat?geography.positions2d:geography.positions,p=positions.get(selected),oldPosition=s.camera.position.clone(),oldTarget=s.controls.target.clone();
    const ids=action.type==='cascade'&&geography.focused?graph.trail.nodes:action.type==='focus'&&selected?graph.trail.nodes:graph.nodes.map(n=>n.id);
    if(['fit','home','top','side','front','cascade','focus'].includes(action.type)){
      const points=ids.map(id=>positions.get(id)).filter(Boolean);if(!flat&&!geography.focused&&!selected){for(const p of geography.centers.values())points.push({x:p.x,y:-geography.levelSpacing*.45,z:p.z});}if(!points.length)points.push({x:0,y:0,z:0});const box=new T.Box3().setFromPoints(points.map(p=>new T.Vector3(p.x,p.y,p.z))),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const aspect=s.renderer.domElement.clientWidth/s.renderer.domElement.clientHeight;
      s.controls.target.copy(center);if(flat){s.camera.position.set(center.x,center.y,12000);s.camera.zoom=Math.min(16,Math.max(.0001,Math.min(1400*aspect/(size.x+180),1400/(size.y+160))*.82));}
      else {const radius=Math.max(100,box.getBoundingSphere(new T.Sphere()).radius)/Math.sin(T.MathUtils.degToRad(24))/Math.min(1,aspect)*1.12;const direction=action.type==='top'?new T.Vector3(0,1,.001):action.type==='side'?new T.Vector3(1,.12,.02):action.type==='front'||geography.focused?new T.Vector3(.04,.12,1):new T.Vector3(.85,.65,1);direction.normalize();let distance=radius;
        if(!geography.focused){const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right),tan=Math.tan(T.MathUtils.degToRad(24));distance=120;for(const p of points){const d=new T.Vector3(p.x,p.y,p.z).sub(center),depth=d.dot(direction);distance=Math.max(distance,Math.abs(d.dot(right))/(tan*aspect)+depth,Math.abs(d.dot(up))/tan+depth);}distance=distance*1.15+120;}
        s.controls.maxDistance=Math.max(30000,distance*2);s.camera.far=Math.max(15000,distance+size.length()*2+1000);s.camera.position.copy(center).add(direction.multiplyScalar(distance));}
    }else if(action.type==='in'||action.type==='out'){if(flat)s.camera.zoom=Math.max(.0001,Math.min(40,s.camera.zoom*(action.type==='in'?1.25:.8)));else s.camera.position.sub(s.controls.target).multiplyScalar(action.type==='in'?.8:1.25).add(s.controls.target);}
    const next=s.camera.position.clone(),target=s.controls.target.clone();let frame;const start=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:260;
    const animate=()=>{const t=duration?Math.min(1,(performance.now()-start)/duration):1,ease=t*t*(3-2*t);s.camera.position.lerpVectors(oldPosition,next,ease);s.controls.target.lerpVectors(oldTarget,target,ease);s.camera.updateProjectionMatrix();s.controls.update();s.render();if(t<1)frame=requestAnimationFrame(animate);};animate();return()=>cancelAnimationFrame(frame);
  },[action,geography]);
  return <div className="l1-network-host" ref={host}>{graph.nodes.length>25&&<div className="l1-elevation-key"><strong>↑ Classified responsibility level</strong>{geography.levels.map(l=><span key={l.id}>{l.label}</span>)}</div>}{!geography.focused&&graph.nodes.length<=25&&<div className="l1-callout-key">Labels grouped by classified level · thin leaders point to stable global positions</div>}{failed&&<p role="alert" className="l1-fallback">{failed}</p>}{hover&&<div className="l1-hover" role="status">{hover}</div>}<div className="l1-hint">{flat?'Drag to pan · scroll to zoom · arrow keys pan · select to inspect':'Drag to rotate · right-drag to pan · scroll to zoom · arrow keys rotate/zoom · select to inspect'}</div></div>;
}
