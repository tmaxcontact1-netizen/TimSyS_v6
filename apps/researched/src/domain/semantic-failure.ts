export function semanticFailureCategory(error:unknown){
 const message=error instanceof Error?error.message:String(error);
 if(/ai_provider_http_(401|403)(?:\D|$)/.test(message)||/provider.*unavailable|provider.*changed/i.test(message))return 'connection';
 if(/ai_provider_http_(429|5\d\d)(?:\D|$)|abort|timeout|timed out|fetch failed|network|econn|socket/i.test(message))return 'provider';
 return 'response';
}
export function safeFailureDiagnostics(error:unknown){
 const d=(error as any)?.diagnostics;
 return d&&typeof d==='object'?d:null;
}
