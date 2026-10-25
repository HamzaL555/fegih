import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Ad ən azı 2 simvoldan ibarət olmalıdır").max(100),
  description: z.string().trim().max(1000, "Təsvir çox uzundur").optional()
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
