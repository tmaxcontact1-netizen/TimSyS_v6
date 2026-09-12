"use strict";
const fs = require("fs"),
  path = require("path"),
  appScope = require("../../shared/services/appScope"),
  extractor = require("./extractor");
function scope(r) {
  return appScope.fromRequest(r);
}
function bad(message, code = "VALIDATION_ERROR", statusCode = 400) {
  return { success: false, statusCode, error: { code, message } };
}
function root() {
  return path.resolve(
    (process.env.DB_PATH ||
      path.resolve(__dirname, "../../data/timsys.sqlite")) + ".documents",
  );
}
function hydrate(c, row) {
  if (!row) return row;
  row.warnings = JSON.parse(row.warning_json || "[]");
  delete row.warning_json;
  row.segments = c.db
    .query(
      "SELECT * FROM document_extraction_segments WHERE run_id=? ORDER BY ordinal",
      [row.id],
    )
    .rows.map((x) => ({ ...x, locator: JSON.parse(x.locator_json || "{}") }));
  row.assets = c.db
    .query("SELECT * FROM document_extraction_assets WHERE run_id=? ORDER BY ordinal", [row.id])
    .rows.map((x) => ({ ...x, locator: JSON.parse(x.locator_json || "{}") }));
  return row;
}
function boot(c) {
  c.log.info("shared document intelligence ready", {
    module: "document_intelligence",
    extractorVersion: extractor.VERSION,
  });
}
function teardown() {}
async function extractDocumentRecord(c, documentId, s, user, options = {}) {
  const doc = c.db.query("SELECT * FROM documents WHERE id=? AND app_id=?", [
    documentId,
    s,
  ]).rows[0];
  if (!doc) return bad("Document not found", "NOT_FOUND", 404);
  const version = c.db.query(
    "SELECT * FROM document_versions WHERE id=? AND document_id=?",
    [options.version_id || doc.current_version_id, doc.id],
  ).rows[0];
  if (!version)
    return bad(
      "Upload a file before starting extraction",
      "NO_FILE_VERSION",
      409,
    );
  const target = path.resolve(root(), version.storage_key);
  if (!target.startsWith(root() + path.sep) || !fs.existsSync(target))
    return bad("Stored file is unavailable", "FILE_UNAVAILABLE", 410);
  const bytes = fs.readFileSync(target),
    runId = c.db.query(
      "INSERT INTO document_extraction_runs(app_id,document_id,document_version_id,status,extractor_version,requested_by) VALUES(?,?,?,?,?,?)",
      [
        s,
        doc.id,
        version.id,
        "running",
        extractor.VERSION,
        String(user.id || user),
      ],
    ).lastInsertRowid;
  try {
    const result = await extractor.extractBytes(bytes, version.mime_type, {
      ocr: options.ocr === true,
    });
    c.db.transaction((db) => {
      for (const seg of result.segments)
        db.query(
          "INSERT INTO document_extraction_segments(run_id,ordinal,kind,content,content_hash,locator_json,confidence) VALUES(?,?,?,?,?,?,?)",
          [
            runId,
            seg.ordinal,
            seg.kind,
            seg.content,
            seg.content_hash,
            JSON.stringify(seg.locator || {}),
            seg.confidence == null ? null : seg.confidence,
          ],
        );
      for (const asset of result.assets || [])
        db.query(
          "INSERT INTO document_extraction_assets(run_id,ordinal,asset_type,locator_json,description,review_required) VALUES(?,?,?,?,?,?)",
          [runId, asset.ordinal, asset.asset_type, JSON.stringify(asset.locator || {}), asset.description || null, 1],
        );
      db.query(
        "UPDATE document_extraction_runs SET status=?,used_ocr=?,warning_json=?,completed_at=datetime('now') WHERE id=?",
        [
          result.status,
          result.usedOcr ? 1 : 0,
          JSON.stringify(result.warnings),
          runId,
        ],
      );
    });
    const row = hydrate(
      c,
      c.db.query("SELECT * FROM document_extraction_runs WHERE id=?", [runId])
        .rows[0],
    );
    c.events.publish("document_intelligence.extraction_completed", {
      entityId: runId,
      documentId: doc.id,
      status: row.status,
      __module: "document_intelligence",
    });
    return { success: true, run: row, text: result.text };
  } catch (e) {
    c.db.query(
      "UPDATE document_extraction_runs SET status='failed',error_message=?,completed_at=datetime('now') WHERE id=?",
      [String(e.message || e), runId],
    );
    c.events.publish("document_intelligence.extraction_failed", {
      entityId: runId,
      documentId: doc.id,
      error: String(e.message || e),
      __module: "document_intelligence",
    });
    return bad(
      "The file could not be read. The failed extraction is recorded for review.",
      "EXTRACTION_FAILED",
      422,
    );
  }
}
async function extract(r, c) {
  return extractDocumentRecord(c, r.params.id, scope(r), r.user, r.body || {});
}
async function read(r, c) {
  const row = c.db.query(
    "SELECT * FROM document_extraction_runs WHERE id=? AND app_id=?",
    [r.params.id, scope(r)],
  ).rows[0];
  return row
    ? { success: true, run: hydrate(c, row) }
    : bad("Extraction run not found", "NOT_FOUND", 404);
}
module.exports = { boot, teardown, extract, read, extractDocumentRecord };
