"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { bookSchema, type BookFormValues } from "@/schemas/book";
import { bookImage } from "@/lib/format";
import type { Book, BookCategory } from "@/types/admin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: Book | null;
  categories: BookCategory[];
  onSubmit: (values: BookFormValues, image: File | null) => Promise<void>;
  error?: string | null;
}

function defaults(book: Book | null): BookFormValues {
  return {
    title: book?.title || "",
    description: book?.description || "",
    author: book?.author || "",
    categoryId: book?.categoryId || (typeof book?.category === "string" ? book.category : book?.category?.id) || "",
    price: book?.price ?? 0,
    compareAtPrice: book?.compareAtPrice ?? undefined,
    stock: book?.stock ?? 0,
    pageCount: book?.pageCount ?? undefined,
    publisher: book?.publisher ?? "",
    language: book?.language ?? "az",
    bookUrl: book?.bookUrl || book?.fileUrl || "",
    imageUrl: (book ? bookImage(book) : "") ?? "",
    isActive: book?.isActive ?? true
  };
}

export function BookFormDialog({ open, onOpenChange, book, categories, onSubmit, error }: Props) {
  const [image, setImage] = useState<File | null>(null);
  const form = useForm<BookFormValues>({ resolver: zodResolver(bookSchema) as never, defaultValues: defaults(null) });

  useEffect(() => {
    if (open) {
      form.reset(defaults(book));
      setImage(null);
    }
  }, [book, form, open]);

  const submit = form.handleSubmit((values) => onSubmit(values, image));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{book ? "Kitabı redaktə et" : "Yeni kitab"}</DialogTitle>
          <DialogDescription>Kitab URL-i və ya şəkil faylı əlavə edin. Şəkil faylı əvvəlcə /admin/uploads endpoint-inə yüklənir.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="book-title">Başlıq</Label>
              <Input id="book-title" aria-invalid={Boolean(form.formState.errors.title)} {...form.register("title")} />
              {form.formState.errors.title ? <p className="text-sm text-destructive">{form.formState.errors.title.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-author">Müəllif</Label>
              <Input id="book-author" {...form.register("author")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-category">Kateqoriya</Label>
              <Select id="book-category" {...form.register("categoryId")}><option value="">Təyin edilməyib</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="book-price">Qiymət (AZN)</Label><Input id="book-price" type="number" min="0" step="0.01" {...form.register("price", { valueAsNumber: true })} /></div>
            <div className="space-y-2"><Label htmlFor="book-compare-price">Endirimli qiymət</Label><Input id="book-compare-price" type="number" min="0" step="0.01" {...form.register("compareAtPrice", { valueAsNumber: true })} /></div>
            <div className="space-y-2"><Label htmlFor="book-stock">Stok</Label><Input id="book-stock" type="number" min="0" step="1" {...form.register("stock", { valueAsNumber: true })} /></div>
            <div className="space-y-2"><Label htmlFor="book-pages">Səhifə</Label><Input id="book-pages" type="number" min="1" step="1" {...form.register("pageCount", { valueAsNumber: true })} /></div>
            <div className="space-y-2"><Label htmlFor="book-publisher">Nəşriyyat</Label><Input id="book-publisher" {...form.register("publisher")} /></div>
            <div className="space-y-2"><Label htmlFor="book-language">Dil</Label><Input id="book-language" {...form.register("language")} /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-description">Təsvir</Label>
            <Textarea id="book-description" rows={4} {...form.register("description")} />
            {form.formState.errors.description ? <p className="text-sm text-destructive">{form.formState.errors.description.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-url">Kitab URL-i</Label>
            <Input id="book-url" type="url" placeholder="https://..." aria-invalid={Boolean(form.formState.errors.bookUrl)} {...form.register("bookUrl")} />
            {form.formState.errors.bookUrl ? <p className="text-sm text-destructive">{form.formState.errors.bookUrl.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-image-url">Şəkil URL-i</Label>
            <Input id="book-image-url" type="url" placeholder="https://..." aria-invalid={Boolean(form.formState.errors.imageUrl)} {...form.register("imageUrl")} />
            {form.formState.errors.imageUrl ? <p className="text-sm text-destructive">{form.formState.errors.imageUrl.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-image">Şəkil faylı</Label>
            <div className="flex items-start gap-3">
              <ImagePlus className="mt-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <Input id="book-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setImage(event.target.files?.[0] || null)} aria-describedby="book-image-help" />
            </div>
            <p id="book-image-help" className="text-xs text-muted-foreground">JPEG, PNG, WebP və ya GIF. Fayl seçilməzsə mövcud URL saxlanılır.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-ring" {...form.register("isActive")} />
            Aktiv
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Ləğv et</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{book ? "Yenilə" : "Yarat"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
