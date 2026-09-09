import type { Pool, PoolClient } from "pg";

import type { CategoryInput, GarmentInput, GarmentUpdate } from "../../domain/garment/garment.js";

type CategoryRow = { category_id: string; parent_category_id: string | null; name: string; slug: string; sort_order: number; is_active: boolean };
type GarmentRow = Record<string, unknown> & { garment_id: string; version: number };

function category(row: CategoryRow) {
  return { id: row.category_id, parentCategoryId: row.parent_category_id, name: row.name, slug: row.slug, sortOrder: row.sort_order, isActive: row.is_active };
}

function garment(row: GarmentRow) {
  return {
    id: row.garment_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    brand: row.brand,
    productName: row.product_name,
    sku: row.sku,
    notes: row.notes,
    formality: row.formality,
    fit: row.fit,
    size: row.size,
    tailoringNotes: row.tailoring_notes,
    materials: row.materials,
    seasons: row.seasons,
    uses: row.uses,
    restrictions: row.restrictions,
    acquisition: {
      condition: row.acquisition_condition,
      purchaseDate: row.purchase_date,
      purchasePriceMinor: row.purchase_price_minor == null ? null : Number(row.purchase_price_minor),
      currency: row.currency,
      originalRetailPriceMinor: row.original_retail_price_minor == null ? null : Number(row.original_retail_price_minor),
      source: row.source,
      isGift: row.is_gift,
      notes: row.acquisition_notes,
    },
    status: row.lifecycle_status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const garmentSelect = `
  SELECT g.*, c.name AS category_name,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('material',m.material,'percentage',m.percentage) ORDER BY m.material) FROM dressed.garment_materials m WHERE m.garment_id=g.garment_id),'[]'::jsonb) AS materials,
    COALESCE((SELECT jsonb_agg(s.season ORDER BY s.season) FROM dressed.garment_seasons s WHERE s.garment_id=g.garment_id),'[]'::jsonb) AS seasons,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',u.use_id,'slug',u.slug,'name',u.name) ORDER BY u.sort_order,u.name) FROM dressed.garment_uses gu JOIN dressed.garment_use_types u ON u.use_id=gu.use_id WHERE gu.garment_id=g.garment_id),'[]'::jsonb) AS uses,
    COALESCE((SELECT jsonb_agg(r.restriction ORDER BY r.restriction) FROM dressed.garment_restrictions r WHERE r.garment_id=g.garment_id),'[]'::jsonb) AS restrictions
  FROM dressed.garments g JOIN dressed.garment_categories c ON c.category_id=g.category_id`;

async function replaceCollections(client: PoolClient, id: string, input: GarmentInput): Promise<void> {
  await client.query("DELETE FROM dressed.garment_materials WHERE garment_id=$1", [id]);
  await client.query("DELETE FROM dressed.garment_seasons WHERE garment_id=$1", [id]);
  await client.query("DELETE FROM dressed.garment_restrictions WHERE garment_id=$1", [id]);
  await client.query("DELETE FROM dressed.garment_uses WHERE garment_id=$1", [id]);
  for (const item of input.materials) await client.query("INSERT INTO dressed.garment_materials(garment_id,material,percentage) VALUES($1,$2,$3)", [id, item.material, item.percentage ?? null]);
  for (const season of input.seasons) await client.query("INSERT INTO dressed.garment_seasons(garment_id,season) VALUES($1,$2)", [id, season]);
  for (const restriction of input.restrictions) await client.query("INSERT INTO dressed.garment_restrictions(garment_id,restriction) VALUES($1,$2)", [id, restriction]);
  for (const useId of input.useIds) await client.query("INSERT INTO dressed.garment_uses(garment_id,use_id) SELECT $1,use_id FROM dressed.garment_use_types WHERE use_id=$2 AND is_active", [id, useId]);
}

export class WardrobeRepository {
  public constructor(private readonly pool: Pool) {}

  public async categories() {
    const result = await this.pool.query<CategoryRow>("SELECT category_id,parent_category_id,name,slug,sort_order,is_active FROM dressed.garment_categories WHERE is_active ORDER BY parent_category_id NULLS FIRST,sort_order,name");
    return result.rows.map(category);
  }

  public async uses() {
    const result = await this.pool.query("SELECT use_id id,slug,name,sort_order FROM dressed.garment_use_types WHERE is_active ORDER BY sort_order,name");
    return result.rows;
  }

  public async createCategory(id: string, input: CategoryInput, timestamp: string) {
    const result = await this.pool.query<CategoryRow>(`INSERT INTO dressed.garment_categories(category_id,parent_category_id,name,slug,sort_order,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING category_id,parent_category_id,name,slug,sort_order,is_active`, [id, input.parentCategoryId ?? null, input.name, input.slug, input.sortOrder, timestamp]);
    return category(result.rows[0]!);
  }

  public async list(input: { search?: string | undefined; categoryId?: string | undefined; useId?: string | undefined; status?: string | undefined; limit: number; offset: number }) {
    const values: unknown[] = [];
    const conditions: string[] = [];
    if (input.status !== "all") { values.push(input.status ?? "available"); conditions.push(`g.lifecycle_status=$${values.length}`); }
    if (input.categoryId) { values.push(input.categoryId); conditions.push(`g.category_id=$${values.length}`); }
    if (input.useId) { values.push(input.useId); conditions.push(`EXISTS(SELECT 1 FROM dressed.garment_uses gu WHERE gu.garment_id=g.garment_id AND gu.use_id=$${values.length})`); }
    if (input.search) { values.push(`%${input.search}%`); conditions.push(`(g.name ILIKE $${values.length} OR g.brand ILIKE $${values.length} OR g.product_name ILIKE $${values.length} OR g.sku ILIKE $${values.length})`); }
    const where = conditions.length === 0 ? "" : ` WHERE ${conditions.join(" AND ")}`;
    const count = await this.pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM dressed.garments g${where}`, values);
    values.push(input.limit, input.offset);
    const result = await this.pool.query<GarmentRow>(`${garmentSelect}${where} ORDER BY g.name,g.garment_id LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    return { items: result.rows.map(garment), total: Number(count.rows[0]?.count ?? 0), limit: input.limit, offset: input.offset };
  }

  public async get(id: string) {
    const result = await this.pool.query<GarmentRow>(`${garmentSelect} WHERE g.garment_id=$1`, [id]);
    return result.rows[0] === undefined ? null : garment(result.rows[0]);
  }

  public async create(id: string, input: GarmentInput, timestamp: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO dressed.garments(garment_id,category_id,name,brand,product_name,sku,notes,formality,fit,size,tailoring_notes,acquisition_condition,purchase_date,purchase_price_minor,currency,original_retail_price_minor,source,is_gift,acquisition_notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20)`, [id,input.categoryId,input.name,input.brand ?? null,input.productName ?? null,input.sku ?? null,input.notes ?? null,input.formality ?? null,input.fit ?? null,input.size ?? null,input.tailoringNotes ?? null,input.acquisition.condition ?? null,input.acquisition.purchaseDate ?? null,input.acquisition.purchasePriceMinor ?? null,input.acquisition.currency ?? null,input.acquisition.originalRetailPriceMinor ?? null,input.acquisition.source ?? null,input.acquisition.isGift,input.acquisition.notes ?? null,timestamp]);
      await replaceCollections(client, id, input);
      await client.query("INSERT INTO dressed.garment_status_history(status_history_id,garment_id,previous_status,new_status,reason,changed_at) VALUES(gen_random_uuid(),$1,NULL,'available','garment_created',$2)", [id,timestamp]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    return this.get(id);
  }

  public async update(id: string, input: GarmentUpdate, timestamp: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(`UPDATE dressed.garments SET category_id=$2,name=$3,brand=$4,product_name=$5,sku=$6,notes=$7,formality=$8,fit=$9,size=$10,tailoring_notes=$11,acquisition_condition=$12,purchase_date=$13,purchase_price_minor=$14,currency=$15,original_retail_price_minor=$16,source=$17,is_gift=$18,acquisition_notes=$19,version=version+1,updated_at=$20 WHERE garment_id=$1 AND version=$21 AND lifecycle_status<>'archived' RETURNING garment_id`, [id,input.categoryId,input.name,input.brand ?? null,input.productName ?? null,input.sku ?? null,input.notes ?? null,input.formality ?? null,input.fit ?? null,input.size ?? null,input.tailoringNotes ?? null,input.acquisition.condition ?? null,input.acquisition.purchaseDate ?? null,input.acquisition.purchasePriceMinor ?? null,input.acquisition.currency ?? null,input.acquisition.originalRetailPriceMinor ?? null,input.acquisition.source ?? null,input.acquisition.isGift,input.acquisition.notes ?? null,timestamp,input.version]);
      if (result.rowCount !== 1) { await client.query("ROLLBACK"); return null; }
      await replaceCollections(client, id, input);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    return this.get(id);
  }

  public async archive(id: string, version: number, timestamp: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<{ lifecycle_status: string }>("SELECT lifecycle_status FROM dressed.garments WHERE garment_id=$1 AND version=$2 AND lifecycle_status<>'archived' FOR UPDATE", [id, version]);
      if (current.rowCount !== 1) { await client.query("ROLLBACK"); return false; }
      const result = await client.query("UPDATE dressed.garments SET lifecycle_status='archived',archived_at=$3,updated_at=$3,version=version+1 WHERE garment_id=$1 AND version=$2", [id,version,timestamp]);
      if (result.rowCount !== 1) { await client.query("ROLLBACK"); return false; }
      await client.query("INSERT INTO dressed.garment_status_history(status_history_id,garment_id,previous_status,new_status,reason,changed_at) VALUES(gen_random_uuid(),$1,$2,'archived','user_archived',$3)", [id,current.rows[0]!.lifecycle_status,timestamp]);
      await client.query("COMMIT"); return true;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  public async delete(id: string, version: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT 1 FROM dressed.garments WHERE garment_id=$1 AND version=$2 FOR UPDATE", [id, version]);
      if (found.rowCount !== 1) { await client.query("ROLLBACK"); return false; }
      const outfits = await client.query<{outfit_id:string}>("SELECT DISTINCT outfit_id FROM dressed.saved_outfit_items WHERE garment_id=$1", [id]);
      const outfitIds = outfits.rows.map(row => row.outfit_id);
      const worn = await client.query<{wear_event_id:string;planned_outfit_id:string|null}>("SELECT DISTINCT e.wear_event_id,e.planned_outfit_id FROM dressed.wear_event_items i JOIN dressed.wear_events e ON e.wear_event_id=i.wear_event_id WHERE i.garment_id=$1", [id]);
      const wearIds = worn.rows.map(row => row.wear_event_id);
      const wornPlanIds = worn.rows.flatMap(row => row.planned_outfit_id ? [row.planned_outfit_id] : []);
      if (outfitIds.length) {
        await client.query("DELETE FROM dressed.wear_event_items WHERE wear_event_id IN (SELECT wear_event_id FROM dressed.wear_events WHERE saved_outfit_id=ANY($1::uuid[]))", [outfitIds]);
        await client.query("DELETE FROM dressed.wear_events WHERE saved_outfit_id=ANY($1::uuid[])", [outfitIds]);
        await client.query("UPDATE dressed.planned_outfits SET replaced_by_id=NULL WHERE replaced_by_id IN (SELECT planned_outfit_id FROM dressed.planned_outfits WHERE saved_outfit_id=ANY($1::uuid[]))", [outfitIds]);
        await client.query("DELETE FROM dressed.planned_outfits WHERE saved_outfit_id=ANY($1::uuid[])", [outfitIds]);
        await client.query("DELETE FROM dressed.saved_outfit_items WHERE outfit_id=ANY($1::uuid[])", [outfitIds]);
        await client.query("DELETE FROM dressed.saved_outfits WHERE outfit_id=ANY($1::uuid[])", [outfitIds]);
      }
      if (wearIds.length) { await client.query("DELETE FROM dressed.wear_event_items WHERE wear_event_id=ANY($1::uuid[])", [wearIds]); await client.query("DELETE FROM dressed.wear_events WHERE wear_event_id=ANY($1::uuid[])", [wearIds]); }
      if (wornPlanIds.length) { await client.query("UPDATE dressed.planned_outfits SET replaced_by_id=NULL WHERE replaced_by_id=ANY($1::uuid[])", [wornPlanIds]); await client.query("DELETE FROM dressed.planned_outfits WHERE planned_outfit_id=ANY($1::uuid[])", [wornPlanIds]); }
      const evaluations = await client.query<{evaluation_id:string}>("SELECT DISTINCT evaluation_id FROM dressed.styling_evaluation_items WHERE garment_id=$1", [id]);
      const evaluationIds = evaluations.rows.map(row => row.evaluation_id);
      if (evaluationIds.length) { await client.query("DELETE FROM dressed.styling_rule_outcomes WHERE evaluation_id=ANY($1::uuid[])", [evaluationIds]); await client.query("DELETE FROM dressed.styling_evaluation_items WHERE evaluation_id=ANY($1::uuid[])", [evaluationIds]); await client.query("DELETE FROM dressed.styling_evaluations WHERE evaluation_id=ANY($1::uuid[])", [evaluationIds]); }
      await client.query("DELETE FROM dressed.combination_overrides WHERE $1::uuid=ANY(garment_ids)", [id]);
      await client.query("UPDATE dressed.outfit_plans SET fixed_garment_ids=array_remove(fixed_garment_ids,$1::uuid),excluded_garment_ids=array_remove(excluded_garment_ids,$1::uuid)", [id]);
      await client.query("DELETE FROM dressed.garment_care_cases WHERE garment_id=$1", [id]);
      await client.query("DELETE FROM dressed.garment_field_suggestions WHERE garment_id=$1", [id]);
      await client.query("DELETE FROM dressed.visual_fingerprints WHERE garment_id=$1", [id]);
      await client.query("DELETE FROM dressed.image_derivatives WHERE source_image_id IN (SELECT image_id FROM dressed.garment_images WHERE garment_id=$1)", [id]);
      await client.query("DELETE FROM dressed.image_quality_findings WHERE image_id IN (SELECT image_id FROM dressed.garment_images WHERE garment_id=$1)", [id]);
      await client.query("DELETE FROM dressed.garment_images WHERE garment_id=$1", [id]);
      await client.query("DELETE FROM dressed.garment_status_history WHERE garment_id=$1", [id]);
      await client.query("DELETE FROM dressed.garments WHERE garment_id=$1", [id]);
      await client.query("COMMIT"); return true;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
