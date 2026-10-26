import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { PrivateImageStore } from '../images/private-image-store.js';

/** New physical item: copy descriptive data, never wear/care/outfit history. */
export async function duplicateGarment(pool: Pool, images: PrivateImageStore, sourceId: string, version: number, timestamp: string) {
  const client = await pool.connect(), id = randomUUID();
  let committed = false;
  try {
    await client.query('BEGIN');
    const source = await client.query('SELECT name FROM dressed.garments WHERE garment_id=$1 AND version=$2 FOR UPDATE', [sourceId, version]);
    if (!source.rows[0]) { await client.query('ROLLBACK'); return null; }
    // Serialize numbering even when duplicating different copies of one item.
    const base = String(source.rows[0].name).replace(/ \(copy \d+\)$/, '').slice(0, 100);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`dressed-copy:${base}`]);
    let number = 2, name = `${base} (copy ${number})`;
    while ((await client.query('SELECT 1 FROM dressed.garments WHERE name=$1', [name])).rowCount) name = `${base} (copy ${++number})`;
    await client.query(`INSERT INTO dressed.garments(garment_id,name,category_id,brand,product_name,sku,notes,formality,fit,size,tailoring_notes,acquisition_condition,purchase_date,purchase_price_minor,currency,original_retail_price_minor,source,is_gift,acquisition_notes,visual_style,created_at,updated_at)
      SELECT $2,$3,category_id,brand,product_name,sku,notes,formality,fit,size,tailoring_notes,acquisition_condition,purchase_date,purchase_price_minor,currency,original_retail_price_minor,source,is_gift,acquisition_notes,visual_style,$4,$4 FROM dressed.garments WHERE garment_id=$1`, [sourceId,id,name,timestamp]);
    for (const [table, columns] of [['garment_materials','material,percentage'],['garment_seasons','season'],['garment_uses','use_id'],['garment_restrictions','restriction']])
      await client.query(`INSERT INTO dressed.${table}(garment_id,${columns}) SELECT $2,${columns} FROM dressed.${table} WHERE garment_id=$1`, [sourceId,id]);
    const imageMap = new Map<string,string>();
    const originals = await client.query('SELECT * FROM dressed.garment_images WHERE garment_id=$1 AND is_current ORDER BY image_id FOR SHARE', [sourceId]);
    for (const image of originals.rows) {
      const imageId = randomUUID();
      const path = await images.writeOriginal({garmentId:id,imageId,extension:image.media_type === 'image/png' ? '.png' : '.jpg',bytes:await images.read(image.original_relative_path)});
      imageMap.set(image.image_id,imageId);
      await client.query(`INSERT INTO dressed.garment_images(image_id,garment_id,calibration_profile_id,role,original_filename,original_relative_path,content_hash,media_type,byte_size,width,height,card_visibility_confirmed,validation_status,captured_at,created_at)
        SELECT $2,$3,calibration_profile_id,role,original_filename,$4,content_hash,media_type,byte_size,width,height,card_visibility_confirmed,validation_status,captured_at,$5 FROM dressed.garment_images WHERE image_id=$1`, [image.image_id,imageId,id,path,timestamp]);
      await client.query('INSERT INTO dressed.image_quality_findings(image_id,finding_index,code,severity,message) SELECT $2,finding_index,code,severity,message FROM dressed.image_quality_findings WHERE image_id=$1',[image.image_id,imageId]);
    }
    const fingerprints = await client.query('SELECT * FROM dressed.visual_fingerprints WHERE garment_id=$1 AND is_current FOR SHARE',[sourceId]);
    for (const fingerprint of fingerprints.rows) {
      const fingerprintId = randomUUID(), payload = structuredClone(fingerprint.measurement_payload);
      if (payload.appearance) payload.appearance.analysisId = null;
      await client.query(`INSERT INTO dressed.visual_fingerprints(fingerprint_id,garment_id,schema_version,algorithm_version,whole_image_id,detail_image_id,measurement_payload,confidence,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,[fingerprintId,id,fingerprint.schema_version,fingerprint.algorithm_version,imageMap.get(fingerprint.whole_image_id)??null,imageMap.get(fingerprint.detail_image_id)??null,JSON.stringify(payload),fingerprint.confidence,timestamp]);
      const reviews = await client.query('SELECT values FROM dressed.garment_appearance_reviews WHERE garment_id=$1 AND fingerprint_id=$2 ORDER BY created_at DESC LIMIT 1',[sourceId,fingerprint.fingerprint_id]);
      if (reviews.rows[0]) {
        const values = {...reviews.rows[0].values,name,version:1,analysisId:null};
        if (values.details) values.details = {...values.details,name};
        await client.query('INSERT INTO dressed.garment_appearance_reviews(review_id,garment_id,analysis_id,fingerprint_id,values,created_at) VALUES($1,$2,NULL,$3,$4::jsonb,$5)',[randomUUID(),id,fingerprintId,JSON.stringify(values),timestamp]);
      }
    }
    await client.query("INSERT INTO dressed.garment_status_history(status_history_id,garment_id,previous_status,new_status,reason,changed_at) VALUES($1,$2,NULL,'available','garment_duplicated',$3)",[randomUUID(),id,timestamp]);
    await client.query('COMMIT'); committed = true;
    return {id,name};
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    if (!committed) await images.removeGarment(id);
  }
}
