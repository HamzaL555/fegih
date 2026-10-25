"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/types/api";

export function Pagination({ meta, onPageChange }: { meta: PaginationMeta; onPageChange: (page: number) => void }) {
  const currentPage = Math.min(Math.max(meta.page, 1), Math.max(meta.totalPages, 1));
  const start = meta.total === 0 ? 0 : (currentPage - 1) * meta.limit + 1;
  const end = Math.min(currentPage * meta.limit, meta.total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {meta.total ? `${start}–${end} / ${meta.total}` : "0 məlumat"}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Əvvəl
        </Button>
        <span className="min-w-20 text-center text-sm text-muted-foreground">Səhifə {currentPage} / {Math.max(meta.totalPages, 1)}</span>
        <Button type="button" variant="outline" size="sm" disabled={currentPage >= meta.totalPages} onClick={() => onPageChange(currentPage + 1)}>
          Növbəti <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
