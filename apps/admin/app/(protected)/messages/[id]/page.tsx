"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { ErrorState, LoadingState } from "@/components/admin/resource-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { messagesApi } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";
import { toDateLabel } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Gözləyir",
  ANSWERED: "Cavablandı",
  CLOSED: "Bağlı",
};

export default function MessageThreadPage() {
  const params = useParams<{ id: string }>();
  const threadId = params.id;
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const query = useQuery({
    queryKey: queryKeys.message(threadId),
    queryFn: () => messagesApi.detail(threadId),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const reply = useMutation({
    mutationFn: (text: string) => messagesApi.reply(threadId, text),
    onSuccess: async () => {
      setBody("");
      // Both the thread and the list badge change after a reply.
      await queryClient.invalidateQueries({ queryKey: queryKeys.message(threadId) });
      await queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
    },
  });

  const setStatus = useMutation({
    mutationFn: (status: "OPEN" | "ANSWERED" | "CLOSED") => messagesApi.setStatus(threadId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.message(threadId) });
      await queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
    },
  });

  // Keep the newest message in view once new ones arrive.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }, [query.data?.messages.length]);

  if (query.isPending) return <LoadingState label="Söhbə yüklənir." />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const thread = query.data;

  return (
    <div>
      <Button asChild variant="ghost" className="mb-3 -ml-2">
        <Link href="/messages"><ArrowLeft className="mr-2 h-4 w-4" />Mesajlar</Link>
      </Button>

      <PageHeader
        title={thread.subject}
        description={`${thread.user?.email ?? "-"} · @${thread.user?.username ?? "-"} · açıldı ${toDateLabel(thread.createdAt)}`}
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Badge variant={thread.status === "ANSWERED" ? "success" : thread.status === "CLOSED" ? "secondary" : "outline"}>
            {STATUS_LABELS[thread.status] ?? thread.status}
          </Badge>
          <span className="text-sm text-muted-foreground">{thread.messages.length} mesaj</span>
          <div className="ml-auto flex gap-2">
            {thread.status !== "CLOSED" ? (
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate("CLOSED")} disabled={setStatus.isPending}>
                Söhbəni bağla
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate("OPEN")} disabled={setStatus.isPending}>
                Yenidən aç
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          {thread.messages.map((message) => {
            const fromAdmin = message.authorRole === "ADMIN";
            return (
              <div
                key={message.id}
                className={`flex flex-col gap-1 rounded-lg border p-3 ${
                  fromAdmin ? "self-end border-primary/30 bg-primary/5" : "self-start bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={fromAdmin ? "font-medium text-primary" : "font-medium"}>
                    {fromAdmin ? "Admin" : thread.user?.email ?? "İstifadəçi"}
                  </span>
                  <span>{toDateLabel(message.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{message.body}</p>
              </div>
            );
          })}

          {thread.status === "CLOSED" ? (
            <p className="text-sm text-muted-foreground">Bu söhbə bağlanıb. Yenidən cavab yazmaq üçün yuxarıdakı düymədən açın.</p>
          ) : (
            <form
              className="mt-2 flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const text = body.trim();
                if (!text) return;
                reply.mutate(text);
              }}
            >
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Cavabınızı yazın…"
                rows={4}
                aria-label="Cavab"
              />
              {reply.isError ? <ErrorState error={reply.error} /> : null}
              <Button type="submit" className="self-end" disabled={!body.trim() || reply.isPending}>
                <Send className="mr-2 h-4 w-4" />
                {reply.isPending ? "Göndərilir…" : "Cavab göndər"}
              </Button>
              <p className="text-right text-xs text-muted-foreground">
                Göndərildikdə istifadəçi mobil tətbiqdə bildiriş alacaq.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}