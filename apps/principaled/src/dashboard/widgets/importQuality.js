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
    ? "registry-row registry-row--review"
    : "registry-row";
}

export function reviewRowTitle(record) {
  const warnings = importWarnings(record);
  return warnings.length ? `Needs review: ${warnings.join("; ")}` : undefined;
}
