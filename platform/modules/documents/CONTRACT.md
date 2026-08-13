# Documents and Attachments component contract

Documents owns reusable document metadata, immutable file versions, integrity hashes and neutral links to records owned by other components. A link uses `subject_component`, `subject_type`, `subject_id` and `link_role`; it never copies or mutates its subject.

Each uploaded file creates a new immutable version. The component records the original filename, declared MIME type, exact byte size and SHA-256 digest, while the generated storage key prevents path traversal. Existing version content is never overwritten.

Files are limited to 10 MiB per version. Executable and active web content types are rejected. This component is for operational documents and attachments, not large media storage.

Withdrawal hides a document from active use without deleting its versions, links, history or physical content. Reinstatement restores it. Physical deletion and retention-policy disposal are intentionally outside this phase.
