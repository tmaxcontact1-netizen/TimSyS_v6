import type { Pool } from "pg";
import { reviewedFingerprint,type AppearanceReview,type Crop } from "../../domain/garment/appearance-review.js";
import type { AnalysisResult } from "../images/card-free-analysis.js";

export class IntakeRepository {
 constructor(private readonly pool:Pool){}
 async state(garmentId:string){
  const [analyses,reviews]=await Promise.all([
   this.pool.query("SELECT analysis_id id,source_image_ids,crops,result,created_at FROM dressed.garment_analyses WHERE garment_id=$1 ORDER BY created_at DESC,analysis_id DESC LIMIT 1",[garmentId]),
   this.pool.query("SELECT r.review_id id,r.values,r.created_at,f.is_current FROM dressed.garment_appearance_reviews r JOIN dressed.visual_fingerprints f ON f.fingerprint_id=r.fingerprint_id WHERE r.garment_id=$1 ORDER BY r.created_at DESC,r.review_id DESC LIMIT 1",[garmentId])]);
  return {analysis:analyses.rows[0]??null,review:reviews.rows[0]??null};
 }
 async analyse(input:{id:string;garmentId:string;imageIds:string[];crop:Crop|null;imageId:string;result:AnalysisResult;timestamp:string}){
  await this.pool.query("INSERT INTO dressed.garment_analyses(analysis_id,garment_id,source_image_ids,crops,result,created_at) VALUES($1,$2,$3::uuid[],$4::jsonb,$5::jsonb,$6)",[input.id,input.garmentId,input.imageIds,JSON.stringify({imageId:input.imageId,crop:input.crop}),JSON.stringify(input.result),input.timestamp]);
  return {id:input.id,result:input.result,source_image_ids:input.imageIds,crops:{imageId:input.imageId,crop:input.crop}};
 }
 async review(id:string,input:AppearanceReview,reviewId:string,fingerprintId:string,timestamp:string){
  const client=await this.pool.connect();
  try{
   await client.query("BEGIN");
   const garment=await client.query("SELECT version FROM dressed.garments WHERE garment_id=$1 AND lifecycle_status<>'archived' FOR UPDATE",[id]);
   if(garment.rows[0]?.version!==input.version)throw new Error("review_version_conflict");
   const category=await client.query("SELECT 1 FROM dressed.garment_categories WHERE category_id=$1 AND is_active",[input.categoryId]);
   const uses=await client.query("SELECT use_id FROM dressed.garment_use_types WHERE use_id=ANY($1::uuid[]) AND is_active",[input.useIds]);
   if(!category.rowCount||uses.rowCount!==input.useIds.length)throw new Error("review_invalid_classification");
   const images=await client.query<{image_id:string;role:string}>("SELECT image_id,role FROM dressed.garment_images WHERE garment_id=$1 AND is_current AND role IN ('whole','detail') ORDER BY image_id",[id]);
   let analysis:AnalysisResult|null=null;
   if(input.analysisId){
    const record=await client.query<{source_image_ids:string[];result:AnalysisResult}>("SELECT source_image_ids,result FROM dressed.garment_analyses WHERE analysis_id=$1 AND garment_id=$2",[input.analysisId,id]);
    const row=record.rows[0];
    if(!row||JSON.stringify([...row.source_image_ids].sort())!==JSON.stringify(images.rows.map(x=>x.image_id).sort()))throw new Error("review_analysis_stale");
    analysis=row.result;
   }
   const fingerprint=reviewedFingerprint(input.appearance,analysis?.fingerprint??null,input.analysisId);
   await client.query("UPDATE dressed.garments SET name=$2,category_id=$3,formality=$4,version=version+1,updated_at=$5 WHERE garment_id=$1",[id,input.name,input.categoryId,input.formality,timestamp]);
   await client.query("DELETE FROM dressed.garment_seasons WHERE garment_id=$1",[id]);
   await client.query("DELETE FROM dressed.garment_uses WHERE garment_id=$1",[id]);
   for(const season of input.seasons)await client.query("INSERT INTO dressed.garment_seasons(garment_id,season) VALUES($1,$2)",[id,season]);
   for(const use of input.useIds)await client.query("INSERT INTO dressed.garment_uses(garment_id,use_id) VALUES($1,$2)",[id,use]);
   await client.query("UPDATE dressed.visual_fingerprints SET is_current=false,superseded_at=$2 WHERE garment_id=$1 AND is_current",[id,timestamp]);
   await client.query("INSERT INTO dressed.visual_fingerprints(fingerprint_id,garment_id,schema_version,algorithm_version,whole_image_id,detail_image_id,measurement_payload,confidence,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)",[fingerprintId,id,fingerprint.schemaVersion,fingerprint.algorithmVersion,images.rows.find(x=>x.role==='whole')?.image_id??null,images.rows.find(x=>x.role==='detail')?.image_id??null,JSON.stringify(fingerprint),fingerprint.confidence,timestamp]);
   await client.query("INSERT INTO dressed.garment_appearance_reviews(review_id,garment_id,analysis_id,fingerprint_id,values,created_at) VALUES($1,$2,$3,$4,$5::jsonb,$6)",[reviewId,id,input.analysisId,fingerprintId,JSON.stringify(input),timestamp]);
   await client.query("COMMIT");
   return {id:reviewId,fingerprintId,version:input.version+1,uncertainFields:fingerprint.appearance!.uncertainFields};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
 }
}
