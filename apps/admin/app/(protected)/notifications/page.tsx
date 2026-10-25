"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bell, MailOpen, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notificationsApi } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";
import { toDateLabel } from "@/lib/utils";

const LIMIT = 20;

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const params = { page, limit: LIMIT, ...(search ? { search } : {}) };
  const query = useQuery({ queryKey: queryKeys.notifications(params), queryFn: () => notificationsApi.list(params), placeholderData: keepPreviousData });
  const submit = (event: React.FormEvent) => { event.preventDefault(); setPage(1); setSearch(input.trim()); };
  return <div>
    <PageHeader title="Bildirişlər" description="Serverdən gələn istifadəçi bildirişlərini izləyin" />
    <Card><CardContent className="p-5"><form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row" role="search"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={input} onChange={(event) => setInput(event.target.value)} className="pl-9" placeholder="Başlıq və ya mesaj" aria-label="Bildiriş axtarışı" /></div><Button type="submit" variant="outline">Axtar</Button></form></CardContent></Card>
    <div className="mt-4 space-y-4">{query.isPending ? <LoadingState label="Bildirişlər yüklənir…" /> : null}{query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}{query.isSuccess ? <Card className="overflow-hidden"><CardContent className="p-0">
      {query.data.data.length === 0 ? <div className="p-5"><EmptyState title="Bildiriş yoxdur" description="Axtarış meyarlarını dəyişin və ya API-də hələ bildiriş olmayabilər." /></div> : <><Table><TableHeader><TableRow><TableHead>Bildiriş</TableHead><TableHead>Növ</TableHead><TableHead>Status</TableHead><TableHead>Tarix</TableHead></TableRow></TableHeader><TableBody>{query.data.data.map((notification) => <TableRow key={notification.id}><TableCell className="min-w-80"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{notification.isRead ? <MailOpen className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</span><div><p className="font-medium">{notification.title || "Başlıqsız bildiriş"}</p><p className="mt-1 max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">{notification.message || "—"}</p></div></div></TableCell><TableCell>{notification.type || "—"}</TableCell><TableCell><Badge variant={notification.isRead ? "secondary" : "success"}>{notification.isRead ? "Oxunub" : "Oxunmayıb"}</Badge></TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{toDateLabel(notification.createdAt)}</TableCell></TableRow>)}</TableBody></Table><div className="p-5 pt-4"><Pagination meta={query.data.meta} onPageChange={setPage} /></div></>}
    </CardContent></Card> : null}</div>
  </div>;
}
