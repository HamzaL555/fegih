"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { AchievementFormDialog } from "@/components/admin/achievement-form-dialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { achievementsApi } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";
import { achievementName } from "@/lib/format";
import { queryKeys } from "@/lib/query/keys";
import type { Achievement } from "@/types/admin";
import type { AchievementFormValues } from "@/schemas/achievement";

const LIMIT = 20;

export default function AchievementsPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [deleting, setDeleting] = useState<Achievement | null>(null);
  const client = useQueryClient();
  const params = { page, limit: LIMIT };
  const query = useQuery({ queryKey: queryKeys.achievements(params), queryFn: () => achievementsApi.list(params), placeholderData: keepPreviousData });
  const invalidate = () => client.invalidateQueries({ queryKey: ["admin", "achievements"] });
  const save = useMutation({ mutationFn: (values: AchievementFormValues) => editing ? achievementsApi.update(editing.id, values) : achievementsApi.create(values), onSuccess: () => { invalidate(); setOpen(false); setEditing(null); } });
  const remove = useMutation({ mutationFn: achievementsApi.remove, onSuccess: () => { invalidate(); setDeleting(null); } });
  return <div>
    <PageHeader title="Nailiyyətlər" description="İstifadəçi nailiyyətlərini və mükafat şərtlərini idarə edin" action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Yeni nailiyyət</Button>} />
    <div className="space-y-4">{remove.isError ? <Alert variant="error">{toApiError(remove.error).message}</Alert> : null}{query.isPending ? <LoadingState label="Nailiyyətlər yüklənir…" /> : null}{query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.isSuccess ? <Card className="overflow-hidden"><CardContent className="p-0">{query.data.data.length === 0 ? <div className="p-5"><EmptyState title="Nailiyyət yoxdur" description="İlk nailiyyəti yaradın." /></div> : <><Table><TableHeader><TableRow><TableHead>Ad</TableHead><TableHead>İkon</TableHead><TableHead>Şərt</TableHead><TableHead>Xal</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Əməliyyat</TableHead></TableRow></TableHeader><TableBody>{query.data.data.map((achievement) => <TableRow key={achievement.id}><TableCell className="min-w-48 font-medium">{achievementName(achievement)}</TableCell><TableCell>{achievement.icon || "—"}</TableCell><TableCell className="max-w-md"><p className="line-clamp-2">{achievement.condition || "—"}</p></TableCell><TableCell>{achievement.points ?? 0}</TableCell><TableCell><Badge variant={achievement.isActive === false ? "secondary" : "success"}>{achievement.isActive === false ? "Passiv" : "Aktiv"}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditing(achievement); setOpen(true); }} aria-label="Nailiyyəti redaktə et"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(achievement)} aria-label="Nailiyyəti sil"><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table><div className="p-5 pt-4"><Pagination meta={query.data.meta} onPageChange={setPage} /></div></>}</CardContent></Card> : null}
    </div>
    <AchievementFormDialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditing(null); }} achievement={editing} onSubmit={async (values) => { await save.mutateAsync(values); }} error={save.isError ? toApiError(save.error).message : null} />
    <Dialog open={Boolean(deleting)} onOpenChange={(value) => !value && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>Nailiyyəti silmək</DialogTitle><DialogDescription>“{deleting ? achievementName(deleting) : ""}” nailiyyətini silmək istəyirsiniz?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Ləğv et</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>Sil</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
