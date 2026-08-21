'use strict';
const helper=require('../../helpers/test-server');

describe('Programme Manager nested survey designer and publication',()=>{
  let context,token,year,schedulerSetup,window,programme,offering,offeringTwo,survey,publication,publicResponse,ambiguousResponse,duplicateResponse,allocationRun;
  const answersFor=(windowId,choice)=>({identity_grade:'7',identity_class:'7A',identity_student:'ST-001',[`window_${windowId}_choice_1`]:String(choice)});
  beforeAll(async()=>{
    context=await helper.createTestServer('programme_manager_surveys');
    token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;
    year=(await context.makeRequest('POST','/academic-structure/years',{code:'2048-49',name:'2048–49',starts_on:'2048-08-01',ends_on:'2049-07-31'},token)).data.year;
    for(const student of [
      {student_id:'ST-001',first_name:'Ivy',last_name:'Exact',date_of_birth:'2036-01-01',sex:'Female',current_grade_level:'7',homeroom:'7A'},
      {student_id:'ST-002',first_name:'Gabe',last_name:'Forms',date_of_birth:'2036-02-02',sex:'Male',current_grade_level:'7',homeroom:'7B'},
      {student_id:'ST-003',first_name:'Cia',last_name:'Imported',date_of_birth:'2036-03-03',sex:'Female',current_grade_level:'7',homeroom:'7C'},
      {student_id:'AM-1',first_name:'Alex',last_name:'Lee',date_of_birth:'2036-04-04',sex:'Male',current_grade_level:'7',homeroom:'7A'},
      {student_id:'AM-2',first_name:'Alex',last_name:'Lee',date_of_birth:'2036-04-04',sex:'Male',current_grade_level:'7',homeroom:'7A'}
    ])await context.makeRequest('POST','/students',student,token);
    await context.makeRequest('POST','/staff',{staff_id:'SV-T1',first_name:'Survey',last_name:'Teacher',job_title:'Teacher',hire_date:'2030-08-01'},token);
    await context.makeRequest('POST','/staff',{staff_id:'SV-T2',first_name:'Second',last_name:'Teacher',job_title:'Teacher',hire_date:'2030-08-01'},token);
    schedulerSetup=(await context.makeRequest('PUT','/scheduler/setup',{academic_year_id:year.id,name:'Survey School',scope_mode:'school'},token)).data.setup;
    const schedulerScope=schedulerSetup.scopes[0];
    await context.makeRequest('PUT','/scheduler/structures',{scheduler_setup_id:schedulerSetup.id,cycle:{name:'Week',week_count:1,week_labels:['Week']},period_templates:[{external_key:'single',name:'Single',duration_minutes:50}],day_patterns:[{scheduler_scope_id:schedulerScope.id,cycle_week:1,day_index:1,name:'Monday',periods:[{external_key:'p1',name:'P1',sequence:1,starts_at:'08:00',ends_at:'08:50',kind:'instruction',period_template_key:'single'}]}]},token);
    await context.makeRequest('PUT','/scheduler/requirements',{scheduler_setup_id:schedulerSetup.id,requirements:[{external_key:'window:survey',academic_year_id:String(year.id),teaching_group_external_key:'window:survey',name:'Monday Activities',occurrences_per_cycle:1,duration_minutes:50,eligible_staff_ids:['SV-T1','SV-T2'],allowed_period_template_keys:['single'],attributes:{programme_window:true,programme_category:'activities'},status:'active'}]},token);
    let version=(await context.makeRequest('POST','/scheduler/generate',{scheduler_setup_id:schedulerSetup.id,alternative_count:1},token)).data.versions[0];
    for(const [action,body] of [['select',{}],['submit',{reason:'Ready'}],['approve',{reason:'Approved'}],['publish',{reason:'Published'}]])version=(await context.makeRequest('PUT',`/scheduler/versions/${version.id}/${action}`,body,token)).data.version;
    window=(await context.makeRequest('GET',`/programme-manager/scheduler-windows?scheduler_setup_id=${schedulerSetup.id}`,null,token)).data.windows[0];
    programme=(await context.makeRequest('POST','/programme-manager/programmes',{external_key:'survey-programme',academic_year_id:year.id,name:'Survey Programme',programme_type:'activities',operating_mode:'timetabled'},token)).data.programme;
    const setupAnswers={purpose:{summary:'Activities survey',intended_outcome:'Collect ranked preferences'},timing:{scheduler_setup_id:schedulerSetup.id,scheduler_window_ids:[String(window.id)]},location:{strategy:'select_from_scheduler_availability'},participation:{participant_type:'student',scope:'cross_grade',respondent_mode:'student'},governance:{submitter_roles:['student'],amendment_roles:['student'],manual_edit_roles:['programme_admin']}};
    let setupRevision=0;for(const step of ['purpose','timing','location','participation','governance']){const result=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup/${step}`,{expected_revision:setupRevision,answers:setupAnswers[step]},token);setupRevision=result.data.setup.revision;}
    programme=(await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup-confirmation`,{expected_revision:setupRevision,confirm:true,reason:'Approved'},token)).data.programme;
    offering=(await context.makeRequest('POST',`/programme-manager/programmes/${programme.id}/offerings`,{external_key:'chess',name:'Chess',scheduler_setup_id:schedulerSetup.id,scheduler_window_id:String(window.id),capacity:{maximum:1},assignments:{staff:['SV-T1']}},token)).data.offering;
    offering=(await context.makeRequest('PUT',`/programme-manager/offerings/${offering.id}/confirm`,{expected_revision:offering.revision,confirm:true,reason:'Offering ready'},token)).data.offering;
    offeringTwo=(await context.makeRequest('POST',`/programme-manager/programmes/${programme.id}/offerings`,{external_key:'coding',name:'Coding',scheduler_setup_id:schedulerSetup.id,scheduler_window_id:String(window.id),capacity:{maximum:20},assignments:{staff:['SV-T2']}},token)).data.offering;
    offeringTwo=(await context.makeRequest('PUT',`/programme-manager/offerings/${offeringTwo.id}/confirm`,{expected_revision:offeringTwo.revision,confirm:true,reason:'Offering ready'},token)).data.offering;
  });
  afterAll(async()=>{if(context)await context.cleanup();});

  test('creates an empty draft that cannot be prematurely published',async()=>{
    let r=await context.makeRequest('POST',`/programme-manager/programmes/${programme.id}/surveys`,{external_key:'student-choices',name:'Student Choices',settings:{preference_count:3,allow_save_and_resume:true}},token);
    expect(r.status).toBe(200);survey=r.data.survey;
    expect(survey).toMatchObject({status:'draft',revision:1,readiness:{ready:false}});
    r=await context.makeRequest('PUT',`/programme-manager/surveys/${survey.id}/publish`,{expected_revision:survey.revision,confirm:true,reason:'Too early',channels:['native']},token);
    expect(r.status).toBe(409);expect(r.data.error.code).toBe('SURVEY_NOT_READY');
  });

  test('generates the nested identity flow and ranked unique choices',async()=>{
    const r=await context.makeRequest('POST',`/programme-manager/surveys/${survey.id}/generate`,{expected_revision:survey.revision,settings:{preference_count:3},reason:'Generate student flow'},token);
    expect(r.status).toBe(200);survey=r.data.survey;
    expect(survey.questions).toHaveLength(6);
    expect(survey.questions.slice(0,3).map(x=>x.question_type)).toEqual(['identity_grade','identity_class','identity_student']);
    expect(survey.questions[1]).toMatchObject({parent_question_key:'identity_grade',condition:{question_key:'identity_grade',operator:'answered'}});
    const choices=survey.questions.filter(x=>x.question_type==='single_choice');
    expect(choices.map(x=>x.configuration.preference_rank)).toEqual([1,2,3]);
    expect(choices[0].configuration.scheduler_window_label).toBe('Monday Activities');
    expect(new Set(choices.map(x=>x.configuration.unique_within_group)).size).toBe(1);
    expect(choices.every(x=>x.configuration.reject_duplicate_values===true)).toBe(true);
    expect(survey.readiness.ready).toBe(true);
  });

  test('rejects malformed nested designs without changing the revision',async()=>{
    const invalid=[{question_key:'child',parent_question_key:'later',question_type:'text',prompt:'Child',sequence:1},{question_key:'later',question_type:'text',prompt:'Later',sequence:2}];
    const r=await context.makeRequest('PUT',`/programme-manager/surveys/${survey.id}/design`,{expected_revision:survey.revision,questions:invalid},token);
    expect(r.status).toBe(400);expect(r.data.error.message).toMatch(/parent questions must appear before/i);
    const current=await context.makeRequest('GET',`/programme-manager/surveys/${survey.id}`,null,token);
    expect(current.data.survey.revision).toBe(survey.revision);
  });

  test('previews safely and publishes an immutable multi-channel snapshot',async()=>{
    let r=await context.makeRequest('GET',`/programme-manager/surveys/${survey.id}/preview`,null,token);
    expect(r.data.preview).toMatchObject({response_collection_enabled:false,readiness:{ready:true}});
    r=await context.makeRequest('PUT',`/programme-manager/surveys/${survey.id}/publish`,{expected_revision:survey.revision,confirm:false,reason:'No confirmation',channels:['native']},token);
    expect(r.status).toBe(409);expect(r.data.error.code).toBe('HUMAN_CONFIRMATION_REQUIRED');
    r=await context.makeRequest('PUT',`/programme-manager/surveys/${survey.id}/publish`,{expected_revision:survey.revision,confirm:true,reason:'Survey reviewed by programme lead',channels:['native','public_link','google_forms']},token);
    expect(r.status).toBe(200);survey=r.data.survey;
    publication=r.data.publication;
    expect(publication).toMatchObject({version:1,status:'published',public_token:expect.any(String),response_collection_enabled:true});
    expect(r.data.publication.snapshot.response_rules).toMatchObject({reject_duplicate_choice_within_group:true,revised_submission_resets_priority_timestamp:true,human_allocation_confirmation_required:true});
    expect(r.data.publication.channels.google_forms).toMatchObject({mode:'export_schema',response_intake:'programme_manager_responses'});
    expect(r.data.human_confirmation).toBe(true);
    const retrieved=await context.makeRequest('GET',`/programme-manager/surveys/${survey.id}/publications/1`,null,token);
    expect(retrieved.data).toMatchObject({response_collection_enabled:true,publication:{version:1,snapshot:{questions:expect.any(Array)}}});
  });

  test('accepts public responses and returns a private amendment token',async()=>{
    let r=await context.makeRequest('GET',`/public/programme-surveys/${publication.public_token}`,null);
    expect(r.status).toBe(200);expect(r.data.response_collection_enabled).toBe(true);
    r=await context.makeRequest('POST',`/public/programme-surveys/${publication.public_token}/responses`,{respondent_role:'student',raw_identity:{student_id:'ST-001',grade_id:'7',class_id:'7A'},answers:answersFor(window.id,offering.id)},null);
    expect(r.status).toBe(200);publicResponse=r.data.response;
    expect(publicResponse).toMatchObject({status:'received',source_channel:'public_link',identity_resolution_status:'pending',amendment_token:expect.any(String)});
    expect(r.data).toMatchObject({accepted_with_flags:false,identity_reconciliation_required:true});
  });

  test('persists incomplete and duplicate choices with explicit flags instead of skipping',async()=>{
    const duplicate={identity_grade:'7',[`window_${window.id}_choice_1`]:String(offering.id),[`window_${window.id}_choice_2`]:String(offering.id)};
    const r=await context.makeRequest('POST',`/public/programme-surveys/${publication.public_token}/responses`,{respondent_role:'student',answers:duplicate},null);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({accepted_with_flags:true,response:{status:'flagged'}});
    expect(r.data.response.flags.map(x=>x.code)).toEqual(expect.arrayContaining(['REQUIRED_ANSWER_MISSING','DUPLICATE_GROUP_CHOICE','RAW_IDENTITY_INCOMPLETE']));
  });

  test('revises publicly with immutable history and resets priority timestamp',async()=>{
    const previous=publicResponse.priority_timestamp;
    const r=await context.makeRequest('PUT',`/public/programme-surveys/${publication.public_token}/responses/${publicResponse.amendment_token}`,{respondent_role:'student',raw_identity:{student_id:'ST-001',grade_id:'7',class_id:'7A'},answers:answersFor(window.id,offering.id),reason:'Student reviewed choices'},null);
    expect(r.status).toBe(200);publicResponse=r.data.response;
    expect(r.data.priority_timestamp_reset).toBe(true);
    expect(publicResponse.revision).toBe(2);
    expect(publicResponse.priority_timestamp).not.toBe(previous);
    const history=await context.makeRequest('GET',`/programme-manager/responses/${publicResponse.id}/history`,null,token);
    expect(history.data.history.map(x=>x.action)).toEqual(['revised','received']);
  });

  test('imports every external row and treats changed source records as timestamp-resetting revisions',async()=>{
    const valid={source_record_key:'GF-1',source_submitted_at:'2048-09-01T08:00:00.000Z',respondent_role:'student',raw_identity:{student_id:'ST-002'},answers:{...answersFor(window.id,offering.id),[`window_${window.id}_choice_2`]:String(offeringTwo.id)}};
    let r=await context.makeRequest('POST',`/programme-manager/surveys/${survey.id}/responses/import`,{source_channel:'google_forms',records:[valid,null,{source_record_key:'GF-2',respondent_role:'student',raw_identity:{student_id:'ST-003'},answers:{}}]},token);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({received:3,accepted:3,flagged:2,skipped:0});
    expect(r.data.results.every(x=>x.success)).toBe(true);
    r=await context.makeRequest('POST',`/programme-manager/surveys/${survey.id}/responses/import`,{source_channel:'google_forms',records:[{...valid,source_revised_at:'2048-09-02T09:30:00.000Z',answers:{...valid.answers,identity_class:'7B'}}]},token);
    expect(r.data.results[0]).toMatchObject({revised:true,priority_timestamp_reset:true,response:{revision:2,priority_timestamp:'2048-09-02T09:30:00.000Z'}});
    const revisedRecord={...valid,source_revised_at:'2048-09-02T09:30:00.000Z',answers:{...valid.answers,identity_class:'7B'}};
    r=await context.makeRequest('POST',`/programme-manager/surveys/${survey.id}/responses/import`,{source_channel:'google_forms',records:[revisedRecord]},token);
    expect(r.data.results[0].idempotent).toBe(true);
    const list=await context.makeRequest('GET',`/programme-manager/surveys/${survey.id}/responses?limit=500`,null,token);
    expect(list.data.limit).toBe(50);
    expect(list.data.total).toBe(5);
  });

  test('recommends ambiguous identities, exactly matches canonical IDs, and opens duplicate cases',async()=>{
    let r=await context.makeRequest('POST',`/public/programme-surveys/${publication.public_token}/responses`,{respondent_role:'student',raw_identity:{first_name:'Alex',last_name:'Lee',date_of_birth:'2036-04-04',grade_id:'7',class_id:'7A'},answers:{...answersFor(window.id,offering.id),identity_student:'UNKNOWN'}},null);
    ambiguousResponse=r.data.response;
    r=await context.makeRequest('POST',`/public/programme-surveys/${publication.public_token}/responses`,{respondent_role:'student',raw_identity:{student_id:'ST-001'},answers:answersFor(window.id,offering.id)},null);
    duplicateResponse=r.data.response;
    r=await context.makeRequest('POST',`/programme-manager/surveys/${survey.id}/reconcile-identities`,{limit:100},token);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({processed:7,counts:{matched:4,ambiguous:1,unresolved:2},human_review_required:3});
    const ambiguous=r.data.resolutions.find(x=>x.response_id===ambiguousResponse.id);
    expect(ambiguous.status).toBe('ambiguous');
    expect(ambiguous.candidates).toHaveLength(2);
    expect(ambiguous.candidates.every(x=>x.score===99)).toBe(true);
    const exact=r.data.resolutions.find(x=>x.response_id===publicResponse.id);
    expect(exact).toMatchObject({status:'matched',canonical_student_id:'ST-001',method:'exact_canonical_id',confidence:100});
    const cases=await context.makeRequest('GET',`/programme-manager/duplicate-cases?survey_id=${survey.id}&status=open`,null,token);
    expect(cases.data.cases).toHaveLength(1);
    expect(cases.data.cases[0].response_ids).toEqual(expect.arrayContaining([String(publicResponse.id),String(duplicateResponse.id)]));
  });

  test('requires a human to resolve ambiguous identities and duplicate submissions',async()=>{
    let queue=await context.makeRequest('GET',`/programme-manager/identity-queue?survey_id=${survey.id}&limit=500`,null,token);
    expect(queue.data.limit).toBe(50);expect(queue.data.total).toBe(3);
    const ambiguous=queue.data.resolutions.find(x=>x.response_id===ambiguousResponse.id);
    let r=await context.makeRequest('PUT',`/programme-manager/responses/${ambiguousResponse.id}/identity`,{expected_revision:ambiguous.revision,decision:'matched',student_id:'AM-1',confirm:false,reason:'Not confirmed'},token);
    expect(r.status).toBe(409);expect(r.data.error.code).toBe('HUMAN_CONFIRMATION_REQUIRED');
    r=await context.makeRequest('PUT',`/programme-manager/responses/${ambiguousResponse.id}/identity`,{expected_revision:ambiguous.revision,decision:'matched',student_id:'AM-1',confirm:true,reason:'Identity checked against admission record'},token);
    expect(r.data).toMatchObject({human_confirmation:true,resolution:{status:'matched',canonical_student_id:'AM-1',method:'human_confirmed'}});
    const cases=await context.makeRequest('GET',`/programme-manager/duplicate-cases?survey_id=${survey.id}&status=open`,null,token);
    const duplicateCase=cases.data.cases.find(x=>x.canonical_student_id==='ST-001');
    r=await context.makeRequest('PUT',`/programme-manager/duplicate-cases/${duplicateCase.id}`,{expected_revision:duplicateCase.revision,disposition:'primary_only',primary_response_id:publicResponse.id,confirm:true,reason:'Keep the reviewed revised submission'},token);
    expect(r.data).toMatchObject({human_confirmation:true,responses_preserved:true,case:{status:'resolved',disposition:'primary_only',primary_response_id:publicResponse.id}});
    expect(r.data.case.excluded_response_ids).toEqual([String(duplicateResponse.id)]);
    const history=await context.makeRequest('GET',`/programme-manager/duplicate-cases/${duplicateCase.id}/history`,null,token);
    expect(history.data.history.map(x=>x.action)).toEqual(['resolved','opened']);
  });

  test('invalidates a confirmed identity after amendment and reconciles it again',async()=>{
    let r=await context.makeRequest('PUT',`/programme-manager/responses/${publicResponse.id}`,{expected_revision:publicResponse.revision,respondent_role:'student',raw_identity:{student_id:'ST-001'},answers:{...answersFor(window.id,offering.id),identity_class:'7B'},reason:'Administrator recorded corrected class'},token);
    expect(r.status).toBe(200);publicResponse=r.data.response;
    expect(publicResponse.identity_resolution_status).toBe('pending');
    r=await context.makeRequest('POST',`/programme-manager/responses/${publicResponse.id}/reconcile-identity`,{},token);
    expect(r.data.resolution).toMatchObject({status:'matched',canonical_student_id:'ST-001',method:'exact_canonical_id'});
    const history=await context.makeRequest('GET',`/programme-manager/responses/${publicResponse.id}/identity-history`,null,token);
    expect(history.data.history.map(x=>x.action)).toEqual(['evaluated','evaluated']);
  });

  test('generates deterministic, explainable recommendations without committing enrolments',async()=>{
    let r=await context.makeRequest('POST',`/programme-manager/surveys/${survey.id}/allocation-runs`,{external_key:'allocation:test:1'},token);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({human_confirmation_required:true,allocations_committed:false,allocation_run:{status:'generated',response_count:7,eligible_response_count:3,recommendation_count:2,review_count:0,unplaced_count:1}});
    const run=r.data.allocation_run;allocationRun=run;
    expect(run.summary).toMatchObject({states:{recommended:2,review_required:0,unplaced:1,excluded:4},decision_authority:'authorised_human',algorithm:'priority_timestamp_then_preference_rank'});
    r=await context.makeRequest('GET',`/programme-manager/allocation-runs/${run.id}?limit=500`,null,token);
    expect(r.data.limit).toBe(50);expect(r.data.total).toBe(7);expect(r.data.allocations_committed).toBe(false);
    const results=r.data.recommendations;
    expect(results.find(x=>x.canonical_student_id==='AM-1')).toMatchObject({recommended_offering_id:offering.id,preference_rank:1,state:'recommended'});
    expect(results.find(x=>x.canonical_student_id==='ST-002')).toMatchObject({recommended_offering_id:offeringTwo.id,preference_rank:2,state:'recommended'});
    expect(results.find(x=>x.response_id===publicResponse.id)).toMatchObject({canonical_student_id:'ST-001',state:'unplaced',reason_code:'NO_FEASIBLE_CHOICE',evidence:{attempts:expect.arrayContaining([expect.objectContaining({code:'CAPACITY_FULL'})])}});
    expect(results.find(x=>x.response_id===duplicateResponse.id)).toMatchObject({state:'excluded',reason_code:'DUPLICATE_NON_PRIMARY'});
    const listed=await context.makeRequest('GET',`/programme-manager/surveys/${survey.id}/allocation-runs`,null,token);
    expect(listed.data.runs).toEqual([expect.objectContaining({id:run.id,input_hash:expect.any(String)})]);
  });

  test('requires complete, audited human intervention before sealing the decision set',async()=>{
    let r=await context.makeRequest('GET',`/programme-manager/allocation-runs/${allocationRun.id}/interventions?limit=500`,null,token);
    expect(r.data).toMatchObject({limit:50,total:3,pending:3,human_decision_required:true,confirmation:null});
    const byStudent=id=>r.data.interventions.find(x=>x.canonical_student_id===id);
    const alex=byStudent('AM-1'),gabe=byStudent('ST-002'),ivy=byStudent('ST-001');
    let attempt=await context.makeRequest('PUT',`/programme-manager/allocation-runs/${allocationRun.id}/confirm`,{confirm:true,reason:'Reviewed'},token);
    expect(attempt.status).toBe(409);expect(attempt.data.error).toMatchObject({code:'INTERVENTIONS_PENDING',details:{pending:3}});
    attempt=await context.makeRequest('PUT',`/programme-manager/allocation-recommendations/${alex.id}/decision`,{action:'accepted',confirm:false,reason:'Reviewed recommendation'},token);
    expect(attempt.status).toBe(409);expect(attempt.data.error.code).toBe('HUMAN_CONFIRMATION_REQUIRED');
    for(const item of [alex,gabe]){
      const decision=await context.makeRequest('PUT',`/programme-manager/allocation-recommendations/${item.id}/decision`,{action:'accepted',confirm:true,reason:'Programme lead reviewed the ranked recommendation'},token);
      expect(decision.data).toMatchObject({human_decision:true,override:false,enrolment_created:false,decision:{action:'accepted',offering_id:item.recommended_offering_id}});
    }
    attempt=await context.makeRequest('PUT',`/programme-manager/allocation-recommendations/${ivy.id}/decision`,{action:'accepted',confirm:true,reason:'Cannot accept an unplaced result'},token);
    expect(attempt.status).toBe(409);expect(attempt.data.error.code).toBe('NO_RECOMMENDED_OFFERING');
    const manual=await context.makeRequest('PUT',`/programme-manager/allocation-recommendations/${ivy.id}/decision`,{action:'manual_placement',offering_id:offeringTwo.id,confirm:true,reason:'Programme lead manually placed the student after reviewing remaining Coding capacity'},token);
    expect(manual.data).toMatchObject({human_decision:true,override:true,enrolment_created:false,decision:{action:'manual_placement',offering_id:offeringTwo.id,override_flags:['HUMAN_OVERRIDE']}});
    r=await context.makeRequest('GET',`/programme-manager/allocation-runs/${allocationRun.id}/interventions?status=pending`,null,token);
    expect(r.data).toMatchObject({total:0,pending:0,human_decision_required:false});
    r=await context.makeRequest('PUT',`/programme-manager/allocation-runs/${allocationRun.id}/confirm`,{confirm:true,reason:'All allocation decisions checked by programme lead'},token);
    expect(r.data).toMatchObject({decisions_confirmed:3,human_confirmation:true,enrolments_committed:false,confirmation:{allocation_run_id:allocationRun.id,input_hash:allocationRun.input_hash,decision_snapshot:{decisions:expect.any(Array)}}});
    expect(r.data.confirmation.decision_snapshot.decisions).toHaveLength(3);
    attempt=await context.makeRequest('PUT',`/programme-manager/allocation-recommendations/${ivy.id}/decision`,{action:'rejected',confirm:true,reason:'Too late'},token);
    expect(attempt.status).toBe(409);expect(attempt.data.error.code).toBe('ALLOCATION_ALREADY_CONFIRMED');
    attempt=await context.makeRequest('POST',`/programme-manager/surveys/${survey.id}/allocation-runs`,{external_key:'allocation:test:after-confirm'},token);
    expect(attempt.status).toBe(409);expect(attempt.data.error.code).toBe('ALLOCATION_ALREADY_CONFIRMED');
    const history=await context.makeRequest('GET',`/programme-manager/allocation-runs/${allocationRun.id}/decision-history?limit=500`,null,token);
    expect(history.data.limit).toBe(50);expect(history.data.total).toBe(4);
    expect(history.data.history.map(x=>x.action)).toEqual(['run_confirmed','decided','decided','decided']);
  });

  test('publishes confirmed enrolments and hands active occurrence rosters to Event Attendance',async()=>{
    let r=await context.makeRequest('POST',`/programme-manager/allocation-runs/${allocationRun.id}/enrolments`,{confirm:false,reason:'Not confirmed'},token);
    expect(r.status).toBe(409);expect(r.data.error.code).toBe('HUMAN_CONFIRMATION_REQUIRED');
    r=await context.makeRequest('POST',`/programme-manager/allocation-runs/${allocationRun.id}/enrolments`,{confirm:true,reason:'Publish the sealed programme allocation'},token);
    expect(r.data).toMatchObject({idempotent:false,human_confirmation:true,rejected_preserved:0,enrolment_batch:{active_count:3,rejected_count:0},enrolments:expect.any(Array)});
    expect(r.data.enrolments).toHaveLength(3);
    const activated=await context.makeRequest('GET',`/programme-manager/programmes/${programme.id}`,null,token);
    expect(activated.data.programme.status).toBe('active');
    const firstBatch=r.data.enrolment_batch;
    r=await context.makeRequest('POST',`/programme-manager/allocation-runs/${allocationRun.id}/enrolments`,{confirm:true,reason:'Retry'},token);
    expect(r.data).toMatchObject({idempotent:true,enrolment_batch:{id:firstBatch.id}});expect(r.data.enrolments).toHaveLength(3);
    let roster=await context.makeRequest('GET',`/programme-manager/offerings/${offeringTwo.id}/roster`,null,token);
    expect(roster.data).toMatchObject({count:2,attendance_subject:{subject_component:'programme_manager',subject_type:'programme_offering',subject_id:String(offeringTwo.id)}});
    expect(roster.data.roster.map(x=>x.canonical_student_id).sort()).toEqual(['ST-001','ST-002']);
    let enrolment=roster.data.roster.find(x=>x.canonical_student_id==='ST-001');
    r=await context.makeRequest('PUT',`/programme-manager/enrolments/${enrolment.id}/withdraw`,{expected_revision:enrolment.revision,confirm:true,reason:'Student temporarily left the programme'},token);
    expect(r.data.enrolment.status).toBe('withdrawn');enrolment=r.data.enrolment;
    roster=await context.makeRequest('GET',`/programme-manager/offerings/${offeringTwo.id}/roster`,null,token);expect(roster.data.count).toBe(1);
    r=await context.makeRequest('PUT',`/programme-manager/enrolments/${enrolment.id}/reinstate`,{expected_revision:enrolment.revision,confirm:true,reason:'Student returned before the occurrence'},token);
    expect(r.data.enrolment.status).toBe('active');
    const history=await context.makeRequest('GET',`/programme-manager/enrolments/${enrolment.id}/history?limit=500`,null,token);
    expect(history.data.limit).toBe(50);expect(history.data.history.map(x=>x.action)).toEqual(['reinstated','withdrawn','enrolled']);
    r=await context.makeRequest('POST',`/programme-manager/offerings/${offeringTwo.id}/attendance-handoffs`,{external_key:'occurrence:2048-09-08:p1',title:'Monday Coding',starts_at:'2048-09-08T08:00:00.000Z',ends_at:'2048-09-08T08:50:00.000Z',confirm:true,reason:'Open attendance for the scheduled occurrence'},token);
    expect(r.data).toMatchObject({idempotent:false,handoff:{status:'completed',roster_hash:expect.any(String)},attendance_session:{status:'open',counts:{expected:2}}});
    expect(r.data.attendance_session.records.map(x=>x.party_id).sort()).toEqual(['ST-001','ST-002']);
    const handoffId=r.data.handoff.id;
    r=await context.makeRequest('POST',`/programme-manager/offerings/${offeringTwo.id}/attendance-handoffs`,{external_key:'occurrence:2048-09-08:p1',title:'Monday Coding',confirm:true,reason:'Safe retry'},token);
    expect(r.data).toMatchObject({idempotent:true,handoff:{id:handoffId,status:'completed'}});
  });

  test('protects published designs and reinstates withdrawals as drafts',async()=>{
    let r=await context.makeRequest('PUT',`/programme-manager/surveys/${survey.id}/design`,{expected_revision:survey.revision,questions:survey.questions},token);
    expect(r.status).toBe(409);
    r=await context.makeRequest('PUT',`/programme-manager/surveys/${survey.id}/withdraw`,{expected_revision:survey.revision,reason:'Selection window postponed'},token);
    expect(r.data.survey.status).toBe('withdrawn');survey=r.data.survey;
    r=await context.makeRequest('PUT',`/programme-manager/surveys/${survey.id}/reinstate`,{expected_revision:survey.revision,reason:'Ready to revise'},token);
    expect(r.data.survey.status).toBe('draft');survey=r.data.survey;
    const publications=await context.makeRequest('GET',`/programme-manager/surveys/${survey.id}/publications?limit=500`,null,token);
    expect(publications.data.limit).toBe(50);
    expect(publications.data.publications).toEqual([expect.objectContaining({version:1,status:'withdrawn'})]);
    const history=await context.makeRequest('GET',`/programme-manager/surveys/${survey.id}/history`,null,token);
    expect(history.data.history.map(x=>x.action)).toEqual(['reinstate','withdraw','published','design_saved','created']);
  });
});
