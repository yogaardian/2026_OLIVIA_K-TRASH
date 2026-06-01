import React from 'react';

const createPageRange = (page, totalPages) => {
  const range = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i += 1) {
    range.push(i);
  }
  if (start > 1) range.unshift('start');
  if (end < totalPages) range.push('end');
  return range;
};

const Pagination = ({ page, totalPages, onPageChange, disabled }) => {
  if (totalPages <= 1) return null;

  const pageRange = createPageRange(page, totalPages);

  return (
    <div className="pagination-wrapper" style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1}>
        Sebelumnya
      </button>
      {pageRange.map((item, index) => {
        if (item === 'start') {
          return <span key={`start-${index}`} style={{ padding: '0 8px' }}>...</span>;
        }
        if (item === 'end') {
          return <span key={`end-${index}`} style={{ padding: '0 8px' }}>...</span>;
        }
        return (
          <button
            key={item}
            type="button"
            className={`btn btn-sm ${item === page ? 'btn-primary' : 'btn-outline-secondary'}`}
            disabled={disabled}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        );
      })}
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPageChange(page + 1)} disabled={disabled || page >= totalPages}>
        Berikutnya
      </button>
    </div>
  );
};

export default Pagination;
