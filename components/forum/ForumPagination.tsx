'use client';

interface ForumPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function ForumPagination({ currentPage, totalPages, onPageChange }: ForumPaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers to show (max 5 with ellipsis)
  const pages: (number | '...')[] = [];

  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    pages.push(totalPages);
  }

  return (
    <div className="rv4-forum-pagination">
      <button
        className="rv4-forum-pagination-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        ‹ Prev
      </button>

      {pages.map((page, index) =>
        page === '...' ? (
          <span key={`ellipsis-${index}`} className="rv4-forum-pagination-info">
            …
          </span>
        ) : (
          <button
            key={page}
            className={`rv4-forum-pagination-btn${page === currentPage ? ' active' : ''}`}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        )
      )}

      <button
        className="rv4-forum-pagination-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Next ›
      </button>

      <span className="rv4-forum-pagination-info">
        Page {currentPage} of {totalPages}
      </span>
    </div>
  );
}
