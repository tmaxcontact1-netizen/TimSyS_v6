import React,{lazy,Suspense,useState} from 'react';
import Canvas2D from './Canvas2D';
const AcceleratedNetwork=lazy(()=>import('./Network3D'));
export default function Network2D(props){
  const [fallback,setFallback]=useState(false);
  return fallback?<Canvas2D {...props}/>:<Suspense fallback={<p role="status">Preparing 2D network…</p>}><AcceleratedNetwork {...props} flat onUnavailable={()=>{props.cameraMemory.current=null;setFallback(true);}}/></Suspense>;
}
