'use strict';
const {z}=require('zod'),{calibrationProfileInputSchema}=require('./schemas.cjs');
const text=z.string().max(4000),uuid=z.string().uuid(),num=z.number().finite(),empty=z.object({}).strict();
const obj=properties=>z.object(properties).strict(),arr=(type,max=1000)=>z.array(type).max(max);
const patch=obj({label:text,labL:num,labA:num,labB:num});
const profile=obj({id:uuid,name:text,cardType:text,notes:text.nullable(),isActive:z.boolean(),readyForPhotos:z.boolean(),patches:arr(patch,100),createdAt:text});
const finding=obj({code:text,severity:z.enum(['info','warning','error']),message:text});
const image=obj({id:uuid,garmentId:uuid,calibrationProfileId:uuid,calibrationProfileName:text,role:z.enum(['whole','detail','additional']),originalFilename:text,relativePath:text,contentHash:z.string().regex(/^[a-f0-9]{64}$/),mediaType:z.enum(['image/png','image/jpeg']),byteSize:z.number().int(),width:z.number().int(),height:z.number().int(),cardVisibilityConfirmed:z.boolean(),validationStatus:z.enum(['accepted_for_analysis','recapture_required']),isCurrent:z.boolean(),capturedAt:text.nullable(),createdAt:text,findings:arr(finding,100)});
const ready=obj({readyForAnalysis:z.boolean(),wholeReady:z.boolean(),detailReady:z.boolean()});
const inspection=obj({patches:arr(patch,100),layout:z.enum(['rgb-3','timsys-8']),confidence:num,message:text});
const palette=obj({rgb:z.array(num).length(3),lab:z.array(num).length(3),proportion:num,label:text});
const measurementFields=Object.fromEntries(['width','height','foregroundCoverage','foregroundAspectRatio','averageLightness','averageChroma','luminanceContrast','edgeDensity','horizontalEdgeEnergy','verticalEdgeEnergy','textureStrength','paletteComplexity','visualComplexity','solidConfidence'].map(k=>[k,num]));measurementFields.palette=arr(palette,10);
const payload=obj({schemaVersion:text,algorithmVersion:text,whole:obj(measurementFields).nullable(),detail:obj(measurementFields).nullable(),combined:obj({palette:arr(palette,10),averageLightness:num,averageChroma:num,contrast:num,patternDensity:num,textureStrength:num,visualComplexity:num,solidConfidence:num}),confidence:num});
const value=z.union([text,num,arr(text,100),arr(obj({slug:text,confidence:num,reason:text}),100)]);
const evidence=obj({foregroundAspectRatio:num.optional(),foregroundCoverage:num.optional(),limitation:text.optional(),visualComplexity:num.optional(),averageChroma:num.optional(),averageLightness:num.optional()});
const fingerprint=obj({id:uuid,schemaVersion:text,algorithmVersion:text,measurements:payload,confidence:num,suggestions:arr(obj({id:uuid,field:text,value,confidence:num,evidence,status:text}),100),createdAt:text});
const field=z.enum(['category','formality','seasons','colour_summary','pattern_summary']);
const shapes={
 profiles:{input:empty,output:obj({items:arr(profile)})},
 profile_create:{input:calibrationProfileInputSchema,output:profile,command:true},
 profile_retire:{input:obj({id:uuid}),output:obj({removed:z.literal(true),retainedForExistingPhotos:z.boolean()}),command:true},
 images:{input:obj({garmentId:uuid}),output:obj({items:arr(image),readiness:ready})},
 upload_begin:{input:obj({purpose:z.enum(['image','calibration']),garmentId:uuid.optional(),profileId:uuid.optional(),role:z.enum(['whole','detail','additional']).optional(),filename:z.string().min(1).max(240),name:z.string().trim().min(1).max(120).optional(),capturedAt:z.iso.datetime().nullable().optional(),byteSize:z.number().int().min(1).max(25000000),contentHash:z.string().regex(/^[a-f0-9]{64}$/)}),output:obj({uploadId:uuid,imageId:uuid}),command:true},
 upload_commit:{input:obj({uploadId:uuid}),output:z.union([obj({image,readiness:ready,calibration:inspection}),profile.extend({inspection})]),command:true},
 upload_abort:{input:obj({uploadId:uuid}),output:obj({aborted:z.boolean()}),command:true},
 fingerprint:{input:obj({garmentId:uuid}),output:fingerprint},
 fingerprint_generate:{input:obj({garmentId:uuid}),output:fingerprint,command:true},
 fingerprint_decide:{input:obj({id:uuid,accepted:arr(field,5),rejected:arr(field,5)}).refine(v=>!v.accepted.some(f=>v.rejected.includes(f)),'Overlapping decisions'),output:obj({recorded:z.literal(true)}),command:true},
};
function schema(value){const s=z.toJSONSchema(value,{io:'input',unrepresentable:'any'});function clean(v){delete v.$schema;delete v.default;if(v.type==='object'){v.required||=[];v.additionalProperties=false;Object.values(v.properties||{}).forEach(clean);}if(v.type==='array'){v.maxItems??=1000;clean(v.items);}if(v.anyOf)v.anyOf.forEach(clean);return v;}return clean(s);}
const operations=Object.fromEntries(Object.entries(shapes).map(([name,s])=>[name,{permission:s.command?'service:photography:write':'service:photography:read',effect:s.command?'command':'read',...(s.command?{idempotency:'required'}:{}),timeoutMs:25000,maximumInputBytes:32768,maximumOutputBytes:1048576,input:schema(s.input),output:schema(s.output)}]));
module.exports={shapes,contract:{serviceId:'photography',version:'1.0.0',owner:'timsys',apps:['dressed'],operations,binary:{maximumBytes:25000000,upload:'PUT uploads/:uploadId/content',download:'GET images/:imageId/content',authentication:'bearer-and-existing-owner',publication:'upload_commit'}}};
