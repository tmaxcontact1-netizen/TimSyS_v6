'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),url=require('url');

describe('E2E: Boot Sequence',function(){
  var server,bu='http://localhost:3003';

  beforeAll(async function(){
    var dp=path.resolve('./data/test_e2e.sqlite');
    [dp,dp+'-wal',dp+'-shm'].forEach(p=>{if(fs.existsSync(p))fs.unlinkSync(p)});
    process.env.NODE_ENV='test';process.env.PORT='3003';
    process.env.JWT_SECRET='test-secret-key-for-jest-minimum-32-characters';
    process.env.DB_PATH='./data/test_e2e.sqlite';
    jest.resetModules();
    var idx=require('../../index');
    server=await idx.bootPlatform();
    await new Promise(r=>setTimeout(r,500));
  },30000);

  afterAll(function(){return new Promise(r=>{if(server){server.close(()=>{var dp=path.resolve('./data/test_e2e.sqlite');[dp,dp+'-wal',dp+'-shm'].forEach(p=>{if(fs.existsSync(p))fs.unlinkSync(p)});r();});}else{r();}});});

  function mr(m,ps,b,t){return new Promise(function(res,rej){var p=url.parse(bu+ps),o={hostname:p.hostname,port:p.port,path:p.path,method:m,headers:{'Content-Type':'application/json'}};if(t)o.headers['Authorization']='Bearer '+t;else o.headers['X-Requested-With']='XMLHttpRequest';var r=http.request(o,function(rr){var d='';rr.on('data',c=>d+=c);rr.on('end',()=>{try{res({status:rr.statusCode,data:JSON.parse(d),headers:rr.headers});}catch(e){res({status:rr.statusCode,data:d,headers:rr.headers});}});});r.on('error',rej);if(b)r.write(JSON.stringify(b));r.end();});}

  describe('Cold boot',function(){
    test('listening',function(){expect(server).toBeDefined();});
    test('health 200',async function(){var r=await mr('GET','/health');expect(r.status).toBe(200);});
    test('ready 200',async function(){var r=await mr('GET','/ready');expect(r.status).toBe(200);});
  });

  describe('Auth lifecycle',function(){
    var tok=null;
    test('login',async function(){var r=await mr('POST','/api/auth/login',{username:'admin',password:'changeme123'});if(r.status!==200)r=await mr('POST','/api/auth/login',{username:'admin',password:'newSecurePass123'});expect(r.status).toBe(200);tok=r.data.token;});
    test('/me',async function(){var r=await mr('GET','/api/auth/me',null,tok);expect(r.status).toBe(200);});
    test('/users',async function(){var r=await mr('GET','/api/users',null,tok);expect(r.status).toBe(200);});
    test('logout',async function(){var r=await mr('POST','/api/auth/logout',null,tok);expect(r.status).toBe(200);});
    test('revoked',async function(){var r=await mr('GET','/api/auth/me',null,tok);expect(r.status).toBe(401);});
  });

  describe('Module discovery',function(){
    test('/introspect/modules',async function(){var lr=await mr('POST','/api/auth/login',{username:'admin',password:'changeme123'});if(lr.status!==200)lr=await mr('POST','/api/auth/login',{username:'admin',password:'newSecurePass123'});expect(lr.status).toBe(200);var r=await mr('GET','/introspect/modules',null,lr.data.token);expect(r.status).toBe(200);});
    test('/introspect/platform',async function(){var lr=await mr('POST','/api/auth/login',{username:'admin',password:'changeme123'});if(lr.status!==200)lr=await mr('POST','/api/auth/login',{username:'admin',password:'newSecurePass123'});expect(lr.status).toBe(200);var r=await mr('GET','/introspect/platform',null,lr.data.token);expect(r.status).toBe(200);});
  });
});