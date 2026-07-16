## CONTEXT.md

Save as `~/TimSyS_v6/CONTEXT.md`:

```markdown
# TimSyS v6 Context

## Current State

**Current Phase:** Phase 0 — Foundation Contracts (PENDING FREEZE)

Contracts exist as stub files. Ready for review and formal sign-off. Once signed off, move to Phase 1.

## Completed

- Repository initialized at `/home/tmax/TimSyS_v6/`
- Git tag `v6.0.0-base` created
- Branch `feature/phase-0-contracts` active
- All root docs: `CONTEXT.md`, `ARCHITECTURE_MAP.md`, `HANDOVER.md`, `CONSTITUTION_V6.0.md`, `LEXICON_V6.0.0.md`
- npm packages installed (`package.json`, `package-lock.json`)
- 6 contract stub files present in `/contracts/`
- 9 service stub files present in `/shared/services/`
- 6 registry stub files present in `/shared/registry/`
- 6 pipeline stub files present in `/shared/pipeline/`

## In Progress

None. Awaiting Phase 0 sign-off before proceeding.

## Blocked

None. Awaiting user decision on Phase 0 completion criteria.

## Next Commit

Once Phase 0 contracts are reviewed and confirmed:
1. Confirm all 6 contracts are frozen (add freeze comment to each file)
2. Update this CONTEXT.md to mark Phase 0 as COMPLETE
3. Begin Phase 1.1: Implement db.js, cache.js services
4. Commit with message: `Phase 0 freeze — contracts ratified, moving to Phase 1.1`

## Recent Changes

| Date | Commit/Change | Description |
|------|---------------|-------------|
| 2026-07-16 | v6.0.0-base | Initial repository setup with all stubs |
| 2026-07-16 | Constitution update | Pipeline path corrected to /shared/pipeline/, 9 services listed, auth revocation added, EventBus request/reply added, FunctionRegistry scope clarified |
| 2026-07-16 | Tooling | Architecture map generator script added |

## Open Decisions

1. **Phase 0 sign-off date:** TBD
2. **Session duration policy:** Handover updated at end of each session before closing thread (documented in HANDOVER.md)
3. **Token revocation strategy:** Bloom filter vs sqlite table for performance trade-off — defer until Phase 1.1 auth implementation
4. **Request/reply timeout defaults:** Not specified — defer to Phase 9 (EventBus impl)

## Session Protocol

- Handover is updated at end of each session (each Lumo thread) before closing.
- Architecture Map is regenerated manually via `bash Tools/update_architecture_map.sh` prior to commits.
- Frozen documents (Constitution, Lexicon) are hashed after modifications. New baseline stored in HANDOVER.md.

---

Last updated: 2026-07-16
