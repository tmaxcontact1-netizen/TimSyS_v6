// Staged topology preflight. Starting validation workers requires separate authorization.
import('./verify-central-layout.mjs').catch(error=>{console.error(error);process.exitCode=1});
