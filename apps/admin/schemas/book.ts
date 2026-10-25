import { z } from "zod";

export const bookSchema = z.object({
  title: z.string().trim().min(2, "Başlıq ən azı 2 simvoldan ibarət olmalıdır").max(200),
  description: z.string().trim().min(1, "Təsvir tələb olunur").max(5000, "Təsvir çox uzundur"),
  author: z.string().trim().min(1, "Müəllif adı tələb olunur").max(200, "Müəllif adı çox uzundur"),
  categoryId: z.string().optional(),
  price: z.number().min(0).max(1000000),
  compareAtPrice: z.number().min(0).max(1000000).optional(),
  stock: z.number().int().min(0).max(1000000),
  pageCount: z.number().int().min(1).max(100000).optional(),
  publisher: z.string().trim().max(200).optional(),
  language: z.string().trim().min(2).max(16).default("az"),
  bookUrl: z.string().trim().refine((value) => !value || /^https?:\/\//i.test(value), "Kitab URL-i http və ya https ilə başlamalıdır").optional(),
  imageUrl: z.string().trim().refine((value) => !value || /^https?:\/\//i.test(value), "Şəkil URL-i http və ya https ilə başlamalıdır").optional(),
  isActive: z.boolean()
});

export type BookFormValues = z.infer<typeof bookSchema>;
