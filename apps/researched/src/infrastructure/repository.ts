import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  canTransition,
  transitionNeedsReason,
  type LifecycleKind,
} from "../domain/lifecycle.js";
import {buildAnalysisJobs} from "../application/analysis-jobs.js";
export class ResearchRepository {
  constructor(
    private readonly db: Pick<Pool, "query"> & Partial<Pick<Pool, "connect">>,
  ) {}
  private async assertStudyWritable(studyId: string) {
    const status = (
      await this.db.query("SELECT status FROM researched.studies WHERE id=$1", [
        studyId,
      ])
    ).rows[0]?.status;
    if (status === "locked" || status === "archived")
      throw new Error("study_read_only");
  }
  async studies() {
    return (
      await this.db.query(
        "SELECT * FROM researched.studies ORDER BY created_at DESC",
      )
    ).rows;
  }
  async studyReadiness(studyId: string) {
    const result = await this.db.query(
      `SELECT
        EXISTS(SELECT 1 FROM researched.studies WHERE id=$1) AS exists,
        (SELECT count(*)::int FROM researched.sources WHERE study_id=$1 AND corpus_status='included') AS included_sources,
        (SELECT count(*)::int FROM researched.sources WHERE study_id=$1 AND corpus_status='pending') AS pending_sources,
        (SELECT count(*)::int FROM researched.sources s WHERE s.study_id=$1 AND s.corpus_status='included' AND NOT EXISTS(SELECT 1 FROM researched.source_snapshots x JOIN researched.source_extractions e ON e.snapshot_id=x.id WHERE x.source_id=s.id AND e.status='completed')) AS unextracted_sources,
        (SELECT count(*)::int FROM researched.sources s WHERE s.study_id=$1 AND s.corpus_status='included' AND NOT EXISTS(SELECT 1 FROM researched.evidence_items e WHERE e.source_id=s.id AND e.status='active')) AS uncited_sources,
        (SELECT count(*)::int FROM researched.findings WHERE study_id=$1 AND status='confirmed') AS confirmed_findings,
        (SELECT count(*)::int FROM researched.acquisition_queue q JOIN researched.sources s ON s.id=q.source_id WHERE s.study_id=$1 AND q.status IN('queued','running')) AS active_queue,
        (SELECT methodology IS NOT NULL AND btrim(methodology)<>'' FROM researched.studies WHERE id=$1) AS has_methodology`,
      [studyId],
    );
    const value = result.rows[0];
    if (!value?.exists) return null;
    const checks = [
      {
        id: "included-sources",
        passed: value.included_sources > 0,
        blocking: true,
        message:
          value.included_sources > 0
            ? `${value.included_sources} source(s) included`
            : "Include at least one source",
      },
      {
        id: "pending-decisions",
        passed: value.pending_sources === 0,
        blocking: true,
        message:
          value.pending_sources === 0
            ? "All corpus decisions complete"
            : `${value.pending_sources} source(s) still pending`,
      },
      {
        id: "source-extraction",
        passed: value.unextracted_sources === 0,
        blocking: true,
        message:
          value.unextracted_sources === 0
            ? "All included sources extracted"
            : `${value.unextracted_sources} included source(s) not extracted`,
      },
      {
        id: "source-evidence",
        passed: value.uncited_sources === 0,
        blocking: true,
        message:
          value.uncited_sources === 0
            ? "Every included source has evidence"
            : `${value.uncited_sources} included source(s) have no evidence`,
      },
      {
        id: "acquisition-queue",
        passed: value.active_queue === 0,
        blocking: true,
        message:
          value.active_queue === 0
            ? "Acquisition queue is clear"
            : `${value.active_queue} acquisition(s) still queued or running`,
      },
      {
        id: "confirmed-findings",
        passed: value.confirmed_findings > 0,
        blocking: true,
        message:
          value.confirmed_findings > 0
            ? `${value.confirmed_findings} finding(s) confirmed`
            : "Confirm at least one finding",
      },
      {
        id: "methodology",
        passed: value.has_methodology === true,
        blocking: false,
        message: value.has_methodology
          ? "Methodology recorded"
          : "Methodology has not been recorded",
      },
    ];
    return {
      readyToLock: checks.every((check) => !check.blocking || check.passed),
      checks,
    };
  }
  async transitionStudy(
    id: string,
    targetStatus: string,
    actor: string,
    reason: string | null | undefined,
    at: string,
  ) {
    const before = (
      await this.db.query("SELECT * FROM researched.studies WHERE id=$1", [id])
    ).rows[0];
    if (!before) return null;
    if (!canTransition("study", before.status, targetStatus))
      throw new Error("invalid_study_transition");
    if (transitionNeedsReason("study", before.status, targetStatus) && !reason)
      throw new Error("transition_reason_required");
    if (targetStatus === "locked") {
      const readiness = await this.studyReadiness(id);
      if (!readiness?.readyToLock) throw new Error("study_not_ready");
    }
    const after = (
      await this.db.query(
        "UPDATE researched.studies SET status=$2,updated_at=$3 WHERE id=$1 AND status=$4 RETURNING *",
        [id, targetStatus, at, before.status],
      )
    ).rows[0];
    if (!after) throw new Error("concurrent_transition");
    await this.db.query(
      "INSERT INTO researched.audit_events(id,study_id,entity_kind,entity_id,action,actor,occurred_at,before_value,after_value,reason) VALUES($1,$2,'study',$2,'status_changed',$3,$4,$5,$6,$7)",
      [
        randomUUID(),
        id,
        actor,
        at,
        JSON.stringify(before),
        JSON.stringify(after),
        reason ?? null,
      ],
    );
    return after;
  }
  async transitionEvidence(
    id: string,
    targetStatus: string,
    actor: string,
    reason: string | null | undefined,
    at: string,
  ) {
    return this.transitionRecord(
      "evidence_items",
      "evidence",
      id,
      targetStatus,
      actor,
      reason,
      at,
    );
  }
  async transitionFinding(
    id: string,
    targetStatus: string,
    actor: string,
    reason: string | null | undefined,
    at: string,
  ) {
    return this.transitionRecord(
      "findings",
      "finding",
      id,
      targetStatus,
      actor,
      reason,
      at,
    );
  }
  private async transitionRecord(
    table: "evidence_items" | "findings",
    kind: string,
    id: string,
    targetStatus: string,
    actor: string,
    reason: string | null | undefined,
    at: string,
  ) {
    const before = (
      await this.db.query(`SELECT * FROM researched.${table} WHERE id=$1`, [id])
    ).rows[0];
    if (!before) return null;
    await this.assertStudyWritable(before.study_id);
    if (!canTransition(kind as LifecycleKind, before.status, targetStatus))
      throw new Error("invalid_status_transition");
    if (
      transitionNeedsReason(
        kind as LifecycleKind,
        before.status,
        targetStatus,
      ) &&
      !reason
    )
      throw new Error("transition_reason_required");
    const after = (
      await this.db.query(
        `UPDATE researched.${table} SET status=$2,updated_at=$3 WHERE id=$1 AND status=$4 RETURNING *`,
        [id, targetStatus, at, before.status],
      )
    ).rows[0];
    if (!after) throw new Error("concurrent_transition");
    await this.db.query(
      "INSERT INTO researched.audit_events(id,study_id,entity_kind,entity_id,action,actor,occurred_at,before_value,after_value,reason) VALUES($1,$2,$3,$4,'status_changed',$5,$6,$7,$8,$9)",
      [
        randomUUID(),
        before.study_id,
        kind,
        id,
        actor,
        at,
        JSON.stringify(before),
        JSON.stringify(after),
        reason ?? null,
      ],
    );
    return after;
  }
  async auditTrail(studyId: string, limit: number, offset: number) {
    return (
      await this.db.query(
        "SELECT * FROM researched.audit_events WHERE study_id=$1 ORDER BY occurred_at DESC LIMIT $2 OFFSET $3",
        [studyId, limit, offset],
      )
    ).rows;
  }
  async createStudy(id: string, value: any, at: string) {
    const r = await this.db.query(
      `INSERT INTO researched.studies(id,title,research_question,description,methodology,inclusion_rules,exclusion_rules,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
      [
        id,
        value.title,
        value.researchQuestion,
        value.description ?? null,
        value.methodology ?? null,
        JSON.stringify(value.inclusionRules),
        JSON.stringify(value.exclusionRules),
        at,
      ],
    );
    return r.rows[0];
  }
  async entityTypes(studyId: string) {
    return (
      await this.db.query(
        "SELECT * FROM researched.entity_types WHERE study_id=$1 ORDER BY name",
        [studyId],
      )
    ).rows;
  }
  async createEntityType(id: string, v: any, at: string) {
    await this.assertStudyWritable(v.studyId);
    return (
      await this.db.query(
        `INSERT INTO researched.entity_types(id,study_id,name,description,field_schema,parent_type_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          id,
          v.studyId,
          v.name,
          v.description ?? null,
          JSON.stringify(v.fieldSchema),
          v.parentTypeId ?? null,
          at,
        ],
      )
    ).rows[0];
  }
  async entities(studyId: string) {
    return (
      await this.db.query(
        "SELECT e.*,t.name AS entity_type FROM researched.entities e JOIN researched.entity_types t ON t.id=e.entity_type_id WHERE e.study_id=$1 ORDER BY e.label",
        [studyId],
      )
    ).rows;
  }
  async createEntity(id: string, v: any, at: string) {
    await this.assertStudyWritable(v.studyId);
    return (
      await this.db.query(
        `INSERT INTO researched.entities(id,study_id,entity_type_id,parent_id,label,attributes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
        [
          id,
          v.studyId,
          v.entityTypeId,
          v.parentId ?? null,
          v.label,
          JSON.stringify(v.attributes),
          at,
        ],
      )
    ).rows[0];
  }
  async sources(studyId: string, limit: number, offset: number) {
    const [items, count] = await Promise.all([
      this.db.query(
        `SELECT s.*,
          (SELECT count(*)::int FROM researched.source_snapshots x WHERE x.source_id=s.id) AS snapshot_count,
          (SELECT x.id FROM researched.source_snapshots x WHERE x.source_id=s.id ORDER BY x.sequence DESC LIMIT 1) AS latest_snapshot_id,
          (SELECT e.status FROM researched.source_snapshots x JOIN researched.source_extractions e ON e.snapshot_id=x.id WHERE x.source_id=s.id ORDER BY x.sequence DESC LIMIT 1) AS extraction_status
         FROM researched.sources s WHERE study_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [studyId, limit, offset],
      ),
      this.db.query(
        "SELECT count(*)::int AS total FROM researched.sources WHERE study_id=$1",
        [studyId],
      ),
    ]);
    return {
      items: items.rows,
      total: count.rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }
  async createSource(id: string, v: any, at: string) {
    await this.assertStudyWritable(v.studyId);
    return (
      await this.db.query(
        `INSERT INTO researched.sources(id,study_id,entity_id,label,original_url,source_type,authority,corpus_status,completeness,exclusion_reason,notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
        [
          id,
          v.studyId,
          v.entityId ?? null,
          v.label,
          v.originalUrl,
          v.sourceType,
          v.authority,
          v.corpusStatus,
          v.completeness,
          v.exclusionReason ?? null,
          v.notes ?? null,
          at,
        ],
      )
    ).rows[0];
  }
  async decideSource(
    id: string,
    value: {
      corpusStatus: string;
      reason?: string | null | undefined;
      actor: string;
    },
    at: string,
  ) {
    const before = (
      await this.db.query("SELECT * FROM researched.sources WHERE id=$1", [id])
    ).rows[0];
    if (!before) return null;
    await this.assertStudyWritable(before.study_id);
    const after = (
      await this.db.query(
        "UPDATE researched.sources SET corpus_status=$2,exclusion_reason=$3,updated_at=$4 WHERE id=$1 RETURNING *",
        [
          id,
          value.corpusStatus,
          value.corpusStatus === "excluded" ? (value.reason ?? null) : null,
          at,
        ],
      )
    ).rows[0];
    await this.db.query(
      "INSERT INTO researched.audit_events(id,study_id,entity_kind,entity_id,action,actor,occurred_at,before_value,after_value,reason) VALUES($1,$2,'source',$3,'corpus_decision',$4,$5,$6,$7,$8)",
      [
        randomUUID(),
        before.study_id,
        id,
        value.actor,
        at,
        JSON.stringify(before),
        JSON.stringify(after),
        value.reason ?? null,
      ],
    );
    return after;
  }
  async source(id: string) {
    return (
      (
        await this.db.query("SELECT * FROM researched.sources WHERE id=$1", [
          id,
        ])
      ).rows[0] ?? null
    );
  }
  async snapshots(sourceId: string) {
    return (
      await this.db.query(
        "SELECT * FROM researched.source_snapshots WHERE source_id=$1 ORDER BY sequence DESC",
        [sourceId],
      )
    ).rows;
  }
  async snapshot(id: string) {
    return (
      (
        await this.db.query(
          "SELECT x.*,s.study_id,s.original_url,s.resolved_url FROM researched.source_snapshots x JOIN researched.sources s ON s.id=x.source_id WHERE x.id=$1",
          [id],
        )
      ).rows[0] ?? null
    );
  }
  async extraction(snapshotId: string) {
    const record = (
      await this.db.query(
        "SELECT * FROM researched.source_extractions WHERE snapshot_id=$1",
        [snapshotId],
      )
    ).rows[0];
    if (!record) return null;
    const segments = await this.db.query(
      "SELECT id,ordinal,segment_kind,content,content_hash,locator FROM researched.extracted_segments WHERE extraction_id=$1 ORDER BY ordinal",
      [record.id],
    );
    return { ...record, segments: segments.rows };
  }
  async saveExtraction(
    id: string,
    snapshotId: string,
    result: {
      status: string;
      extractorVersion: string;
      text: string;
      warnings: readonly string[];
      segments: readonly {
        ordinal: number;
        kind: string;
        content: string;
        hash: string;
        locator: Readonly<Record<string,string|number>>;
      }[];
    },
    at: string,
    replace = false,
  ) {
    const owner = (
      await this.db.query(
        "SELECT s.study_id FROM researched.source_snapshots x JOIN researched.sources s ON s.id=x.source_id WHERE x.id=$1",
        [snapshotId],
      )
    ).rows[0];
    if (!owner) throw new Error("snapshot_not_found");
    await this.assertStudyWritable(owner.study_id);
    const existing = await this.extraction(snapshotId);
    if (existing && !replace) return existing;
    const client = this.db.connect ? await this.db.connect() : null;
    const query = client
      ? client.query.bind(client)
      : this.db.query.bind(this.db);
    if (client) await query("BEGIN");
    try {
      const saved = (
        await query(
          `INSERT INTO researched.source_extractions(id,snapshot_id,status,extractor_version,extracted_at,text_content,character_count,warnings)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT(snapshot_id) DO UPDATE SET status=excluded.status,extractor_version=excluded.extractor_version,extracted_at=excluded.extracted_at,text_content=excluded.text_content,character_count=excluded.character_count,warnings=excluded.warnings
           RETURNING id`,
          [
            id,
            snapshotId,
            result.status,
            result.extractorVersion,
            at,
            result.text,
            result.text.length,
            JSON.stringify(result.warnings),
          ],
        )
      ).rows[0];
      await query(
        "DELETE FROM researched.extracted_segments WHERE extraction_id=$1",
        [saved.id],
      );
      for (const item of result.segments) {
        await query(
          "INSERT INTO researched.extracted_segments(id,extraction_id,ordinal,segment_kind,content,content_hash,locator) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            randomUUID(),
            saved.id,
            item.ordinal,
            item.kind,
            item.content,
            item.hash,
            JSON.stringify(item.locator),
          ],
        );
      }
      if (client) await query("COMMIT");
    } catch (error) {
      if (client) await query("ROLLBACK");
      throw error;
    } finally {
      client?.release();
    }
    return this.extraction(snapshotId);
  }
  async latestHash(sourceId: string) {
    return (
      await this.db.query(
        "SELECT content_hash FROM researched.source_snapshots WHERE source_id=$1 ORDER BY sequence DESC LIMIT 1",
        [sourceId],
      )
    ).rows[0]?.content_hash as string | undefined;
  }
  async researchCodes(studyId: string) {
    return (
      await this.db.query(
        "SELECT * FROM researched.research_codes WHERE study_id=$1 ORDER BY label",
        [studyId],
      )
    ).rows;
  }
  async createResearchCode(id: string, value: any, at: string) {
    await this.assertStudyWritable(value.studyId);
    return (
      await this.db.query(
        "INSERT INTO researched.research_codes(id,study_id,label,description,colour,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          id,
          value.studyId,
          value.label,
          value.description ?? null,
          value.colour,
          at,
        ],
      )
    ).rows[0];
  }
  async evidence(
    studyId: string,
    filters: {
      query: string;
      status: string;
      evidenceType: string;
      codeId: string;
      limit: number;
      offset: number;
    } = {
      query: "",
      status: "",
      evidenceType: "",
      codeId: "",
      limit: 50,
      offset: 0,
    },
  ) {
    const parameters = [
      studyId,
      filters.query,
      filters.status,
      filters.evidenceType,
      filters.codeId,
      filters.limit,
      filters.offset,
    ];
    const predicate = `e.study_id=$1 AND ($2='' OR e.interpretation ILIKE '%'||$2||'%' OR e.captured_text ILIKE '%'||$2||'%' OR s.label ILIKE '%'||$2||'%') AND ($3='' OR e.status=$3) AND ($4='' OR e.evidence_type=$4) AND ($5='' OR EXISTS(SELECT 1 FROM researched.evidence_item_codes match_code WHERE match_code.evidence_id=e.id AND match_code.code_id=$5::uuid))`;
    const [items, count] = await Promise.all([
      this.db.query(
        `SELECT e.*,s.label AS source_label,x.sequence AS snapshot_sequence,g.ordinal AS segment_ordinal,
          COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,'colour',c.colour)) FILTER(WHERE c.id IS NOT NULL),'[]') AS codes
         FROM researched.evidence_items e
         JOIN researched.sources s ON s.id=e.source_id
         JOIN researched.source_snapshots x ON x.id=e.snapshot_id
         JOIN researched.extracted_segments g ON g.id=e.segment_id
         LEFT JOIN researched.evidence_item_codes ec ON ec.evidence_id=e.id
         LEFT JOIN researched.research_codes c ON c.id=ec.code_id
         WHERE ${predicate} GROUP BY e.id,s.label,x.sequence,g.ordinal ORDER BY e.created_at DESC LIMIT $6 OFFSET $7`,
        parameters,
      ),
      this.db.query(
        `SELECT count(*)::int AS total FROM researched.evidence_items e JOIN researched.sources s ON s.id=e.source_id WHERE ${predicate}`,
        parameters.slice(0, 5),
      ),
    ]);
    return {
      items: items.rows,
      total: count.rows[0]?.total ?? 0,
      limit: filters.limit,
      offset: filters.offset,
    };
  }
  async segmentContext(segmentId: string) {
    return (
      (
        await this.db.query(
          `SELECT g.id,g.content,x.id AS snapshot_id,s.id AS source_id,s.study_id
         FROM researched.extracted_segments g
         JOIN researched.source_extractions e ON e.id=g.extraction_id
         JOIN researched.source_snapshots x ON x.id=e.snapshot_id
         JOIN researched.sources s ON s.id=x.source_id WHERE g.id=$1`,
          [segmentId],
        )
      ).rows[0] ?? null
    );
  }
  async createEvidence(id: string, value: any, context: any, at: string) {
    await this.assertStudyWritable(value.studyId);
    const client = this.db.connect ? await this.db.connect() : null;
    const query = client
      ? client.query.bind(client)
      : this.db.query.bind(this.db);
    if (client) await query("BEGIN");
    try {
      if (value.codeIds.length) {
        const valid = await query(
          "SELECT count(*)::int AS total FROM researched.research_codes WHERE study_id=$1 AND id=ANY($2::uuid[])",
          [value.studyId, value.codeIds],
        );
        if (valid.rows[0]?.total !== new Set(value.codeIds).size)
          throw new Error("invalid_evidence_codes");
      }
      const evidence = (
        await query(
          `INSERT INTO researched.evidence_items(id,study_id,source_id,snapshot_id,segment_id,evidence_type,captured_text,interpretation,confidence,notes,captured_by,created_at,updated_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
          [
            id,
            value.studyId,
            context.source_id,
            context.snapshot_id,
            context.id,
            value.evidenceType,
            context.content,
            value.interpretation,
            value.confidence,
            value.notes ?? null,
            value.actor,
            at,
          ],
        )
      ).rows[0];
      for (const codeId of new Set<string>(value.codeIds)) {
        await query(
          "INSERT INTO researched.evidence_item_codes(evidence_id,code_id) VALUES($1,$2)",
          [id, codeId],
        );
      }
      await query(
        "INSERT INTO researched.audit_events(id,study_id,entity_kind,entity_id,action,actor,occurred_at,after_value) VALUES($1,$2,'evidence',$3,'captured',$4,$5,$6)",
        [
          randomUUID(),
          value.studyId,
          id,
          value.actor,
          at,
          JSON.stringify(evidence),
        ],
      );
      if (client) await query("COMMIT");
      return evidence;
    } catch (error) {
      if (client) await query("ROLLBACK");
      throw error;
    } finally {
      client?.release();
    }
  }
  async analysis(studyId: string) {
    const [corpus, coverage, codes, uncoded] = await Promise.all([
      this.db.query(
        `SELECT count(*)::int AS total,
          count(*) FILTER(WHERE corpus_status='included')::int AS included,
          count(*) FILTER(WHERE corpus_status='pending')::int AS pending,
          count(*) FILTER(WHERE corpus_status='excluded')::int AS excluded
         FROM researched.sources WHERE study_id=$1`,
        [studyId],
      ),
      this.db.query(
        `SELECT s.id,s.label,s.authority,s.completeness,s.corpus_status,
          (SELECT e.status FROM researched.source_snapshots x JOIN researched.source_extractions e ON e.snapshot_id=x.id WHERE x.source_id=s.id ORDER BY x.sequence DESC LIMIT 1) AS extraction_status,
          (SELECT count(*)::int FROM researched.evidence_items i WHERE i.source_id=s.id AND i.status='active') AS evidence_count
         FROM researched.sources s WHERE s.study_id=$1 ORDER BY s.label`,
        [studyId],
      ),
      this.db.query(
        `SELECT c.id,c.label,c.colour,
          count(e.id)::int AS evidence_count,
          count(DISTINCT e.source_id)::int AS source_count,
          count(*) FILTER(WHERE e.evidence_type='counterevidence')::int AS counterevidence_count,
          count(*) FILTER(WHERE e.confidence='low')::int AS low_confidence_count
         FROM researched.research_codes c
         LEFT JOIN researched.evidence_item_codes ec ON ec.code_id=c.id
         LEFT JOIN researched.evidence_items e ON e.id=ec.evidence_id AND e.status='active'
         WHERE c.study_id=$1 GROUP BY c.id ORDER BY c.label`,
        [studyId],
      ),
      this.db.query(
        `SELECT count(*)::int AS total FROM researched.evidence_items e
         WHERE e.study_id=$1 AND e.status='active' AND NOT EXISTS(SELECT 1 FROM researched.evidence_item_codes ec WHERE ec.evidence_id=e.id)`,
        [studyId],
      ),
    ]);
    const sources = coverage.rows;
    const included = sources.filter(
      (source) => source.corpus_status === "included",
    );
    return {
      corpus: corpus.rows[0],
      coverage: {
        includedSources: included.length,
        extractedSources: included.filter(
          (source) => source.extraction_status === "completed",
        ).length,
        evidencedSources: included.filter((source) => source.evidence_count > 0)
          .length,
        sources,
      },
      codes: codes.rows,
      uncodedEvidence: uncoded.rows[0]?.total ?? 0,
    };
  }
  async findings(
    studyId: string,
    filters: {
      query: string;
      status: string;
      limit: number;
      offset: number;
    } = { query: "", status: "", limit: 50, offset: 0 },
  ) {
    const predicate = `f.study_id=$1 AND ($2='' OR f.title ILIKE '%'||$2||'%' OR f.conclusion ILIKE '%'||$2||'%') AND ($3='' OR f.status=$3)`;
    const [items, count] = await Promise.all([
      this.db.query(
        `SELECT f.*,
          COALESCE(jsonb_agg(jsonb_build_object('id',e.id,'interpretation',e.interpretation,'capturedText',e.captured_text,'sourceId',e.source_id)) FILTER(WHERE e.id IS NOT NULL),'[]') AS evidence
         FROM researched.findings f
         LEFT JOIN researched.finding_evidence fe ON fe.finding_id=f.id
         LEFT JOIN researched.evidence_items e ON e.id=fe.evidence_id
         WHERE ${predicate} GROUP BY f.id ORDER BY f.created_at DESC LIMIT $4 OFFSET $5`,
        [studyId, filters.query, filters.status, filters.limit, filters.offset],
      ),
      this.db.query(
        `SELECT count(*)::int AS total FROM researched.findings f WHERE ${predicate}`,
        [studyId, filters.query, filters.status],
      ),
    ]);
    return {
      items: items.rows,
      total: count.rows[0]?.total ?? 0,
      limit: filters.limit,
      offset: filters.offset,
    };
  }
  async createFinding(id: string, value: any, at: string) {
    await this.assertStudyWritable(value.studyId);
    const evidenceIds = [...new Set<string>(value.evidenceIds)];
    const client = this.db.connect ? await this.db.connect() : null;
    const query = client
      ? client.query.bind(client)
      : this.db.query.bind(this.db);
    if (client) await query("BEGIN");
    try {
      const valid = await query(
        "SELECT count(*)::int AS total FROM researched.evidence_items WHERE study_id=$1 AND status='active' AND id=ANY($2::uuid[])",
        [value.studyId, evidenceIds],
      );
      if (valid.rows[0]?.total !== evidenceIds.length)
        throw new Error("invalid_finding_evidence");
      const finding = (
        await query(
          "INSERT INTO researched.findings(id,study_id,title,conclusion,confidence,limitations,authored_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *",
          [
            id,
            value.studyId,
            value.title,
            value.conclusion,
            value.confidence,
            value.limitations ?? null,
            value.actor,
            at,
          ],
        )
      ).rows[0];
      for (const evidenceId of evidenceIds)
        await query(
          "INSERT INTO researched.finding_evidence(finding_id,evidence_id) VALUES($1,$2)",
          [id, evidenceId],
        );
      await query(
        "INSERT INTO researched.audit_events(id,study_id,entity_kind,entity_id,action,actor,occurred_at,after_value) VALUES($1,$2,'finding',$3,'authored',$4,$5,$6)",
        [
          randomUUID(),
          value.studyId,
          id,
          value.actor,
          at,
          JSON.stringify(finding),
        ],
      );
      if (client) await query("COMMIT");
      return finding;
    } catch (error) {
      if (client) await query("ROLLBACK");
      throw error;
    } finally {
      client?.release();
    }
  }
  async reportData(studyId: string, findingIds: readonly string[]) {
    const [study, corpus, findings, evidence] = await Promise.all([
      this.db.query("SELECT * FROM researched.studies WHERE id=$1", [studyId]),
      this.db.query(
        `SELECT s.*,(SELECT count(*)::int FROM researched.source_snapshots x WHERE x.source_id=s.id) AS snapshot_count
         FROM researched.sources s WHERE s.study_id=$1 ORDER BY s.label`,
        [studyId],
      ),
      this.db.query(
        `SELECT f.*,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'interpretation',e.interpretation,'capturedText',e.captured_text,'sourceLabel',s.label,'originalUrl',s.original_url,'snapshotSequence',x.sequence,'segmentOrdinal',g.ordinal) ORDER BY s.label,x.sequence,g.ordinal)
            FROM researched.finding_evidence fe JOIN researched.evidence_items e ON e.id=fe.evidence_id JOIN researched.sources s ON s.id=e.source_id JOIN researched.source_snapshots x ON x.id=e.snapshot_id JOIN researched.extracted_segments g ON g.id=e.segment_id WHERE fe.finding_id=f.id),'[]') AS evidence
         FROM researched.findings f WHERE f.study_id=$1 AND f.status<>'withdrawn' AND (cardinality($2::uuid[])=0 OR f.id=ANY($2::uuid[])) ORDER BY f.created_at`,
        [studyId, findingIds],
      ),
      this.db.query(
        `SELECT e.*,s.label AS source_label,s.original_url,x.sequence AS snapshot_sequence,g.ordinal AS segment_ordinal
         FROM researched.evidence_items e JOIN researched.sources s ON s.id=e.source_id JOIN researched.source_snapshots x ON x.id=e.snapshot_id JOIN researched.extracted_segments g ON g.id=e.segment_id
         WHERE e.study_id=$1 AND e.status='active' ORDER BY s.label,x.sequence,g.ordinal`,
        [studyId],
      ),
    ]);
    if (!study.rows[0]) return null;
    if (findingIds.length && findings.rows.length !== new Set(findingIds).size)
      throw new Error("invalid_report_findings");
    return {
      study: study.rows[0],
      corpus: corpus.rows,
      findings: findings.rows,
      evidence: evidence.rows,
    };
  }
  async reports(studyId: string) {
    return (
      await this.db.query(
        "SELECT id,study_id,title,configuration,content_hash,generated_by,generated_at FROM researched.report_runs WHERE study_id=$1 ORDER BY generated_at DESC",
        [studyId],
      )
    ).rows;
  }
  async report(id: string) {
    return (
      (
        await this.db.query(
          "SELECT * FROM researched.report_runs WHERE id=$1",
          [id],
        )
      ).rows[0] ?? null
    );
  }
  async saveReport(
    id: string,
    value: any,
    payload: unknown,
    hash: string,
    at: string,
  ) {
    const report = (
      await this.db.query(
        "INSERT INTO researched.report_runs(id,study_id,title,configuration,report_payload,content_hash,generated_by,generated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          id,
          value.studyId,
          value.title,
          JSON.stringify({
            findingIds: value.findingIds,
            includeMethodology: value.includeMethodology,
            includeCorpus: value.includeCorpus,
            includeEvidenceTable: value.includeEvidenceTable,
          }),
          JSON.stringify(payload),
          hash,
          value.actor,
          at,
        ],
      )
    ).rows[0];
    await this.db.query(
      "INSERT INTO researched.audit_events(id,study_id,entity_kind,entity_id,action,actor,occurred_at,after_value) VALUES($1,$2,'report',$3,'generated',$4,$5,$6)",
      [
        randomUUID(),
        value.studyId,
        id,
        value.actor,
        at,
        JSON.stringify({ title: value.title, contentHash: hash }),
      ],
    );
    return report;
  }
  async beginRetrieval(id: string, sourceId: string, url: string, at: string) {
    const owner = (
      await this.db.query(
        "SELECT study_id FROM researched.sources WHERE id=$1",
        [sourceId],
      )
    ).rows[0];
    if (!owner) throw new Error("source_not_found");
    await this.assertStudyWritable(owner.study_id);
    await this.db.query(
      "INSERT INTO researched.retrieval_attempts(id,source_id,started_at,requested_url,outcome) VALUES($1,$2,$3,$4,'started')",
      [id, sourceId, at, url],
    );
    await this.db.query(
      "UPDATE researched.sources SET retrieval_status='fetching',last_error=NULL,updated_at=$2 WHERE id=$1",
      [sourceId, at],
    );
  }
  async completeRetrieval(input: {
    attemptId: string;
    sourceId: string;
    snapshotId: string;
    at: string;
    resolvedUrl: string;
    status: number;
    hash: string;
    mediaType: string;
    byteLength: number;
    storagePath: string;
    metadata: unknown;
    unchanged: boolean;
  }) {
    if (!input.unchanged)
      await this.db.query(
        `INSERT INTO researched.source_snapshots(id,source_id,sequence,retrieved_at,content_hash,media_type,byte_length,storage_path,retrieval_metadata) SELECT $2,$1,COALESCE(max(sequence),0)+1,$3,$4,$5,$6,$7,$8 FROM researched.source_snapshots WHERE source_id=$1`,
        [
          input.sourceId,
          input.snapshotId,
          input.at,
          input.hash,
          input.mediaType,
          input.byteLength,
          input.storagePath,
          JSON.stringify(input.metadata),
        ],
      );
    await this.db.query(
      "UPDATE researched.retrieval_attempts SET completed_at=$2,resolved_url=$3,http_status=$4,outcome=$5,response_metadata=$6 WHERE id=$1",
      [
        input.attemptId,
        input.at,
        input.resolvedUrl,
        input.status,
        input.unchanged ? "unchanged" : "snapshot_created",
        JSON.stringify(input.metadata),
      ],
    );
    await this.db.query(
      "UPDATE researched.sources SET retrieval_status=$2,last_fetched_at=$3,last_http_status=$4,last_error=NULL,resolved_url=$5,updated_at=$3 WHERE id=$1",
      [
        input.sourceId,
        input.unchanged ? "unchanged" : "available",
        input.at,
        input.status,
        input.resolvedUrl,
      ],
    );
    return {
      outcome: input.unchanged ? "unchanged" : "snapshot_created",
      snapshotId: input.unchanged ? null : input.snapshotId,
    };
  }
  async failRetrieval(
    attemptId: string,
    sourceId: string,
    at: string,
    errorCode: string,
  ) {
    await this.db.query(
      "UPDATE researched.retrieval_attempts SET completed_at=$2,outcome='failed',error_code=$3 WHERE id=$1",
      [attemptId, at, errorCode],
    );
    await this.db.query(
      "UPDATE researched.sources SET retrieval_status='failed',last_fetched_at=$2,last_error=$3,updated_at=$2 WHERE id=$1",
      [sourceId, at, errorCode],
    );
  }
  async saveDiscoveredLinks(
    snapshot: any,
    links: readonly { url: string; text: string | null }[],
    at: string,
  ) {
    await this.assertStudyWritable(snapshot.study_id);
    let added = 0;
    for (const link of links) {
      const result = await this.db.query(
        `INSERT INTO researched.discovered_links(id,study_id,parent_source_id,snapshot_id,discovered_url,link_text,discovered_at)
         VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(study_id,discovered_url) DO NOTHING`,
        [
          randomUUID(),
          snapshot.study_id,
          snapshot.source_id,
          snapshot.id,
          link.url,
          link.text,
          at,
        ],
      );
      added += result.rowCount ?? 0;
    }
    return {
      discovered: links.length,
      added,
      duplicates: links.length - added,
    };
  }
  async discoveredLinks(
    studyId: string,
    status: string,
    limit: number,
    offset: number,
  ) {
    const [items, count] = await Promise.all([
      this.db.query(
        "SELECT d.*,s.label AS parent_source_label FROM researched.discovered_links d JOIN researched.sources s ON s.id=d.parent_source_id WHERE d.study_id=$1 AND ($2='' OR d.status=$2) ORDER BY d.discovered_at DESC LIMIT $3 OFFSET $4",
        [studyId, status, limit, offset],
      ),
      this.db.query(
        "SELECT count(*)::int AS total FROM researched.discovered_links WHERE study_id=$1 AND ($2='' OR status=$2)",
        [studyId, status],
      ),
    ]);
    return {
      items: items.rows,
      total: count.rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }
  async decideDiscoveredLink(id: string, value: any, at: string) {
    const client = this.db.connect ? await this.db.connect() : null;
    const query = client
      ? client.query.bind(client)
      : this.db.query.bind(this.db);
    if (client) await query("BEGIN");
    try {
      const before = (
        await query(
          "SELECT * FROM researched.discovered_links WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!before) {
        if (client) await query("ROLLBACK");
        return null;
      }
      await this.assertStudyWritable(before.study_id);
      if (before.status !== "pending")
        throw new Error("discovery_already_decided");
      let source = null;
      if (value.action === "add") {
        const pathname = new URL(before.discovered_url).pathname.toLowerCase();
        const sourceType = pathname.endsWith(".pdf")
          ? "pdf"
          : pathname.endsWith(".docx") || pathname.endsWith(".docm")
            ? "document"
            : "webpage";
        source = (
          await query(
            `INSERT INTO researched.sources(id,study_id,label,original_url,source_type,authority,corpus_status,completeness,created_at,updated_at)
           VALUES($1,$2,$3,$4,$5,'unknown','pending','unassessed',$6,$6) ON CONFLICT(study_id,original_url) DO UPDATE SET updated_at=researched.sources.updated_at RETURNING *`,
            [
              randomUUID(),
              before.study_id,
              value.label || before.link_text || before.discovered_url,
              before.discovered_url,
              sourceType,
              at,
            ],
          )
        ).rows[0];
      }
      const after = (
        await query(
          "UPDATE researched.discovered_links SET status=$2,decision_reason=$3,decided_at=$4 WHERE id=$1 RETURNING *",
          [
            id,
            value.action === "add" ? "added" : "dismissed",
            value.reason ?? null,
            at,
          ],
        )
      ).rows[0];
      await query(
        "INSERT INTO researched.audit_events(id,study_id,entity_kind,entity_id,action,actor,occurred_at,before_value,after_value,reason) VALUES($1,$2,'discovered_link',$3,$4,$5,$6,$7,$8,$9)",
        [
          randomUUID(),
          before.study_id,
          id,
          value.action,
          value.actor,
          at,
          JSON.stringify(before),
          JSON.stringify(after),
          value.reason ?? null,
        ],
      );
      if (client) await query("COMMIT");
      return { link: after, source };
    } catch (error) {
      if (client) await query("ROLLBACK");
      throw error;
    } finally {
      client?.release();
    }
  }
  async enqueueSources(
    studyId: string,
    sourceIds: readonly string[],
    maximumAttempts: number,
    at: string,
  ) {
    await this.assertStudyWritable(studyId);
    const ids = [...new Set(sourceIds)];
    const valid = await this.db.query(
      "SELECT count(*)::int AS total FROM researched.sources WHERE study_id=$1 AND id=ANY($2::uuid[])",
      [studyId, ids],
    );
    if (valid.rows[0]?.total !== ids.length)
      throw new Error("invalid_queue_sources");
    let queued = 0;
    for (const sourceId of ids) {
      const result = await this.db.query(
        `INSERT INTO researched.acquisition_queue(id,source_id,status,maximum_attempts,next_attempt_at,created_at) VALUES($1,$2,'queued',$3,$4,$4) ON CONFLICT(source_id) WHERE status IN('queued','running') DO NOTHING`,
        [randomUUID(), sourceId, maximumAttempts, at],
      );
      queued += result.rowCount ?? 0;
    }
    return {
      requested: ids.length,
      queued,
      alreadyQueued: ids.length - queued,
    };
  }
  async acquisitionQueue(studyId: string) {
    return (
      await this.db.query(
        "SELECT q.*,s.label,s.original_url FROM researched.acquisition_queue q JOIN researched.sources s ON s.id=q.source_id WHERE s.study_id=$1 ORDER BY q.created_at DESC LIMIT 200",
        [studyId],
      )
    ).rows;
  }
  async queuedStudyIds() {
    return (
      await this.db.query(
        "SELECT DISTINCT s.study_id FROM researched.acquisition_queue q JOIN researched.sources s ON s.id=q.source_id WHERE q.status IN('queued','failed') AND q.attempts<q.maximum_attempts AND q.next_attempt_at<=now()",
      )
    ).rows.map((row) => String(row.study_id));
  }
  async claimAcquisition(studyId: string, at: string) {
    return (
      (
        await this.db.query(
          `WITH next AS (SELECT q.id,s.original_url,s.label FROM researched.acquisition_queue q JOIN researched.sources s ON s.id=q.source_id WHERE s.study_id=$1 AND q.status IN('queued','failed') AND q.attempts<q.maximum_attempts AND q.next_attempt_at<=$2 ORDER BY q.next_attempt_at,q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1)
    UPDATE researched.acquisition_queue q SET status='running',attempts=attempts+1,started_at=$2,last_error=NULL FROM next WHERE q.id=next.id RETURNING q.*,next.original_url,next.label`,
          [studyId, at],
        )
      ).rows[0] ?? null
    );
  }
  async finishAcquisitionQueue(id: string, at: string) {
    await this.db.query(
      "UPDATE researched.acquisition_queue SET status='succeeded',completed_at=$2 WHERE id=$1",
      [id, at],
    );
  }
  async failAcquisitionQueue(
    id: string,
    at: string,
    error: string,
    attempts: number,
  ) {
    const delayMinutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
    await this.db.query(
      "UPDATE researched.acquisition_queue SET status='failed',last_error=$2,next_attempt_at=$3::timestamptz + ($4||' minutes')::interval WHERE id=$1",
      [id, error, at, delayMinutes],
    );
  }
  async cancelAcquisition(id: string, at: string) {
    return (
      (
        await this.db.query(
          "UPDATE researched.acquisition_queue SET status='cancelled',completed_at=$2 WHERE id=$1 AND status IN('queued','failed') RETURNING *",
          [id, at],
        )
      ).rows[0] ?? null
    );
  }
  async createAnalysisPlan(id: string, value: any, at: string) {
    await this.assertStudyWritable(value.studyId);
    return (
      await this.db.query(
        `INSERT INTO researched.analysis_plans(id,study_id,name,analysis_types,source_ids,custom_questions,expected_fields,options,created_by,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
        [id,value.studyId,value.name,JSON.stringify(value.analysisTypes),JSON.stringify(value.sourceIds),JSON.stringify(value.customQuestions),JSON.stringify(value.expectedFields),JSON.stringify(value.options),value.actor,at],
      )
    ).rows[0];
  }
  async analysisPlans(studyId: string) {
    return (await this.db.query("SELECT * FROM researched.analysis_plans WHERE study_id=$1 ORDER BY created_at DESC",[studyId])).rows;
  }
  async analysisPlan(id: string) {
    return (await this.db.query("SELECT * FROM researched.analysis_plans WHERE id=$1",[id])).rows[0] ?? null;
  }
  async analysisTemplates(){return(await this.db.query("SELECT * FROM researched.analysis_templates ORDER BY lower(name)",[])).rows;}
  async createAnalysisTemplate(id:string,value:any,at:string){return(await this.db.query(`INSERT INTO researched.analysis_templates(id,name,description,analysis_types,custom_questions,expected_fields,options,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) ON CONFLICT(name) DO UPDATE SET description=excluded.description,analysis_types=excluded.analysis_types,custom_questions=excluded.custom_questions,expected_fields=excluded.expected_fields,options=excluded.options,updated_at=excluded.updated_at RETURNING *`,[id,value.name,value.description??null,JSON.stringify(value.analysisTypes),JSON.stringify(value.customQuestions),JSON.stringify(value.expectedFields),JSON.stringify(value.options),value.actor,at])).rows[0];}
  async deleteAnalysisTemplate(id:string){return(await this.db.query("DELETE FROM researched.analysis_templates WHERE id=$1 RETURNING id",[id])).rows[0]??null;}
  async analysisInputs(studyId: string, sourceIds: readonly string[]) {
    return (await this.db.query(
      `SELECT s.id AS source_id,s.label,s.entity_id,x.id AS snapshot_id,e.id AS extraction_id,e.text_content,
        COALESCE(jsonb_agg(g.id ORDER BY g.ordinal) FILTER(WHERE g.id IS NOT NULL),'[]') AS segment_ids,
        COALESCE(jsonb_agg(jsonb_build_object('segmentId',g.id,'sourceId',s.id,'content',g.content) ORDER BY g.ordinal) FILTER(WHERE g.id IS NOT NULL),'[]') AS evidence_segments
       FROM researched.sources s
       JOIN LATERAL (SELECT * FROM researched.source_snapshots WHERE source_id=s.id ORDER BY sequence DESC LIMIT 1) x ON true
       JOIN researched.source_extractions e ON e.snapshot_id=x.id AND e.status='completed'
       LEFT JOIN researched.extracted_segments g ON g.extraction_id=e.id
       WHERE s.study_id=$1 AND s.corpus_status='included' AND (cardinality($2::uuid[])=0 OR s.id=ANY($2::uuid[]))
       GROUP BY s.id,s.label,x.id,e.id,e.text_content ORDER BY s.label`,[studyId,sourceIds]
    )).rows;
  }
  async beginAnalysisRun(id: string, plan: any, actor: string, inputs: readonly any[], maximumAttempts: number, at: string) {
    await this.assertStudyWritable(plan.study_id);
    const jobs=buildAnalysisJobs(inputs,plan.analysis_types as string[],maximumAttempts,at,randomUUID),total=jobs.length,client=this.db.connect?await this.db.connect():null,query=client?client.query.bind(client):this.db.query.bind(this.db);
    if(client)await query("BEGIN");
    try{
      const run=(await query(`INSERT INTO researched.analysis_runs(id,plan_id,study_id,status,progress_total,rules_version,requested_by,maximum_attempts,created_at)
       VALUES($1,$2,$3,'queued',$4,'deterministic-v1',$5,$6,$7) RETURNING *`,[id,plan.id,plan.study_id,total,actor,maximumAttempts,at])).rows[0];
      if(jobs.length)await query(`INSERT INTO researched.analysis_run_items(id,run_id,source_id,analysis_type,scope_type,scope_key,source_ids,maximum_attempts,next_attempt_at,created_at) SELECT job.id,$1,job."sourceId",job."analysisType",job."scopeType",job."scopeKey",job."sourceIds",job."maximumAttempts",job."nextAttemptAt",job."createdAt" FROM jsonb_to_recordset($2::jsonb) AS job(id uuid,"sourceId" uuid,"analysisType" text,"scopeType" text,"scopeKey" text,"sourceIds" jsonb,"maximumAttempts" integer,"nextAttemptAt" timestamptz,"createdAt" timestamptz)`,[id,JSON.stringify(jobs)]);
      if(client)await query("COMMIT");return run;
    }catch(error){if(client)await query("ROLLBACK");throw error;}finally{client?.release();}
  }
  async saveAnalysisResult(run: any, sourceId: string|null, analysisType: string, method: string, value: unknown, segmentIds: readonly string[], at: string, metadata:{confidence?:number;ruleVersion?:string|null;model?:Record<string,unknown>|null}={}) {
    const result=(await this.db.query(
      `INSERT INTO researched.analysis_results(id,run_id,study_id,source_id,analysis_type,method,value,confidence,evidence_segment_ids,rule_version,model_metadata,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING RETURNING *`,
      [randomUUID(),run.id,run.study_id,sourceId,analysisType,method,JSON.stringify(value),metadata.confidence??1,JSON.stringify(segmentIds),metadata.ruleVersion===undefined?"deterministic-v1":metadata.ruleVersion,metadata.model?JSON.stringify(metadata.model):null,at]
    )).rows[0];
    return result;
  }
  async finishAnalysisRun(id: string, status: "completed"|"partial"|"failed", at: string, error: string|null = null) {
    return (await this.db.query("UPDATE researched.analysis_runs SET status=$2,completed_at=$3,error_summary=$4 WHERE id=$1 RETURNING *",[id,status,at,error])).rows[0];
  }
  async analysisRuns(studyId: string) {
    return (await this.db.query("SELECT * FROM researched.analysis_runs WHERE study_id=$1 ORDER BY created_at DESC",[studyId])).rows;
  }
  async analysisRun(id: string) {
    const run=(await this.db.query("SELECT * FROM researched.analysis_runs WHERE id=$1",[id])).rows[0];
    if(!run) return null;
    const results=(await this.db.query("SELECT * FROM researched.analysis_results WHERE run_id=$1 ORDER BY analysis_type,created_at",[id])).rows;
    const items=(await this.db.query("SELECT * FROM researched.analysis_run_items WHERE run_id=$1 ORDER BY created_at,analysis_type",[id])).rows;
    return {...run,results,items};
  }
  async recoverAnalysisJobs(at:string){
    await this.db.query("UPDATE researched.analysis_run_items SET status='queued',next_attempt_at=$1,started_at=NULL,last_error=COALESCE(last_error,'Recovered after application restart') WHERE status='running'",[at]);
    await this.db.query("UPDATE researched.analysis_runs SET status='queued',started_at=NULL WHERE status='running'",[]);
  }
  async claimAnalysisItem(at:string){
    const client=this.db.connect?await this.db.connect():null,query=client?client.query.bind(client):this.db.query.bind(this.db);if(client)await query("BEGIN");
    try{const item=(await query(`SELECT i.*,r.study_id,r.plan_id,r.requested_by FROM researched.analysis_run_items i JOIN researched.analysis_runs r ON r.id=i.run_id WHERE i.status='queued' AND i.next_attempt_at<=$1 AND r.status IN('queued','running') ORDER BY i.created_at FOR UPDATE OF i,r SKIP LOCKED LIMIT 1`,[at])).rows[0];if(!item){if(client)await query("COMMIT");return null;}await query("UPDATE researched.analysis_run_items SET status='running',attempts=attempts+1,started_at=$2 WHERE id=$1",[item.id,at]);await query("UPDATE researched.analysis_runs SET status='running',started_at=COALESCE(started_at,$2) WHERE id=$1",[item.run_id,at]);if(client)await query("COMMIT");return{...item,status:'running',attempts:item.attempts+1};}catch(error){if(client)await query("ROLLBACK");throw error;}finally{client?.release();}
  }
  async analysisJobContext(item:any){
    const plan=await this.analysisPlan(item.plan_id),inputs=await this.analysisInputs(item.study_id,item.scope_type==='corpus'?item.source_ids:[item.source_id]);if(!plan||!inputs.length)return null;const hierarchy=await this.analysisHierarchy(item.study_id),paths=new Map(hierarchy.map((entity:any)=>[entity.id,entity.path]));for(const source of inputs)source.entity_path=source.entity_id?paths.get(source.entity_id)??[]:[];return{plan,source:inputs[0],sources:inputs,hierarchy,run:{id:item.run_id,study_id:item.study_id}};
  }
  async analysisHierarchy(studyId:string){return(await this.db.query(`WITH RECURSIVE tree AS (SELECT e.id,e.parent_id,e.label,t.name AS entity_type,ARRAY[e.label]::text[] AS path,0 AS depth FROM researched.entities e JOIN researched.entity_types t ON t.id=e.entity_type_id WHERE e.study_id=$1 AND e.parent_id IS NULL UNION ALL SELECT child.id,child.parent_id,child.label,t.name,tree.path||child.label,tree.depth+1 FROM researched.entities child JOIN tree ON tree.id=child.parent_id JOIN researched.entity_types t ON t.id=child.entity_type_id) SELECT * FROM tree ORDER BY path`,[studyId])).rows;}
  async analysisRunStatus(id:string){return(await this.db.query("SELECT status FROM researched.analysis_runs WHERE id=$1",[id])).rows[0]?.status??null;}
  async completeAnalysisItem(item:any,at:string){await this.db.query("UPDATE researched.analysis_run_items SET status='succeeded',completed_at=$2,last_error=NULL WHERE id=$1 AND status='running'",[item.id,at]);await this.refreshAnalysisRun(item.run_id,at);}
  async cancelAnalysisItem(item:any,at:string){await this.db.query("UPDATE researched.analysis_run_items SET status='cancelled',completed_at=$2 WHERE id=$1 AND status='running'",[item.id,at]);}
  async failAnalysisItem(item:any,error:string,nextAttemptAt:string,at:string,forceTerminal=false){const retry=!forceTerminal&&item.attempts<item.maximum_attempts;await this.db.query("UPDATE researched.analysis_run_items SET status=$2,next_attempt_at=$3,last_error=$4,completed_at=CASE WHEN $2='failed' THEN $5::timestamptz ELSE NULL END WHERE id=$1 AND status='running'",[item.id,retry?'queued':'failed',nextAttemptAt,error,at]);await this.refreshAnalysisRun(item.run_id,at);return retry;}
  async refreshAnalysisRun(id:string,at:string){const counts=(await this.db.query("SELECT count(*)::int total,count(*) FILTER(WHERE status='succeeded')::int succeeded,count(*) FILTER(WHERE status='failed')::int failed,count(*) FILTER(WHERE status IN('queued','running'))::int pending FROM researched.analysis_run_items WHERE run_id=$1",[id])).rows[0];await this.db.query("UPDATE researched.analysis_runs SET progress_completed=$2,error_summary=CASE WHEN $3::int>0 THEN $3::text||' analysis item(s) failed' ELSE NULL END,status=CASE WHEN status IN('paused','cancelled') THEN status WHEN $4::int>0 THEN status WHEN $3::int>0 AND $2::int>0 THEN 'partial' WHEN $3::int>0 THEN 'failed' ELSE 'completed' END,completed_at=CASE WHEN $4::int=0 THEN $5::timestamptz ELSE NULL END WHERE id=$1",[id,counts.succeeded+counts.failed,counts.failed,counts.pending,at]);}
  async controlAnalysisRun(id:string,action:'pause'|'resume'|'cancel'|'retry',at:string){if(action==='retry'){const run=(await this.db.query("UPDATE researched.analysis_runs SET status='queued',completed_at=NULL,error_summary=NULL WHERE id=$1 AND status IN('failed','partial') RETURNING *",[id])).rows[0];if(!run)return null;await this.db.query("UPDATE researched.analysis_run_items SET status='queued',attempts=0,next_attempt_at=$2,last_error=NULL,completed_at=NULL WHERE run_id=$1 AND status='failed'",[id,at]);await this.refreshAnalysisRun(id,at);return run;}const states={pause:["paused","paused_at",["queued","running"]],resume:["queued",null,["paused"]],cancel:["cancelled","cancelled_at",["queued","running","paused"]]} as const,target=states[action],run=(await this.db.query(`UPDATE researched.analysis_runs SET status=$2,paused_at=CASE WHEN $3='paused_at' THEN $4::timestamptz ELSE paused_at END,cancelled_at=CASE WHEN $3='cancelled_at' THEN $4::timestamptz ELSE cancelled_at END,completed_at=CASE WHEN $2='cancelled' THEN $4::timestamptz ELSE completed_at END WHERE id=$1 AND status=ANY($5::text[]) RETURNING *`,[id,target[0],target[1],at,target[2]])).rows[0];if(!run)return null;if(action==='cancel')await this.db.query("UPDATE researched.analysis_run_items SET status='cancelled',completed_at=$2 WHERE run_id=$1 AND status='queued'",[id,at]);if(action==='resume')await this.refreshAnalysisRun(id,at);return run;}
  async decideAnalysisResult(id: string, value: any, at: string) {
    const before=(await this.db.query("SELECT * FROM researched.analysis_results WHERE id=$1",[id])).rows[0];
    if(!before) return null;
    await this.assertStudyWritable(before.study_id);
    const after=(await this.db.query(
      `UPDATE researched.analysis_results SET status=$2,value=CASE WHEN $2='amended' THEN $3::jsonb ELSE value END,review_reason=$4,reviewed_by=$5,reviewed_at=$6 WHERE id=$1 RETURNING *`,
      [id,value.status,JSON.stringify(value.amendedValue ?? before.value),value.reason,value.actor,at]
    )).rows[0];
    await this.db.query("INSERT INTO researched.audit_events(id,study_id,entity_kind,entity_id,action,actor,occurred_at,before_value,after_value,reason) VALUES($1,$2,'analysis_result',$3,'reviewed',$4,$5,$6,$7,$8)",[randomUUID(),before.study_id,id,value.actor,at,JSON.stringify(before),JSON.stringify(after),value.reason]);
    return after;
  }
  async analysisResult(id:string){return(await this.db.query("SELECT * FROM researched.analysis_results WHERE id=$1",[id])).rows[0]??null;}
  async researchInsightMetrics(studyId:string){return(await this.db.query(`SELECT
    (SELECT count(*) FROM researched.sources WHERE study_id=$1 AND corpus_status='pending')::int AS "pendingSources",
    (SELECT count(*) FROM researched.sources s WHERE s.study_id=$1 AND s.corpus_status='included' AND NOT EXISTS(SELECT 1 FROM researched.source_snapshots x JOIN researched.source_extractions e ON e.snapshot_id=x.id AND e.status='completed' WHERE x.source_id=s.id))::int AS "unextractedSources",
    (SELECT count(*) FROM researched.analysis_run_items i JOIN researched.analysis_runs r ON r.id=i.run_id WHERE r.study_id=$1 AND i.status='failed')::int AS "failedTasks",
    (SELECT count(*) FROM researched.analysis_results WHERE study_id=$1 AND status='generated')::int AS "unreviewedResults",
    (SELECT count(*) FROM researched.analysis_results WHERE study_id=$1 AND confidence<0.5 AND status<>'rejected')::int AS "lowConfidenceResults",
    (SELECT COALESCE(sum(jsonb_array_length(COALESCE(value->'interpretation'->'contradictions',value->'contradictions','[]'::jsonb))),0) FROM researched.analysis_results WHERE study_id=$1 AND analysis_type='contradictions' AND status<>'rejected')::int AS "potentialContradictions",
    (SELECT COALESCE(sum(jsonb_array_length(COALESCE(value->'interpretation'->'missing',value->'missing','[]'::jsonb))),0) FROM researched.analysis_results WHERE study_id=$1 AND analysis_type='completeness' AND status<>'rejected')::int AS "missingExpectedFields",
    (SELECT count(*) FROM researched.findings WHERE study_id=$1 AND status='confirmed')::int AS "confirmedFindings",
    (SELECT count(*) FROM researched.analysis_results WHERE study_id=$1 AND status<>'rejected')::int AS "completedResults"`,[studyId])).rows[0];}
  async counts() {
    const r = await this.db.query(
      `SELECT (SELECT count(*)::int FROM researched.studies) studies,(SELECT count(*)::int FROM researched.sources) sources,(SELECT count(*)::int FROM researched.source_snapshots) snapshots,(SELECT count(*)::int FROM researched.source_extractions WHERE status='completed') extractions,(SELECT count(*)::int FROM researched.evidence_items WHERE status='active') evidence,(SELECT count(*)::int FROM researched.findings WHERE status<>'withdrawn') findings,(SELECT count(*)::int FROM researched.report_runs) reports,(SELECT count(*)::int FROM researched.entities) entities`,
    );
    return r.rows[0];
  }
}
