'use strict';
const {randomUUID} = require('node:crypto');
const headings = ['Performance', 'Assessment', 'Strengths', 'Areas for improvement', 'Next steps'];
const tokens = /\{(namePoss|name|hisCap|heCap|he|him|his|subject|object|possessive)\}/g;
function fail(message, status=400) { throw Object.assign(new Error(message), {status}); }
function text(value, max, label, blank=false) {
  if(typeof value!=='string' || value.length>max || (!blank&&!value.trim())) fail(`${label} must contain ${blank?'0':'1'}–${max} characters.`);
  return value.trim();
}
function empty() { return {revision:0,classes:[],characterTargets:[null,null,null,null]}; }
function quarter(value) { if(!Number.isInteger(value)||value<1||value>4) fail('Choose quarter 1–4.'); return value-1; }
function apply(original, command) {
  if(!command||typeof command!=='object'||Array.isArray(command))fail('Provide a command object.');
  const state=structuredClone(original), {action}=command;
  if(action==='createClass') {
    state.classes.push({id:randomUUID(),name:text(command.name,48,'Class name'),categories:headings.map((name,i)=>({id:`category-${i+1}`,name,options:[]})),quarters:[[],[],[],[]]});
  } else if(action==='target') {
    const q=quarter(command.quarter), value=command.value;
    if(value!==null&&(!Number.isSafeInteger(value)||value<1||value>100000)) fail('Use a positive character recommendation or leave it blank.');
    state.characterTargets[q]=value;
  } else {
    const c=state.classes.find(c=>c.id===command.classId);
    if(!c) fail('Class not found.',404);
    if(action==='deleteClass') {
      if(command.confirmId!==c.id) fail('Confirm the class deletion.');
      state.classes=state.classes.filter(item=>item.id!==c.id);
    } else if(action==='renameClass') c.name=text(command.name,48,'Class name');
    else if(action==='bank') {
      if(!Array.isArray(command.categories)||command.categories.length!==5) fail('Keep five categories.');
      c.categories=c.categories.map((old,i)=>{
        const input=command.categories[i];
        if(!input||!Array.isArray(input.options)||input.options.length>20) fail('Use up to 20 options per category.');
        const seen=new Set();
        const options=input.options.map(o=>{
          if(!o||typeof o!=='object'||Array.isArray(o))fail('Invalid bank option.');
          if(o.id&&(!old.options.some(p=>p.id===o.id)||seen.has(o.id))) fail('Unknown or duplicate option ID.');
          const id=o.id||randomUUID(); seen.add(id);
          const wording=text(o.text,400,'Comment wording');
          if(/[{}]/.test(wording.replace(tokens,''))) fail('Unsupported placeholder in comment wording.');
          const skill=text(o.skill||'',80,'Skill tag',true),level=o.level||'';
          if(!['','consistent','developing','rare'].includes(level)) fail('Unknown skill level.');
          return {id,text:wording,skill,level};
        });
        return {id:old.id,name:text(input.name,48,'Category heading'),options};
      });
      // Retain removed option IDs as unresolved selections; never substitute another option.
    } else {
      const q=quarter(command.quarter), roster=c.quarters[q];
      if(action==='addStudent') {
        if(roster.length>=80) fail('A class list can contain up to 80 students.');
        roster.push({id:randomUUID(),name:text(command.name,80,'Student name'),pronoun:pronoun(command.pronoun),selections:[null,null,null,null,null],personal:null});
      } else if(action==='copyRoster') {
        const source=quarter(command.fromQuarter);
        if(source===q||roster.length) fail('Copy a different quarter into an empty class list.');
        c.quarters[q]=c.quarters[source].map(s=>({id:randomUUID(),name:s.name,pronoun:s.pronoun,selections:[null,null,null,null,null],personal:null}));
      } else {
        const s=roster.find(s=>s.id===command.studentId);
        if(!s) fail('Student not found in this quarter.',404);
        if(action==='deleteStudent') {
          if(command.confirmId!==s.id) fail('Confirm the student deletion.');
          c.quarters[q]=roster.filter(p=>p.id!==s.id);
        } else if(action==='editStudent') {
          s.name=text(command.name,80,'Student name');s.pronoun=pronoun(command.pronoun);
        } else if(action==='comment') {
          if(!Array.isArray(command.selections)||command.selections.length!==5) fail('Provide five selections.');
          s.selections=command.selections.map((id,i)=>{
            if(id!==null&&!c.categories[i].options.some(o=>o.id===id)&&id!==s.selections[i]) fail('Unknown comment option.');
            return id;
          });
          s.personal=command.personal===null?null:text(command.personal,2500,'Personal comment',true);
        } else fail('Unknown action.');
      }
    }
  }
  state.revision++;
  return state;
}
function pronoun(value) { if(!['he','she','they'].includes(value)) fail('Choose a pronoun.');return value; }
module.exports={empty,apply,fail};
