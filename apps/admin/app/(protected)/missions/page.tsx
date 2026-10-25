"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { MissionFormDialog } from "@/components/admin/mission-form-dialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { missionsApi } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";
import { missionName } from "@/lib/format";
import { queryKeys } from "@/lib/query/keys";
import type { Mission } from "@/types/admin";
import type { MissionFormValues } from "@/schemas/mission";

const LIMIT = 20;

export default function MissionsPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Mission | null>(null);
  const [deleting, setDeleting] = useState<Mission | null>(null);
  const client = useQueryClient();
  const params = { page, limit: LIMIT };
  const query = useQuery({ queryKey: queryKeys.missions(params), queryFn: () => missionsApi.list(params), placeholderData: keepPreviousData });
  const invalidate = () => client.invalidateQueries({ queryKey: ["admin", "missions"] });
  const save = useMutation({ mutationFn: (values: MissionFormValues) => editing ? missionsApi.update(editing.id, values) : missionsApi.create(values), onSuccess: () => { invalidate(); setOpen(false); setEditing(null); } });
  const remove = useMutation({ mutationFn: missionsApi.remove, onSuccess: () => { invalidate(); setDeleting(null); } });
  return <div>
    <PageHeader title="Missiyalar" description="Günlük və uzunmüddətli istifadəçi missiyalarını idarə edin" action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Yeni missiya</Button>} />
    <div className="space-y-4">{remove.isError ? <Alert variant="error">{toApiError(remove.error).message}</Alert> : null}{query.isPending ? <LoadingState label="Missiyalar yüklənir…" /> : null}{query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.isSuccess ? <Card className="overflow-hidden"><CardContent className="p-0">{query.data.data.length === 0 ? <div className="p-5"><EmptyState title="Missiya yoxdur" description="İlk missiyanı yaradın." /></div> : <><Table><TableHeader><TableRow><TableHead>Başlıq</TableHead><TableHead>Növ</TableHead><TableHead>Hədəf</TableHead><TableHead>Mükafat</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Əməliyyat</TableHead></TableRow></TableHeader><TableBody>{query.data.data.map((mission) => <TableRow key={mission.id}><TableCell className="min-w-56"><p className="font-medium">{missionName(mission)}</p><p className="max-w-md truncate text-xs text-muted-foreground">{mission.description || "—"}</p></TableCell><TableCell>{mission.type || "—"}</TableCell><TableCell>{mission.target ?? "—"}</TableCell><TableCell>{mission.rewardPoints ?? 0}</TableCell><TableCell><Badge variant={mission.isActive === false ? "secondary" : "success"}>{mission.isActive === false ? "Passiv" : "Aktiv"}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditing(mission); setOpen(true); }} aria-label="Missiyanı redaktə et"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(mission)} aria-label="Missiyanı sil"><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table><div className="p-5 pt-4"><Pagination meta={query.data.meta} onPageChange={setPage} /></div></>}</CardContent></Card> : null}
    </div>
    <MissionFormDialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditing(null); }} mission={editing} onSubmit={async (values) => { await save.mutateAsync(values); }} error={save.isError ? toApiError(save.error).message : null} />
    <Dialog open={Boolean(deleting)} onOpenChange={(value) => !value && setDeleting(null)}><DialogContent><DialogHeader><DialogTitle>Missiyanı silmək</DialogTitle><DialogDescription>“{deleting ? missionName(deleting) : ""}” missiyasını silmək istəyirsiniz?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Ləğv et</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>Sil</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
