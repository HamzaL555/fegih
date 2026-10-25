"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Plus, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contentApi } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";

const today = () => new Date().toISOString().slice(0, 10);

export default function ContentPage() {
  const client = useQueryClient();
  const [tab, setTab] = useState<"ayah" | "info" | "event">("ayah");
  const ayahQuery = useQuery({ queryKey: ["admin", "content", "ayahs"], queryFn: contentApi.ayahs });
  const infoQuery = useQuery({ queryKey: ["admin", "content", "infos"], queryFn: contentApi.infos });
  const eventQuery = useQuery({ queryKey: ["admin", "content", "events"], queryFn: contentApi.events });
  const mutation = useMutation({ mutationFn: ({ kind, payload }: { kind: typeof tab; payload: unknown }) => kind === "ayah" ? contentApi.createAyah(payload) : kind === "info" ? contentApi.createInfo(payload) : contentApi.createEvent(payload), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin", "content"] }); } });
  const [ayah, setAyah] = useState({ day: today(), surahNumber: "1", ayahNumber: "1", reference: "", arabicText: "", translationText: "" });
  const [info, setInfo] = useState({ day: today(), title: "", content: "" });
  const [event, setEvent] = useState({ slug: "", title: "", startsAt: today(), description: "" });
  const activeQuery = tab === "ayah" ? ayahQuery : tab === "info" ? infoQuery : eventQuery;
  const submit = () => mutation.mutate({ kind: tab, payload: tab === "ayah" ? { ...ayah, surahNumber: Number(ayah.surahNumber), ayahNumber: Number(ayah.ayahNumber), day: new Date(`${ayah.day}T00:00:00Z`).toISOString() } : tab === "info" ? { ...info, day: new Date(`${info.day}T00:00:00Z`).toISOString(), isPublished: true } : { ...event, startsAt: new Date(`${event.startsAt}T00:00:00Z`).toISOString(), isPublished: true, allDay: true } });

  return <div className="space-y-6">
    <PageHeader title="İslami kontent" description="Daily Ayah, məlumat və təqvim hadisələrini mobil tətbiqə bağlı DB-dən idarə edin" />
    <div className="flex flex-wrap gap-2">{([{ key: "ayah", label: "Daily Ayah", icon: BookOpen }, { key: "info", label: "İslami məlumat", icon: BookOpen }, { key: "event", label: "Təqvim", icon: CalendarDays }] as const).map((item) => <Button key={item.key} variant={tab === item.key ? "default" : "outline"} onClick={() => setTab(item.key)}><item.icon className="mr-2 h-4 w-4" />{item.label}</Button>)}</div>
    {mutation.isError ? <Alert variant="error">{toApiError(mutation.error).message}</Alert> : null}
    {mutation.isSuccess ? <Alert variant="success">Kontent əlavə edildi.</Alert> : null}
    <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Yeni məzmun</CardTitle><CardDescription>Məlumat yalnız server DB-sinə yazılır.</CardDescription></CardHeader><CardContent className="space-y-4">
        {tab === "ayah" ? <><Field label="Tarix"><Input type="date" value={ayah.day} onChange={(e) => setAyah({ ...ayah, day: e.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-3"><Field label="Surə"><Input type="number" value={ayah.surahNumber} onChange={(e) => setAyah({ ...ayah, surahNumber: e.target.value })} /></Field><Field label="Ayə"><Input type="number" value={ayah.ayahNumber} onChange={(e) => setAyah({ ...ayah, ayahNumber: e.target.value })} /></Field><Field label="İstinad"><Input value={ayah.reference} onChange={(e) => setAyah({ ...ayah, reference: e.target.value })} /></Field></div><Field label="Ərəb dərsi"><Textarea value={ayah.arabicText} onChange={(e) => setAyah({ ...ayah, arabicText: e.target.value })} /></Field><Field label="Tərcümə"><Textarea value={ayah.translationText} onChange={(e) => setAyah({ ...ayah, translationText: e.target.value })} /></Field></> : null}
        {tab === "info" ? <><Field label="Tarix"><Input type="date" value={info.day} onChange={(e) => setInfo({ ...info, day: e.target.value })} /></Field><Field label="Başlıq"><Input value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} /></Field><Field label="Məzmun"><Textarea rows={6} value={info.content} onChange={(e) => setInfo({ ...info, content: e.target.value })} /></Field></> : null}
        {tab === "event" ? <><Field label="Slug"><Input value={event.slug} onChange={(e) => setEvent({ ...event, slug: e.target.value })} /></Field><Field label="Başlıq"><Input value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} /></Field><Field label="Tarix"><Input type="date" value={event.startsAt} onChange={(e) => setEvent({ ...event, startsAt: e.target.value })} /></Field><Field label="Təsvir"><Textarea value={event.description} onChange={(e) => setEvent({ ...event, description: e.target.value })} /></Field></> : null}
        <Button onClick={submit} disabled={mutation.isPending}><Save className="mr-2 h-4 w-4" />Yadda et</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Mövcud məzmun</CardTitle><CardDescription>Son əlavə olunan DB qeydləri</CardDescription></CardHeader><CardContent>{activeQuery.isPending ? <LoadingState /> : activeQuery.isError ? <ErrorState error={activeQuery.error} onRetry={() => activeQuery.refetch()} /> : activeQuery.data.data.length === 0 ? <EmptyState title="Məzmun yoxdur" description="İlk qeydi yaradın." /> : <pre className="max-h-[34rem] overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(activeQuery.data.data, null, 2)}</pre>}</CardContent></Card>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
