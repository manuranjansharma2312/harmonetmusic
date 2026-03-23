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

export function TablePagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'records',
  onExport,
  exportLabel = 'Export CSV',
}: TablePaginationProps) {
  const effectivePageSize = pageSize === 'all' ? totalItems : pageSize;
  const totalPages = effectivePageSize > 0 ? Math.ceil(totalItems / effectivePageSize) : 1;
  const start = currentPage * effectivePageSize + 1;
  const end = Math.min((currentPage + 1) * effectivePageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {totalItems === 0 ? `0 ${itemLabel}` : `${start}–${end} of ${totalItems} ${itemLabel}`}
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
      </div>
      <div className="flex items-center gap-2">
        {onExport && (
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-1" /> {exportLabel}
          </Button>
        )}
        {totalPages > 1 && (
          <>
            <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => onPageChange(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentPage + 1} / {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={currentPage >= totalPages - 1} onClick={() => onPageChange(currentPage + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function paginateItems<T>(items: T[], page: number, pageSize: number | 'all'): T[] {
  if (pageSize === 'all') return items;
  return items.slice(page * pageSize, (page + 1) * pageSize);
}
