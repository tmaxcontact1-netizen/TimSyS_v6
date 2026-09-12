import type { Pool } from "pg";

export interface OperationalApprovalSummary {
  readonly pending: number;
  readonly approved: number;
  readonly expiringSoon: number;
  readonly oldestRequestedAt: string | null;
}

export interface OperationalDashboardStatus {
  readonly entryBlocked: boolean;
  readonly entryBlockReason: string | null;
  readonly entryControlChangedAt: string | null;
  readonly entryControlChangedBy: string | null;
  readonly approvals: OperationalApprovalSummary;
  readonly queuedEntries: number;
  readonly submittedEntries: number;
  readonly reconciliationBacklog: number;
  readonly failedWork: number;
  readonly telegramLastUpdateAt: string | null;
  readonly telegramFailedUpdates: number;
}

interface OperationalRow {
  readonly entry_blocked: boolean | null;
  readonly entry_block_reason: string | null;
  readonly entry_control_changed_at: Date | string | null;
  readonly entry_control_changed_by: string | null;
  readonly pending_approvals: number | string;
  readonly approved_approvals: number | string;
  readonly expiring_approvals: number | string;
  readonly oldest_approval_at: Date | string | null;
  readonly queued_entries: number | string;
  readonly submitted_entries: number | string;
  readonly reconciliation_backlog: number | string;
  readonly failed_work: number | string;
  readonly telegram_last_update_at: Date | string | null;
  readonly telegram_failed_updates: number | string;
}

function timestamp(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

/** A bounded, read-only projection of the facts an operator needs to act safely. */
export async function readOperationalDashboardStatus(
  database: Pick<Pool, "query">,
): Promise<OperationalDashboardStatus> {
  const result = await database.query<OperationalRow>(
    `SELECT
       control.entry_blocked,
       control.reason AS entry_block_reason,
       control.changed_at AS entry_control_changed_at,
       control.changed_by AS entry_control_changed_by,
       (SELECT count(*)::int FROM operator_approvals
         WHERE state='pending' AND expires_at>=now()) AS pending_approvals,
       (SELECT count(*)::int FROM operator_approvals
         WHERE state='approved' AND expires_at>=now()) AS approved_approvals,
       (SELECT count(*)::int FROM operator_approvals
         WHERE state IN ('pending','approved') AND expires_at BETWEEN now() AND now()+interval '5 minutes')
         AS expiring_approvals,
       (SELECT min(requested_at) FROM operator_approvals
         WHERE state='pending' AND expires_at>=now()) AS oldest_approval_at,
       (SELECT count(*)::int FROM entry_plans WHERE state IN ('planned','quoting'))
         AS queued_entries,
       (SELECT count(*)::int FROM orders WHERE state='submitted') AS submitted_entries,
       (SELECT count(*)::int FROM jobs
         WHERE job_type='position_reconciliation' AND state IN ('available','leased'))
         AS reconciliation_backlog,
       (SELECT count(*)::int FROM jobs
         WHERE state='failed'
            OR (state IN ('available','leased') AND last_error_json IS NOT NULL)) AS failed_work,
       (SELECT max(received_at) FROM telegram_operator_updates) AS telegram_last_update_at,
       (SELECT count(*)::int FROM telegram_operator_updates WHERE state='failed')
         AS telegram_failed_updates
     FROM (SELECT true AS singleton) seed
     LEFT JOIN operator_runtime_control control ON control.singleton=seed.singleton`,
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error("Operational status is unavailable");
  return Object.freeze({
    entryBlocked: row.entry_blocked ?? false,
    entryBlockReason: row.entry_block_reason,
    entryControlChangedAt: timestamp(row.entry_control_changed_at),
    entryControlChangedBy: row.entry_control_changed_by,
    approvals: Object.freeze({
      pending: Number(row.pending_approvals),
      approved: Number(row.approved_approvals),
      expiringSoon: Number(row.expiring_approvals),
      oldestRequestedAt: timestamp(row.oldest_approval_at),
    }),
    queuedEntries: Number(row.queued_entries),
    submittedEntries: Number(row.submitted_entries),
    reconciliationBacklog: Number(row.reconciliation_backlog),
    failedWork: Number(row.failed_work),
    telegramLastUpdateAt: timestamp(row.telegram_last_update_at),
    telegramFailedUpdates: Number(row.telegram_failed_updates),
  });
}
