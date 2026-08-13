export function importWarnings(record) {
  try {
    const custom =
      typeof record?.custom_fields === "string"
        ? JSON.parse(record.custom_fields)
        : record?.custom_fields;
    const warnings = custom?.csv_import?.warnings;
    return Array.isArray(warnings) ? warnings.filter(Boolean) : [];
  } catch {
    return ["Import review metadata could not be read"];
  }
}

export function reviewRowClass(record) {
  return importWarnings(record).length
    ? "border-b border-red-800 border-l-4 border-l-red-500 bg-red-950/50 hover:bg-red-900/50"
    : "border-b border-gray-800 hover:bg-gray-800/50";
}

export function reviewRowTitle(record) {
  const warnings = importWarnings(record);
  return warnings.length ? `Needs review: ${warnings.join("; ")}` : undefined;
}
