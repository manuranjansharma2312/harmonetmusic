import { forwardRef } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: 'all', label: 'All' },
];

interface TablePaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize: number | 'all';
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number | 'all') => void;
  itemLabel?: string;
  onExport?: () => void;
  exportLabel?: string;
}

export const TablePagination = forwardRef<HTMLDivElement, TablePaginationProps>(
  function TablePagination({
    totalItems,
    currentPage,
    pageSize,
    onPageChange,
    onPageSizeChange,
    itemLabel = 'results',
    onExport,
    exportLabel = 'Export CSV',
  }, ref) {
    const effectivePageSize = pageSize === 'all' ? totalItems : pageSize;
    const totalPages = effectivePageSize > 0 ? Math.ceil(totalItems / effectivePageSize) : 1;
    const start = totalItems === 0 ? 0 : currentPage * effectivePageSize + 1;
    const end = Math.min((currentPage + 1) * effectivePageSize, totalItems);

    const getPageNumbers = () => {
      const pages: (number | 'ellipsis')[] = [];
      if (totalPages <= 5) {
        for (let i = 0; i < totalPages; i++) pages.push(i);
      } else {
        pages.push(0);
        if (currentPage > 2) pages.push('ellipsis');
        const rangeStart = Math.max(1, currentPage - 1);
        const rangeEnd = Math.min(totalPages - 2, currentPage + 1);
        for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
        if (currentPage < totalPages - 3) pages.push('ellipsis');
        pages.push(totalPages - 1);
      }
      return pages;
    };

    return (
      <div ref={ref} className="flex items-center justify-between px-4 py-3 border-t border-border/50 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {totalItems === 0
              ? `0 ${itemLabel}`
              : `Showing ${start} to ${end} of ${totalItems} ${itemLabel}`}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Show</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                onPageSizeChange(v === 'all' ? 'all' : Number(v));
                onPageChange(0);
              }}
            >
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {onExport && (
            <Button size="sm" variant="outline" onClick={onExport}>
              <Download className="h-4 w-4 mr-1" /> {exportLabel}
            </Button>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={currentPage === 0}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {getPageNumbers().map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
              ) : (
                <Button
                  key={p}
                  size="icon"
                  variant={currentPage === p ? 'default' : 'outline'}
                  className="h-8 w-8 text-xs"
                  onClick={() => onPageChange(p)}
                >
                  {p + 1}
                </Button>
              )
            )}
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={currentPage >= totalPages - 1}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }
);

export function paginateItems<T>(items: T[], page: number, pageSize: number | 'all'): T[] {
  if (pageSize === 'all') return items;
  return items.slice(page * pageSize, (page + 1) * pageSize);
}
