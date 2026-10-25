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
import { missionSchema, type MissionFormValues } from "@/schemas/mission";
import type { Mission } from "@/types/admin";

export function MissionFormDialog({ open, onOpenChange, mission, onSubmit, error }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mission: Mission | null;
  onSubmit: (values: MissionFormValues) => Promise<void>;
  error?: string | null;
}) {
  const form = useForm<MissionFormValues>({ resolver: zodResolver(missionSchema), defaultValues: { title: "", description: "", type: "", target: 1, rewardPoints: 0, isActive: true } });
  useEffect(() => { if (open) form.reset({ title: mission?.title || mission?.name || "", description: mission?.description || "", type: mission?.type || "", target: mission?.target ?? 1, rewardPoints: mission?.rewardPoints ?? 0, isActive: mission?.isActive ?? true }); }, [form, mission, open]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>{mission ? "Missiyanı redaktə et" : "Yeni missiya"}</DialogTitle><DialogDescription>Missiyanın hədəfini, növünü və mükafatını daxil edin.</DialogDescription></DialogHeader>
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="space-y-2"><Label htmlFor="mission-title">Başlıq</Label><Input id="mission-title" autoFocus {...form.register("title")} />{form.formState.errors.title ? <p className="text-sm text-destructive">{form.formState.errors.title.message}</p> : null}</div>
      <div className="space-y-2"><Label htmlFor="mission-description">Təsvir</Label><Textarea id="mission-description" rows={3} {...form.register("description")} />{form.formState.errors.description ? <p className="text-sm text-destructive">{form.formState.errors.description.message}</p> : null}</div>
      <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="mission-type">Növ</Label><Input id="mission-type" placeholder="questions, streak…" {...form.register("type")} />{form.formState.errors.type ? <p className="text-sm text-destructive">{form.formState.errors.type.message}</p> : null}</div><div className="space-y-2"><Label htmlFor="mission-target">Hədəf</Label><Input id="mission-target" type="number" min={1} step={1} {...form.register("target", { valueAsNumber: true })} />{form.formState.errors.target ? <p className="text-sm text-destructive">{form.formState.errors.target.message}</p> : null}</div><div className="space-y-2"><Label htmlFor="mission-points">Mükafat xalı</Label><Input id="mission-points" type="number" min={0} step={1} {...form.register("rewardPoints", { valueAsNumber: true })} />{form.formState.errors.rewardPoints ? <p className="text-sm text-destructive">{form.formState.errors.rewardPoints.message}</p> : null}</div></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-ring" {...form.register("isActive")} />Aktiv</label>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Ləğv et</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{mission ? "Yenilə" : "Yarat"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
