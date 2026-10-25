import { z } from "zod";

export const missionSchema = z.object({
  title: z.string().trim().min(2, "Başlıq ən azı 2 simvoldan ibarət olmalıdır").max(150),
  description: z.string().trim().min(1, "Təsvir tələb olunur").max(2000),
  type: z.string().trim().min(1, "Növ seçin").max(100),
  target: z.number().int().min(1).max(1000000),
  rewardPoints: z.number().int().min(0).max(100000),
  isActive: z.boolean()
});

export type MissionFormValues = z.infer<typeof missionSchema>;
