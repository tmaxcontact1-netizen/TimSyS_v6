import type { Pool } from "pg";
import type { CalibrationProfileInput, ImageFinding, ImageRole, ValidatedImage } from "../../domain/garment/photography.js";

export class PhotographyRepository {
  public constructor(private readonly pool: Pool) {}

  public async profiles() {
    const result = await this.pool.query(`SELECT p.calibration_profile_id,p.name,p.card_type,p.notes,p.is_active,p.created_at,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('label',x.label,'labL',x.lab_l,'labA',x.lab_a,'labB',x.lab_b) ORDER BY x.patch_index) FROM dressed.calibration_patches x WHERE x.calibration_profile_id=p.calibration_profile_id),'[]'::jsonb) AS patches
      FROM dressed.calibration_profiles p WHERE p.is_active ORDER BY p.name`);
    return result.rows.map((row) => { const labels=new Set((row.patches as Array<{label:string}>).map(patch=>patch.label.toLowerCase())); return { id: row.calibration_profile_id, name: row.name, cardType: row.card_type, notes: row.notes, isActive: row.is_active, readyForPhotos: ["red","green","blue"].every(label=>labels.has(label)), patches: row.patches, createdAt: row.created_at }; });
  }

  public async createProfile(id: string, input: CalibrationProfileInput, timestamp: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO dressed.calibration_profiles(calibration_profile_id,name,card_type,notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5)", [id,input.name,input.cardType,input.notes ?? null,timestamp]);
      for (const [index, patch] of input.patches.entries()) await client.query("INSERT INTO dressed.calibration_patches(calibration_profile_id,patch_index,label,lab_l,lab_a,lab_b) VALUES($1,$2,$3,$4,$5,$6)", [id,index,patch.label,patch.labL,patch.labA,patch.labB]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    return (await this.profiles()).find((profile) => profile.id === id)!;
  }

  public async garmentExists(id: string): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 FROM dressed.garments WHERE garment_id=$1 AND lifecycle_status<>'archived'", [id]);
    return result.rowCount === 1;
  }

  public async addImage(input: { imageId: string; garmentId: string; profileId: string; role: ImageRole; filename: string; relativePath: string; cardVisible: boolean; capturedAt: string | null; timestamp: string; validation: ValidatedImage }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const isCurrent = input.validation.status === "accepted_for_analysis";
      if (isCurrent && input.role !== "additional") await client.query("UPDATE dressed.garment_images SET is_current=false,superseded_at=$3 WHERE garment_id=$1 AND role=$2 AND is_current", [input.garmentId,input.role,input.timestamp]);
      await client.query(`INSERT INTO dressed.garment_images(image_id,garment_id,calibration_profile_id,role,original_filename,original_relative_path,content_hash,media_type,byte_size,width,height,card_visibility_confirmed,validation_status,is_current,captured_at,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [input.imageId,input.garmentId,input.profileId,input.role,input.filename,input.relativePath,input.validation.contentHash,input.validation.mediaType,input.validation.byteSize,input.validation.width,input.validation.height,input.cardVisible,input.validation.status,isCurrent,input.capturedAt,input.timestamp]);
      for (const [index, finding] of input.validation.findings.entries()) await client.query("INSERT INTO dressed.image_quality_findings(image_id,finding_index,code,severity,message) VALUES($1,$2,$3,$4,$5)", [input.imageId,index,finding.code,finding.severity,finding.message]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    return this.image(input.imageId);
  }

  public async images(garmentId: string) {
    const result = await this.pool.query(`SELECT i.*,p.name AS calibration_profile_name,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('code',f.code,'severity',f.severity,'message',f.message) ORDER BY f.finding_index) FROM dressed.image_quality_findings f WHERE f.image_id=i.image_id),'[]'::jsonb) AS findings
      FROM dressed.garment_images i JOIN dressed.calibration_profiles p ON p.calibration_profile_id=i.calibration_profile_id WHERE i.garment_id=$1 ORDER BY i.created_at DESC,i.image_id`, [garmentId]);
    return result.rows.map(mapImage);
  }

  public async image(id: string) {
    const result = await this.pool.query(`SELECT i.*,p.name AS calibration_profile_name,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('code',f.code,'severity',f.severity,'message',f.message) ORDER BY f.finding_index) FROM dressed.image_quality_findings f WHERE f.image_id=i.image_id),'[]'::jsonb) AS findings
      FROM dressed.garment_images i JOIN dressed.calibration_profiles p ON p.calibration_profile_id=i.calibration_profile_id WHERE i.image_id=$1`, [id]);
    return result.rows[0] === undefined ? null : mapImage(result.rows[0]);
  }

  public async readiness(garmentId: string) {
    const result = await this.pool.query<{ role: string }>("SELECT role FROM dressed.garment_images WHERE garment_id=$1 AND is_current AND validation_status='accepted_for_analysis' AND role IN ('whole','detail')", [garmentId]);
    const roles = new Set(result.rows.map((row) => row.role));
    return { readyForAnalysis: roles.has("whole") && roles.has("detail"), wholeReady: roles.has("whole"), detailReady: roles.has("detail") };
  }
}

function mapImage(row: Record<string, unknown>) {
  return { id: row.image_id, garmentId: row.garment_id, calibrationProfileId: row.calibration_profile_id, calibrationProfileName: row.calibration_profile_name, role: row.role, originalFilename: row.original_filename, relativePath: row.original_relative_path, contentHash: row.content_hash, mediaType: row.media_type, byteSize: Number(row.byte_size), width: row.width, height: row.height, cardVisibilityConfirmed: row.card_visibility_confirmed, validationStatus: row.validation_status, isCurrent: row.is_current, capturedAt: row.captured_at, createdAt: row.created_at, findings: row.findings as readonly ImageFinding[] };
}
