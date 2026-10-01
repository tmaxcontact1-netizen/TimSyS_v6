export async function loadProgrammeTiming(api, programme) {
  const response = await api.getSchedulerSetup(programme.academic_year_id);
  const scheduler = response.data.setup;
  if (!scheduler) return { windows: [], notice: 'No Scheduler setup exists for this academic year. Configure and publish programme windows in Scheduler before completing timing.' };
  const windows = [];
  let page = 1, total;
  do {
    const result = await api.listProgrammeManagerSchedulerWindows({scheduler_setup_id: scheduler.id, page, limit: 50});
    const rows = result.data.windows || [];
    windows.push(...rows.map(row => ({...row, scheduler_setup_id: scheduler.id})));
    total = result.data.total || 0;
    if (!rows.length) break;
    page++;
  } while (windows.length < total);
  return {windows, notice: windows.length ? '' : 'No published programme windows exist for this academic year. Publish programme windows in Scheduler before completing timing.'};
}

export function programmeSetupForm(setup) {
  const p=setup.purpose||{},t=setup.timing||{},l=setup.location||{},a=setup.participation||{},g=setup.governance||{};
  const join=value=>(value||[]).join(', ');
  return {summary:p.summary||'',outcome:p.intended_outcome||'',categories:join(p.programme_categories),notes:p.notes||'',
    scheduler_setup_id:t.scheduler_setup_id||'',scheduler_window_ids:join(t.scheduler_window_ids),window_choice:String(t.scheduler_window_ids?.[0]||''),delivery_notes:t.delivery_notes||'',
    strategy:l.strategy||'scheduler_assigned',location_requirements:join(l.requirements),location_notes:l.notes||'',
    participant_type:a.participant_type||'student',scope:a.scope||'open',respondent_mode:a.respondent_mode||'student',scope_notes:a.scope_notes||'',
    owner_staff_ids:join(g.owner_staff_ids),submitter_roles:join(g.submitter_roles||['student']),amendment_roles:join(g.amendment_roles),manual_edit_roles:join(g.manual_edit_roles||['superuser','principal']),governance_notes:g.notes||''};
}
