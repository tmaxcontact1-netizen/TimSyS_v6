'use strict';
const {createHash}=require('node:crypto');
const D=require('./domain');
const scope=require('../../shared/services/appScope');
function enabled(ctx,app) {return !!ctx.db.query("SELECT 1 FROM app_module_assignments WHERE app_id=? AND module_name='comment_builder'",[app]).rows.length;}
function read(ctx,app,user) {const row=ctx.db.query('SELECT data_json FROM comment_builder_workspaces WHERE app_id=? AND user_id=?',[app,user]).rows[0];return row?JSON.parse(row.data_json):D.empty();}
const wrap=fn=>async(req,ctx)=>{try {
  if(!req.user?.id) D.fail('Sign in first.',401);
  const app=scope.fromRequest(req), user=String(req.user.id);
  if(!enabled(ctx,app)) D.fail('Comment Builder is not enabled.',403);
  return fn(req,ctx,app,user);
} catch(e) {if(!e.status&&e.code!=='INVALID_APP_SCOPE')throw e;return {success:false,statusCode:e.status||400,error:{code:e.status===409?'CONFLICT':'COMMENT_BUILDER_ERROR',message:e.message}};}};
const workspace=wrap((req,ctx,app,user)=>({success:true,workspace:read(ctx,app,user)}));
const access=wrap(()=>({success:true,enabled:true}));
const command=wrap((req,ctx,app,user)=>ctx.db.transaction(()=>{
  const {command_id,expected_revision,...input}=req.body||{};
  if(typeof command_id!=='string'||command_id.length<8||command_id.length>100) D.fail('A command identifier is required.');
  const hash=createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
  const receipt=ctx.db.query('SELECT payload_hash FROM comment_builder_receipts WHERE app_id=? AND user_id=? AND command_id=?',[app,user,command_id]).rows[0];
  if(receipt) {if(receipt.payload_hash!==hash) D.fail('This command identifier was already used.',409);return {success:true,workspace:read(ctx,app,user)};}
  const current=read(ctx,app,user);
  if(expected_revision!==current.revision) D.fail('Saved work changed in another tab. Your edits are retained. Reload saved work before retrying.',409);
  const next=D.apply(current,input);
  ctx.db.query('INSERT INTO comment_builder_workspaces(app_id,user_id,data_json) VALUES(?,?,?) ON CONFLICT(app_id,user_id) DO UPDATE SET data_json=excluded.data_json',[app,user,JSON.stringify(next)]);
  ctx.db.query('INSERT INTO comment_builder_receipts(app_id,user_id,command_id,payload_hash) VALUES(?,?,?,?)',[app,user,command_id,hash]);
  return {success:true,workspace:next};
}));
module.exports={boot(){},teardown(){},workspace,command,access};
