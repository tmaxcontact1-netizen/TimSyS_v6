'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

describe('HTTP Auth Integration', function() {
  var server, baseUrl = 'http://localhost:3001';

  beforeAll(async function() {
    var dbPath = path.resolve('./data/test_http.sqlite');
    [dbPath, dbPath+'-wal', dbPath+'-shm'].forEach(function(p){if(fs.existsSync(p))fs.unlinkSync(p)});
    process.env.NODE_ENV='test'; process.env.PORT='3001';
    process.env.JWT_SECRET='test-secret-key-for-jest-minimum-32-characters';
    process.env.DB_PATH='./data/test_http.sqlite';
    jest.resetModules();
    var index=require('../../../index');
    server=await index.bootPlatform();
    await new Promise(r=>setTimeout(r,500));
  },30000);

  afterAll(function(){
    return new Promise(r=>{
      if(server){server.close(()=>{
        var dbPath=path.resolve('./data/test_http.sqlite');
        [dbPath,dbPath+'-wal',dbPath+'-shm'].forEach(p=>{if(fs.existsSync(p))fs.unlinkSync(p)});
        r();});}else{r();}});
  });

  function makeRequest(meth,p,body,tok){
    return new Promise(function(res,rej){
      var par=url.parse(baseUrl+p);
      var opt={hostname:par.hostname,port:par.port,path:par.path,method:meth,headers:{'Content-Type':'application/json'}};
      if(tok)opt.headers['Authorization']='Bearer '+tok;else opt.headers['X-Requested-With']='XMLHttpRequest';
      var req=http.request(opt,function(ress){var data='';ress.on('data',c=>{data+=c});ress.on('end',()=>{try{res({status:ress.statusCode,data:JSON.parse(data),headers:ress.headers})}catch(e){res({status:ress.statusCode,data:data,headers:ress.headers})}})});
      req.on('error',rej);if(body)req.write(JSON.stringify(body));req.end();
    });
  }
  async function adminLogin(){
    var r=await makeRequest('POST','/api/auth/login',{username:'admin',password:'changeme123'});
    if(r.status!==200)r=await makeRequest('POST','/api/auth/login',{username:'admin',password:'newSecurePass123!'});
    return r;
  }

  describe('Login flow',function(){
    test('reject no credentials',async function(){var r=await makeRequest('POST','/api/auth/login',{});expect(r.status).toBe(401);});
    test('reject wrong password',async function(){var r=await makeRequest('POST','/api/auth/login',{username:'admin',password:'wrong'});expect(r.status).toBe(401);});
    test('accept valid',async function(){var r=await adminLogin();expect(r.status).toBe(200);expect(r.data.token).toBeDefined();});
  });

  describe('Protected routes',function(){
    var tok=null;
    beforeAll(async function(){var r=await adminLogin();tok=r.data.token;});
    test('reject unauth',async function(){var r=await makeRequest('GET','/api/users');expect(r.status).toBe(401);});
    test('accept auth',async function(){var r=await makeRequest('GET','/api/users',null,tok);expect(r.status).toBe(200);});
    test('auth/me',async function(){var r=await makeRequest('GET','/api/auth/me',null,tok);expect(r.status).toBe(200);});
    test('create user',async function(){var r=await makeRequest('POST','/api/users',{username:'u'+Date.now(),email:'e@test.com',password:'TestPass123!',permissions:['user:read']},tok);expect(r.status).toBe(200);});
    test('dup username',async function(){var r=await makeRequest('POST','/api/users',{username:'admin',email:'d@test.com',password:'TestPass123!',permissions:[]},tok);expect(r.status).toBe(409);});
  });

  describe('CSRF',function(){
    test('no token/XHR',async function(){var par=url.parse(baseUrl+'/api/auth/login'),r=await new Promise((res,rej)=>{var req=http.request({hostname:par.hostname,port:par.port,path:par.path,method:'POST',headers:{'Content-Type':'application/json'}},function(ress){var d='';ress.on('data',c=>d+=c);ress.on('end',()=>{try{res({status:ress.statusCode,data:JSON.parse(d)})}catch(e){res({status:ress.statusCode,data:d})}});});req.on('error',rej);req.write(JSON.stringify({username:'admin',password:'changeme123'}));req.end();});expect(r.status).toBe(403);});
  });

  describe('Rate limiting',function(){
    test('has headers',async function(){var r=await makeRequest('GET','/health');expect(r.status).toBe(200);expect(r.headers['x-ratelimit-limit']).toBeDefined();});
  });

  describe('Token revocation',function(){
    var tok=null;
    beforeAll(async function(){var r=await adminLogin();tok=r.data.token;});
    test('logout',async function(){var r=await makeRequest('POST','/api/auth/logout',null,tok);expect(r.status).toBe(200);});
    test('revoked rejected',async function(){var r=await makeRequest('GET','/api/auth/me',null,tok);expect(r.status).toBe(401);});
  });

    describe('Password change',function(){
    var tok=null,id=null,np='newSecurePass123!';
    beforeAll(async function(){
      var r=await makeRequest('POST','/api/auth/login',{username:'admin',password:'changeme123'});
      if(r.status===401)r=await makeRequest('POST','/api/auth/login',{username:'admin',password:'newSecurePass123!'});
      expect(r.status).toBe(200);
      expect(r.data.token).toBeDefined();
      tok=r.data.token;
      id=r.data.user.id;
    });
    test('short pwd',async function(){if(!tok){console.log('no token');return;}var r=await makeRequest('POST','/api/users/'+id+'/change-password',{newPassword:'s'},tok);expect(r.status).toBe(400);});
    test('change pwd',async function(){if(!tok)return;var r=await makeRequest('POST','/api/users/'+id+'/change-password',{newPassword:np},tok);expect(r.status).toBe(200);});
    test('old token rejected',async function(){if(!tok)return;var r=await makeRequest('GET','/api/auth/me',null,tok);expect(r.status).toBe(401);});
    test('new login',async function(){var r=await makeRequest('POST','/api/auth/login',{username:'admin',password:np});expect(r.status).toBe(200);});
  });
});
