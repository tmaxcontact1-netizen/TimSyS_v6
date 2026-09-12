"use strict";
const appScope = require("../../shared/services/appScope");
const STATUSES = [
  "high_confidence",
  "probable",
  "ambiguous",
  "unmapped",
  "insufficient_information",
  "human_review",
];
function boot(c) {
  c.log.info("assessment_evaluator independent audit pipeline ready", {
    module: "assessment_evaluator",
  });
}
function teardown() {}
function scope(r) {
  return appScope.fromRequest(r);
}
function txt(v) {
  return String(v == null ? "" : v).trim();
}
function json(v, f = []) {
  try {
    return JSON.parse(v);
  } catch (_) {
    return f;
  }
}
function bad(message, code = "VALIDATION_ERROR", statusCode = 400) {
  return { success: false, statusCode, error: { code, message } };
}
function emit(c, channel, row) {
  c.events.publish(channel, {
    entityId: row.id,
    record: row,
    __module: "assessment_evaluator",
  });
}
function audit(c, action, r, id, oldValue, newValue) {
  c.db.query(
    "INSERT INTO audit_log(timestamp,user_id,action,entity_type,entity_id,old_value,new_value,ip_address) VALUES(?,?,?,?,?,?,?,?)",
    [
      Date.now(),
      String(r.user.id),
      action,
      "assessment_evaluation_item",
      String(id),
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      null,
    ],
  );
}
function hydrateItem(c, row, includeReference = false) {
  if (!row) return row;
  row.answer_choices = json(row.answer_choices_json);
  row.visible_scaffolding = json(row.visible_scaffolding_json);
  row.supporting_constructs = json(row.supporting_constructs_json);
  row.media = json(row.media_json);
  delete row.answer_choices_json;
  delete row.visible_scaffolding_json;
  delete row.supporting_constructs_json;
  delete row.media_json;
  row.alignments = c.db.query(
    "SELECT a.*,COALESCE(rs.code,s.code) standard_code,COALESCE(rs.statement,s.title) standard_title,rf.name framework_name FROM assessment_evaluation_alignments a LEFT JOIN learning_standards s ON s.id=a.standard_id LEFT JOIN standards_repository_statements rs ON rs.id=a.repository_statement_id LEFT JOIN standards_repository_frameworks rf ON rf.id=a.framework_id WHERE a.item_id=? ORDER BY a.rank,a.id",
    [row.id],
  ).rows;
  row.reviews = c.db.query(
    "SELECT * FROM assessment_evaluation_reviews WHERE item_id=? ORDER BY id DESC",
    [row.id],
  ).rows;
  row.interpretations = c.db
    .query(
      "SELECT i.*,r.provider,r.model,r.prompt_version FROM assessment_evaluation_interpretations i JOIN ai_gateway_runs r ON r.id=i.ai_run_id WHERE i.item_id=? ORDER BY i.id DESC",
      [row.id],
    )
    .rows.map((x) => ({
      ...x,
      interpretation: json(x.interpretation_json, {}),
      evidence_ids: json(x.evidence_ids_json),
      limitations: json(x.limitations_json),
    }));
  if (includeReference)
    row.reference_metadata =
      c.db.query(
        "SELECT * FROM assessment_evaluation_reference_metadata WHERE item_id=?",
        [row.id],
      ).rows[0] || null;
  return row;
}
function getAudit(c, id, s) {
  const row = c.db.query(
    "SELECT * FROM assessment_evaluation_audits WHERE id=? AND app_id=?",
    [id, s],
  ).rows[0];
  if (row) {
    row.intent_standard_codes = json(row.intent_standard_codes_json);
    delete row.intent_standard_codes_json;
    row.frameworks = c.db.query(
      "SELECT af.*,f.code,f.name,f.subject,f.grade_band,f.version_label FROM assessment_evaluation_frameworks af JOIN standards_repository_frameworks f ON f.id=af.framework_id WHERE af.audit_id=? ORDER BY af.comparison_role,f.name",
      [row.id],
    ).rows;
    row.sources = c.db
      .query(
        "SELECT * FROM assessment_evaluation_sources WHERE audit_id=? ORDER BY id",
        [row.id],
      )
      .rows.map((source) => ({
        ...source,
        candidates: c.db
          .query(
            "SELECT * FROM assessment_evaluation_item_candidates WHERE source_id=? ORDER BY id",
            [source.id],
          )
          .rows.map((x) => ({
            ...x,
            answer_choices: json(x.answer_choices_json),
            source_locator: json(x.source_locator_json, {}),
            media: json(x.media_json),
            warnings: json(x.warnings_json),
          })),
      }));
    row.items = c.db
      .query(
        "SELECT * FROM assessment_evaluation_items WHERE audit_id=? ORDER BY id",
        [row.id],
      )
      .rows.map((x) => hydrateItem(c, x));
    row.reports = c.db.query(
      "SELECT id,version,created_at,generated_by FROM assessment_evaluation_reports WHERE audit_id=? ORDER BY version DESC",
      [row.id],
    ).rows;
  }
  return row;
}
function getItem(c, id, s) {
  const row = c.db.query(
    "SELECT i.* FROM assessment_evaluation_items i JOIN assessment_evaluation_audits a ON a.id=i.audit_id WHERE i.id=? AND a.app_id=?",
    [id, s],
  ).rows[0];
  return hydrateItem(c, row);
}
async function list(r, c) {
  const s = scope(r),
    page = Math.max(1, +r.query.page || 1),
    limit = Math.min(50, Math.max(1, +r.query.limit || 50)),
    status = txt(r.query.status),
    where = ["app_id=?"],
    p = [s];
  if (status) {
    where.push("status=?");
    p.push(status);
  }
  const clause = " WHERE " + where.join(" AND "),
    total = +c.db.query(
      "SELECT COUNT(*) total FROM assessment_evaluation_audits" + clause,
      p,
    ).rows[0].total,
    rows = c.db.query(
      "SELECT a.*,(SELECT COUNT(*) FROM assessment_evaluation_items i WHERE i.audit_id=a.id) item_count,(SELECT COUNT(*) FROM assessment_evaluation_items i WHERE i.audit_id=a.id AND i.analysis_status IN ('ambiguous','human_review','insufficient_information')) review_count FROM assessment_evaluation_audits a" +
        clause.replace("app_id", "a.app_id") +
        " ORDER BY a.updated_at DESC,a.id DESC LIMIT ? OFFSET ?",
      p.concat([limit, (page - 1) * limit]),
    ).rows;
  return { success: true, audits: rows, total, page, limit };
}
async function create(r, c) {
  const b = r.body || {},
    s = scope(r);
  if (!txt(b.title)) return bad("Assessment name is required");
  const frameworkIds = [
    ...new Set(
      (Array.isArray(b.framework_ids) ? b.framework_ids : [])
        .map(Number)
        .filter(Boolean),
    ),
  ];
  let legacy = b.framework_id ? +b.framework_id : null;
  if (frameworkIds.length) {
    const marks = frameworkIds.map(() => "?").join(","),
      found = c.db.query(
        `SELECT id FROM standards_repository_frameworks WHERE app_id=? AND status='active' AND id IN (${marks})`,
        [s].concat(frameworkIds),
      ).rows;
    if (found.length !== frameworkIds.length)
      return bad(
        "One or more selected standards frameworks are not active",
        "FRAMEWORK_NOT_ACTIVE",
        409,
      );
  } else if (
    legacy &&
    !c.db.query(
      "SELECT f.id FROM standards_frameworks f WHERE f.id=? AND f.app_id=?",
      [legacy, s],
    ).rows[0]
  )
    return bad("Standards framework not found", "NOT_FOUND", 404);
  const mode = b.workflow_mode === "coordinator" ? "coordinator" : "teacher",
    x = c.db.query(
      "INSERT INTO assessment_evaluation_audits(app_id,title,subject,grade_band,source_type,framework_id,workflow_mode,created_by) VALUES(?,?,?,?,?,?,?,?)",
      [
        s,
        txt(b.title),
        txt(b.subject) || null,
        txt(b.grade_band) || null,
        b.source_type || "manual",
        legacy,
        mode,
        String(r.user.id),
      ],
    );
  frameworkIds.forEach((id, i) =>
    c.db.query(
      "INSERT INTO assessment_evaluation_frameworks(audit_id,framework_id,comparison_role) VALUES(?,?,?)",
      [
        x.lastInsertRowid,
        id,
        i === 0
          ? "primary"
          : (b.cross_subject_framework_ids || []).map(Number).includes(id)
            ? "cross_subject"
            : "comparison",
      ],
    ),
  );
  const row = getAudit(c, x.lastInsertRowid, s);
  emit(c, "assessment_evaluator.audit_created", row);
  return { success: true, audit: row };
}
async function read(r, c) {
  const row = getAudit(c, r.params.id, scope(r));
  return row
    ? { success: true, audit: row }
    : bad("Assessment audit not found", "NOT_FOUND", 404);
}
async function addItem(r, c) {
  const s = scope(r),
    a = getAudit(c, r.params.id, s),
    b = r.body || {};
  if (!a) return bad("Assessment audit not found", "NOT_FOUND", 404);
  if (a.status === "complete" || a.status === "withdrawn")
    return bad(
      "Completed or withdrawn audits cannot accept new items",
      "INVALID_STATE",
      409,
    );
  if (!txt(b.item_key) || !txt(b.task))
    return bad("Item ID and the student-visible task are required");
  try {
    const x = c.db.query(
      "INSERT INTO assessment_evaluation_items(audit_id,item_key,stimulus,task,answer_choices_json,response_format,media_json,visible_scaffolding_json,supporting_information) VALUES(?,?,?,?,?,?,?,?,?)",
      [
        a.id,
        txt(b.item_key),
        txt(b.stimulus) || null,
        txt(b.task),
        JSON.stringify(Array.isArray(b.answer_choices) ? b.answer_choices : []),
        txt(b.response_format) || null,
        JSON.stringify(Array.isArray(b.media) ? b.media : []),
        JSON.stringify(
          Array.isArray(b.visible_scaffolding) ? b.visible_scaffolding : [],
        ),
        txt(b.supporting_information) || null,
      ],
    );
    if (b.reference_metadata)
      c.db.query(
        "INSERT INTO assessment_evaluation_reference_metadata(item_id,official_claim_target,official_standards_json,official_dok,evidence_statement,answer_key,scoring_guidance) VALUES(?,?,?,?,?,?,?)",
        [
          x.lastInsertRowid,
          txt(b.reference_metadata.official_claim_target) || null,
          JSON.stringify(b.reference_metadata.official_standards || []),
          txt(b.reference_metadata.official_dok) || null,
          txt(b.reference_metadata.evidence_statement) || null,
          txt(b.reference_metadata.answer_key) || null,
          txt(b.reference_metadata.scoring_guidance) || null,
        ],
      );
    c.db.query(
      "UPDATE assessment_evaluation_audits SET status='in_progress',updated_at=datetime('now') WHERE id=?",
      [a.id],
    );
    const row = getItem(c, x.lastInsertRowid, s);
    emit(c, "assessment_evaluator.item_added", row);
    return { success: true, item: row };
  } catch (e) {
    if (String(e.message).includes("UNIQUE"))
      return bad(
        "That item ID already exists in this assessment",
        "ITEM_EXISTS",
        409,
      );
    throw e;
  }
}
async function addSource(r, c) {
  const s = scope(r),
    a = getAudit(c, r.params.id, s),
    b = r.body || {};
  if (!a) return bad("Assessment audit not found", "NOT_FOUND", 404);
  if (!txt(b.filename)) return bad("File name is required");
  const roles = [
      "question_paper",
      "answer_key",
      "rubric",
      "specification",
      "declared_objectives",
    ],
    role = roles.includes(b.source_role) ? b.source_role : "question_paper";
  if (a.workflow_mode === "teacher" && role !== "question_paper")
    return bad(
      "Teacher mode accepts the question paper only. Use coordinator mode for supporting materials.",
      "TEACHER_MODE_BOUNDARY",
      409,
    );
  if (
    b.document_id &&
    !c.db.query("SELECT id FROM documents WHERE id=? AND app_id=?", [
      b.document_id,
      s,
    ]).rows[0]
  )
    return bad("Document not found", "NOT_FOUND", 404);
  const x = c.db.query(
    "INSERT INTO assessment_evaluation_sources(audit_id,document_id,filename,mime_type,source_role,extraction_status,extracted_text,extraction_notes) VALUES(?,?,?,?,?,?,?,?)",
    [
      a.id,
      b.document_id || null,
      txt(b.filename),
      txt(b.mime_type) || null,
      role,
      txt(b.extracted_text) ? "extracted" : "pending",
      txt(b.extracted_text) || null,
      txt(b.extraction_notes) || null,
    ],
  );
  return {
    success: true,
    source: c.db.query(
      "SELECT * FROM assessment_evaluation_sources WHERE id=?",
      [x.lastInsertRowid],
    ).rows[0],
    message: txt(b.extracted_text)
      ? "Source added and text received for review."
      : "Source added. Content extraction is waiting to run.",
  };
}
function parseCandidates(text, segments, assets = []) {
  const clean = txt(text),
    warnings = [];
  if (!clean) return [];
  const numbered = /^(?:question\s*)?(\d{1,3})(?:[.)]|\s*[-:])\s+(.+)$/i,
    lines = clean
      .split(/\n+/)
      .map((x) => x.trim())
      .filter(Boolean),
    groups = [];
  let current = null;
  for (const line of lines) {
    const choice = line.match(/^([A-H])[.)]\s+(.+)$/i);
    if (choice && current) {
      current.lines.push(line);
      continue;
    }
    const match = line.match(numbered);
    if (match) {
      if (current) groups.push(current);
      current = { key: match[1], lines: [match[2]] };
    } else if (current) current.lines.push(line);
  }
  if (current) groups.push(current);
  if (!groups.length) {
    warnings.push(
      "Question numbering was not detected; the extracted text is offered as one review candidate.",
    );
    groups.push({ key: "1", lines: [clean] });
  }
  return groups.map((g, index) => {
    const choices = [],
      body = [];
    for (const line of g.lines) {
      const choice = line.match(/^([A-H])[.)]\s+(.+)$/i);
      if (choice) choices.push(`${choice[1].toUpperCase()}. ${choice[2]}`);
      else body.push(line);
    }
    const task = body.join(" ").trim(),
      questionLike =
        /[?]$|\b(explain|identify|compare|analyse|analyze|evaluate|write|describe|select|which|what|how|why)\b/i.test(
          task,
        ),
      segment = segments.find((x) =>
        x.content.includes(body[0] || task.slice(0, 20)),
      );
    const locator = segment ? segment.locator : {};
    const media = assets.filter(
      (asset) =>
        locator.page && Number(asset.locator?.page) === Number(locator.page),
    );
    return {
      item_key: String(g.key || index + 1),
      task,
      answer_choices: choices,
      response_format: choices.length ? "multiple choice" : null,
      source_locator: locator,
      media,
      extraction_confidence: questionLike
        ? choices.length
          ? 0.92
          : 0.82
        : 0.55,
      warnings: [
        ...warnings,
        ...(!questionLike
          ? [
              "The extracted block does not clearly resemble a question. Review it before accepting.",
            ]
          : []),
        ...(assets.length && !media.length
          ? [
              "Visual content was detected in the source but could not be reliably linked to this question. Check the original page.",
            ]
          : []),
      ],
    };
  });
}
async function extractSource(r, c) {
  const s = scope(r),
    source = c.db.query(
      "SELECT es.* FROM assessment_evaluation_sources es JOIN assessment_evaluation_audits a ON a.id=es.audit_id WHERE es.id=? AND a.app_id=?",
      [r.params.id, s],
    ).rows[0];
  if (!source) return bad("Assessment source not found", "NOT_FOUND", 404);
  if (!source.document_id)
    return bad(
      "This source is not linked to a stored file",
      "NO_DOCUMENT",
      409,
    );
  const service = require("../document_intelligence"),
    result = await service.extractDocumentRecord(
      c,
      source.document_id,
      s,
      r.user,
      r.body || {},
    );
  if (!result.success) {
    c.db.query(
      "UPDATE assessment_evaluation_sources SET extraction_status='failed',extraction_notes=? WHERE id=?",
      [result.error.message, source.id],
    );
    return result;
  }
  const candidates = parseCandidates(
    result.text,
    result.run.segments,
    result.run.assets || [],
  );
  c.db.transaction((db) => {
    db.query(
      "DELETE FROM assessment_evaluation_item_candidates WHERE source_id=? AND status=?",
      [source.id, "pending"],
    );
    for (const x of candidates)
      db.query(
        "INSERT INTO assessment_evaluation_item_candidates(source_id,item_key,task,answer_choices_json,response_format,source_locator_json,media_json,extraction_confidence,warnings_json) VALUES(?,?,?,?,?,?,?,?,?)",
        [
          source.id,
          x.item_key,
          x.task,
          JSON.stringify(x.answer_choices),
          x.response_format,
          JSON.stringify(x.source_locator),
          JSON.stringify(x.media),
          x.extraction_confidence,
          JSON.stringify(x.warnings),
        ],
      );
    db.query(
      "UPDATE assessment_evaluation_sources SET extraction_status=?,extracted_text=?,extraction_notes=? WHERE id=?",
      [
        candidates.length ? "needs_review" : result.run.status,
        result.text,
        JSON.stringify(result.run.warnings),
        source.id,
      ],
    );
  });
  return {
    success: true,
    source: getAudit(c, source.audit_id, s).sources.find(
      (x) => x.id === source.id,
    ),
    message: candidates.length
      ? `${candidates.length} possible assessment item${candidates.length === 1 ? "" : "s"} found. Review them before adding them.`
      : "No questions could be identified. The extraction remains available for review.",
  };
}
async function decideCandidate(r, c) {
  const s = scope(r),
    b = r.body || {},
    row = c.db.query(
      "SELECT ic.*,es.audit_id FROM assessment_evaluation_item_candidates ic JOIN assessment_evaluation_sources es ON es.id=ic.source_id JOIN assessment_evaluation_audits a ON a.id=es.audit_id WHERE ic.id=? AND a.app_id=?",
      [r.params.id, s],
    ).rows[0];
  if (!row) return bad("Extracted item candidate not found", "NOT_FOUND", 404);
  if (row.status !== "pending")
    return bad(
      "This candidate has already been reviewed",
      "CANDIDATE_REVIEWED",
      409,
    );
  if (!["accept", "reject"].includes(b.decision))
    return bad("Choose accept or reject");
  if (b.decision === "reject") {
    c.db.query(
      "UPDATE assessment_evaluation_item_candidates SET status='rejected',reviewed_by=?,reviewed_at=datetime('now') WHERE id=?",
      [String(r.user.id), row.id],
    );
    return {
      success: true,
      message: "Extracted candidate rejected. No assessment item was created.",
    };
  }
  const key = txt(b.item_key) || row.item_key,
    task = txt(b.task) || row.task;
  if (!key || !task) return bad("Item ID and question text are required");
  let created;
  try {
    created = c.db.query(
      "INSERT INTO assessment_evaluation_items(audit_id,item_key,stimulus,task,answer_choices_json,response_format,media_json,visible_scaffolding_json,supporting_information) VALUES(?,?,?,?,?,?,?,?,?)",
      [
        row.audit_id,
        key,
        txt(b.stimulus) || row.stimulus || null,
        task,
        JSON.stringify(
          Array.isArray(b.answer_choices)
            ? b.answer_choices
            : json(row.answer_choices_json),
        ),
        txt(b.response_format) || row.response_format || null,
        JSON.stringify(
          Array.isArray(b.media) ? b.media : json(row.media_json),
        ),
        "[]",
        txt(b.supporting_information) || null,
      ],
    ).lastInsertRowid;
  } catch (e) {
    if (String(e.message).includes("UNIQUE"))
      return bad(
        "That item ID already exists in this assessment",
        "ITEM_EXISTS",
        409,
      );
    throw e;
  }
  c.db.query(
    "UPDATE assessment_evaluation_item_candidates SET status=?,reviewed_by=?,reviewed_at=datetime('now'),created_item_id=? WHERE id=?",
    [
      key !== row.item_key || task !== row.task ? "edited" : "accepted",
      String(r.user.id),
      created,
      row.id,
    ],
  );
  c.db.query(
    "UPDATE assessment_evaluation_audits SET status='in_progress',updated_at=datetime('now') WHERE id=?",
    [row.audit_id],
  );
  const item = getItem(c, created, s);
  emit(c, "assessment_evaluator.item_added", item);
  return {
    success: true,
    item,
    message:
      "Extracted item added to the assessment and is ready for blind analysis.",
  };
}
const RULES = [
  {
    re: /\b(compare|contrast|similarit|differen)/i,
    demand:
      "compare ideas, arguments or texts and establish a meaningful similarity or difference",
    construct: "comparative analysis",
    relationship: "two texts or ideas → similarity/difference",
    behaviour:
      "identify a defensible comparison and support it with relevant details",
    depth: 3,
  },
  {
    re: /\b(evaluate|valid|credible|best evidence|supports? (the )?claim)|\bevidence\b.*\bsupports?\b.*\bclaim\b/i,
    demand: "evaluate whether evidence adequately supports a claim",
    construct: "evaluation of evidence",
    relationship: "claim → evidence",
    behaviour:
      "judge the relevance and sufficiency of evidence supporting a claim",
    depth: 3,
  },
  {
    re: /\b(argument|claim).*(evidence|reason)|\bjustify\b/i,
    demand: "construct or justify an argument using relevant evidence",
    construct: "evidence-based argumentation",
    relationship: "claim → reasons → evidence",
    behaviour:
      "produce a defensible claim and justify it with relevant evidence",
    depth: 4,
  },
  {
    re: /\b(infer|imply|suggests?|conclude)/i,
    demand:
      "infer meaning that is not explicitly stated by using contextual evidence",
    construct: "inference from evidence",
    relationship: "contextual evidence → inferred meaning",
    behaviour:
      "select or explain an inference supported by information in the text or stimulus",
    depth: 2,
  },
  {
    re: /\b(word|phrase|vocabulary).*(context|mean)|\bmeaning.*context/i,
    demand: "determine the meaning of a word or phrase from its context",
    construct: "word meaning in context",
    relationship: "word or phrase → context",
    behaviour: "derive and demonstrate an appropriate contextual meaning",
    depth: 2,
  },
  {
    re: /\b(analy[sz]e|how|develop|effect|impact|contribute)/i,
    demand:
      "analyse how a relevant element is developed and how it affects meaning",
    construct: "analysis of development and effect",
    relationship: "authorial or structural choice → effect",
    behaviour:
      "explain the relationship between a choice, development or feature and its effect",
    depth: 3,
  },
  {
    re: /\b(identify|which|what|who|when|where|state|list)\b/i,
    demand: "identify information explicitly available in the item or stimulus",
    construct: "retrieval of explicit information",
    relationship: "idea → supporting detail",
    behaviour: "select or state the relevant explicitly presented information",
    depth: 1,
  },
];
function classify(row) {
  const text = [row.task, row.response_format, row.supporting_information]
    .filter(Boolean)
    .join(" ");
  if (txt(row.task).length < 8)
    return {
      status: "insufficient_information",
      rationale:
        "The student-visible task does not contain enough information to determine the intellectual work reliably.",
    };
  const matches = RULES.filter((x) => x.re.test(text));
  if (!matches.length)
    return {
      status: "human_review",
      rationale:
        "No deterministic construct rule can classify this task reliably. Semantic interpretation or human review is required.",
    };
  const primary = matches[0],
    choices = json(row.answer_choices_json),
    declared = json(row.visible_scaffolding_json),
    scaffolds = [...declared];
  if (choices.length)
    scaffolds.push("answer choices narrow the possible response");
  if (/highlight|underlin|provided passage/i.test(text))
    scaffolds.push("relevant material is visibly directed or supplied");
  if (/sentence frame|complete the sentence/i.test(text))
    scaffolds.push("a response frame performs part of the organisation");
  const supporting = matches
    .slice(1)
    .map((x) => x.construct)
    .filter((x) => x !== primary.construct);
  const independence = scaffolds.length
    ? `The student performs the construct with ${scaffolds.length} identified source${scaffolds.length === 1 ? "" : "s"} of narrowing or support. Nominal depth ${primary.depth}/4; scaffolding limits the strength of mastery evidence.`
    : `The student must perform the construct independently from the presentation provided. Nominal depth ${primary.depth}/4.`;
  return {
    task_presentation: `The student receives ${row.stimulus ? "a stimulus and " : ""}${choices.length ? choices.length + " answer choices and " : ""}a ${row.response_format || "response"} task.`,
    assessment_demand: primary.demand,
    primary_construct: primary.construct,
    supporting_constructs: supporting,
    relationship_analysed: primary.relationship,
    evidence_behaviour: primary.behaviour,
    scaffolding_analysis: scaffolds.length
      ? scaffolds.join("; ")
      : "No material student-visible scaffolding was identified.",
    independence_depth: independence,
    analysis_stage: "deterministic_rule",
    status: matches.length > 1 ? "ambiguous" : "probable",
    rationale:
      matches.length > 1
        ? "More than one defensible construct rule matched. The first is recorded as primary and requires review."
        : "A deterministic action-and-evidence rule identified a defensible construct. Standards have not yet been considered.",
  };
}
function saveAnalysis(c, row, result, user) {
  c.db.query(
    "UPDATE assessment_evaluation_items SET task_presentation=?,assessment_demand=?,primary_construct=?,supporting_constructs_json=?,relationship_analysed=?,evidence_behaviour=?,scaffolding_analysis=?,independence_depth=?,analysis_stage=?,analysis_status=?,analysis_rationale=?,analysis_locked_at=datetime('now'),analysed_by=?,updated_at=datetime('now') WHERE id=?",
    [
      result.task_presentation || null,
      result.assessment_demand || null,
      result.primary_construct || null,
      JSON.stringify(result.supporting_constructs || []),
      result.relationship_analysed || null,
      result.evidence_behaviour || null,
      result.scaffolding_analysis || null,
      result.independence_depth || null,
      result.analysis_stage || "deterministic_rule",
      result.status,
      result.rationale,
      String(user.id),
      row.id,
    ],
  );
}
async function analyseItem(r, c) {
  const s = scope(r),
    row = getItem(c, r.params.id, s);
  if (!row) return bad("Assessment item not found", "NOT_FOUND", 404);
  if (row.analysis_locked_at)
    return bad(
      "Blind construct analysis is already locked",
      "ANALYSIS_LOCKED",
      409,
    );
  const raw = c.db.query(
      "SELECT * FROM assessment_evaluation_items WHERE id=?",
      [row.id],
    ).rows[0],
    result = classify(raw);
  saveAnalysis(c, raw, result, r.user);
  const next = getItem(c, row.id, s);
  audit(c, "assessment_evaluator.analysis_lock", r, row.id, row, next);
  emit(c, "assessment_evaluator.analysis_locked", next);
  return {
    success: true,
    item: next,
    guardrail:
      "No claimed standard or benchmark metadata was exposed during construct analysis.",
  };
}
async function analyseAudit(r, c) {
  const s = scope(r),
    a = getAudit(c, r.params.id, s);
  if (!a) return bad("Assessment audit not found", "NOT_FOUND", 404);
  let analysed = 0;
  for (const item of a.items) {
    if (item.analysis_locked_at) continue;
    const raw = c.db.query(
      "SELECT * FROM assessment_evaluation_items WHERE id=?",
      [item.id],
    ).rows[0];
    saveAnalysis(c, raw, classify(raw), r.user);
    analysed++;
  }
  c.db.query(
    "UPDATE assessment_evaluation_audits SET status='review',updated_at=datetime('now') WHERE id=?",
    [a.id],
  );
  return { success: true, audit: getAudit(c, a.id, s), analysed };
}
function tokens(value) {
  const stop = new Set([
    "the",
    "and",
    "that",
    "with",
    "from",
    "into",
    "using",
    "student",
    "students",
    "relevant",
    "appropriate",
    "information",
    "demonstrate",
  ]);
  return new Set(
    txt(value)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((x) => x.length > 3 && !stop.has(x)),
  );
}
function scoreOntology(c, frameworkId, query) {
  const build = c.db.query(
    "SELECT * FROM standards_ontology_builds WHERE framework_id=? AND status='ready' ORDER BY version DESC LIMIT 1",
    [frameworkId],
  ).rows[0];
  if (!build) return [];
  const standards = c.db.query(
    "SELECT * FROM standards_ontology_nodes WHERE build_id=? AND node_type='standard'",
    [build.id],
  ).rows;
  return standards
    .map((st) => {
      const related = c.db.query(
          "SELECT n.* FROM standards_ontology_relations r JOIN standards_ontology_nodes n ON n.id=r.target_node_id WHERE r.build_id=? AND r.source_node_id=?",
          [build.id, st.id],
        ).rows,
        target = tokens(
          [
            st.label,
            st.description,
            ...related.map((x) => x.canonical_key),
          ].join(" "),
        );
      let overlap = 0;
      query.forEach((x) => {
        if ([...target].some((y) => y === x || y.includes(x) || x.includes(y)))
          overlap++;
      });
      return {
        node: st,
        framework_id: frameworkId,
        overlap,
        score: query.size ? overlap / query.size : 0,
      };
    })
    .filter((x) => x.overlap >= 2)
    .sort((a, b) => b.overlap - a.overlap || b.score - a.score);
}
async function mapItem(r, c) {
  const s = scope(r),
    item = getItem(c, r.params.id, s);
  if (!item) return bad("Assessment item not found", "NOT_FOUND", 404);
  if (!item.analysis_locked_at)
    return bad(
      "Lock blind construct analysis before standards mapping",
      "ANALYSIS_NOT_LOCKED",
      409,
    );
  if (item.alignments.length)
    return bad(
      "A standards mapping has already been recorded",
      "MAPPING_LOCKED",
      409,
    );
  const a = getAudit(c, item.audit_id, s),
    query = tokens(
      [
        item.primary_construct,
        item.assessment_demand,
        item.evidence_behaviour,
        item.relationship_analysed,
      ].join(" "),
    ),
    created = [];
  if (a.frameworks.length) {
    for (const framework of a.frameworks) {
      const scored = scoreOntology(c, framework.framework_id, query),
        best = scored[0],
        tied = best && scored[1] && scored[1].overlap === best.overlap,
        status = !best ? "unmapped" : tied ? "ambiguous" : "probable",
        rationale = !best
          ? "No verified ontology node showed sufficient construct-level correspondence. No alignment was forced."
          : tied
            ? "Multiple standards in this framework show equally defensible correspondence; professional review is required."
            : "The locked construct and observable evidence correspond most strongly to this verified ontology node. Automated mapping remains advisory.";
      const x = c.db.query(
        "INSERT INTO assessment_evaluation_alignments(item_id,repository_statement_id,ontology_node_id,framework_id,status,rationale,confidence_score,method,decided_by) VALUES(?,?,?,?,?,?,?,?,?)",
        [
          item.id,
          best?.node.statement_id || null,
          best?.node.id || null,
          framework.framework_id,
          status,
          rationale,
          best?.score || 0,
          "verified_ontology_after_blind_lock",
          String(r.user.id),
        ],
      );
      created.push(x.lastInsertRowid);
    }
  } else {
    let standards = [];
    if (a.framework_id)
      standards = c.db.query(
        "SELECT s.* FROM learning_standards s JOIN standards_frameworks f ON f.id=s.framework_id WHERE f.id=? AND f.app_id=? AND f.status='active' AND s.status='active'",
        [a.framework_id, s],
      ).rows;
    const scored = standards
        .map((st) => {
          const target = tokens([st.title, st.description].join(" "));
          let overlap = 0;
          query.forEach((x) => {
            if (target.has(x)) overlap++;
          });
          return { st, overlap, score: query.size ? overlap / query.size : 0 };
        })
        .filter((x) => x.overlap >= 2)
        .sort((x, y) => y.overlap - x.overlap),
      best = scored[0],
      status = !best
        ? "unmapped"
        : scored[1] && scored[1].overlap === best.overlap
          ? "ambiguous"
          : "probable",
      rationale = !best
        ? "No active standard showed sufficient construct-level correspondence. No alignment was forced."
        : "Legacy standards compatibility mapping; move this framework into the verified repository for ontology-backed analysis.";
    created.push(
      c.db.query(
        "INSERT INTO assessment_evaluation_alignments(item_id,standard_id,status,rationale,confidence_score,method,decided_by) VALUES(?,?,?,?,?,?,?)",
        [
          item.id,
          best?.st.id || null,
          status,
          rationale,
          best?.score || 0,
          "legacy_construct_after_lock",
          String(r.user.id),
        ],
      ).lastInsertRowid,
    );
  }
  const next = getItem(c, item.id, s),
    statuses = next.alignments.map((x) => x.status),
    overall = statuses.includes("ambiguous")
      ? "ambiguous"
      : statuses.every((x) => x === "unmapped")
        ? "unmapped"
        : "probable";
  c.db.query(
    "UPDATE assessment_evaluation_items SET analysis_status=?,updated_at=datetime('now') WHERE id=?",
    [overall, item.id],
  );
  const hydrated = getItem(c, item.id, s);
  created.forEach((id) =>
    emit(
      c,
      "assessment_evaluator.alignment_proposed",
      hydrated.alignments.find((x) => x.id === id),
    ),
  );
  return { success: true, item: hydrated, human_confirmation_required: true };
}
async function reviewItem(r, c) {
  const s = scope(r),
    old = getItem(c, r.params.id, s),
    b = r.body || {};
  if (!old) return bad("Assessment item not found", "NOT_FOUND", 404);
  if (!old.analysis_locked_at)
    return bad(
      "Blind analysis must be locked before review",
      "ANALYSIS_NOT_LOCKED",
      409,
    );
  if (
    !["confirm", "revise", "unmapped", "human_review"].includes(b.decision) ||
    !txt(b.rationale)
  )
    return bad("A valid review decision and rationale are required");
  if (
    b.standard_id &&
    !c.db.query(
      "SELECT s.id FROM learning_standards s JOIN standards_frameworks f ON f.id=s.framework_id WHERE s.id=? AND f.app_id=?",
      [b.standard_id, s],
    ).rows[0]
  )
    return bad("Standard not found", "NOT_FOUND", 404);
  const status =
    b.decision === "confirm"
      ? "high_confidence"
      : b.decision === "unmapped"
        ? "unmapped"
        : b.decision === "human_review"
          ? "human_review"
          : "probable";
  c.db.query(
    "INSERT INTO assessment_evaluation_reviews(item_id,decision,primary_construct,standard_id,status,rationale,reviewer_id) VALUES(?,?,?,?,?,?,?)",
    [
      old.id,
      b.decision,
      txt(b.primary_construct) || old.primary_construct,
      b.standard_id || old.alignments[0]?.standard_id || null,
      status,
      txt(b.rationale),
      String(r.user.id),
    ],
  );
  c.db.query(
    "UPDATE assessment_evaluation_items SET primary_construct=?,analysis_status=?,updated_at=datetime('now') WHERE id=?",
    [txt(b.primary_construct) || old.primary_construct, status, old.id],
  );
  if (b.interpretation_id)
    c.db.query(
      "UPDATE assessment_evaluation_interpretations SET status=?,reviewed_by=?,reviewed_at=datetime('now') WHERE id=? AND item_id=?",
      [b.accept_interpretation === false ? "rejected" : "accepted", String(r.user.id), b.interpretation_id, old.id],
    );
  const next = getItem(c, old.id, s);
  audit(c, "assessment_evaluator.review", r, old.id, old, next);
  emit(c, "assessment_evaluator.reviewed", next);
  return { success: true, item: next };
}
async function interpretItem(r, c) {
  const s = scope(r),
    item = getItem(c, r.params.id, s);
  if (!item) return bad("Assessment item not found", "NOT_FOUND", 404);
  if (!item.analysis_locked_at)
    return bad(
      "Lock the rules-based analysis before asking AI to interpret this item",
      "ANALYSIS_NOT_LOCKED",
      409,
    );
  if (
    !["ambiguous", "insufficient_information", "human_review"].includes(
      item.analysis_status,
    )
  )
    return bad(
      "AI interpretation is reserved for items the rules cannot classify confidently",
      "AI_NOT_REQUIRED",
      409,
    );
  const evidence = [
    item.stimulus && { id: `item:${item.id}:stimulus`, text: item.stimulus },
    { id: `item:${item.id}:task`, text: item.task },
    item.answer_choices?.length && {
      id: `item:${item.id}:choices`,
      text: item.answer_choices.join("\n"),
    },
    item.response_format && {
      id: `item:${item.id}:response-format`,
      text: item.response_format,
    },
    item.supporting_information && {
      id: `item:${item.id}:supporting-information`,
      text: item.supporting_information,
    },
    ...(item.media || []).map((media, index) => ({
      id: `item:${item.id}:visual:${index + 1}`,
      text:
        media.description ||
        `Visual content at ${JSON.stringify(media.locator || {})}; no dependable description is available.`,
    })),
  ].filter(Boolean);
  const result = await require("../ai_gateway").analyseGrounded(c, {
    appId: s,
    purpose: "assessment_semantic_interpretation",
    promptVersion: "assessment-ela-semantic-v1",
    user: r.user,
    evidence,
    instructions:
      "Interpret the literacy thinking demanded by this assessment item. Return value as an object containing suggested_primary_construct, assessment_demand, evidence_behaviour, relationship_analysed, and uncertainty_reason. Do not infer the teacher's intent, answer the question, score a student response, or select a standard. If visual evidence is not described adequately, state that limitation.",
  });
  if (!result.success) return result;
  const value = result.value;
  if (!value || typeof value !== "object" || Array.isArray(value))
    return bad(
      "The AI response did not match the assessment interpretation contract",
      "AI_RESPONSE_INVALID",
      502,
    );
  const interpretation = {
    suggested_primary_construct: txt(value.suggested_primary_construct) || null,
    assessment_demand: txt(value.assessment_demand) || null,
    evidence_behaviour: txt(value.evidence_behaviour) || null,
    relationship_analysed: txt(value.relationship_analysed) || null,
    uncertainty_reason: txt(value.uncertainty_reason) || null,
  };
  const id = c.db.query(
    "INSERT INTO assessment_evaluation_interpretations(item_id,ai_run_id,interpretation_json,confidence,evidence_ids_json,limitations_json) VALUES(?,?,?,?,?,?)",
    [
      item.id,
      result.run_id,
      JSON.stringify(interpretation),
      result.confidence,
      JSON.stringify(result.evidence_ids),
      JSON.stringify(result.limitations),
    ],
  ).lastInsertRowid;
  audit(c, "assessment_evaluator.ai_interpretation_proposed", r, item.id, null, {
    interpretation_id: id,
    ai_run_id: result.run_id,
  });
  return {
    success: true,
    item: getItem(c, item.id, s),
    message:
      "AI interpretation added as a suggestion. A professional must review it before it can affect the assessment record.",
    human_confirmation_required: true,
  };
}
async function revealBenchmark(r, c) {
  const s = scope(r),
    item = getItem(c, r.params.id, s);
  if (!item) return bad("Assessment item not found", "NOT_FOUND", 404);
  if (!item.analysis_locked_at || !item.alignments.length)
    return bad(
      "Benchmark metadata remains sealed until blind analysis and mapping are locked",
      "BENCHMARK_SEALED",
      409,
    );
  const ref = c.db.query(
    "SELECT * FROM assessment_evaluation_reference_metadata WHERE item_id=?",
    [item.id],
  ).rows[0];
  if (!ref)
    return bad("No benchmark reference metadata is stored", "NOT_FOUND", 404);
  c.db.query(
    "UPDATE assessment_evaluation_reference_metadata SET revealed_at=COALESCE(revealed_at,datetime('now')) WHERE item_id=?",
    [item.id],
  );
  const next = c.db.query(
    "SELECT * FROM assessment_evaluation_reference_metadata WHERE item_id=?",
    [item.id],
  ).rows[0];
  emit(c, "assessment_evaluator.benchmark_revealed", {
    id: item.id,
    record: next,
  });
  return {
    success: true,
    reference_metadata: {
      ...next,
      official_standards: json(next.official_standards_json),
    },
    classification: item,
  };
}
function locked(a) {
  return (
    a.items.length > 0 &&
    a.items.every((x) => x.analysis_locked_at && x.alignments.length)
  );
}
async function setIntent(r, c) {
  const s = scope(r),
    a = getAudit(c, r.params.id, s),
    b = r.body || {};
  if (!a) return bad("Assessment audit not found", "NOT_FOUND", 404);
  if (!locked(a))
    return bad(
      "Declared intent stays sealed until every item has a locked analysis and standards mapping",
      "INTENT_SEALED",
      409,
    );
  const codes = Array.isArray(b.standard_codes)
    ? b.standard_codes.map(txt).filter(Boolean)
    : [];
  if (!txt(b.intent_text) && !codes.length)
    return bad(
      "Enter the intended learning or at least one intended standard code",
    );
  c.db.query(
    "UPDATE assessment_evaluation_audits SET intent_text=?,intent_standard_codes_json=?,intent_unlocked_at=datetime('now'),updated_at=datetime('now') WHERE id=?",
    [txt(b.intent_text) || null, JSON.stringify(codes), a.id],
  );
  return {
    success: true,
    audit: getAudit(c, a.id, s),
    message: "Declared intent saved after the blind analysis was locked.",
  };
}
function intentComparison(a) {
  const inferredCodes = [
      ...new Set(
        a.items.flatMap((x) =>
          x.alignments.map((y) => y.standard_code).filter(Boolean),
        ),
      ),
    ],
    declared = a.intent_standard_codes || [],
    matched = declared.filter((x) => inferredCodes.includes(x)),
    missing = declared.filter((x) => !inferredCodes.includes(x)),
    additional = inferredCodes.filter((x) => !declared.includes(x));
  return {
    declared_codes: declared,
    inferred_codes: inferredCodes,
    matched_codes: matched,
    declared_but_not_evidenced: missing,
    evidenced_but_not_declared: additional,
    match_rate: declared.length
      ? +(matched.length / declared.length).toFixed(3)
      : null,
    interpretation: declared.length
      ? "This comparison shows correspondence between declared and inferred standards; it does not determine assessment quality on its own."
      : "No standard codes were declared. The narrative intent remains available for professional comparison.",
  };
}
async function compareIntent(r, c) {
  const a = getAudit(c, r.params.id, scope(r));
  if (!a) return bad("Assessment audit not found", "NOT_FOUND", 404);
  if (!a.intent_unlocked_at)
    return bad(
      "Add declared intent after the blind analysis is locked",
      "INTENT_NOT_AVAILABLE",
      409,
    );
  return {
    success: true,
    comparison: intentComparison(a),
    intent_text: a.intent_text,
    human_confirmation_required: true,
  };
}
function reportFor(a) {
  const total = a.items.length,
    statusCounts = {},
    constructCounts = {},
    frameworks = {};
  let visualItems = 0,
    aiInterpretedItems = 0,
    professionallyReviewedItems = 0;
  for (const item of a.items) {
    statusCounts[item.analysis_status] =
      (statusCounts[item.analysis_status] || 0) + 1;
    const construct = item.primary_construct || "Not classified";
    constructCounts[construct] = (constructCounts[construct] || 0) + 1;
    if (item.media?.length) visualItems++;
    if (item.interpretations?.length) aiInterpretedItems++;
    if (item.reviews?.length) professionallyReviewedItems++;
    for (const alignment of item.alignments) {
      const name = alignment.framework_name || "Legacy standards";
      frameworks[name] = frameworks[name] || {
        mapped: 0,
        unmapped: 0,
        standards: {},
      };
      if (alignment.standard_code) {
        frameworks[name].mapped++;
        frameworks[name].standards[alignment.standard_code] =
          (frameworks[name].standards[alignment.standard_code] || 0) + 1;
      } else frameworks[name].unmapped++;
    }
  }
  const review = a.items.filter((x) =>
      [
        "ambiguous",
        "human_review",
        "insufficient_information",
        "unmapped",
      ].includes(x.analysis_status),
    ),
    scaffolded = a.items.filter(
      (x) =>
        x.scaffolding_analysis &&
        x.scaffolding_analysis !==
          "No material student-visible scaffolding was identified.",
    ).length,
    recommendations = [];
  if (review.length)
    recommendations.push({
      priority: "high",
      finding: `${review.length} item${review.length === 1 ? "" : "s"} need professional review.`,
      action:
        "Review ambiguous, unmapped or insufficiently specified items before using the assessment.",
    });
  if (total && scaffolded / total > 0.5)
    recommendations.push({
      priority: "medium",
      finding: "More than half of the items contain identified scaffolding.",
      action:
        "Check whether the level of support matches the independence you intend students to demonstrate.",
    });
  for (const [name, data] of Object.entries(frameworks))
    if (data.unmapped)
      recommendations.push({
        priority: "medium",
        finding: `${data.unmapped} item mapping${data.unmapped === 1 ? "" : "s"} could not be defended against ${name}.`,
        action:
          "Clarify the task or ask a professional reviewer to consider a different construct; do not force a standards label.",
      });
  if (visualItems)
    recommendations.push({
      priority: "medium",
      finding: `${visualItems} item${visualItems === 1 ? " contains" : "s contain"} visual material.`,
      action:
        "Confirm that each chart, image or diagram and its relationship to the question were preserved during extraction.",
    });
  const distribution = (counts) =>
    Object.entries(counts)
      .map(([label, count]) => ({
        label,
        count,
        percentage: total ? +((count / total) * 100).toFixed(1) : 0,
      }))
      .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label));
  return {
    assessment: {
      id: a.id,
      title: a.title,
      subject: a.subject,
      grade_band: a.grade_band,
      workflow_mode: a.workflow_mode,
    },
    method: {
      sequence: [
        "student-visible demand",
        "construct lock",
        "verified ontology mapping",
        "professional review",
        "optional declared-intent comparison",
      ],
      ai_used: aiInterpretedItems > 0,
      ai_scope:
        "AI is used only for review-gated semantic interpretation of uncertain items.",
      human_confirmation_required: true,
    },
    quantitative: {
      item_count: total,
      status_counts: statusCounts,
      construct_counts: constructCounts,
      scaffolded_items: scaffolded,
      visual_items: visualItems,
      ai_interpreted_items: aiInterpretedItems,
      professionally_reviewed_items: professionallyReviewedItems,
      status_distribution: distribution(statusCounts),
      construct_distribution: distribution(constructCounts),
      frameworks,
    },
    qualitative: {
      review_queue: review.map((x) => ({
        item_key: x.item_key,
        status: x.analysis_status,
        rationale: x.analysis_rationale,
        ai_interpretation: x.interpretations?.[0] || null,
      })),
      recommendations,
      item_findings: a.items.map((x) => ({
        item_key: x.item_key,
        task: x.task,
        status: x.analysis_status,
        primary_construct: x.primary_construct,
        assessment_demand: x.assessment_demand,
        evidence_behaviour: x.evidence_behaviour,
        scaffolding_analysis: x.scaffolding_analysis,
        independence_depth: x.independence_depth,
        rationale: x.analysis_rationale,
        visual_elements: x.media?.length || 0,
        standards: x.alignments.map((y) => ({
          framework: y.framework_name || "Legacy standards",
          code: y.standard_code,
          title: y.standard_title,
          status: y.status,
          rationale: y.rationale,
        })),
        latest_ai_suggestion: x.interpretations?.[0] || null,
        professional_review: x.reviews?.[0] || null,
      })),
    },
    intent: a.intent_unlocked_at ? intentComparison(a) : null,
    limitations: [
      "Rules can identify explicit linguistic evidence but cannot guarantee an author’s intended construct.",
      "Images, charts and notation must be extracted with their relationships preserved before their intellectual demand can be evaluated reliably.",
      "Automated mappings are recommendations until a professional confirms them.",
    ],
  };
}
async function generateReport(r, c) {
  const s = scope(r),
    a = getAudit(c, r.params.id, s);
  if (!a) return bad("Assessment audit not found", "NOT_FOUND", 404);
  if (!locked(a))
    return bad(
      "Analyse and map every item before generating the report",
      "REPORT_NOT_READY",
      409,
    );
  const report = reportFor(a),
    version =
      1 +
      +c.db.query(
        "SELECT COALESCE(MAX(version),0) n FROM assessment_evaluation_reports WHERE audit_id=?",
        [a.id],
      ).rows[0].n,
    x = c.db.query(
      "INSERT INTO assessment_evaluation_reports(audit_id,version,report_json,generated_by) VALUES(?,?,?,?)",
      [a.id, version, JSON.stringify(report), String(r.user.id)],
    );
  return {
    success: true,
    report_id: x.lastInsertRowid,
    version,
    report,
    message: "Assessment report generated. Recommendations remain advisory.",
  };
}
async function insights(r, c) {
  const s = scope(r),
    counts = c.db.query(
      "SELECT COUNT(*) total,SUM(CASE WHEN i.analysis_status='pending' THEN 1 ELSE 0 END) pending,SUM(CASE WHEN i.analysis_status IN ('ambiguous','human_review','insufficient_information') THEN 1 ELSE 0 END) review_required,SUM(CASE WHEN i.analysis_status='unmapped' THEN 1 ELSE 0 END) unmapped,SUM(CASE WHEN i.analysis_status='high_confidence' THEN 1 ELSE 0 END) confirmed FROM assessment_evaluation_items i JOIN assessment_evaluation_audits a ON a.id=i.audit_id WHERE a.app_id=?",
      [s],
    ).rows[0];
  const total = +counts.total || 0,
    review = +counts.review_required || 0,
    unmapped = +counts.unmapped || 0;
  return {
    success: true,
    insights: [
      ...(review
        ? [
            {
              severity: "high",
              type: "human_review",
              title: "Items requiring professional review",
              count: review,
              action: "/assessment-evaluator?filter=review",
            },
          ]
        : []),
      ...(unmapped
        ? [
            {
              severity: "medium",
              type: "alignment",
              title: "Items with no defensible AERO alignment",
              count: unmapped,
              action: "/assessment-evaluator?filter=unmapped",
            },
          ]
        : []),
    ],
    summary: {
      total,
      pending: +counts.pending || 0,
      review_required: review,
      unmapped,
      confirmed: +counts.confirmed || 0,
      false_confident_rate: 0,
      principle: "False confidence is worse than human review.",
    },
  };
}
async function manifest() {
  return {
    success: true,
    module: {
      name: "assessment_evaluator",
      purpose:
        "Independently audit what assessment items actually measure before mapping them to one or more standards frameworks.",
      boundary: {
        does: "Evaluates assessment instruments, construct alignment, scaffolding, evidence and optional declared intent.",
        does_not: [
          "calculate student grades",
          "justify claimed alignment",
          "evaluate curriculum scope or sequence",
        ],
      },
      modes: {
        teacher: "Question paper only; context is inferred.",
        coordinator:
          "Question paper plus optional answer key, rubric, specification, objectives and framework comparisons.",
      },
      stages: [
        "deterministic rules",
        "semantic classifier",
        "constrained AI interpretation",
        "human review",
      ],
      current_stage_support: ["deterministic rules", "review-gated AI interpretation for uncertain items", "human review"],
      confidence: STATUSES,
    },
  };
}
module.exports = {
  boot,
  teardown,
  list,
  create,
  read,
  addItem,
  addSource,
  extractSource,
  decideCandidate,
  analyseItem,
  interpretItem,
  analyseAudit,
  mapItem,
  reviewItem,
  revealBenchmark,
  setIntent,
  compareIntent,
  generateReport,
  insights,
  manifest,
  _reportFor: reportFor,
  _parseCandidates: parseCandidates,
  _classify: classify,
};
