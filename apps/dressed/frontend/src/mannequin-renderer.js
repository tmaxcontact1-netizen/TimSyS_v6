import { styleFor, slotFor } from "../../src/domain/garment/visual-style.ts";
// A small software 3D renderer: actual meshes, per-pixel depth and smooth curved-surface lighting.
// No network textures, GPU dependency, animation loop or external service.
const colours={black:[24,25,29],white:[235,232,224],grey:[127,131,139],navy:[28,43,76],blue:[54,109,177],brown:[108,72,47],beige:[205,189,157],red:[178,48,51],burgundy:[100,31,49],green:[62,115,74],yellow:[220,191,63],orange:[212,119,52],purple:[113,73,148],pink:[215,145,168],unknown:[133,142,145]};
const dummy={colour:[140,148,150],pattern:'solid'};
export function previewMaterial(appearance){
  const a=appearance||{},base=colours[a.primaryColour]||colours.unknown;
  let colour=[...base];
  if(!['black','white','unknown',undefined].includes(a.primaryColour)){
    const adjustment=a.lightness==='light'?.32:a.lightness==='dark'?-.25:0;
    colour=colour.map(v=>adjustment>0?v+(245-v)*adjustment:v*(1+adjustment));
  }
  if(a.saturation==='muted'){const mean=colour.reduce((n,v)=>n+v,0)/3;colour=colour.map(v=>v*.65+mean*.35);}
  return {colour,secondary:colours[a.secondaryColour]||null,pattern:a.pattern||'unknown'};
}
function colourAt(m,u,v){
  if(!m.secondary)return m.colour;
  const x=Math.floor(u*24),y=Math.floor(v*24);
  const accent=m.pattern==='striped'?y%6===0:m.pattern==='checked'?(x%6===0||y%6===0):m.pattern==='patterned'?(x%6===2&&y%6===2):false;
  return accent?m.secondary:m.colour;
}
export function mannequinMesh(items,skinColour=null){
  const skin=/^#[0-9a-fA-F]{6}$/.test(skinColour||'')?{colour:[1,3,5].map(i=>parseInt(skinColour.slice(i,i+2),16)),pattern:'solid'}:dummy;
  items=items.map(g=>({...g,slotId:slotFor(g),style:g.style||styleFor(g)?.id,visualStyle:g.visualStyle||{}}));
  const faces=[],bySlot=new Map(items.map(g=>[g.slotId,g]));
  const mat=slot=>bySlot.has(slot)?previewMaterial(bySlot.get(slot).appearance):dummy;
  const triangle=(a,b,c,colour)=>faces.push({points:[a,b,c],colour});
  const panel=(points,m)=>{for(let i=1;i<points.length-1;i++)triangle(points[0],points[i],points[i+1],m.colour);};
  // Elliptical cross-sections can bend, taper and open at the front.
  const tube=(rings,m,segments=36,open=false)=>{
    if(rings.length<10){
      rings=rings.flatMap((r,i)=>i===rings.length-1?[r]:Array.from({length:8},(_,step)=>r.map((v,k)=>v+(rings[i+1][k]-v)*step/8)));
    }
    // Smooth normals are shared by adjacent triangles, while each garment
    // surface keeps its own boundary. Compute once per vertex, not per pixel.
    const angles=rings.map((_,j)=>Array.from({length:segments+1},(_,i)=>{const gap=open?.125-.085*j/(rings.length-1):0,t=gap+(1-2*gap)*i/segments;return [Math.sin(t*Math.PI*2),Math.cos(t*Math.PI*2)];}));
    const vertices=rings.map((r,j)=>angles[j].map(([sin,cos])=>[r[0]+sin*r[3],r[1],r[2]+cos*r[4]]));
    const normals=rings.map((r,j)=>{
      return angles[j].map(([sin,cos],i)=>{
        const before=vertices[Math.max(0,j-1)][i],after=vertices[Math.min(rings.length-1,j+1)][i];
        const dx=after[0]-before[0],dy=after[1]-before[1],dz=after[2]-before[2];
        const n=[r[4]*sin*dy,-r[4]*sin*dx-r[3]*cos*dz,r[3]*cos*dy],length=Math.hypot(...n)||1;
        return n.map(v=>v/length);
      });
    });
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
      const u=i/segments;
      const a=vertices[j][i],b=vertices[j][i+1],c=vertices[j+1][i+1],d=vertices[j+1][i],colour=colourAt(m,u,j/(rings.length-1));
      faces.push({points:[a,b,c],colour,normals:[normals[j][i],normals[j][i+1],normals[j+1][i+1]]});
      faces.push({points:[a,c,d],colour,normals:[normals[j][i],normals[j+1][i+1],normals[j+1][i]]});
    }
  };
  const segment=(from,to,r1,r2,m,depth=1,steps=24)=>{
    const rings=Array.from({length:steps+1},(_,i)=>{const t=i/steps,r=r1+(r2-r1)*t;return [from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t,from[2]+(to[2]-from[2])*t,r,r*depth];});tube(rings,m);
  };
  const ellipsoid=(x,y,z,rx,ry,rz,m)=>tube(Array.from({length:25},(_,i)=>{const a=i*Math.PI/24;return [x,y+Math.cos(a)*ry,z,Math.max(.001,Math.sin(a)*rx),Math.max(.001,Math.sin(a)*rz)];}),m,36);
  const rod=(a,b,r,m)=>{
    const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d)||1,n=d.map(v=>v/len);
    const ref=Math.abs(n[1])<.9?[0,1,0]:[1,0,0];
    const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    let u=cross(n,ref);const ul=Math.hypot(...u);u=u.map(v=>v/ul);const v=cross(n,u);
    const point=(base,i)=>base.map((x,k)=>x+r*(u[k]*Math.cos(i*Math.PI/6)+v[k]*Math.sin(i*Math.PI/6)));
    for(let i=0;i<12;i++){const x=point(a,i),y=point(a,i+1),z=point(b,i+1),w=point(b,i);triangle(x,y,z,m.colour);triangle(x,z,w,m.colour);}
  };
  const ring=(x,y,z,rx,ry,m)=>{for(let i=0;i<24;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;rod([x+rx*Math.cos(a),y+ry*Math.sin(a),z],[x+rx*Math.cos(b),y+ry*Math.sin(b),z],.009,m);}};
  const box=(x,y,z,w,h,d,m)=>{
    const a=[x-w,y-h,z-d],b=[x+w,y-h,z-d],c=[x+w,y+h,z-d],e=[x-w,y+h,z-d],f=[x-w,y-h,z+d],g=[x+w,y-h,z+d],h1=[x+w,y+h,z+d],j=[x-w,y+h,z+d];
    for(const q of [[a,b,c,e],[f,g,h1,j],[a,f,j,e],[b,g,h1,c],[e,c,h1,j],[a,b,g,f]])panel(q,m);
  };
  // Neutral, featureless display mannequin. Height is arbitrary, not a body measurement.
  ellipsoid(0,3.61,0,.20,.28,.19,skin);
  // A tapered neck overlaps the head and flares into the collar naturally.
  tube([[0,3.43,-.015,.085,.085],[0,3.36,-.01,.09,.09],[0,3.28,0,.105,.10],[0,3.20,0,.14,.12]],skin);
  const top=mat(bySlot.has('top')?'top':'base_layer'),bottom=mat('bottom'),topStyle=bySlot.get('top')?.style;
  const shortSleeves=['tshirt','polo'].includes(topStyle);
  const coveredArms=bySlot.has('jacket')||bySlot.has('outerwear');
  tube([[0,3.25,0,.13,.12],[0,3.22,0,.20,.15],[0,3.17,0,coveredArms?.28:.34,.19],[0,3.07,0,coveredArms?.32:.44,.21],[0,2.92,0,coveredArms?.32:.43,.22],[0,2.55,0,.32,.19],[0,2.15,0,.32,.19]],coveredArms?mat(bySlot.has('outerwear')?'outerwear':'jacket'):top);
  if(coveredArms){
    for(let i=0;i<24;i++){
      const y=3.18-i*.042;
      panel([[-.125,y,.242],[.125,y,.242],[.125,y-.042,.242],[-.125,y-.042,.242]],{colour:colourAt(top,.5,i/24)});
    }
  }
  ellipsoid(0,2.05,0,.34,.22,.20,bottom);
  for(const side of [-1,1]){
    segment([side*.18,2.07,0],[side*.19,1.18,0],.17,.13,bottom,1.1);
    segment([side*.19,1.18,0],[side*.20,.30,0],.13,.10,bottom,1.1);
    segment([side*.20,.36,0],[side*.20,.20,0],.105,.105,bySlot.has('socks')?mat('socks'):bottom);
    const shoe=bySlot.get('footwear')?.style;
    ellipsoid(side*.20,.17,.12,.145,.13,shoe==='sneakers'?.30:.28,mat('footwear'));
    if(shoe==='boots')segment([side*.20,.24,0],[side*.20,.60,0],.125,.12,mat('footwear'));
    if(shoe==='sneakers')box(side*.20,.09,.12,.14,.035,.27,{colour:[210,210,202]});
    if(shoe==='loafers')rod([side*.10,.26,.21],[side*.30,.26,.21],.018,mat('footwear'));
    if(shoe==='dress-shoes')for(let y=0;y<3;y++)rod([side*.20-.06,.27,.08+y*.04],[side*.20+.06,.27,.08+y*.04],.006,{colour:[37,35,34]});
    if(!coveredArms){
      // Rounded sleeve cap closes the old open-cylinder shoulder seam.
      tube([[side*.39,3.18,0,.025,.06],[side*.43,3.14,0,.105,.12],[side*.46,3.06,0,.145,.15],[side*.50,2.92,0,.135,.14],[side*.53,2.75,0,.12,.12]],top);
      segment([side*.53,2.75,0],[side*.57,2.56,0],.12,.115,shortSleeves?skin:top);
      segment([side*.57,2.56,0],[side*.63,2.08,.02],.115,.085,shortSleeves?skin:top);
    }
    ellipsoid(side*.65,1.96,.02,.085,.14,.08,skin);
  }
  if(bySlot.has('belt')){
    tube([[0,2.20,0,.342,.203],[0,2.13,0,.342,.203]],mat('belt'));
    panel([[-.055,2.20,.21],[.055,2.20,.21],[.055,2.13,.21],[-.055,2.13,.21]],{colour:[175,174,161]});
  }
  const waist=bySlot.has('waistcoat');
  if(waist){tube([[0,3.04,0,.39,.235],[0,2.74,0,.37,.23],[0,2.18,0,.35,.215]],mat('waistcoat'),24,true);}
  for(const jacket of ['jacket','outerwear'])if(bySlot.has(jacket)){
    const item=bySlot.get(jacket),style=item.style,m=mat(jacket),outer=jacket==='outerwear',thick=outer?.085:style==='sports-jacket'?.025:style==='suit-jacket'?-.012:0;
    const hem=({overcoat:1.05,trench:1.10,raincoat:1.25,parka:1.55,puffer:1.85,bomber:2.05,denim:2.02,'leather-jacket':2.02})[style]??2.02;
    const closed=item.visualStyle.closure==='closed',tailored=!['parka','puffer','bomber','denim','leather-jacket','raincoat'].includes(style);
    const layerM=style==='puffer'?{...m,pattern:'striped',secondary:m.colour.map(v=>v*.73)}:m;
    tube([[0,3.25,0,.14,.14+thick],[0,3.23,0,.23+thick*.3,.18+thick],[0,3.17,0,.37+thick*.7,.22+thick],[0,3.06,0,.465+thick,.24+thick],[0,2.94,0,.455+thick,.25+thick],[0,2.55,0,.375+thick,.23+thick],[0,hem,0,.39+thick,.23+thick]].map(([x,y,z,rx,rz])=>[x,y+(outer?.035:0),z,rx,rz]),layerM,32,!closed);
    for(const side of [-1,1]){
      if(outer||!bySlot.has('outerwear')){
      tube([[side*(.39+thick),3.20,0,.025,.065],[side*(.44+thick),3.16,0,.105+thick*.3,.13+thick*.3],[side*(.47+thick),3.07,0,.155+thick*.5,.16+thick*.5],[side*(.51+thick),2.91,0,.15+thick*.5,.15+thick*.5],[side*(.59+thick),2.57,0,.13+thick*.5,.13+thick*.5]],layerM);
      segment([side*(.59+thick),2.57,0],[side*.65,2.09,.02],.13+thick*.5,.095+thick*.5,layerM);
      }
      if(tailored)panel([[side*.14,3.19,.26+thick],[side*.30,3.03,.25+thick],[side*.18,2.65,.27+thick],[side*.09,2.91,.28+thick]],{colour:m.colour.map(v=>v*1.12)});
      else box(side*.12,3.17,.15+thick,.10,.055,.10,m);
    }
    if(['parka','raincoat'].includes(style))ellipsoid(0,3.22,-.14,.24,.17,.13,m);
    if(['bomber','puffer'].includes(style))tube([[0,hem+.06,0,.40+thick,.24+thick],[0,hem,0,.40+thick,.24+thick]],{colour:m.colour.map(v=>v*.7)});
    if(['denim','leather-jacket'].includes(style))for(const side of [-1,1])box(side*.25,2.90,.27+thick,.09,.08,.012,{colour:m.colour.map(v=>v*.82)});
    for(const y of [2.53,2.35])ellipsoid(closed?.04:.20,y,.25+thick,.022,.022,.012,{colour:[54,51,48]});
    if(style==='sports-jacket')for(const side of [-1,1])box(side*.27,2.35,.245+thick,.09,.10,.012,{colour:m.colour.map(v=>v*.92)});
    if(style==='blazer')for(const y of [2.53,2.35])ellipsoid(.20,y,.27,.023,.023,.012,{colour:[176,153,91]});
    if(style==='trench'){
      tube([[0,2.25,0,.47,.34],[0,2.18,0,.47,.34]],m,32,!closed);
      for(const x of [-.14,.14])for(const y of [2.75,2.50,2.25])ellipsoid(x,y,.34,.018,.018,.012,{colour:[65,57,46]});
    }
    if(jacket==='jacket'&&bySlot.has('pocket_square')){
      panel([[.24,2.93,.28],[.28,3.02,.28],[.32,2.97,.28],[.36,3.01,.28],[.36,2.89,.28],[.24,2.89,.28]],mat('pocket_square'));
      panel([[.22,2.91,.29],[.38,2.91,.29],[.38,2.88,.29],[.22,2.88,.29]],m);
    }
  }
  if(bySlot.has('top')&&!['tshirt','sweater'].includes(topStyle)){
    tube([[0,3.28,0,.115,.115],[0,3.20,0,.135,.135]],top,36,true);
    for(const side of [-1,1])panel([[side*.02,3.20,.25],[side*.10,3.24,.24],[side*.13,3.09,.27],[side*.06,3.06,.275]],top);
  }
  const neck=bySlot.get('neckwear')?.style||'tie';
  if(bySlot.has('neckwear')&&bySlot.has('top')&&neck==='tie'){
    const m=mat('neckwear');
    panel([[-.045,3.16,.245],[.045,3.16,.245],[.026,3.06,.26],[-.026,3.06,.26]],m);
    for(let i=0;i<20;i++){
      const y=3.06-i*.028,w=.025+(i/20)*.035;
      panel([[-w,y,.265],[w,y,.265],[w+.002,y-.028,.265],[-w-.002,y-.028,.265]],{colour:colourAt(m,.5,i/20)});
    }
    panel([[-.06,2.50,.265],[.06,2.50,.265],[0,2.42,.27]],m);
  }
  if(bySlot.has('neckwear')&&bySlot.has('top')&&neck==='bow-tie'){
    const m=mat('neckwear');panel([[-.03,3.14,.29],[-.15,3.22,.29],[-.15,3.06,.29]],m);panel([[.03,3.14,.29],[.15,3.22,.29],[.15,3.06,.29]],m);box(0,3.14,.30,.035,.035,.018,m);
  }
  if(bySlot.has('neckwear')&&bySlot.has('top')&&neck==='cravat'){
    const m=mat('neckwear');ellipsoid(0,3.15,.20,.09,.07,.065,m);panel([[-.07,3.14,.285],[.07,3.14,.285],[.12,2.82,.285],[0,2.74,.29],[-.12,2.82,.285]],m);
  }
  if(bySlot.has('headwear')){
    const style=bySlot.get('headwear').style,m=mat('headwear');
    if(style==='beanie'){ellipsoid(0,3.85,0,.22,.18,.20,m);tube([[0,3.78,0,.222,.202],[0,3.72,0,.222,.202]],m);}
    else if(style==='cap'||style==='flat-cap'){ellipsoid(0,3.86,style==='flat-cap'?.04:0,.22,style==='flat-cap'?.10:.16,.21,m);ellipsoid(0,3.78,.22,.21,.018,.21,m);}
    else {ellipsoid(0,3.79,0,.35,.025,.30,m);tube([[0,3.79,0,.22,.19],[0,4.00,0,.19,.17],[0,4.02,0,.001,.001]],m);}
  }
  if(bySlot.has('eyewear')){
    const g=bySlot.get('eyewear'),m=mat('eyewear');
    for(const side of [-1,1]){if(g.style==='sunglasses')ellipsoid(side*.095,3.65,.181,.075,.045,.015,{colour:[27,32,36]});ring(side*.095,3.65,.201,.079,.05,m);rod([side*.17,3.65,.19],[side*.20,3.65,-.09],.009,m);}
    rod([-.025,3.65,.20],[.025,3.65,.20],.009,m);
  }
  if(bySlot.has('scarf')){
    const m=mat('scarf');tube([[0,3.30,0,.15,.18],[0,3.17,0,.17,.22]],m);box(.13,2.89,.39,.07,.30,.025,m);box(-.12,2.99,.39,.065,.21,.025,m);
  }
  for(const slot of ['watch','bracelet','ring'])if(bySlot.has(slot)){
    const g=bySlot.get(slot),side=g.visualStyle.side==='right'?-1:1,m=mat(slot),x=side*.64;
    if(slot==='ring'){ring(x,1.96,.105,.035,.025,m);}
    else {tube([[x,2.15,.02,.10,.10],[x,2.09,.02,.10,.10]],m);if(slot==='watch'){ellipsoid(x,2.12,.125,.045,.055,.014,m);ellipsoid(x,2.12,.14,.032,.040,.008,{colour:[227,224,209]});rod([x,2.12,.15],[x+.018,2.14,.15],.004,{colour:[30,31,32]});}}
  }
  if(bySlot.has('gloves'))for(const side of [-1,1])ellipsoid(side*.65,1.96,.02,.092,.15,.09,mat('gloves'));
  if(bySlot.has('tie_clip')&&bySlot.has('neckwear')&&neck==='tie')box(0,2.85,.30,.064,.012,.013,mat('tie_clip'));
  if(bySlot.has('cufflinks')&&bySlot.has('top')&&!shortSleeves&&bySlot.get('top').visualStyle.cuffs!=='button')for(const side of [-1,1])ellipsoid(side*.66,2.10,.12,.028,.022,.015,mat('cufflinks'));
  if(bySlot.has('lapel_pin')&&bySlot.has('jacket'))ellipsoid(.22,3.02,.31,.035,.035,.015,mat('lapel_pin'));
  if(bySlot.has('necklace')){
    const m=mat('necklace');for(let i=0;i<20;i++){const x=-.13+i*.013,xx=x+.013;rod([x,3.18-.20*(1-(x/.13)**2),.32],[xx,3.18-.20*(1-(xx/.13)**2),.32],.006,m);}ellipsoid(0,2.95,.33,.025,.035,.01,m);
  }
  if(bySlot.has('earrings'))for(const side of [-1,1])ring(side*.20,3.50,.02,.025,.04,mat('earrings'));
  if(bySlot.has('suspenders')&&bySlot.has('bottom'))for(const side of [-1,1])box(side*.20,2.66,.238,.025,.43,.006,mat('suspenders'));
  if(bySlot.has('bag')){
    const g=bySlot.get('bag'),m=mat('bag'),side=g.visualStyle.side==='right'?-1:1;
    if(g.style==='backpack'){box(0,2.70,-.40,.32,.40,.16,m);for(const a of [-1,1])rod([a*.28,3.14,-.20],[a*.30,2.45,.30],.025,m);}
    else if(g.style==='shoulder-bag'){box(side*.52,2.06,.05,.20,.25,.12,m);rod([-side*.30,3.12,.38],[side*.51,2.25,.38],.025,m);}
    else {box(side*.72,1.45,.04,.29,.22,.10,m);ring(side*.72,1.77,.04,.12,.09,m);}
  }
  if(bySlot.has('umbrella')){const g=bySlot.get('umbrella'),side=g.visualStyle.side==='right'?-1:1,m=mat('umbrella');rod([side*.82,1.95,.03],[side*.82,.30,.03],.028,m);ellipsoid(side*.82,1.0,.03,.09,.55,.09,m);ring(side*.76,1.99,.03,.06,.09,m);}
  return faces;
}
export function renderMannequin(canvas,faces,angle,zoom){
  const ctx=canvas.getContext('2d');if(!ctx)return false;
  const width=canvas.clientWidth||520,height=canvas.clientHeight||540,dpr=2;
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.scale(dpr,dpr);
  const bg=ctx.createLinearGradient(0,0,0,height);bg.addColorStop(0,'#23303a');bg.addColorStop(1,'#10171e');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  const scale=Math.min(width*.56,height*.225)*zoom,rad=angle*Math.PI/180;
  const rotate=([x,y,z])=>[x*Math.cos(rad)+z*Math.sin(rad),y-2,z*Math.cos(rad)-x*Math.sin(rad)];
  const project=([x,y,z])=>{const p=7/(7-z);return [width/2+x*scale*p,height*.48-y*scale*p];};
  const floor=project([0,-2,0]);ctx.fillStyle='#080e13';ctx.beginPath();ctx.ellipse(floor[0],floor[1]+5,scale*.68,scale*.13,0,0,Math.PI*2);ctx.fill();
  // Per-pixel depth keeps overlapping lapels, shirt and pocket square in order.
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),depth=new Float32Array(canvas.width*canvas.height);
  const edge=(a,b,x,y)=>(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);
  for(const face of faces){
    const points=face.points.map(rotate),[a,b,c]=points,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...normal)||1;
    const light=.68+.32*Math.abs((normal[0]*-.4+normal[1]*.65+normal[2]*.65)/length);
    const lights=face.normals?.map(n=>{
      const x=n[0]*Math.cos(rad)+n[2]*Math.sin(rad),z=n[2]*Math.cos(rad)-n[0]*Math.sin(rad);
      return .68+.32*Math.abs(x*-.4+n[1]*.65+z*.65);
    });
    const rgb=face.colour.map(v=>Math.min(255,Math.round(v*light)));
    const screen=points.map(p=>project(p).map(v=>v*dpr)),[sa,sb,sc]=screen,area=edge(sa,sb,sc[0],sc[1]);
    if(Math.abs(area)<.001)continue;
    const x0=Math.max(0,Math.floor(Math.min(...screen.map(p=>p[0])))),x1=Math.min(canvas.width-1,Math.ceil(Math.max(...screen.map(p=>p[0]))));
    const y0=Math.max(0,Math.floor(Math.min(...screen.map(p=>p[1])))),y1=Math.min(canvas.height-1,Math.ceil(Math.max(...screen.map(p=>p[1]))));
    const q=points.map(p=>1/(7-p[2]));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const wa=edge(sb,sc,x+.5,y+.5)/area,wb=edge(sc,sa,x+.5,y+.5)/area,wc=1-wa-wb;
      if(wa<-.00001||wb<-.00001||wc<-.00001)continue;
      const z=wa*q[0]+wb*q[1]+wc*q[2],index=y*canvas.width+x;
      if(z<=depth[index])continue;depth[index]=z;
      const shade=lights?(wa*q[0]*lights[0]+wb*q[1]*lights[1]+wc*q[2]*lights[2])/z:null;
      for(let channel=0;channel<3;channel++)pixels.data[index*4+channel]=shade===null?rgb[channel]:Math.min(255,Math.round(face.colour[channel]*shade));
      pixels.data[index*4+3]=255;
    }
  }
  ctx.putImageData(pixels,0,0);
  return true;
}
