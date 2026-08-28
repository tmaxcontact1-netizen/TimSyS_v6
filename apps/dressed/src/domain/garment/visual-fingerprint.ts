export const FINGERPRINT_SCHEMA_VERSION = "1.0.0";
export const FINGERPRINT_ALGORITHM_VERSION = "classical-pixels-1.0.0";

export type PaletteEntry = Readonly<{ rgb: readonly [number, number, number]; lab: readonly [number, number, number]; proportion: number; label: string }>;
export type ImageMeasurements = Readonly<{
  width: number; height: number; foregroundCoverage: number; foregroundAspectRatio: number;
  palette: readonly PaletteEntry[]; averageLightness: number; averageChroma: number; luminanceContrast: number;
  edgeDensity: number; horizontalEdgeEnergy: number; verticalEdgeEnergy: number; textureStrength: number;
  paletteComplexity: number; visualComplexity: number; solidConfidence: number;
}>;
export type VisualFingerprint = Readonly<{
  schemaVersion: typeof FINGERPRINT_SCHEMA_VERSION; algorithmVersion: typeof FINGERPRINT_ALGORITHM_VERSION;
  whole: ImageMeasurements | null; detail: ImageMeasurements | null;
  combined: Readonly<{ palette: readonly PaletteEntry[]; averageLightness: number; averageChroma: number; contrast: number; patternDensity: number; textureStrength: number; visualComplexity: number; solidConfidence: number }>;
  confidence: number;
}>;
export type FieldSuggestion = Readonly<{ field: "category" | "formality" | "seasons" | "colour_summary" | "pattern_summary"; value: unknown; confidence: number; evidence: Readonly<Record<string, unknown>> }>;
