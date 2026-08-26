# Student Exits contract

Student Exits owns student movement and custody-transfer facts. It supports routine exits, supervised destination hand-offs, and campus releases through configurable but validated workflows. Each transition records the actor, time, previous state, next state, and optional operational note. Historical transitions are immutable.

The component never approves a release or makes a disciplinary, medical, counselling, safeguarding, or attendance decision. Campus release requires confirmation by an authorised human. Sensitive case details remain in their authoritative component; Student Exits stores only an operational reason and a restricted reference where permission permits.

The state engine and permission matrix are active. Existing medical referral records and APIs remain intact throughout the transition. Operational screens, dashboards and later integrations build on this governed boundary.
