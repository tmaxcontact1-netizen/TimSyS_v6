import React from "react";

export const PAGE_SIZE = 50;
export const rowNumber = (page, index, pageSize = PAGE_SIZE) =>
  (Math.max(1, page) - 1) * pageSize + index + 1;

export default function Pagination({ page = 1, total = 0, pageSize = PAGE_SIZE, onPageChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const first = total ? (current - 1) * pageSize + 1 : 0;
  const last = Math.min(current * pageSize, total);
  return (
    <nav aria-label="List pagination" className="timsys-pagination">
      <span>{total > pageSize ? `Showing ${first}–${last} of ${total}` : `${total} records`}</span>
      {pages > 1 && <div>
        <button type="button" disabled={current === 1} onClick={() => onPageChange(current - 1)}>Previous</button>
        <span aria-current="page">Page {current} of {pages}</span>
        <button type="button" disabled={current === pages} onClick={() => onPageChange(current + 1)}>Next</button>
      </div>}
    </nav>
  );
}
