"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { CategoryFormDialog } from "@/components/admin/category-form-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bookCategoriesApi } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";
import { queryKeys } from "@/lib/query/keys";
import type { BookCategory } from "@/types/admin";
import type { CategoryFormValues } from "@/schemas/category";

export default function CategoriesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BookCategory | null>(null);
  const [deleting, setDeleting] = useState<BookCategory | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.bookCategories, queryFn: bookCategoriesApi.list });
  const invalidate = () => { client.invalidateQueries({ queryKey: queryKeys.bookCategories }); client.invalidateQueries({ queryKey: ["admin", "books"] }); };
  const save = useMutation({ mutationFn: (values: CategoryFormValues) => editing ? bookCategoriesApi.update(editing.id, values) : bookCategoriesApi.create(values), onSuccess: () => { invalidate(); setFormOpen(false); setEditing(null); } });
  const remove = useMutation({ mutationFn: bookCategoriesApi.remove, onSuccess: () => { invalidate(); setDeleting(null); } });

  return <div>
    <PageHeader title="Kitab kateqoriyaları" description="Kitabları qruplaşdırmaq üçün kateqoriyaları idarə edin" action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />Yeni kateqoriya</Button>} />
    <div className="space-y-4">
      {remove.isError ? <Alert variant="error">{toApiError(remove.error).message}</Alert> : null}
      {query.isPending ? <LoadingState label="Kateqoriyalar yüklənir…" /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.isSuccess ? <Card className="overflow-hidden"><CardContent className="p-0">
        {query.data.data.length === 0 ? <div className="p-5"><EmptyState title="Kateqoriya yoxdur" description="İlk kitab kateqoriyasını yaradın." /></div> : <Table><TableHeader><TableRow><TableHead>Ad</TableHead><TableHead>Təsvir</TableHead><TableHead>Kitab sayı</TableHead><TableHead className="text-right">Əməliyyat</TableHead></TableRow></TableHeader><TableBody>{query.data.data.map((category) => <TableRow key={category.id}><TableCell className="font-medium">{category.name}</TableCell><TableCell className="max-w-xl text-muted-foreground">{category.description || "—"}</TableCell><TableCell>{category.bookCount ?? category._count?.books ?? "—"}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditing(category); setFormOpen(true); }} aria-label="Kateqoriyanı redaktə et"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(category)} aria-label="Kateqoriyanı sil"><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table>}
      </CardContent></Card> : null}
    </div>
    <CategoryFormDialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }} category={editing} onSubmit={async (values) => { await save.mutateAsync(values); }} error={save.isError ? toApiError(save.error).message : null} />
    <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>Kateqoriyanı silmək</DialogTitle><DialogDescription>“{deleting?.name || ""}” kateqoriyasını silmək istəyirsiniz? Əlaqəli kitablar bu əməliyyatdan təsirlənə bilər.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Ləğv et</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>Sil</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
