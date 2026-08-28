import type { CvAnalysisPort } from "../../application/ports/cv.js";
import {
  cvAnalysisRequestSchema,
  cvAnalysisResponseSchema,
  type CvAnalysisRequest,
  type CvAnalysisResponse,
} from "../../application/contracts/cv.js";
import { ContractViolationError } from "../../domain/shared/errors.js";

export class LocalCvHttpClient implements CvAnalysisPort {
  public constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  public async analyse(request: CvAnalysisRequest, signal?: AbortSignal): Promise<CvAnalysisResponse> {
    const payload = cvAnalysisRequestSchema.parse(request);
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
    const response = await this.fetcher(`${this.baseUrl}/v1/analyse`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      signal: combined,
    });
    if (!response.ok) throw new Error(`CV service refused analysis with status ${response.status}`);
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > 1_048_576)
      throw new ContractViolationError("CV response exceeds the 1 MiB contract limit");
    let decoded: unknown;
    try {
      decoded = JSON.parse(text);
    } catch {
      throw new ContractViolationError("CV service returned invalid JSON");
    }
    const result = cvAnalysisResponseSchema.safeParse(decoded);
    if (!result.success) throw new ContractViolationError("CV response violates contract v1");
    if (result.data.requestId !== payload.requestId || result.data.contentHash !== payload.contentHash)
      throw new ContractViolationError("CV response does not match the submitted evidence");
    return Object.freeze(result.data);
  }
}

