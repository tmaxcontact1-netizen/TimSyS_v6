import type {IncomingMessage,ServerResponse} from 'node:http';
export function normalizeDomainRequest(req:IncomingMessage,res:ServerResponse,appId:string):boolean;
