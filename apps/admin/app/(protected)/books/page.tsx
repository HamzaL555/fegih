"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { BookFormDialog } from "@/components/admin/book-form-dialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { booksApi } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";
import { bookImage, relationName } from "@/lib/format";
import { normaliseCover } from "@/lib/cover-image";
import { queryKeys } from "@/lib/query/keys";
import { firstString, isRecord } from "@/lib/utils";
import type { Book, BookCategory } from "@/types/admin";
import type { BookFormValues } from "@/schemas/book";

const LIMIT = 20;

function uploadedImageUrl(value: unknown) {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return null;
  return firstString(value.url, value.imageUrl, value.coverUrl, value.path, value.fileUrl) || null;
}

export default function BooksPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState<Book | null>(null);
  const queryClient = useQueryClient();
  const params = { page, limit: LIMIT, ...(search ? { search } : {}) };

  const query = useQuery({ queryKey: queryKeys.books(params), queryFn: () => booksApi.list(params), placeholderData: keepPreviousData });
  const categoriesQuery = useQuery({ queryKey: queryKeys.bookCategories, queryFn: booksApi.categories });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "books"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.bookCategories });
  };
  const saveMutation = useMutation({
    mutationFn: async ({ values, image }: { values: BookFormValues; image: File | null }) => {
      // Crop to the standard 600x900 before the upload so every cover in the
      // catalogue shares one proportion.
      const prepared = image ? await normaliseCover(image) : null;
      const imageUrl = prepared ? uploadedImageUrl(await booksApi.uploadImage(prepared)) : values.imageUrl;
      const payload = { ...values, categoryId: values.categoryId || null, bookUrl: values.bookUrl || null, imageUrl: imageUrl || null };
      return editing ? booksApi.update(editing.id, payload) : booksApi.create(payload);
    },
    onSuccess: () => { invalidate(); setFormOpen(false); setEditing(null); }
  });
  const deleteMutation = useMutation({ mutationFn: booksApi.remove, onSuccess: () => { invalidate(); setDeleting(null); } });

  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); };
  const openCreate = () => { setEditing(null); setFormOpen(true); };

  return (
    <div>
      <PageHeader title="Kitablar" description="Kitabları, URL-ləri, şəkilləri və kateqoriyalarını idarə edin" action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Yeni kitab</Button>} />
      <Card><CardContent className="p-5"><form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row" role="search"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" placeholder="Başlıq və ya müəllif" aria-label="Kitab axtarışı" /></div><Button type="submit" variant="outline">Axtar</Button></form></CardContent></Card>
      <div className="mt-4 space-y-4">
        {deleteMutation.isError ? <Alert variant="error">{toApiError(deleteMutation.error).message}</Alert> : null}
        {query.isPending ? <LoadingState label="Kitablar yüklənir…" /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
        {query.isSuccess ? <Card className="overflow-hidden"><CardContent className="p-0">
          {query.data.data.length === 0 ? <div className="p-5"><EmptyState title="Kitab tapılmadı" description="Yeni kitab əlavə edin və ya axtarış meyarlarını dəyişin." /></div> : <>
            <Table><TableHeader><TableRow><TableHead>Kitab</TableHead><TableHead>Kateqoriya</TableHead><TableHead>Status</TableHead><TableHead>Bağlantılar</TableHead><TableHead className="text-right">Əməliyyat</TableHead></TableRow></TableHeader><TableBody>
              {query.data.data.map((book) => { const image = bookImage(book); const link = book.bookUrl || book.fileUrl; return <TableRow key={book.id}>
                <TableCell className="min-w-72"><div className="flex items-center gap-3">{image ? <img src={image} alt="" className="h-[60px] w-10 rounded-md object-cover" /> : <span className="grid h-[60px] w-10 place-items-center rounded-md bg-muted text-xs text-muted-foreground">Kitab</span>}<div className="min-w-0"><p className="truncate font-medium">{book.title}</p><p className="truncate text-xs text-muted-foreground">{book.author || "Müəllif göstərilməyib"}</p></div></div></TableCell>
                <TableCell>{relationName(book.category)}</TableCell><TableCell><Badge variant={book.isActive === false ? "secondary" : "success"}>{book.isActive === false ? "Passiv" : "Aktiv"}</Badge></TableCell>
                <TableCell><div className="flex gap-2">{link ? <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm text-primary hover:underline">Kitab <ExternalLink className="ml-1 h-3.5 w-3.5" /></a> : "—"}{image ? <a href={image} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Şəkil</a> : null}</div></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditing(book); setFormOpen(true); }} aria-label="Kitabı redaktə et"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(book)} aria-label="Kitabı sil"><Trash2 className="h-4 w-4" /></Button></div></TableCell>
              </TableRow>; })}
            </TableBody></Table><div className="p-5 pt-4"><Pagination meta={query.data.meta} onPageChange={setPage} /></div></>}
          </CardContent></Card> : null}
      </div>
      <BookFormDialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }} book={editing} categories={(categoriesQuery.data?.data || []) as BookCategory[]} onSubmit={async (values, image) => { await saveMutation.mutateAsync({ values, image }); }} error={saveMutation.isError ? toApiError(saveMutation.error).message : null} />
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>Kitabı silmək</DialogTitle><DialogDescription>“{deleting?.title || ""}” kitabını silmək istəyirsiniz?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Ləğv et</Button><Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Sil</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
