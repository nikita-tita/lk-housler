'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  buildUrl?: (page: number) => string;
  className?: string;
}

// NavButton component moved outside to avoid recreation on each render
function NavButton({
  direction,
  currentPage,
  totalPages,
  buildUrl,
  onPageChange,
}: {
  direction: 'prev' | 'next';
  currentPage: number;
  totalPages: number;
  buildUrl?: (page: number) => string;
  onPageChange?: (page: number) => void;
}) {
  const isPrev = direction === 'prev';
  const targetPage = isPrev ? currentPage - 1 : currentPage + 1;
  const isDisabled = isPrev ? currentPage <= 1 : currentPage >= totalPages;
  const label = isPrev ? '← Назад' : 'Далее →';

  if (isDisabled) return null;

  if (buildUrl) {
    return (
      <a href={buildUrl(targetPage)} className="btn btn-secondary btn-sm">
        {label}
      </a>
    );
  }

  return (
    <button onClick={() => onPageChange?.(targetPage)} className="btn btn-secondary btn-sm">
      {label}
    </button>
  );
}

// PageButton component moved outside to avoid recreation on each render
function PageButton({
  page,
  currentPage,
  buildUrl,
  onPageChange,
}: {
  page: number;
  currentPage: number;
  buildUrl?: (page: number) => string;
  onPageChange?: (page: number) => void;
}) {
  const isActive = page === currentPage;
  const baseClass = 'btn btn-sm min-w-[40px]';
  const activeClass = isActive ? 'btn-primary' : 'btn-secondary';

  if (buildUrl) {
    return (
      <a href={buildUrl(page)} className={`${baseClass} ${activeClass}`}>
        {page}
      </a>
    );
  }

  return (
    <button
      onClick={() => onPageChange?.(page)}
      className={`${baseClass} ${activeClass}`}
      disabled={isActive}
    >
      {page}
    </button>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  buildUrl,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Генерация массива страниц с ellipsis
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className={`flex justify-center items-center gap-2 flex-wrap ${className}`}>
      <NavButton
        direction="prev"
        currentPage={currentPage}
        totalPages={totalPages}
        buildUrl={buildUrl}
        onPageChange={onPageChange}
      />

      {pages.map((page, index) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-[var(--color-text-light)]">
            ...
          </span>
        ) : (
          <PageButton
            key={page}
            page={page}
            currentPage={currentPage}
            buildUrl={buildUrl}
            onPageChange={onPageChange}
          />
        )
      )}

      <NavButton
        direction="next"
        currentPage={currentPage}
        totalPages={totalPages}
        buildUrl={buildUrl}
        onPageChange={onPageChange}
      />
    </div>
  );
}
