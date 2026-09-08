# UI Capability Coverage

Generated: 2026-09-08T18:10:26.197Z

This report is a static connection audit. A route is **referenced** when application frontend source contains a matching endpoint. Reference proves an intended UI connection, not that the resulting workflow is usable; interaction acceptance is a later gate.

Infrastructure-only services are intentionally excluded unless they publish a user-facing HTTP capability. Health, manifest, contract, and diagnostic endpoints are classified as administration rather than ordinary work.

## Principal'Ed

Declared capabilities: **528**
Frontend-referenced: **528**
Not referenced: **0**
Operational gaps: **0**

| Owner | Declared | Referenced | Unreferenced |
|---|---:|---:|---:|
| academic_commentary | 4 | 4 | 0 |
| academic_structure | 13 | 13 | 0 |
| approvals | 7 | 7 | 0 |
| assessment_evidence | 8 | 8 | 0 |
| assessment_scales | 7 | 7 | 0 |
| attendance | 6 | 6 | 0 |
| audiences | 6 | 6 | 0 |
| builder | 19 | 19 | 0 |
| calendar | 15 | 15 | 0 |
| catering | 12 | 12 | 0 |
| classroom_attendance | 4 | 4 | 0 |
| communications | 12 | 12 | 0 |
| contingency | 9 | 9 | 0 |
| cover | 26 | 26 | 0 |
| documents | 9 | 9 | 0 |
| evaluation_policies | 6 | 6 | 0 |
| event_planner | 3 | 3 | 0 |
| event_record | 6 | 6 | 0 |
| financial_planning | 11 | 11 | 0 |
| grade_evaluation | 3 | 3 | 0 |
| grade_reporting | 6 | 6 | 0 |
| gradebook | 2 | 2 | 0 |
| gradebook_core | 4 | 4 | 0 |
| gradebook_workspace | 2 | 2 | 0 |
| intelligence_center | 14 | 14 | 0 |
| inventory | 9 | 9 | 0 |
| invitations | 4 | 4 | 0 |
| late_entries | 31 | 31 | 0 |
| learning_behaviours | 8 | 8 | 0 |
| learning_standards | 7 | 7 | 0 |
| medical_referrals | 5 | 5 | 0 |
| ownership | 9 | 9 | 0 |
| programme_manager | 80 | 80 | 0 |
| resource_reservations | 5 | 5 | 0 |
| risk_assessments | 6 | 6 | 0 |
| room_registry | 9 | 9 | 0 |
| safeguarding_requirements | 4 | 4 | 0 |
| scheduler | 29 | 29 | 0 |
| school_analytics | 5 | 5 | 0 |
| staff_profile | 4 | 4 | 0 |
| staff_registry | 10 | 10 | 0 |
| student_exits | 32 | 32 | 0 |
| student_profile | 4 | 4 | 0 |
| student_registry | 11 | 11 | 0 |
| system_health | 1 | 1 | 0 |
| tasks | 7 | 7 | 0 |
| teacher_preferences | 15 | 15 | 0 |
| transportation | 14 | 14 | 0 |
| venue_bookings | 5 | 5 | 0 |

### Unreferenced capabilities

None.

## Dress'Ed

Declared capabilities: **27**
Frontend-referenced: **26**
Not referenced: **1**
Operational gaps: **1**

| Owner | Declared | Referenced | Unreferenced |
|---|---:|---:|---:|
| dressed | 27 | 26 | 1 |

### Unreferenced capabilities

| Exposure | Method | Endpoint | Owner |
|---|---|---|---|
| operational | ANY | `/api/outfits/:id` | dressed |

## MemeCoined

Declared capabilities: **16**
Frontend-referenced: **14**
Not referenced: **2**
Operational gaps: **1**

| Owner | Declared | Referenced | Unreferenced |
|---|---:|---:|---:|
| memecoined | 16 | 14 | 2 |

### Unreferenced capabilities

| Exposure | Method | Endpoint | Owner |
|---|---|---|---|
| administration | ANY | `/api/application` | memecoined |
| operational | ANY | `/api/watchlists/:id/tokens:parameter2)?` | memecoined |

## Research'Ed

Declared capabilities: **49**
Frontend-referenced: **46**
Not referenced: **3**
Operational gaps: **0**

| Owner | Declared | Referenced | Unreferenced |
|---|---:|---:|---:|
| researched | 49 | 46 | 3 |

### Unreferenced capabilities

| Exposure | Method | Endpoint | Owner |
|---|---|---|---|
| administration | ANY | `/api/analysis-types/:id/contract` | researched |
| administration | ANY | `/api/application` | researched |
| administration | ANY | `/api/health` | researched |

## Machine-readable totals

```json
{
  "generatedAt": "2026-09-08T18:10:26.212Z",
  "totals": {
    "declared": 620,
    "referenced": 614,
    "unreferenced": 6
  },
  "applications": {
    "Principal'Ed": {
      "declared": 528,
      "referenced": 528
    },
    "Dress'Ed": {
      "declared": 27,
      "referenced": 26
    },
    "MemeCoined": {
      "declared": 16,
      "referenced": 14
    },
    "Research'Ed": {
      "declared": 49,
      "referenced": 46
    }
  }
}
```
