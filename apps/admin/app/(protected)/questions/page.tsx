"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { QuestionFormDialog } from "@/components/admin/question-form-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { questionsApi } from "@/lib/api/admin";
import { firstNumber, firstString, isRecord } from "@/lib/utils";
import { toApiError } from "@/lib/api/error";
import { questionText, relationName } from "@/lib/format";
import { queryKeys } from "@/lib/query/keys";
import type { Question, QuestionCategory, QuestionLevel } from "@/types/admin";
import type { QuestionFormValues } from "@/schemas/question";

const LIMIT = 20;

export default function QuestionsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [levelId, setLevelId] = useState("");
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const queryClient = useQueryClient();
  const params = {
    page,
    limit: LIMIT,
    ...(search ? { search } : {}),
    ...(levelId ? { levelId } : {}),
    ...(status ? { status } : {})
  };

  const query = useQuery({
    queryKey: queryKeys.questions(params),
    queryFn: () => questionsApi.list(params),
    placeholderData: keepPreviousData
  });
  const categoriesQuery = useQuery({ queryKey: queryKeys.questionCategories, queryFn: questionsApi.categories });
  const levelsQuery = useQuery({ queryKey: queryKeys.questionLevels, queryFn: questionsApi.levels });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "questions"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.questionCategories });
    queryClient.invalidateQueries({ queryKey: queryKeys.questionLevels });
  };
  const saveMutation = useMutation({
    mutationFn: async ({ values, image }: { values: QuestionFormValues; image: File | null }) => {
      const uploaded = image ? await questionsApi.uploadImage(image) : undefined;
      const imageUrl = typeof uploaded === "string" ? uploaded : isRecord(uploaded) ? firstString(uploaded.url, uploaded.imageUrl, uploaded.coverUrl) : values.imageUrl;
      const payload = { ...values, imageUrl: imageUrl || null };
      return editing ? questionsApi.update(editing.id, payload) : questionsApi.create(payload);
    },
    onSuccess: () => { invalidate(); setFormOpen(false); setEditing(null); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => questionsApi.remove(id),
    onSuccess: () => { invalidate(); setDeleting(null); }
  });
  const restoreMutation = useMutation({
    mutationFn: (id: string) => questionsApi.restore(id),
    onSuccess: invalidate
  });

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };
  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (question: Question) => { setEditing(question); setFormOpen(true); };
  const levels = (levelsQuery.data?.data || []) as QuestionLevel[];

  return (
    <div>
      <PageHeader
        title="Suallar"
        description="Sual mətnini, cavabları, səviyyəni, kateqoriyanı və xalı idarə edin"
        action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Yeni sual</Button>}
      />
      <Card>
        <CardContent className="p-5">
          <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row" role="search">
            <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" placeholder="Sual mətnində axtar" aria-label="Sual axtarışı" /></div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Səviyyə filtri"
              value={levelId}
              onChange={(event) => { setLevelId(event.target.value); setPage(1); }}
            >
              <option value="">Bütün səviyyələr</option>
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {(firstNumber(level.position) ?? 0) + 1}. {firstString(level.name) ?? level.id}
                  {firstNumber(level.questionCount) === undefined ? "" : ` (${firstNumber(level.questionCount)})`}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Status filtri"
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
            >
              <option value="">Bütün statuslar</option>
              <option value="ACTIVE">Aktiv</option>
              <option value="DRAFT">Qaralama</option>
              <option value="ARCHIVED">Arxiv</option>
            </select>
            <Button type="submit" variant="outline">Axtar</Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-4 space-y-4">
        {deleteMutation.isError || restoreMutation.isError ? <Alert variant="error">{toApiError(deleteMutation.error || restoreMutation.error).message}</Alert> : null}
        {query.isPending ? <LoadingState label="Suallar yüklənir…" /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
        {query.isSuccess ? (
          <Card className="overflow-hidden"><CardContent className="p-0">
            {query.data.data.length === 0 ? <div className="p-5"><EmptyState title="Sual tapılmadı" description="Yeni sual yaradın və ya filtrləri dəyişin." /></div> : (
              <>
                <Table>
                  <TableHeader><TableRow><TableHead>Sual</TableHead><TableHead>Kateqoriya</TableHead><TableHead>Səviyyə</TableHead><TableHead>Xal</TableHead><TableHead>Cavablar</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Əməliyyat</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {query.data.data.map((question) => (
                      <TableRow key={question.id}>
                        <TableCell className="min-w-72 max-w-lg"><p className="line-clamp-2 font-medium">{questionText(question)}</p></TableCell>
                        <TableCell>{relationName(question.category)}</TableCell>
                        <TableCell>{relationName(question.level)}</TableCell>
                        <TableCell>{question.points ?? "—"}</TableCell>
                        <TableCell>{question.answers?.length ?? question.answerCount ?? 0}</TableCell>
                        <TableCell>
                          <span className={question.isActive === false ? "text-muted-foreground" : "text-emerald-600"}>
                            {question.isActive === false ? "Arxiv" : "Aktiv"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {question.isActive === false ? (
                              <Button variant="ghost" size="sm" onClick={() => restoreMutation.mutate(question.id)}>Bərpa et</Button>
                            ) : null}
                            <Button variant="ghost" size="icon" onClick={() => openEdit(question)} aria-label="Sualı redaktə et"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(question)} aria-label="Sualı arxivlə"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-5 pt-4"><Pagination meta={query.data.meta} onPageChange={setPage} /></div>
              </>
            )}
          </CardContent></Card>
        ) : null}
      </div>

      <QuestionFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }}
        question={editing}
        categories={(categoriesQuery.data?.data || []) as QuestionCategory[]}
        levels={levels}
        onSubmit={async (values, image) => { await saveMutation.mutateAsync({ values, image }); }}
        error={saveMutation.isError ? toApiError(saveMutation.error).message : null}
      />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sualı arxivləmək</DialogTitle><DialogDescription>“{deleting ? questionText(deleting) : ""}” sualı arxivlənəcək və viktorinada göstərilməyəcək. Əməliyyat sonradan “Bərpa et” düyməsi ilə geri qaytarıla bilər.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Ləğv et</Button><Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Arxivlə</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
