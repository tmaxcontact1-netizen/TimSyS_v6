import type { Pool } from "pg";
import type { FieldSuggestion, VisualFingerprint } from "../../domain/garment/visual-fingerprint.js";

export class FingerprintRepository {
  public constructor(private readonly pool: Pool) {}

  public async currentImages(garmentId: string) {
    const result = await this.pool.query<{ image_id: string; role: "whole" | "detail"; original_relative_path: string }>("SELECT image_id,role,original_relative_path FROM dressed.garment_images WHERE garment_id=$1 AND is_current AND validation_status='accepted_for_analysis' AND role IN ('whole','detail') ORDER BY role", [garmentId]);
    return result.rows.map((row) => ({ id: row.image_id, role: row.role, relativePath: row.original_relative_path }));
  }

  public async save(input: { fingerprintId: string; garmentId: string; fingerprint: VisualFingerprint; suggestions: readonly FieldSuggestion[]; wholeImageId: string | null; detailImageId: string | null; timestamp: string }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE dressed.visual_fingerprints SET is_current=false,superseded_at=$2 WHERE garment_id=$1 AND is_current", [input.garmentId,input.timestamp]);
      await client.query("UPDATE dressed.garment_field_suggestions SET status='superseded',decided_at=$2 WHERE garment_id=$1 AND status='pending'", [input.garmentId,input.timestamp]);
      await client.query(`INSERT INTO dressed.visual_fingerprints(fingerprint_id,garment_id,schema_version,algorithm_version,whole_image_id,detail_image_id,measurement_payload,confidence,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`, [input.fingerprintId,input.garmentId,input.fingerprint.schemaVersion,input.fingerprint.algorithmVersion,input.wholeImageId,input.detailImageId,JSON.stringify(input.fingerprint),input.fingerprint.confidence,input.timestamp]);
      for (const suggestion of input.suggestions) await client.query(`INSERT INTO dressed.garment_field_suggestions(suggestion_id,fingerprint_id,garment_id,field_name,suggested_value,confidence,evidence,created_at)
        VALUES(gen_random_uuid(),$1,$2,$3,$4::jsonb,$5,$6::jsonb,$7)`, [input.fingerprintId,input.garmentId,suggestion.field,JSON.stringify(suggestion.value),suggestion.confidence,JSON.stringify(suggestion.evidence),input.timestamp]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    return this.current(input.garmentId);
  }

  public async current(garmentId: string) {
    const result = await this.pool.query(`SELECT f.fingerprint_id,f.schema_version,f.algorithm_version,f.measurement_payload,f.confidence,f.created_at,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.suggestion_id,'field',s.field_name,'value',s.suggested_value,'confidence',s.confidence,'evidence',s.evidence,'status',s.status) ORDER BY s.field_name) FROM dressed.garment_field_suggestions s WHERE s.fingerprint_id=f.fingerprint_id),'[]'::jsonb) AS suggestions
      FROM dressed.visual_fingerprints f WHERE f.garment_id=$1 AND f.is_current`, [garmentId]);
    const row = result.rows[0];
    return row === undefined ? null : { id: row.fingerprint_id, schemaVersion: row.schema_version, algorithmVersion: row.algorithm_version, measurements: row.measurement_payload, confidence: Number(row.confidence), suggestions: row.suggestions, createdAt: row.created_at };
  }

  public async decide(fingerprintId: string, accepted: readonly string[], rejected: readonly string[], timestamp: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT 1 FROM dressed.visual_fingerprints WHERE fingerprint_id=$1 AND is_current FOR UPDATE", [fingerprintId]);
      if (result.rowCount !== 1) { await client.query("ROLLBACK"); return false; }
      if (accepted.length > 0) await client.query("UPDATE dressed.garment_field_suggestions SET status='accepted',decided_at=$3 WHERE fingerprint_id=$1 AND field_name=ANY($2::text[]) AND status='pending'", [fingerprintId,accepted,timestamp]);
      if (rejected.length > 0) await client.query("UPDATE dressed.garment_field_suggestions SET status='rejected',decided_at=$3 WHERE fingerprint_id=$1 AND field_name=ANY($2::text[]) AND status='pending'", [fingerprintId,rejected,timestamp]);
      await client.query("COMMIT"); return true;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
