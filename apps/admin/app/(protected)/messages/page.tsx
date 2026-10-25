"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MailOpen, MessageSquare, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { messagesApi } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";
import { toDateLabel } from "@/lib/utils";

const LIMIT = 20;
/** New questions appear in the inbox without a manual reload. */
const LIVE_POLL_MS = 10_000;

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Gözləyir",
  ANSWERED: "Cavablandı",
  CLOSED: "Bağlı",
};

const STATUS_VARIANTS: Record<string, "success" | "secondary" | "outline"> = {
  OPEN: "outline",
  ANSWERED: "success",
  CLOSED: "secondary",
};

export default function MessagesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  const params = { page, limit: LIMIT, status, ...(search ? { search } : {}) };
  const query = useQuery({
    queryKey: queryKeys.messages(params),
    queryFn: () => messagesApi.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(input.trim());
  };

  const unreadTotal = query.data?.meta.unreadCount ?? 0;

  return (
    <div>
      <PageHeader
        title="Mesajlar"
        description="Tətbiqdən gələn istifadəçi sualları. Cavab verdikdə istifadəçiyə bildiriş göndərilir."
      />

      <Card>
        <CardContent className="p-5">
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row" role="search">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="pl-9"
                placeholder="Mövzu və ya istifadəçi emaili"
                aria-label="Mesaj axtarışı"
              />
            </div>
            <div className="flex gap-2">
              {(["ALL", "OPEN", "ANSWERED", "CLOSED"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={status === value ? "default" : "outline"}
                  onClick={() => { setStatus(value); setPage(1); }}
                >
                  {value === "ALL" ? "Hamısı" : STATUS_LABELS[value]}
                </Button>
              ))}
              <Button type="submit" variant="outline">Axtar</Button>
            </div>
          </form>
          {unreadTotal > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {unreadTotal} oxunmamış mesaj var.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-4 space-y-4">
        {query.isPending ? <LoadingState label="Mesajlar yüklənir." /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
        {query.isSuccess ? (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {query.data.data.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Mesaj yoxdur"
                    description="Bu filtrdə uyğun söhbə tapılmadı."
                  />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mövzu</TableHead>
                        <TableHead>İstifadəçi</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Son mesaj</TableHead>
                        <TableHead>Tarix</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {query.data.data.map((thread) => (
                        <TableRow key={thread.id} className={thread.unread > 0 ? "bg-primary/5" : undefined}>
                          <TableCell className="min-w-80">
                            <Link href={`/messages/${thread.id}`} className="flex items-start gap-3 hover:underline">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                                {thread.unread > 0 ? <MessageSquare className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                              </span>
                              <div>
                                <p className="font-medium">{thread.subject}</p>
                                <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                                  {thread.lastMessage?.body ?? "-"}
                                </p>
                                {thread.unread > 0 ? (
                                  <Badge variant="success" className="mt-1.5">
                                    {thread.unread} oxunmamış
                                  </Badge>
                                ) : null}
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {thread.user?.email ?? "-"}
                            <p className="text-xs text-muted-foreground">@{thread.user?.username}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[thread.status] ?? "outline"}>
                              {STATUS_LABELS[thread.status] ?? thread.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {thread.lastMessage?.authorRole === "ADMIN" ? "Sizdən: " : "İstifadəçidən: "}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {toDateLabel(thread.lastMessageAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-5 pt-4">
                    <Pagination meta={query.data.meta} onPageChange={setPage} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}