"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { questionCategoriesApi, questionLevelsApi } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";
import { queryKeys } from "@/lib/query/keys";
import { firstNumber, firstString } from "@/lib/utils";
import type { QuestionCategory, QuestionLevel } from "@/types/admin";

interface LevelForm {
  id?: string;
  code: string;
  name: string;
  difficulty: string;
  defaultPoints: string;
  defaultTimeLimit: string;
  position: string;
  isActive: boolean;
}

const EMPTY_FORM: LevelForm = {
  code: "",
  name: "",
  difficulty: "1",
  defaultPoints: "10",
  defaultTimeLimit: "30",
  position: "1",
  isActive: true
};

function toForm(level: QuestionLevel): LevelForm {
  return {
    id: level.id,
    code: firstString(level.code) ?? "",
    name: firstString(level.name) ?? "",
    difficulty: String(firstNumber(level.difficulty) ?? 1),
    defaultPoints: String(firstNumber(level.defaultPoints) ?? 0),
    defaultTimeLimit: String(firstNumber(level.defaultTimeLimit) ?? 30),
    position: String(firstNumber(level.position) ?? level.position ?? 0),
    isActive: level.isActive !== false
  };
}

export default function QuestionLevelsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LevelForm>(EMPTY_FORM);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");

  const levelsQuery = useQuery({ queryKey: queryKeys.questionLevels, queryFn: questionLevelsApi.list });
  const categoriesQuery = useQuery({ queryKey: queryKeys.questionCategories, queryFn: questionCategoriesApi.list });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.questionLevels });
    queryClient.invalidateQueries({ queryKey: queryKeys.questionCategories });
    queryClient.invalidateQueries({ queryKey: ["admin", "questions"] });
  };

  const saveLevel = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        difficulty: Number(form.difficulty) || 1,
        defaultPoints: Number(form.defaultPoints) || 0,
        defaultTimeLimit: Number(form.defaultTimeLimit) || 30,
        position: Number(form.position) || 0,
        isActive: form.isActive
      };
      return form.id ? questionLevelsApi.update(form.id, payload) : questionLevelsApi.create(payload);
    },
    onSuccess: () => { invalidate(); setFormOpen(false); setForm(EMPTY_FORM); }
  });

  const toggleLevel = useMutation({
    mutationFn: (level: QuestionLevel) => questionLevelsApi.update(level.id, { isActive: level.isActive === false }),
    onSuccess: invalidate
  });

  const createCategory = useMutation({
    mutationFn: () => questionCategoriesApi.create({ name: categoryName.trim(), slug: slugify(categoryName) }),
    onSuccess: () => { invalidate(); setCategoryName(""); setCategoryFormOpen(false); }
  });

  const levels = (levelsQuery.data?.data || []) as QuestionLevel[];
  const categories = (categoriesQuery.data?.data || []) as QuestionCategory[];
  const totalQuestions = levels.reduce((sum, level) => sum + (firstNumber(level.questionCount) ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Səviyyələr və kateqoriyalar"
        description={`${levels.length} səviyyə · ${totalQuestions} sual · ${categories.length} kateqoriya`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCategoryFormOpen(true)}><Plus className="mr-2 h-4 w-4" />Kateqoriya</Button>
            <Button onClick={() => { setForm(EMPTY_FORM); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />Yeni səviyyə</Button>
          </div>
        }
      />

      <div className="space-y-4">
        {(saveLevel.isError || toggleLevel.isError || createCategory.isError) ? (
          <Alert variant="error">
            {toApiError(saveLevel.error || toggleLevel.error || createCategory.error).message}
          </Alert>
        ) : null}

        <Card className="overflow-hidden"><CardContent className="p-0">
          {levelsQuery.isPending ? <div className="p-5"><LoadingState label="Səviyyələr yüklənir…" /></div> : null}
          {levelsQuery.isError ? <div className="p-5"><ErrorState error={levelsQuery.error} onRetry={() => levelsQuery.refetch()} /></div> : null}
          {levelsQuery.isSuccess && levels.length === 0 ? (
            <div className="p-5"><EmptyState title="Səviyyə yoxdur" description="Viktorina üçün ilk səviyyəni yaradın." /></div>
          ) : null}
          {levels.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>#</TableHead><TableHead>Kod</TableHead><TableHead>Ad</TableHead>
                <TableHead>Çətinlik</TableHead><TableHead>Xal</TableHead><TableHead>Vaxt (san)</TableHead>
                <TableHead>Suallar</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Əməliyyat</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {levels.map((level, index) => (
                  <TableRow key={level.id}>
                    <TableCell>{firstNumber(level.position) ?? index + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{firstString(level.code) ?? "—"}</TableCell>
                    <TableCell className="font-medium">{firstString(level.name) ?? "—"}</TableCell>
                    <TableCell>{firstNumber(level.difficulty) ?? "—"}</TableCell>
                    <TableCell>{firstNumber(level.defaultPoints) ?? "—"}</TableCell>
                    <TableCell>{firstNumber(level.defaultTimeLimit) ?? "—"}</TableCell>
                    <TableCell>{firstNumber(level.questionCount) ?? 0}</TableCell>
                    <TableCell>
                      <span className={level.isActive === false ? "text-muted-foreground" : "text-emerald-600"}>
                        {level.isActive === false ? "Deaktiv" : "Aktiv"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setForm(toForm(level)); setFormOpen(true); }} aria-label="Səviyyəni redaktə et"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleLevel.mutate(level)}>
                          {level.isActive === false ? "Aktivləşdir" : "Deaktivləşdir"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent></Card>

        <Card className="overflow-hidden"><CardContent className="p-0">
          {categoriesQuery.isPending ? <div className="p-5"><LoadingState label="Kateqoriyalar yüklənir…" /></div> : null}
          {categoriesQuery.isError ? <div className="p-5"><ErrorState error={categoriesQuery.error} onRetry={() => categoriesQuery.refetch()} /></div> : null}
          {categories.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Ad</TableHead><TableHead>Slug</TableHead><TableHead>Suallar</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{firstString(category.name) ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{firstString(category.slug) ?? "—"}</TableCell>
                    <TableCell>{firstNumber(category.questionCount) ?? 0}</TableCell>
                    <TableCell>{category.isActive === false ? "Deaktiv" : "Aktiv"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent></Card>
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => setFormOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Səviyyəni redaktə et" : "Yeni səviyyə"}</DialogTitle>
            <DialogDescription>Sual idxalında `level` sahəsi bu səviyyənin sıra nömrəsinə uyğun gəlir.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="level-name">Ad</label>
              <Input id="level-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Çox Asan" /></div>
            <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="level-code">Kod</label>
              <Input id="level-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="LEVEL_01" /></div>
            <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="level-position">Sıra (1-15)</label>
              <Input id="level-position" type="number" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} /></div>
            <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="level-difficulty">Çətinlik (1-100)</label>
              <Input id="level-difficulty" type="number" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })} /></div>
            <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="level-points">Varsayılan xal</label>
              <Input id="level-points" type="number" value={form.defaultPoints} onChange={(event) => setForm({ ...form, defaultPoints: event.target.value })} /></div>
            <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="level-time">Vaxt (san)</label>
              <Input id="level-time" type="number" value={form.defaultTimeLimit} onChange={(event) => setForm({ ...form, defaultTimeLimit: event.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Aktiv</label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Ləğv et</Button>
            <Button disabled={saveLevel.isPending || !form.name.trim() || !form.code.trim()} onClick={() => saveLevel.mutate()}>Yadda saxla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryFormOpen} onOpenChange={(open) => setCategoryFormOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni kateqoriya</DialogTitle>
            <DialogDescription>Kateqoriya adı sual idxalındakı `category` sahəsi ilə eyni olmalıdır.</DialogDescription>
          </DialogHeader>
          <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="İslam ümumi" aria-label="Kateqoriya adı" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryFormOpen(false)}>Ləğv et</Button>
            <Button disabled={createCategory.isPending || !categoryName.trim()} onClick={() => createCategory.mutate()}>Yarat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function slugify(value: string) {
  return value.toLocaleLowerCase("az").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 130);
}
