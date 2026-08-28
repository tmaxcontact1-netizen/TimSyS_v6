import { describe, expect, it } from "vitest";

import { readOperationalDashboardStatus } from "../../src/infrastructure/database/operational-dashboard.js";

describe("operational dashboard", () => {
  it("projects bounded durable operator facts without exposing approval secrets", async () => {
    let sql = "";
    const database = {
      query: async (statement: string) => {
        sql = statement;
        return {
          rows: [
            {
              entry_blocked: true,
              entry_block_reason: "Emergency stop requested by operator",
              entry_control_changed_at: new Date("2026-08-27T10:00:00.000Z"),
              entry_control_changed_by: "telegram:42",
              pending_approvals: 2,
              approved_approvals: 1,
              expiring_approvals: 1,
              oldest_approval_at: "2026-08-27T09:58:00.000Z",
              queued_entries: 3,
              submitted_entries: 1,
              reconciliation_backlog: 1,
              failed_work: 2,
              telegram_last_update_at: "2026-08-27T10:01:00.000Z",
              telegram_failed_updates: 0,
            },
          ],
        };
      },
    };
    const status = await readOperationalDashboardStatus(database as never);
    expect(status).toMatchObject({
      entryBlocked: true,
      approvals: { pending: 2, approved: 1, expiringSoon: 1 },
      queuedEntries: 3,
      reconciliationBacklog: 1,
      telegramFailedUpdates: 0,
    });
    expect(status.entryControlChangedAt).toBe("2026-08-27T10:00:00.000Z");
    expect(JSON.stringify(status)).not.toContain("nonce");
    expect(sql).toContain("operator_runtime_control");
    expect(sql).toContain("operator_approvals");
    expect(sql).toContain("position_reconciliation");
  });

  it("defaults to an open entry control before the singleton has been written", async () => {
    const database = {
      query: async () => ({
        rows: [
          {
            entry_blocked: null,
            entry_block_reason: null,
            entry_control_changed_at: null,
            entry_control_changed_by: null,
            pending_approvals: 0,
            approved_approvals: 0,
            expiring_approvals: 0,
            oldest_approval_at: null,
            queued_entries: 0,
            submitted_entries: 0,
            reconciliation_backlog: 0,
            failed_work: 0,
            telegram_last_update_at: null,
            telegram_failed_updates: 0,
          },
        ],
      }),
    };
    expect((await readOperationalDashboardStatus(database as never)).entryBlocked).toBe(false);
  });
});
