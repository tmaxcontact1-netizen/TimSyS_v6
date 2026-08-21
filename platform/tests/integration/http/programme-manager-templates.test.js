'use strict';
const helper=require('../../helpers/test-server');

describe('Programme Manager templates and defaults',()=>{
  let context,token,year,programme,systemTemplate,clone;
  beforeAll(async()=>{
    context=await helper.createTestServer('programme_manager_templates');
    token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;
    year=(await context.makeRequest('POST','/academic-structure/years',{code:'2044-45',name:'2044–45',starts_on:'2044-08-01',ends_on:'2045-07-31'},token)).data.year;
    programme=(await context.makeRequest('POST','/programme-manager/programmes',{external_key:'template-target',academic_year_id:year.id,name:'Template Target',programme_type:'custom'},token)).data.programme;
  });
  afterAll(async()=>{if(context)await context.cleanup();});

  test('offers three immutable, cloneable system frameworks',async()=>{
    const r=await context.makeRequest('GET','/programme-manager/templates?scope=system&limit=500',null,token);
    expect(r.status).toBe(200);
    expect(r.data.limit).toBe(50);
    expect(r.data.templates.map(x=>x.template_key)).toEqual(['system:activities','system:electives','system:enrichment']);
    expect(r.data.templates.every(x=>x.editable===false)).toBe(true);
    systemTemplate=r.data.templates.find(x=>x.template_key==='system:enrichment');
    const edit=await context.makeRequest('PUT',`/programme-manager/templates/${systemTemplate.id}`,{expected_revision:systemTemplate.revision,name:'Changed'},token);
    expect(edit.status).toBe(409);
    expect(edit.data.error.code).toBe('SYSTEM_TEMPLATE_READ_ONLY');
  });

  test('clones a framework into an editable school default with lifecycle audit',async()=>{
    let r=await context.makeRequest('POST',`/programme-manager/templates/${systemTemplate.id}/clone`,{template_key:'school:enrichment',name:'Our Enrichment'},token);
    expect(r.status).toBe(200);
    clone=r.data.template;
    expect(clone).toMatchObject({scope:'school',editable:true,source_template_id:systemTemplate.id,revision:1});
    r=await context.makeRequest('PUT',`/programme-manager/templates/${clone.id}`,{expected_revision:clone.revision,description:'School-specific enrichment default'},token);
    expect(r.data.template.revision).toBe(2);
    clone=r.data.template;
    r=await context.makeRequest('PUT',`/programme-manager/templates/${clone.id}/withdraw`,{expected_revision:clone.revision},token);
    expect(r.status).toBe(400);
    r=await context.makeRequest('PUT',`/programme-manager/templates/${clone.id}/withdraw`,{expected_revision:clone.revision,reason:'Temporarily retired'},token);
    expect(r.data.template.status).toBe('withdrawn');
    clone=r.data.template;
    r=await context.makeRequest('PUT',`/programme-manager/templates/${clone.id}/reinstate`,{expected_revision:clone.revision,reason:'Required again'},token);
    expect(r.data.template.status).toBe('active');
    clone=r.data.template;
    const history=await context.makeRequest('GET',`/programme-manager/templates/${clone.id}/history`,null,token);
    expect(history.data.history.map(x=>x.action)).toEqual(['reinstated','withdrawn','revised','created']);
  });

  test('rejects timetable-specific data in reusable templates',async()=>{
    const r=await context.makeRequest('POST','/programme-manager/templates',{template_key:'unsafe',name:'Unsafe',definition:{programme_defaults:{programme_type:'activities'},setup_defaults:{timing:{scheduler_setup_id:1,scheduler_window_ids:['1']}}}},token);
    expect(r.status).toBe(400);
    expect(r.data.error.message).toMatch(/Scheduler-specific timing/i);
  });

  test('applies defaults without inventing timing, allocation, or confirmation',async()=>{
    let r=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/apply-template/${systemTemplate.id}`,{expected_programme_revision:programme.revision,expected_setup_revision:0,reason:'Use enrichment framework'},token);
    expect(r.status).toBe(200);
    expect(r.data.programme).toMatchObject({programme_type:'enrichment',operating_mode:'timetabled',status:'draft',revision:2});
    expect(r.data.setup).toMatchObject({status:'in_progress',current_step:'timing',completed_steps:['purpose','location','participation','governance'],timing_preserved:false});
    expect(r.data.setup).not.toHaveProperty('allocations');
    programme=r.data.programme;
    const setup=await context.makeRequest('GET',`/programme-manager/programmes/${programme.id}/setup`,null,token);
    expect(setup.data.setup.readiness).toMatchObject({ready:false,percent:80,missing_steps:['timing'],human_confirmation_required:true});
  });

  test('saves only reusable programme state as a new template',async()=>{
    const r=await context.makeRequest('POST',`/programme-manager/programmes/${programme.id}/save-template`,{template_key:'school:saved-enrichment',name:'Saved Enrichment'},token);
    expect(r.status).toBe(200);
    expect(r.data.template.source_programme_id).toBe(programme.id);
    expect(r.data.template.definition.setup_defaults).toHaveProperty('purpose');
    expect(r.data.template.definition.setup_defaults).not.toHaveProperty('timing');
  });
});
