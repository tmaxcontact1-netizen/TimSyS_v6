import {z} from 'zod';

export const institutionInput=z.object({state:z.enum(['confirmed','proposed','unassigned']),name:z.string().max(500),note:z.string().max(2000).default('')}).strict().refine(v=>v.state==='unassigned'?!v.name.trim():!!v.name.trim(),'Institution name and assignment state disagree');
export const structuralMappingInput=z.object({profile:z.literal('legacy-questionnaire@1.0'),hash:z.string().regex(/^[a-f0-9]{64}$/),previousMappingId:z.uuid().nullable(),reason:z.string().trim().min(1).max(2000),
 records:z.array(z.object({start:z.number().int().min(0),end:z.number().int().positive(),confirmed:z.literal(true),institution:institutionInput,
  include:z.array(z.enum(['heading','questionnaire','editorial','narrative'])).min(1).max(4),notes:z.string().max(5000).default('')}).strict()).min(1).max(25000)
}).strict();
