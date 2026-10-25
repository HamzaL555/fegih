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
import { categorySchema, type CategoryFormValues } from "@/schemas/category";
import type { BookCategory } from "@/types/admin";

export function CategoryFormDialog({ open, onOpenChange, category, onSubmit, error }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: BookCategory | null;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
  error?: string | null;
}) {
  const form = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema), defaultValues: { name: "", description: "" } });
  useEffect(() => { if (open) form.reset({ name: category?.name || "", description: category?.description || "" }); }, [category, form, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{category ? "Kateqoriyanı redaktə et" : "Yeni kateqoriya"}</DialogTitle><DialogDescription>Kitab kateqoriyasının adını və təsvirini daxil edin.</DialogDescription></DialogHeader>
        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="space-y-2"><Label htmlFor="category-name">Ad</Label><Input id="category-name" autoFocus aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />{form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}</div>
          <div className="space-y-2"><Label htmlFor="category-description">Təsvir</Label><Textarea id="category-description" rows={4} {...form.register("description")} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Ləğv et</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{category ? "Yenilə" : "Yarat"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
