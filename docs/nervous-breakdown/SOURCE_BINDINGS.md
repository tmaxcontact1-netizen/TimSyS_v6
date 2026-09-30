# Registered JD sources — 29 September 2026

Scope: Principal’Ed project store at `C:\Users\tmaxc\Downloads\TimSyS\TimSyS_v6\platform\data\timsys.sqlite`. These are not the IDs from the previous isolated test database or a separately installed application. Original files were registered through the existing Documents services, then bound using Nervous Breakdown validation and audited revisions. A pre-registration database backup is recorded in the private receipt.

All seven files match the uploaded originals byte-for-byte. Each has **document version number 1, source-record revision 1 and role-record revision 1**. Document version IDs are globally allocated identifiers, not version numbers. All source/role records are draft; roles are placeholder references, not approved mappings.

| Original JD | Role ID | Source ID | Document ID | Document version ID |
|---|---|---|---:|---:|
| BBS Teacher.docx | `role.teacher` | `jd.teacher.2026-27` | 1 | 1 |
| BBS Section Principal.docx | `role.principal` | `jd.principal.2026-27` | 2 | 2 |
| BBS MS Behavioral Interventionist - 26-27.pdf | `role.interventionist` | `jd.interventionist.2026-27` | 3 | 3 |
| BBS MS Activities Coordinator.docx | `role.activities` | `jd.activities.2026-27` | 4 | 4 |
| BBS MS Student Affairs and Administrative Supervisor - 26-27.pdf | `role.student-affairs` | `jd.student-affairs.2026-27` | 5 | 5 |
| BBS Subject Leader.docx | `role.subject-leader` | `jd.subject-leader.2026-27` | 6 | 6 |
| BBS School Counselor Job Description 2026-27.pdf | `role.counselor` | `jd.counselor.2026-27` | 7 | 7 |

No source statements, responsibilities, connections or ontology terms were created. The corrected package supplies new statement IDs with exact wording/location and one of the source IDs above. New statements use expected_revision 0; their first saved revision is 1, which dependent responsibilities/evidence references can pin in the same batch. Source/role updates require expected_revision 1 unless their current revisions have since changed.

Do not assume new statements inherit the source-record revision or document version ID. Do not re-import the source/role records as new. Review status draft does not certify evidence or activate a record.

Full machine-readable registration receipt (including hashes): `../../../principaled-context/registered-jd-sources.json`. Source bytes remain in the ignored local Documents directory and are not committed to Git.
