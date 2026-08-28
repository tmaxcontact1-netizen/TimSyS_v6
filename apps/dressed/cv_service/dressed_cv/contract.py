"""Transport-only CV contract. Image algorithms are intentionally not implemented here."""

from dataclasses import dataclass
from typing import Literal

CONTRACT_VERSION = "1.0.0"
ImageRole = Literal["whole", "detail", "calibration", "additional"]
Operation = Literal["quality", "calibration", "fingerprint"]


@dataclass(frozen=True)
class AnalysisRequest:
    contract_version: str
    request_id: str
    image_id: str
    image_role: ImageRole
    relative_path: str
    content_hash: str
    analysis_version: str
    operations: tuple[Operation, ...]

