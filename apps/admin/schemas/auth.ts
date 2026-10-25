import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "E-poçt, telefon və ya istifadəçi adı tələb olunur").max(254, "Giriş məlumatı çox uzundur"),
  password: z.string().min(1, "Şifrə tələb olunur").max(128, "Şifrə çox uzundur")
});

export type LoginFormValues = z.infer<typeof loginSchema>;
