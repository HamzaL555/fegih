import { z } from 'zod';

const email = z
  .string()
  .trim()
  .email()
  .max(160);

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s()-]{7,}$/);

export function isEmail(value: string): boolean {
  return email.safeParse(value).success;
}

export function isPhone(value: string): boolean {
  return phone.safeParse(value).success;
}

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

/**
 * Form shape: a single contact input keeps the sign-up flow short, while the
 * submit handler splits it into the `email` / `phone` fields the API expects.
 */
export const registerFormSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'fieldRequired')
      .max(32)
      .regex(/^[a-zA-Z0-9_.-]+$/, 'invalidUsername'),
    contact: z
      .string()
      .trim()
      .min(1, 'fieldRequired')
      .refine((value) => isEmail(value) || isPhone(value), 'invalidEmailPhone'),
    displayName: z.string().trim().max(80).optional(),
    password: z.string().min(8, 'passwordLength'),
    confirmPassword: z.string().min(1, 'fieldRequired'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwordsDoNotMatch',
  });

/** Wire shape expected by `POST /auth/register`. */
export const registerSchema = z
  .object({
    username: z.string().trim().min(3).max(32),
    email: email.optional(),
    phone: phone.optional(),
    displayName: z.string().trim().max(80).optional(),
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((values) => Boolean(values.email || values.phone), {
    path: ['email'],
    message: 'invalidEmailPhone',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerFormSchema>;
