import { z } from 'zod';

export const profileSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(500).optional(),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((values) => values.newPassword === values.confirmPassword, { path: ['confirmPassword'] });

export type ProfileValues = z.infer<typeof profileSchema>;
export type PasswordValues = z.infer<typeof passwordSchema>;
