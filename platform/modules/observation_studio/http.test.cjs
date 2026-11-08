const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
test('isolated platform boots, registers observations and serves authenticated CRUD', async () => {
    const file = path.resolve(__dirname, 'synthetic-http-' + process.pid + '.sqlite');
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'synthetic-observation-test-secret-at-least-32';
    process.env.REFRESH_TOKEN_SECRET = 'synthetic-observation-refresh-at-least-32';
    process.env.DB_PATH = file;
    process.env.PORT = '0';
    const runtime=process.env.OBSERVATION_VERIFY_PLATFORM||path.resolve(__dirname,'../..');
    const platform = require(path.join(runtime,'index.js'));
    let server;
    try {
        server = await platform.bootPlatform();
        const base = 'http://127.0.0.1:' + server.address().port;
        const request = async (method, url, body, token) => { const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; };
        const login = await request('POST', '/api/auth/dev-login', {});
        assert.equal(login.status, 200);
        const token = login.data.token;
        const modules = await request('GET', '/modules/list-for-app?appId=principal-ed', null, token);
        assert.ok(modules.data.data.find(m => m.name === 'observation_studio' && m.enabled));
        const db = require(path.join(runtime,'shared/services/db.js'));
        db.query("INSERT INTO staff(staff_id,first_name,last_name,hire_date,employment_status) VALUES('SYN-T','Synthetic','Teacher','2026-01-01','active')");
        db.query("INSERT INTO staff(staff_id,first_name,last_name,hire_date,employment_status) VALUES('SYN-O','Synthetic','Observer','2026-01-01','active')");
        const linked=db.query("INSERT INTO users(external_id,username,display_name) VALUES('http-teacher','http-teacher','Synthetic teacher')");db.query("UPDATE staff SET user_id=(SELECT id FROM users WHERE external_id='http-teacher') WHERE staff_id='SYN-T'");
        const teacherToken=require('jsonwebtoken').sign({userId:'http-teacher',permissions:[],sessionId:'http-teacher'},process.env.JWT_SECRET,{expiresIn:'1h'});
        const access=await request('GET','/observations/access',null,teacherToken);assert.equal(access.status,200);assert.equal(access.data.enabled,true);
        const empty = await request('GET', '/observations/workspace', null, token);
        assert.equal(empty.status, 200);
        assert.equal(empty.data.records.length, 0);
        const created = await request('POST', '/observations', { command_id: 'http-create-01', title: 'Synthetic HTTP visit', teacher_id: 'SYN-T', observer_ids: ['SYN-O'], template_id: 'tbo' }, token);
        assert.equal(created.status, 200, JSON.stringify(created.data));
        assert.ok(created.data.record?.id);
        const s = created.data.record;
        const saved = await request('POST', `/observations/${s.id}/commands`, { command_id: 'http-evidence-01', expected_revision: 1, action: 'evidence', text: 'Synthetic HTTP evidence' }, token);
        assert.equal(saved.status, 200);
        assert.equal(saved.data.record.evidence.length, 1);
        const removed = await request('POST', `/observations/${s.id}/commands`, { command_id: 'http-delete-01', expected_revision: 2, action: 'delete', confirm_id: s.id }, token);
        assert.equal(removed.status, 200);
        assert.equal(removed.data.deleted, true);
        const rpc=await request('POST','/observations/studio/rpc',{path:'visits',command_id:'http-full-create',body:{teacherId:'SYN-T',protocol:'tbo',subject:'Full HTTP'}},token);
        assert.equal(rpc.status,200,JSON.stringify(rpc.data));assert.equal(rpc.data.success,true);assert.ok(rpc.data.data.id);
        const read=await request('POST','/observations/studio/rpc',{path:'visits/'+rpc.data.data.id},token);assert.equal(read.data.data.meta.subject,'Full HTTP');assert.equal(read.data.data.nativePermissions.contribute,true);
        const invalid=await request('POST','/observations/studio/rpc',{path:'scheduler',command_id:'http-full-invalid',body:{action:'recommend',baseRevision:0,teacherId:'missing',protocol:'tbo'}},token);assert.equal(invalid.status,400);assert.ok(invalid.data.error.message);
        assert.notEqual((await request('GET', '/observations/workspace')).status, 200);
    }
    finally {
        if (server)
            await platform.shutdownPlatform(server);
        for (const suffix of ['', '-wal', '-shm'])
            if (fs.existsSync(file + suffix))
                fs.unlinkSync(file + suffix);
        if (fs.existsSync(file + '.documents'))
            fs.rmdirSync(file + '.documents'); // No documents are created by this test.
    }
});
