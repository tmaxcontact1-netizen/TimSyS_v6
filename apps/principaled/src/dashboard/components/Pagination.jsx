import React from "react";

export const PAGE_SIZE = 50;

export function rowNumber(page, index, pageSize = PAGE_SIZE) {
  return (Math.max(1, page) - 1) * pageSize + index + 1;
}

export default function Pagination({
  page = 1,
  total = 0,
  pageSize = PAGE_SIZE,
  onPageChange,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, total);
  if (total <= pageSize) {
    return (
      <div className="border-t border-gray-800 px-4 py-3 text-sm text-gray-500">
        {total} record{total === 1 ? "" : "s"}
      </div>
    );
  }
  const candidates = [1, current - 1, current, current + 1, pageCount]
    .filter((value) => value >= 1 && value <= pageCount)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((a, b) => a - b);
  return (
    <nav
      aria-label="List pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 px-4 py-3"
    >
      <span className="text-sm text-gray-400">
        Showing {first}–{last} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={current === 1}
          onClick={() => onPageChange(current - 1)}
          className="rounded border border-gray-700 px-3 py-1.5 text-sm text-gray-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-gray-800"
        >
          Previous
        </button>
        {candidates.map((value, index) => (
          <React.Fragment key={value}>
            {index > 0 && value - candidates[index - 1] > 1 && (
              <span className="px-1 text-gray-600">…</span>
            )}
            <button
              type="button"
              aria-current={value === current ? "page" : undefined}
              onClick={() => onPageChange(value)}
              className={`min-w-9 rounded px-3 py-1.5 text-sm ${value === current ? "bg-timsys-primary text-white" : "border border-gray-700 text-gray-300 hover:bg-gray-800"}`}
            >
              {value}
            </button>
          </React.Fragment>
        ))}
        <button
          type="button"
          disabled={current === pageCount}
          onClick={() => onPageChange(current + 1)}
          className="rounded border border-gray-700 px-3 py-1.5 text-sm text-gray-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-gray-800"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
