import React from 'react';

export default function CsvImportResult({ result }) {
  if (!result) return null;
  if (!result.success) return <div className="mt-4 px-4 py-3 rounded bg-red-900/50 text-red-200">{result.error}</div>;
  const errors = Array.isArray(result.errors) ? result.errors : [];
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const issues = [...warnings, ...errors];
  return (
    <div className={`mt-4 px-4 py-3 rounded ${issues.length ? 'bg-yellow-900/40 text-yellow-100' : 'bg-green-900/50 text-green-200'}`}>
      <p className="font-semibold">Imported: {result.inserted || 0} · Could not import: {result.skipped || 0} · Warnings: {warnings.length}</p>
      {warnings.length > 0 && <p className="mt-1 text-sm">Imperfect rows were retained and flagged for review and data-quality insights.</p>}
      {issues.length > 0 && (
        <ul className="mt-2 max-h-48 overflow-y-auto text-sm list-disc pl-5">
          {issues.map((entry, index) => <li key={`${entry.row}-${index}`}>Row {entry.row}: {entry.reason}</li>)}
        </ul>
      )}
    </div>
  );
}
