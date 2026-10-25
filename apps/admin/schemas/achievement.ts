import { z } from "zod";

export const achievementSchema = z.object({
  name: z.string().trim().min(2, "Ad ən azı 2 simvoldan ibarət olmalıdır").max(150),
  description: z.string().trim().min(1, "Təsvir tələb olunur").max(2000),
  icon: z.string().trim().max(100).optional(),
  condition: z.string().trim().min(1, "Şərt tələb olunur").max(500),
  points: z.number().int().min(0).max(100000),
  isActive: z.boolean()
});

export type AchievementFormValues = z.infer<typeof achievementSchema>;
