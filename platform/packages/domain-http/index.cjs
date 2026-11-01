'use strict';
const {timingSafeEqual}=require('node:crypto');
function equal(a,b){return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function normalizeDomainRequest(req,res,appId){
 const base='/api/timsys/v1/apps/'+appId+'/backend/1.0.0',url=new URL(req.url||'/','http://127.0.0.1');
 const reply=(status,error)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error}));return false;};
 if(url.pathname===base+'/contract'){const contract=JSON.parse(require('node:fs').readFileSync(require('node:path').join(process.env.TIMSYS_SERVICE_ROOT||process.cwd(),'contract.json'),'utf8'));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(contract));return false;}
 if(url.pathname==='/api/health')return true;
 if(!url.pathname.startsWith('/api/'))return true;
 if(!url.pathname.startsWith(base+'/'))return reply(410,'use_versioned_timsys_contract');
 const token=process.env.TIMSYS_DOMAIN_TOKEN,cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('timsys_domain_'+appId+'='))?.slice(('timsys_domain_'+appId+'=').length);
 if(!token||!equal(req.headers['x-timsys-domain-token']||cookie,token))return reply(401,'timsys_native_session_required');
 const origin=req.headers.origin;if(origin&&origin!=='http://'+req.headers.host)return reply(403,'cross_origin_request_forbidden');
 req.url='/api/'+url.pathname.slice(base.length+1)+url.search;return true;
}
module.exports={normalizeDomainRequest};
