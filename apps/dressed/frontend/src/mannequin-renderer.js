import { styleFor, slotFor } from "../../../../platform/services/dressed/src/domain/garment/visual-style.ts";
// A small software 3D renderer: actual meshes, per-pixel depth and smooth curved-surface lighting.
// No network textures, GPU dependency, animation loop or external service.
const colours={black:[24,25,29],white:[235,232,224],grey:[127,131,139],navy:[28,43,76],blue:[54,109,177],brown:[108,72,47],beige:[205,189,157],red:[178,48,51],burgundy:[100,31,49],green:[62,115,74],yellow:[220,191,63],orange:[212,119,52],purple:[113,73,148],pink:[215,145,168],unknown:[133,142,145]};
const dummy={colour:[140,148,150],pattern:'solid',finish:'matte'};
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
export function garmentPreviewMaterial(garment){
  const m=previewMaterial(garment.appearance),slot=slotFor(garment);
  const description=`${garment.name||''} ${garment.notes||''}`.toLowerCase();
  m.finish=['footwear','belt','bag'].includes(slot)?'leather':['neckwear','pocket_square'].includes(slot)?'silk':'cloth';
  m.variant=m.pattern==='patterned'?(/paisley/.test(description)?'paisley':/floral|flower|petal/.test(description)?'floral':/dot|spot|circle/.test(description)?'dots':'motif'):m.pattern;
  m.repeat=slot==='neckwear'?.06:slot==='pocket_square'?.04:m.pattern==='striped'?.075:.075;
  if(/fine|tight|subtle|small/.test(description))m.repeat*=.65;
  m.diagonal=slot==='neckwear'||slot==='pocket_square';
  m.gingham=m.pattern==='checked'&&slot==='top'&&!/windowpane|window pane/.test(description);
  m.textured=garment.appearance?.texture==='textured';
  if(m.secondary)m.ramp=Array.from({length:65},(_,i)=>m.colour.map((v,c)=>v+(m.secondary[c]-v)*i/64));
  return m;
}
const fract=x=>x-Math.floor(x);
const soft=(distance,width,edge=.035)=>Math.max(0,Math.min(1,(width+edge-distance)/(2*edge)));
export function patternColourAt(m,u,v){
  if(!m.secondary||!m.ramp)return m.colour;
  const repeat=m.repeat||.1,x=u/repeat,y=v/repeat;
  let ink=0;
  if(m.pattern==='striped'){
    const phase=fract(m.diagonal?x+y:x);
    ink=soft(Math.min(phase,1-phase),m.diagonal?.13:.075);
  }else if(m.pattern==='checked'){
    const fx=fract(x),fy=fract(y);
    if(m.gingham){const a=soft(Math.abs(fx-.5),.25),b=soft(Math.abs(fy-.5),.25);ink=.43*(a+b)+.14*a*b;}
    else{const a=soft(Math.min(fx,1-fx),.055),b=soft(Math.min(fy,1-fy),.055);ink=Math.max(a,b)*.85;}
  }else if(m.pattern==='patterned'){
    const row=Math.floor(y),xx=fract(x+(row%2)*.5)-.5,yy=fract(y)-.5;
    const r=Math.hypot(xx,yy);
    if(m.variant==='dots')ink=soft(r,.13);
    else if(m.variant==='floral'){
      const petals=.20+.075*Math.cos(Math.atan2(yy,xx)*5);
      ink=soft(r,petals)*.88;
      if(r<.065)ink=.25;
    }else if(m.variant==='paisley'){
      // Curved teardrop outline and inner seed; a motif, not a copied print.
      const bend=xx-.11*Math.sin((yy+.25)*5),radius=.19*(1-(yy+.35)/.8);
      const outer=soft(Math.abs(bend),Math.max(.015,radius));
      const inner=soft(Math.abs(bend),Math.max(0,radius-.05));
      ink=(outer-inner*.85)*soft(Math.abs(yy),.32);
      ink=Math.max(ink,soft(Math.hypot(xx+.01,yy+.15),.055));
    }else ink=soft(Math.abs(xx)+Math.abs(yy),.19);
  }
  return m.ramp[Math.round(Math.max(0,Math.min(1,ink))*64)];
}
const colourAt=patternColourAt;
// One cross-section definition drives the shell, opening and lapels so the
// chest layers cannot drift apart when the garment shape changes.
function profileAt(rings,y){
  let i=rings.findIndex((r,j)=>j<rings.length-1&&y<=r[1]&&y>=rings[j+1][1]);
  if(i<0)return y>rings[0][1]?rings[0]:rings[rings.length-1];
  const a=rings[Math.max(0,i-1)],b=rings[i],c=rings[i+1],d=rings[Math.min(rings.length-1,i+2)],t=(b[1]-y)/(b[1]-c[1]);
  return b.map((v,k)=>k===1?y:.5*(2*v+(-a[k]+c[k])*t+(2*a[k]-5*v+4*c[k]-d[k])*t*t+(-a[k]+3*v-3*c[k]+d[k])*t*t*t));
}
export function mannequinMesh(items,skinColour=null,bodyType='male'){
  const skin=/^#[0-9a-fA-F]{6}$/.test(skinColour||'')?{colour:[1,3,5].map(i=>parseInt(skinColour.slice(i,i+2),16)),pattern:'solid'}:dummy;
  items=items.map(g=>({...g,slotId:slotFor(g),style:g.style||styleFor(g)?.id,visualStyle:g.visualStyle||{}}));
  const faces=[],bySlot=new Map(items.map(g=>[g.slotId,g]));
  const materials=new Map();
  const mat=slot=>{if(!materials.has(slot))materials.set(slot,bySlot.has(slot)?garmentPreviewMaterial(bySlot.get(slot)):dummy);return materials.get(slot);};
  const triangle=(a,b,c,colour)=>faces.push({points:[a,b,c],colour});
  const panel=(points,m)=>{for(let i=1;i<points.length-1;i++){const p=[points[0],points[i],points[i+1]];faces.push({points:p,colour:m.colour,material:m,uv:p.map(v=>[v[0],v[1]])});}};
  // Elliptical cross-sections can bend, taper and open at the front.
  const tube=(rings,m,segments=36,open=false)=>{
    if(rings.length<12){
      // Cubic profiles round transitions at the chest, elbows and knees rather
      // than leaving a stack of straight conical sections. Keep height monotone.
      const source=rings;
      rings=source.flatMap((r,i)=>i===source.length-1?[r]:Array.from({length:6},(_,step)=>{
        const t=step/6,a=source[Math.max(0,i-1)],b=r,c=source[i+1],d=source[Math.min(source.length-1,i+2)];
        return r.map((v,k)=>k===1?v+(c[k]-v)*t:k>=3?Math.max(.001,.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)):.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t));
      }));
    }
    // Smooth normals are shared by adjacent triangles, while each garment
    // surface keeps its own boundary. Compute once per vertex, not per pixel.
    const angles=rings.map((_,j)=>Array.from({length:segments+1},(_,i)=>{const gap=typeof open==='function'?open(rings[j][1]):open?.125-.085*j/(rings.length-1):0,t=gap+(1-2*gap)*i/segments;return [Math.sin(t*Math.PI*2),Math.cos(t*Math.PI*2)];}));
    const vertices=rings.map((r,j)=>angles[j].map(([sin,cos])=>[r[0]+sin*r[3],r[1],r[2]+cos*r[4]+(m.crease||0)*Math.pow(Math.max(0,cos),24)]));
    const normals=rings.map((r,j)=>{
      return angles[j].map(([sin,cos],i)=>{
        const before=vertices[Math.max(0,j-1)][i],after=vertices[Math.min(rings.length-1,j+1)][i];
        const dx=after[0]-before[0],dy=after[1]-before[1],dz=after[2]-before[2];
        const sign=dy<0?-1:1,n=[sign*r[4]*sin*dy,sign*(-r[4]*sin*dx-r[3]*cos*dz),sign*r[3]*cos*dy],length=Math.hypot(...n)||1;
        return n.map(v=>v/length);
      });
    });
    const fabricRadius=Math.max(...rings.map(r=>r[3]));
    const uv=vertices.map((row,j)=>row.map((p,i)=>{
      const [sin,cos]=angles[j][i];
      // A continuous seam around the back, not down the visible shirt front.
      const angle=Math.atan2(sin,cos);
      return [angle*fabricRadius,p[1]];
    }));
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
      const a=vertices[j][i],b=vertices[j][i+1],c=vertices[j+1][i+1],d=vertices[j+1][i];
      // Unwrap the back seam locally to avoid interpolating across a whole repeat.
      const coords=[uv[j][i],uv[j][i+1],uv[j+1][i+1],uv[j+1][i]].map(v=>[...v]);
      if(coords.some(v=>v[0]<0)&&coords.some(v=>v[0]>.3))for(let k=0;k<4;k++)if(coords[k][0]<0)coords[k][0]+=Math.PI*2*fabricRadius;
      const colour=colourAt(m,coords[0][0],coords[0][1]);
      faces.push({points:[a,b,c],colour,material:m,uv:[coords[0],coords[1],coords[2]],normals:[normals[j][i],normals[j][i+1],normals[j+1][i+1]]});
      faces.push({points:[a,c,d],colour,material:m,uv:[coords[0],coords[2],coords[3]],normals:[normals[j][i],normals[j+1][i+1],normals[j+1][i]]});
    }
  };
  const segment=(from,to,r1,r2,m,depth=1,steps=24)=>{
    const rings=Array.from({length:steps+1},(_,i)=>{const t=i/steps,r=r1+(r2-r1)*t;return [from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t,from[2]+(to[2]-from[2])*t,r,r*depth];});tube(rings,m);
  };
  const ellipsoid=(x,y,z,rx,ry,rz,m)=>{const steps=ry<.08?12:24;return tube(Array.from({length:steps+1},(_,i)=>{const a=i*Math.PI/steps;return [x,y+Math.cos(a)*ry,z,Math.max(.001,Math.sin(a)*rx),Math.max(.001,Math.sin(a)*rz)];}),m,ry<.08?20:36);};
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
  // Sculpted but featureless head: brow, jaw and chin instead of an egg.
  tube([[0,3.93,-.025,.001,.001],[0,3.90,-.025,.085,.095],[0,3.85,-.02,.15,.15],[0,3.79,-.012,.181,.178],[0,3.64,.005,.18,.18],[0,3.54,.025,.145,.15],[0,3.43,.04,.105,.105],[0,3.40,.02,.001,.001]],skin,40);
  for(const side of [-1,1])ellipsoid(side*.181,3.62,-.006,.025,.064,.035,skin);
  // A tapered neck overlaps the head and flares into the collar naturally.
  tube([[0,3.43,-.015,.085,.085],[0,3.36,-.01,.09,.09],[0,3.28,0,.105,.10],[0,3.20,0,.14,.12]],skin);
  const top=mat(bySlot.has('top')?'top':'base_layer'),bottom=mat('bottom'),topStyle=bySlot.get('top')?.style;
  const shortSleeves=['tshirt','polo'].includes(topStyle);
  const coveredArms=bySlot.has('jacket')||bySlot.has('outerwear');
  // A complete fitted shirt sits underneath the jacket, with a rounded chest.
  tube([[0,3.25,0,.13,.12],[0,3.19,-.005,.31,.16],[0,3.10,0,.425,.205],[0,2.94,.005,.415,.23],[0,2.72,0,.365,.205],[0,2.40,0,.325,.184],[0,2.15,0,.335,.19]].map((r,i)=>coveredArms&&i?[r[0],r[1],r[2],r[3]*.90,r[4]]:r),top);
  if(bySlot.has('top')&&!['tshirt','sweater'].includes(topStyle)){
    // The shirt placket follows the chest instead of floating as a rectangle.
    for(const [y,z] of [[3.00,.237],[2.86,.23],[2.70,.212],[2.54,.201],[2.37,.193]]){
      ellipsoid(.012,y,z,.009,.009,.004,{colour:top.colour.map(v=>Math.min(245,v*1.08))});
    }
  }
  tube([[0,2.20,-.01,.335,.205],[0,2.10,-.01,.35,.225],[0,2.02,-.01,.345,.215],[0,1.96,-.01,.325,.175]],bottom);
  for(const side of [-1,1]){
    // Gentle knee and ankle changes give the trousers a tailored drape.
    tube([[side*.178,2.08,0,.177,.198],[side*.18,1.85,0,.174,.184],[side*.19,1.55,.012,.149,.153],[side*.20,1.19,.025,.127,.135],[side*.205,1.04,.015,.132,.14],[side*.21,.72,0,.116,.123],[side*.21,.39,.01,.105,.112],[side*.21,.29,.025,.111,.12]],{...bottom,crease:.007});
    segment([side*.21,.33,0],[side*.21,.18,0],.088,.087,bySlot.has('socks')?mat('socks'):bottom);
    const shoe=bySlot.get('footwear')?.style,shoeM=mat('footwear'),sneaker=shoe==='sneakers';
    // Flat sole, shaped toe box, raised instep and a distinct heel.
    tube([[side*.21,.065,.13,.123,.255],[side*.21,.10,.13,.133,.265],[side*.21,.15,.135,.13,.26],[side*.21,.205,.10,.118,.215],[side*.21,.25,.035,.099,.14],[side*.21,.28,-.015,.083,.09]],shoeM,40);
    tube([[side*.21,.055,.13,.127,.259],[side*.21,.09,.13,.132,.266]],{colour:sneaker?[198,198,191]:shoeM.colour.map(v=>v*.48)},40);
    tube([[side*.21,.035,-.045,.09,.085],[side*.21,.08,-.045,.105,.10]],{colour:shoeM.colour.map(v=>v*.45)},28);
    if(shoe==='boots')segment([side*.21,.24,0],[side*.21,.60,0],.112,.105,shoeM);
    if(shoe==='loafers')rod([side*.21-.09,.215,.14],[side*.21+.09,.215,.14],.012,{colour:shoeM.colour.map(v=>v*.72)});
    if(shoe==='dress-shoes'||sneaker)for(let i=0;i<4;i++)rod([side*.21-.038,.249-i*.007,.04+i*.025],[side*.21+.038,.249-i*.007,.04+i*.025],.004,{colour:shoeM.colour.map(v=>v*.5)});
    if(!coveredArms){
      tube([[side*.365,3.17,-.005,.035,.07],[side*.43,3.11,0,.113,.13],[side*.47,3.01,0,.132,.146],[side*.51,2.82,0,.12,.13],[side*.55,2.60,.01,.108,.112]],top);
      segment([side*.55,2.60,.01],[side*.60,2.32,.015],.108,.085,shortSleeves?skin:top);
      segment([side*.60,2.32,.015],[side*.63,2.08,.02],.085,.073,shortSleeves?skin:top);
    }
    // A flattened palm and tucked thumb read as a mannequin hand, not a ball.
    ellipsoid(side*.65,1.995,.018,.064,.10,.049,skin);
    for(let finger=0;finger<4;finger++)ellipsoid(side*.65+(finger-1.5)*.025,1.905+Math.abs(finger-1.5)*.01,.022,.014,.057,.028,skin);
    ellipsoid(side*.589,2.015,.045,.026,.067,.031,skin);
    if(bySlot.has('top')&&!shortSleeves){
      tube([[side*.64,2.13,.02,.089,.09],[side*.65,2.075,.02,.087,.087]],top);
    }
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
    const layerM=style==='puffer'?{...m,textured:true}:m;
    const body=[[0,3.255,0,.125,.13+thick],[0,3.205,-.012,.27+thick,.19+thick],[0,3.12,-.008,.425+thick,.245+thick],[0,2.98,0,.45+thick,.275+thick],[0,2.77,0,.408+thick,.255+thick],[0,2.53,0,.37+thick,.232+thick],[0,hem,0,.415+thick,.26+thick]];
    const openingX=y=>y>3.17?.095:y>2.93?.095+(3.17-y)*.19:y>2.57?(closed?.008:.065)+(y-2.57)*(closed?.37:.21):closed?.008:.065+(2.57-y)*.10;
    const surface=(x,y,offset=0)=>{const r=profileAt(body,y);return r[2]+r[4]*Math.sqrt(Math.max(.02,1-(x/r[3])**2))+offset;};
    const opening=y=>Math.asin(Math.min(.95,openingX(y)/profileAt(body,y)[3]))/(2*Math.PI);
    tube(body,layerM,48,tailored?opening:!closed);
    const lapelStrip=(side,rows,material)=>{
      const verts=[];
      for(let r=0;r<rows.length-1;r++)for(let step=0;step<5;step++){
        const t=step/5;verts.push(rows[r].map((v,k)=>v+(rows[r+1][k]-v)*t));
      }
      verts.push(rows[rows.length-1]);
      const points=verts.map(([y,inner,outer])=>Array.from({length:5},(_,j)=>{
        inner=openingX(y)+.002;outer=Math.max(outer,inner+.022);const x=side*(inner+(outer-inner)*j/4);return [x,y,surface(x,y,.012+.021*Math.sin(j*Math.PI/4))];
      }));
      const shading=points.map((row,r)=>row.map((p,j)=>{
        const l=row[Math.max(0,j-1)],q=row[Math.min(4,j+1)],a=points[Math.max(0,r-1)][j],b=points[Math.min(points.length-1,r+1)][j];
        const u=q.map((v,k)=>v-l[k]),v=b.map((x,k)=>x-a[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n)||1,sign=n[2]<0?-1:1;
        return n.map(x=>sign*x/length);
      }));
      // A fine seam distinguishes the turned lapel from the jacket front.
      for(let r=0;r<points.length-1;r++)rod(points[r][4],points[r+1][4],.0025,{colour:m.colour.map(v=>v*.62)});
      for(let r=0;r<points.length-1;r++)for(let j=0;j<4;j++){
        const p=[points[r][j],points[r][j+1],points[r+1][j+1],points[r+1][j]];
        for(const indices of [[0,1,2],[0,2,3]]){
          const tri=indices.map(i=>p[i]);
          const cornerNormals=[shading[r][j],shading[r][j+1],shading[r+1][j+1],shading[r+1][j]];
          const normals=indices.map(i=>cornerNormals[i]);
          faces.push({points:tri,colour:material.colour,material,uv:tri.map(v=>[v[0],v[1]]),normals});
        }
      }
    };
    for(const side of [-1,1]){
      if(outer||!bySlot.has('outerwear')){
      tube([[side*(.36+thick),3.19,0,.025,.07],[side*(.425+thick),3.14,0,.105+thick*.3,.13+thick*.3],[side*(.465+thick),3.045,0,.142+thick*.5,.157+thick*.5],[side*(.50+thick),2.86,0,.132+thick*.5,.144+thick*.5],[side*(.56+thick*.5),2.60,.012,.112+thick*.5,.122+thick*.5],[side*.59,2.40,.018,.104+thick*.5,.108+thick*.5],[side*.64,2.14,.02,.088+thick*.5,.094+thick*.5]],layerM,36);
      // Sleeve button row and a small cuff seam.
      if(tailored)for(let i=0;i<3;i++)ellipsoid(side*.68,2.19+i*.035,.09,.009,.009,.006,{colour:m.colour.map(v=>v*.6)});
      }
      if(tailored){
        const lapel={...m,colour:m.colour.map(v=>Math.min(255,v*1.04))};
        // Two curved pieces form the notch. Both rest on the same chest shell.
        lapelStrip(side,[[3.22,.095,.145],[3.17,.095,.205],[3.10,.085,.23],[3.065,.08,.18]],lapel);
        lapelStrip(side,[[3.045,.078,.215],[3.01,.072,.235],[2.91,.058,.19],[2.75,.032,.11],[2.58,.009,.025]],lapel);
        // Angled hip pockets, almost flush with the jacket.
        panel([[side*.20,2.40,.218+thick],[side*.32,2.425,.163+thick],[side*.32,2.385,.166+thick],[side*.20,2.36,.221+thick]],{...m,colour:m.colour.map(v=>v*.88)});
      }
      else box(side*.12,3.17,.15+thick,.10,.055,.10,m);
    }
    if(['parka','raincoat'].includes(style))ellipsoid(0,3.22,-.14,.24,.17,.13,m);
    if(['bomber','puffer'].includes(style))tube([[0,hem+.06,0,.40+thick,.24+thick],[0,hem,0,.40+thick,.24+thick]],{colour:m.colour.map(v=>v*.7)});
    if(['denim','leather-jacket'].includes(style))for(const side of [-1,1])box(side*.25,2.90,.27+thick,.09,.08,.012,{colour:m.colour.map(v=>v*.82)});
    if(style!=='blazer')for(const y of [2.57,2.37]){const x=closed?.025:openingX(y)+.025;ellipsoid(x,y,surface(x,y,.012),.014,.014,.009,{colour:m.colour.map(v=>v*.5)});}
    if(style==='sports-jacket')for(const side of [-1,1])box(side*.27,2.35,.245+thick,.09,.10,.012,{colour:m.colour.map(v=>v*.92)});
    if(style==='blazer')for(const y of [2.57,2.37]){const x=closed?.025:openingX(y)+.025;ellipsoid(x,y,surface(x,y,.012),.014,.014,.009,{colour:[151,132,81]});}
    if(style==='trench'){
      tube([[0,2.25,0,.47,.34],[0,2.18,0,.47,.34]],m,32,!closed);
      for(const x of [-.14,.14])for(const y of [2.75,2.50,2.25])ellipsoid(x,y,.34,.018,.018,.012,{colour:[65,57,46]});
    }
    if(jacket==='jacket'&&bySlot.has('pocket_square')){
      panel([[.235,2.93],[.26,2.99],[.29,2.945],[.32,2.975],[.33,2.91],[.235,2.91]].map(([x,y])=>[x,y,surface(x,y,.023)]),mat('pocket_square'));
      panel([[.225,2.925],[.34,2.915],[.34,2.89],[.225,2.90]].map(([x,y])=>[x,y,surface(x,y,.027)]),m);
    }
  }
  if(bySlot.has('top')&&!['tshirt','sweater'].includes(topStyle)){
    tube([[0,3.28,0,.108,.108],[0,3.20,0,.132,.132]],top,36,true);
    for(const side of [-1,1])panel([[side*.018,3.235,.126],[side*.10,3.235,.13],[side*.135,3.095,.217],[side*.055,3.145,.211]],top);
  }
  const neck=bySlot.get('neckwear')?.style||'tie';
  if(bySlot.has('neckwear')&&bySlot.has('top')&&neck==='tie'){
    const m=mat('neckwear');
    panel([[-.037,3.20,.174],[.037,3.20,.174],[.022,3.08,.257],[-.022,3.08,.257]],m);
    for(let i=0;i<20;i++){
      const y=3.08-i*.039,w=.023+(i/20)*.028,z=.207+(y-2.15)*.053;
      panel([[-w,y,z],[w,y,z],[w+.001,y-.039,z-.002],[-w-.001,y-.039,z-.002]],m);
    }
    panel([[-.051,2.30,.215],[.051,2.30,.215],[0,2.23,.211]],m);
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
  // A relaxed stance: a slight bend at the elbows and one foot set back.
  // Transform accessories with the body, preserving their attachment positions.
  const pose=([x,y,z])=>{
    if(y<2.6&&Math.abs(x)>.48)z+=.055*Math.min(1,(2.6-y)/.7);
    if(y<1.9&&x<-.07&&Math.abs(x)<.46)z-=.065*Math.min(1,(1.9-y)/1.3);
    return [x,y,z];
  };
  // Apply the same continuous body shape to clothing and accessories so layers
  // stay attached. This is a generic silhouette, not a prediction of garment fit.
  const femaleShape=([x,y,z])=>{
    const bell=(centre,width)=>Math.exp(-(((y-centre)/width)**2));
    const sx=1-.13*bell(3.12,.24)-.16*bell(2.56,.23)+.10*bell(2.12,.25)-.055*bell(3.75,.30);
    const sz=1-.10*bell(2.53,.23)+.08*bell(2.13,.25);
    const chest=.055*bell(2.96,.16)*Math.exp(-(((Math.abs(x)-.17)/.20)**2))*Math.max(0,Math.tanh(z*9));
    return [x*sx,y,z*sz+chest];
  };
  for(const face of faces){
    if(bodyType==='female'){
      if(face.normals)face.normals=face.normals.map((n,i)=>{
        // Inverse transpose of the shape Jacobian preserves smooth lighting.
        const p=face.points[i],h=.0001;
        const derivative=axis=>{const a=[...p],b=[...p];a[axis]+=h;b[axis]-=h;const u=femaleShape(a),v=femaleShape(b);return u.map((q,j)=>(q-v[j])/(2*h));};
        const dx=derivative(0),dy=derivative(1),dz=derivative(2);
        const nz=n[2]/dz[2],nx=(n[0]-dx[2]*nz)/dx[0],ny=n[1]-dy[0]*nx-dy[2]*nz;
        const length=Math.hypot(nx,ny,nz);return [nx/length,ny/length,nz/length];
      });
      face.points=face.points.map(femaleShape);
    }
    face.points=face.points.map(pose);
  }
  return faces;
}
export function renderMannequin(canvas,faces,angle,zoom){
  const ctx=canvas.getContext('2d');if(!ctx)return false;
  const width=canvas.clientWidth||520,height=canvas.clientHeight||540,dpr=2;
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.scale(dpr,dpr);
  const bg=ctx.createLinearGradient(0,0,0,height);bg.addColorStop(0,'#303841');bg.addColorStop(.6,'#202932');bg.addColorStop(1,'#161d24');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  const scale=Math.min(width*.58,height*.219)*zoom,rad=angle*Math.PI/180;
  const rotate=([x,y,z])=>[x*Math.cos(rad)+z*Math.sin(rad),y-2,z*Math.cos(rad)-x*Math.sin(rad)];
  const project=([x,y,z])=>{const p=7/(7-z);return [width/2+x*scale*p,height*.48-y*scale*p];};
  const floor=project([0,-1.99,0]);
  // Layered translucent ellipses produce a soft studio contact shadow.
  for(let i=18;i>0;i--){ctx.fillStyle='rgba(3,7,11,0.035)';ctx.beginPath();ctx.ellipse(floor[0]+scale*.11,floor[1]+scale*.015,scale*(.34+i*.025),scale*(.048+i*.006),0,0,Math.PI*2);ctx.fill();}
  for(const side of [-1,1]){const foot=project(rotate([side*.21,.07,.10]));ctx.fillStyle='rgba(2,5,8,0.35)';ctx.beginPath();ctx.ellipse(foot[0],floor[1],scale*.14,scale*.036,0,0,Math.PI*2);ctx.fill();}
  // Per-pixel depth keeps overlapping lapels, shirt and pocket square in order.
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),depth=new Float32Array(canvas.width*canvas.height);
  const edge=(a,b,x,y)=>(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);
  for(const face of faces){
    const points=face.points.map(rotate),[a,b,c]=points,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...normal)||1;
    const illuminate=(nx,ny,nz)=>{
      const key=Math.max(0,-nx*.48+ny*.58+nz*.66),fill=Math.max(0,nx*.70+ny*.15+nz*.60);
      const spec=Math.pow(Math.max(0,-nx*.25+ny*.30+nz*.92),face.material?.finish==='leather'?28:14);
      return .40+key*.54+fill*.12+spec*(face.material?.finish==='leather'?.24:face.material?.finish==='silk'?.15:.045);
    };
    // Flat detail panels are double-sided; curved shells carry outward normals.
    const sign=normal[2]<0?-1:1;
    const light=illuminate(sign*normal[0]/length,sign*normal[1]/length,sign*normal[2]/length);
    const lights=face.normals?.map(n=>illuminate(n[0]*Math.cos(rad)+n[2]*Math.sin(rad),n[1],n[2]*Math.cos(rad)-n[0]*Math.sin(rad)));
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
      let shade=lights?(wa*q[0]*lights[0]+wb*q[1]*lights[1]+wc*q[2]*lights[2])/z:light;
      let colour=face.colour;
      if(face.uv&&face.material){
        const u=(wa*q[0]*face.uv[0][0]+wb*q[1]*face.uv[1][0]+wc*q[2]*face.uv[2][0])/z;
        const v=(wa*q[0]*face.uv[0][1]+wb*q[1]*face.uv[1][1]+wc*q[2]*face.uv[2][1])/z;
        colour=colourAt(face.material,u,v);
        // Fine tonal weave stays attached to the garment as it rotates.
        if(face.material.finish==='cloth'){const weave=(Math.floor(u*520)+Math.floor(v*720))&1;shade*=face.material.textured?.955+.07*weave:.985+.025*weave;}
      }
      for(let channel=0;channel<3;channel++)pixels.data[index*4+channel]=Math.min(255,Math.round(colour[channel]*shade));
      pixels.data[index*4+3]=255;
    }
  }
  ctx.putImageData(pixels,0,0);
  return true;
}
