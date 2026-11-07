import React, { useEffect, useRef, useState } from 'react';
import '../styles/workspace.css';

export function WorkspaceBar({ brand='TimSyS', context, onBack, backDisabled=false, onLauncher, fileActions=[], onAiSettings, onAssistant, children, popOut=false }) {
  const [menu,setMenu]=useState(null),[notice,setNotice]=useState('');
  const root=useRef(null);
  const desktop=Boolean(window.electronAPI?.windows);
  const run=async action=>{setMenu(null);setNotice('');try{await action?.();}catch(e){setNotice(e.message||'Unable to open this window.');}};
  const back=()=>run(onBack||(()=>{if(history.length>1)history.back();}));
  const launcher=()=>run(onLauncher||(()=>{if(window.electronAPI?.returnToLauncher)return window.electronAPI.returnToLauncher();window.location.assign('/');}));
  const ai=()=>run(onAiSettings||(()=>{if(window.electronAPI?.assistant?.openSettings)return window.electronAPI.assistant.openSettings();setNotice('Open AI integration from the TimSyS desktop launcher.');}));
  useEffect(()=>{
    const close=e=>{if(!root.current?.contains(e.target))setMenu(null);};
    const key=e=>{if(e.key==='Escape'&&menu){const button=root.current?.querySelector('[aria-expanded=true]');setMenu(null);button?.focus();}};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};
  },[menu]);
  useEffect(()=>{
    const handler=e=>{e.preventDefault();if(!backDisabled)back();};
    window.addEventListener('timsys:navigate-back',handler);
    return()=>window.removeEventListener('timsys:navigate-back',handler);
  },[onBack,backDisabled]);
  useEffect(()=>{const handler=e=>{e.preventDefault();launcher();};window.addEventListener('timsys:return-launcher',handler);return()=>window.removeEventListener('timsys:return-launcher',handler);},[onLauncher]);
  const dropdown=(id,label,items)=><div className="workspace-menu"><button type="button" data-workspace-menu aria-expanded={menu===id} aria-controls={`workspace-${id}`} onClick={()=>setMenu(menu===id?null:id)}>{label}</button>{menu===id&&<div className="workspace-menu__items" id={`workspace-${id}`} aria-label={label}>{items}</div>}</div>;
  return <header className="workspace-bar" ref={root}>
    <div className="workspace-bar__navigation"><button type="button" onClick={back} disabled={backDisabled} aria-label="Back to previous page">← Back</button><button type="button" className="workspace-bar__launcher" onClick={launcher}>Return to launcher</button></div>
    <div className="workspace-bar__identity"><strong>{brand}</strong>{context&&<small>{context}</small>}</div>
    <div className="workspace-bar__actions">
      {(!desktop||fileActions.length>0)&&dropdown('file','File',<>{fileActions.map(action=><button key={action.label} type="button" disabled={action.disabled} onClick={()=>run(action.onSelect)}>{action.label}</button>)}{fileActions.length>0&&<hr/>}<button type="button" disabled={backDisabled} onClick={back}>Back</button><button type="button" onClick={launcher}>Return to launcher</button></>)}
      {!desktop&&dropdown('ai','AI integration',<><button type="button" onClick={()=>run(onAssistant||(()=>window.electronAPI?.assistant?.open?.()||ai()))}>Open assistant</button><button type="button" onClick={ai}>Connections and models…</button></>)}
      {popOut&&desktop&&<button type="button" onClick={()=>run(()=>window.electronAPI.windows.popOut())}>Open in window ↗</button>}{children}
    </div>{notice&&<p role="status" className="workspace-bar__notice">{notice}</p>}
  </header>;
}

// A native dialog gives browser previews the same separate, focused surface as
// desktop utilities, without copying a React subtree or losing its form state.
export function WorkspaceDialog({open,title,onClose,children}){
  const ref=useRef(null);
  useEffect(()=>{const d=ref.current;if(open&&!d.open)d.showModal();if(!open&&d.open)d.close();},[open]);
  return <dialog className="workspace-dialog" ref={ref} onCancel={e=>{e.preventDefault();onClose();}}><header><h2>{title}</h2><button type="button" onClick={onClose}>Close</button></header>{children}</dialog>;
}
