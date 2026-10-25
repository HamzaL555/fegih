"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { questionSchema, type QuestionFormValues } from "@/schemas/question";
import type { Question, QuestionCategory, QuestionLevel } from "@/types/admin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question | null;
  categories: QuestionCategory[];
  levels: QuestionLevel[];
  onSubmit: (values: QuestionFormValues, image: File | null) => Promise<void>;
  error?: string | null;
}

function defaults(question: Question | null): QuestionFormValues {
  return {
    question: question?.question || question?.questionText || question?.text || "",
    /**
     * The `id` must survive the round trip. Without it the API has no way to
     * tell an edit from a new answer, so it creates a row for every option
     * while the originals still hold positions 0..n — which trips
     * `@@unique([questionId, position])` and fails the whole save with "A
     * record with the same unique value already exists".
     */
    answers: question?.answers?.length ? question.answers.map((answer) => ({ id: answer.id, text: answer.text, isCorrect: answer.isCorrect })) : [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false }
    ],
    categoryId: question?.categoryId || (typeof question?.category === "string" ? question.category : question?.category?.id) || "",
    levelId: question?.levelId || (typeof question?.level === "string" ? question.level : question?.level?.id) || "",
    points: question?.points ?? 0,
    imageUrl: question?.imageUrl || ""
  };
}

export function QuestionFormDialog({ open, onOpenChange, question, categories, levels, onSubmit, error }: Props) {
  const [image, setImage] = useState<File | null>(null);
  const form = useForm<QuestionFormValues>({ resolver: zodResolver(questionSchema), defaultValues: defaults(null) });
  const answers = useFieldArray({ control: form.control, name: "answers" });

  useEffect(() => {
    if (open) { form.reset(defaults(question)); setImage(null); }
  }, [form, open, question]);

  const submit = form.handleSubmit((values) => onSubmit(values, image));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{question ? "Sualı redaktə et" : "Yeni sual"}</DialogTitle>
          <DialogDescription>Cavabları, səviyyəni, kateqoriyanı, şəkli və xal dəyərini daxil edin.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="space-y-2">
            <Label htmlFor="question-text">Sual</Label>
            <Textarea id="question-text" rows={4} aria-invalid={Boolean(form.formState.errors.question)} {...form.register("question")} />
            {form.formState.errors.question ? <p className="text-sm text-destructive">{form.formState.errors.question.message}</p> : null}
          </div>
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium">Cavablar</legend>
              <Button type="button" size="sm" variant="outline" onClick={() => answers.append({ text: "", isCorrect: false })} disabled={answers.fields.length >= 8}><Plus className="mr-1 h-4 w-4" /> Cavab</Button>
            </div>
            <div className="space-y-2">
              {answers.fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
                  <input id={`answer-correct-${field.id}`} type="checkbox" className="mt-2.5 h-4 w-4 rounded border-input text-primary focus:ring-ring" aria-label={`${index + 1}-ci cavabı doğru işarələ`} {...form.register(`answers.${index}.isCorrect`)} />
                  <div className="flex-1 space-y-1"><Label htmlFor={`answer-${field.id}`} className="sr-only">{index + 1}-ci cavab</Label><Input id={`answer-${field.id}`} placeholder={`${index + 1}-ci cavab`} aria-invalid={Boolean(form.formState.errors.answers?.[index]?.text)} {...form.register(`answers.${index}.text`)} />{form.formState.errors.answers?.[index]?.text ? <p className="text-xs text-destructive">{form.formState.errors.answers?.[index]?.text?.message}</p> : null}</div>
                  <Button type="button" variant="ghost" size="icon" className="mt-0.5 text-destructive" disabled={answers.fields.length <= 2} onClick={() => answers.remove(index)} aria-label={`${index + 1}-ci cavabı sil`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            {form.formState.errors.answers?.message ? <p className="text-sm text-destructive">{form.formState.errors.answers.message}</p> : null}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="question-category">Kateqoriya</Label><Select id="question-category" {...form.register("categoryId")}><option value="">Seçin</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></div>
            <div className="space-y-2"><Label htmlFor="question-level">Səviyyə</Label><Select id="question-level" {...form.register("levelId")}><option value="">Seçin</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</Select></div>
          </div>
          <div className="space-y-2"><Label htmlFor="question-points">Xal</Label><Input id="question-points" type="number" min={0} step={1} {...form.register("points", { valueAsNumber: true })} /></div>
          <div className="space-y-2"><Label htmlFor="question-image-url">Şəkil URL-i</Label><Input id="question-image-url" type="url" {...form.register("imageUrl")} /></div>
          <div className="space-y-2"><Label htmlFor="question-image">Şəkil faylı</Label><Input id="question-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Ləğv et</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{question ? "Yenilə" : "Yarat"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
