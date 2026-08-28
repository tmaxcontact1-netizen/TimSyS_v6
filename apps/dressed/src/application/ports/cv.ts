import type { CvAnalysisRequest, CvAnalysisResponse } from "../contracts/cv.js";

export interface CvAnalysisPort {
  analyse(request: CvAnalysisRequest, signal?: AbortSignal): Promise<CvAnalysisResponse>;
}

