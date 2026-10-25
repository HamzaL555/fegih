import { z } from "zod";

export const rewardJsonSchema = z.object({
  json: z.string().min(2, "Konfiqurasiya tələb olunur").refine((value) => {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null;
    } catch {
      return false;
    }
  }, "Düzgün JSON obyekti və ya massivi daxil edin")
});

export type RewardJsonFormValues = z.infer<typeof rewardJsonSchema>;
