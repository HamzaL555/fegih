"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { achievementSchema, type AchievementFormValues } from "@/schemas/achievement";
import type { Achievement } from "@/types/admin";

export function AchievementFormDialog({ open, onOpenChange, achievement, onSubmit, error }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievement: Achievement | null;
  onSubmit: (values: AchievementFormValues) => Promise<void>;
  error?: string | null;
}) {
  const form = useForm<AchievementFormValues>({ resolver: zodResolver(achievementSchema), defaultValues: { name: "", description: "", icon: "", condition: "", points: 0, isActive: true } });
  useEffect(() => { if (open) form.reset({ name: achievement?.name || achievement?.title || "", description: achievement?.description || "", icon: achievement?.icon || "", condition: achievement?.condition || "", points: achievement?.points ?? 0, isActive: achievement?.isActive ?? true }); }, [achievement, form, open]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>{achievement ? "Nailiyyəti redaktə et" : "Yeni nailiyyət"}</DialogTitle><DialogDescription>Nailiyyətin adını, şərtini və xal mükafatını daxil edin.</DialogDescription></DialogHeader>
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="space-y-2"><Label htmlFor="achievement-name">Ad</Label><Input id="achievement-name" autoFocus aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />{form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}</div>
      <div className="space-y-2"><Label htmlFor="achievement-description">Təsvir</Label><Textarea id="achievement-description" rows={3} {...form.register("description")} />{form.formState.errors.description ? <p className="text-sm text-destructive">{form.formState.errors.description.message}</p> : null}</div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="achievement-icon">İkon</Label><Input id="achievement-icon" placeholder="trophy və ya emoji" {...form.register("icon")} /></div><div className="space-y-2"><Label htmlFor="achievement-points">Xal</Label><Input id="achievement-points" type="number" min={0} step={1} {...form.register("points", { valueAsNumber: true })} />{form.formState.errors.points ? <p className="text-sm text-destructive">{form.formState.errors.points.message}</p> : null}</div></div>
      <div className="space-y-2"><Label htmlFor="achievement-condition">Şərt</Label><Textarea id="achievement-condition" rows={2} placeholder="Məsələn: complete_questions = 10" {...form.register("condition")} />{form.formState.errors.condition ? <p className="text-sm text-destructive">{form.formState.errors.condition.message}</p> : null}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-ring" {...form.register("isActive")} />Aktiv</label>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Ləğv et</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{achievement ? "Yenilə" : "Yarat"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
