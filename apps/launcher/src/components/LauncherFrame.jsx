import React from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {WorkspaceBar} from '../../../shared-ui/react/index.js';

export default function LauncherFrame({children}){
  const location=useLocation(),navigate=useNavigate();
  // Principal’Ed supplies its own workspace bar in both embedded and pop-out modes.
  if(['/app/principaled','/app/principal-ed','/app/builder','/modules'].includes(location.pathname)||location.pathname.endsWith('/modules'))return children;
  const assistant=settings=>{
    const bridge=window.electronAPI?.assistant;
    if(bridge)return settings?bridge.openSettings():bridge.open();
    const popup=window.open('/assistant'+(settings?'?settings=connections':''),'timsys-ai','popup,width=640,height=820');
    if(!popup)throw Error('Allow pop-out windows to open AI integration.');
  };
  const builder=location.pathname.includes('modules')||location.pathname==='/app/builder';
  const isLauncherHome=location.pathname==='/';
  return <div className="launcher-workspace"><WorkspaceBar brand="TimSyS Launcher" context={builder?'Builder':'Applications'} backDisabled={isLauncherHome} showLauncher={!isLauncherHome} onBack={()=>{if((window.history.state?.idx||0)>0)navigate(-1);else navigate('/');}} onLauncher={()=>navigate('/')} onAssistant={()=>assistant(false)} onAiSettings={()=>assistant(true)} popOut={builder}/><div className="launcher-workspace-content">{children}</div></div>;
}
