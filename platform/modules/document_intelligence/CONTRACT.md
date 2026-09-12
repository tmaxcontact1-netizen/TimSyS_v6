# Document Intelligence service contract

Document Intelligence is a shared backend consumable for extracting traceable content from stored files. It supports native PDF text, DOCX, plain text and local English OCR for scanned PDFs and images. Every segment records its source page or extraction method, content hash and extractor version.

OCR is used only when requested and native text is unavailable. OCR results carry an explicit warning and must be reviewed against the source. Unsupported, empty and failed files remain visible states; they are never converted into invented content.

Extraction does not interpret meaning, identify standards or approve parsed questions. Consuming components retain responsibility for their own domain-specific parsing and human confirmation.
