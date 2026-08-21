'use strict';

const fs=require('fs'),path=require('path');
const componentRegistry=require('./componentRegistry'),log=require('../services/log'),intelligenceContribution=require('../contracts/intelligenceContribution'),componentContract=require('../contracts/componentContract'),db=require('../services/db');
const MODULES_DIR=path.resolve(__dirname,'../../modules');

function applyCanonicalRelationships(component){
  const entities=component.intelligence&&component.intelligence.entities||[];
  entities.forEach(function(entity){
    const columns=db.query('PRAGMA table_info("'+entity.source.table+'")').rows.map(function(row){return row.name;});
    if(!columns.includes('subject_component')||!columns.includes('subject_id'))return;
    entity.relationships=entity.relationships||[];
    if(!entity.relationships.some(function(rel){return rel.field==='subject_id'&&rel.targetType==='event_record';}))entity.relationships.push({field:'subject_id',type:'supports_event',targetType:'event_record',when:{field:'subject_component',value:'event_record'}});
  });
  return component;
}

function applyInsightPolicy(component){
  if(component.insights)return component;
  const sensitive=String(component.type||'').includes('sensitive'),composite=component.type==='composite_module';
  component.insights={classification:composite?'composite_operational':sensitive?'sensitive_operational':'operational',platform:{heartbeat:true,health:true,usage:true,performance:true,dataQuality:true,dependencies:true},operational:{enabled:true,advisoryOnly:true,evidenceRequired:true},visibility:{principal:'summary',superuser:'detailed',developer:'diagnostic'},inherited:true};
  return component;
}

function moduleDirs(dir,found){
  fs.readdirSync(dir,{withFileTypes:true}).forEach(function(entry){if(!entry.isDirectory()||entry.name==='node_modules'||entry.name==='.gitkeep')return;const full=path.join(dir,entry.name);if(fs.existsSync(path.join(full,'module.json'))||fs.existsSync(path.join(full,'component.json')))found.push(full);moduleDirs(full,found);});
  return found;
}

function scan(){
  if(!fs.existsSync(MODULES_DIR)){log.warn('Components directory not found, skipping component scan',{path:MODULES_DIR});return[];}
  const found=[];
  moduleDirs(MODULES_DIR,[]).forEach(function(dir){
    const componentFile=path.join(dir,'component.json'),manifestFile=path.join(dir,'module.json');
    if(!fs.existsSync(componentFile))return; // Capabilities alone never become components.
    const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
    if(manifest.status==='draft')return;
    try{
      const component=JSON.parse(fs.readFileSync(componentFile,'utf8'));
      component.ownerModule=path.basename(dir);applyInsightPolicy(component);
      if(component.intelligence){applyCanonicalRelationships(component);intelligenceContribution.assertValid(component.intelligence,component.name);intelligenceContribution.assertSchema(component.intelligence,component.name,db);}
      component.dependencies=component.dependencies||manifest.requires||[];component.routes=component.routes||manifest.routes||null;component.schema=component.schema||manifest.schema||null;component.capabilities=component.capabilities||manifest.provides||null;component.events=component.events||manifest.events||null;component.version=component.version||manifest.version;
      component.certification=componentContract.certify(component,manifest,{contractPath:path.join(dir,'CONTRACT.md')});
      if(component.certification.status!=='certified')throw new Error('Component certification failed for "'+component.name+'":\n  - '+component.certification.errors.join('\n  - '));
      componentRegistry.register(component);found.push({name:component.name,module:component.ownerModule,type:component.type||'generic'});log.info('Registered certified component',{component:component.name,module:component.ownerModule});
    }catch(error){log.error('Failed to register component',{module:path.basename(dir),error:error.message});throw error;}
  });
  log.info('Component scan complete',{count:found.length});return found;
}

function inferComponentType(name){const lower=name.toLowerCase();if(lower.includes('registry'))return'registry';if(lower.includes('allocation')||lower.includes('room'))return'allocation';if(lower.includes('inventory')||lower.includes('equipment'))return'inventory';if(lower.includes('medical')||lower.includes('health'))return'medical';if(lower.includes('attendance')||lower.includes('schedule'))return'scheduling';if(lower.includes('incident')||lower.includes('report'))return'reporting';return'generic';}
function clear(){componentRegistry.clear();log.info('Component registry cleared');}
module.exports={scan,inferComponentType,clear,applyCanonicalRelationships,applyInsightPolicy};
