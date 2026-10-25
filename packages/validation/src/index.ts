import { z } from "zod";

const cuidSchema = z.string().cuid();
const localeSchema = z.enum(["az", "tr", "en", "ar"]);
const urlSchema = z.string().url().max(2048);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");
const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .regex(/^\+?[0-9 ()-]+$/, "Enter a valid phone number");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format");

const moneySchema = z
  .union([
    z
      .number()
      .finite()
      .nonnegative()
      .max(9_999_999_999.99)
      .refine((value) => Number.isInteger(value * 100), "Use at most two decimal places"),
    z
      .string()
      .trim()
      .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Use a non-negative amount with at most two decimals"),
  ])
  .transform((value) => (typeof value === "number" ? value.toFixed(2) : value));

export const percentageSchema = z
  .union([z.number().finite(), z.string().trim().min(1)])
  .transform(Number)
  .pipe(z.number().finite().min(0).max(100));

// -----------------------------------------------------------------------------
// Authentication
// -----------------------------------------------------------------------------

const registrationPasswordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .max(128, "Password must contain at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/\d/, "Password must contain a number");

export const registerSchema = z
  .object({
    username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ.-]+$/u),
    displayName: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(320).optional(),
    phone: phoneSchema.optional(),
    password: registrationPasswordSchema,
    confirmPassword: z.string(),
    locale: localeSchema.default("az"),
    acceptTerms: z.literal(true).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.email && !value.phone) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Email or phone is required" });
    }
    if (value.password !== value.confirmPassword) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords do not match" });
    }
  });

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(3).max(320),
    password: z.string().min(1).max(128),
    rememberMe: z.boolean().default(false),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// -----------------------------------------------------------------------------
// Quiz
// -----------------------------------------------------------------------------

export const quizStartSchema = z
  .object({
    gameId: cuidSchema,
    locale: localeSchema.default("az"),
    deviceId: z.string().trim().min(1).max(128).optional(),
    idempotencyKey: z.string().trim().uuid().optional(),
  })
  .strict();

export const quizAnswerSchema = z
  .object({
    sessionId: cuidSchema,
    sessionQuestionId: cuidSchema,
    answerId: cuidSchema,
    responseTimeMs: z.number().int().nonnegative().max(3_600_000).optional(),
    idempotencyKey: z.string().trim().uuid().optional(),
  })
  .strict();

export type QuizStartInput = z.infer<typeof quizStartSchema>;
export type QuizAnswerInput = z.infer<typeof quizAnswerSchema>;

// -----------------------------------------------------------------------------
// Books
// -----------------------------------------------------------------------------

const bookSchema = z
  .object({
    sku: z.string().trim().min(1).max(64),
    slug: slugSchema,
    title: z.string().trim().min(2).max(300),
    subtitle: z.string().trim().max(300).nullish(),
    description: z.string().trim().min(1).max(50_000),
    author: z.string().trim().min(1).max(200),
    translator: z.string().trim().max(200).nullish(),
    publisher: z.string().trim().max(200).nullish(),
    isbn: z
      .string()
      .trim()
      .transform((value) => value.replace(/-/g, ""))
      .pipe(z.string().regex(/^(?:\d{9}[\dX]|\d{13})$/, "Enter a valid ISBN-10 or ISBN-13"))
      .nullish(),
    language: z.string().trim().min(2).max(16).default("az"),
    publicationDate: isoDateTimeSchema.optional(),
    pageCount: z.number().int().positive().max(100_000).optional(),
    coverImageUrl: urlSchema.nullish(),
    price: moneySchema,
    compareAtPrice: moneySchema.nullish(),
    currency: z.string().trim().toUpperCase().length(3).default("AZN"),
    trackInventory: z.boolean().default(true),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    categoryIds: z.array(cuidSchema).max(20).default([]),
    imageUrls: z.array(urlSchema).max(12).default([]),
  })
  .strict();

type BookData = z.output<typeof bookSchema> & {
  publishedAt?: string | null;
};

function validateBook(value: Partial<BookData>, context: z.RefinementCtx): void {
  if (
    value.compareAtPrice != null &&
    value.price != null &&
    Number(value.compareAtPrice) <= Number(value.price)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compareAtPrice"],
      message: "Compare-at price must be greater than the selling price",
    });
  }

  if (
    value.publicationDate != null &&
    value.publishedAt != null &&
    Date.parse(value.publicationDate) > Date.parse(value.publishedAt)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publicationDate"],
      message: "Publication date cannot be after the published-at timestamp",
    });
  }
}

// publishedAt is intentionally separate from publicationDate (a real date).
const bookFieldsWithPublishedAt = {
  ...bookSchema.shape,
  publishedAt: isoDateTimeSchema.nullish(),
  stock: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
};

export const bookCreateSchema = z
  .object(bookFieldsWithPublishedAt)
  .strict()
  .superRefine(validateBook);

export const bookUpdateSchema = z
  .object(bookFieldsWithPublishedAt)
  .partial()
  .strict()
  .superRefine(validateBook);

export type BookCreateInput = z.infer<typeof bookCreateSchema>;
export type BookUpdateInput = z.infer<typeof bookUpdateSchema>;

// -----------------------------------------------------------------------------
// Cart and order
// -----------------------------------------------------------------------------

export const addCartItemSchema = z
  .object({
    bookId: cuidSchema,
    quantity: z.number().int().min(1).max(99).default(1),
  })
  .strict();

export const updateCartItemSchema = z
  .object({
    quantity: z.number().int().min(0).max(99),
  })
  .strict();

export const shippingAddressSchema = z
  .object({
    recipientName: z.string().trim().min(2).max(120),
    phone: phoneSchema,
    country: z.string().trim().toUpperCase().length(2).default("AZ"),
    city: z.string().trim().min(1).max(120),
    postalCode: z.string().trim().min(2).max(20).optional(),
    line1: z.string().trim().min(3).max(250),
    line2: z.string().trim().max(250).optional(),
  })
  .strict();

const promoCodeInputSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(80)
  .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, underscores, or hyphens");

export const checkoutSchema = z
  .object({
    cartId: cuidSchema,
    customerEmail: z.string().trim().toLowerCase().email().max(320),
    customerPhone: phoneSchema,
    shippingAddress: shippingAddressSchema,
    billingAddress: shippingAddressSchema.optional(),
    deliveryMethod: z.enum(["STANDARD", "PICKUP"]).default("STANDARD"),
    paymentMethod: z.enum(["CARD", "CASH_ON_DELIVERY", "BANK_TRANSFER"]),
    promoCode: promoCodeInputSchema.optional(),
    notes: z.string().trim().max(1000).optional(),
    idempotencyKey: z.string().trim().uuid().optional(),
  })
  .strict();

export const orderStatusUpdateSchema = z
  .object({
    status: z.enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "PARTIALLY_REFUNDED",
      "REFUNDED",
    ]),
    note: z.string().trim().max(1000).optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;

// -----------------------------------------------------------------------------
// Promo codes
// -----------------------------------------------------------------------------

const promoCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(80)
  .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, underscores, or hyphens");

const promoSchema = z
  .object({
    code: promoCodeSchema,
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).nullish(),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
    value: moneySchema,
    currency: z.string().trim().toUpperCase().length(3).optional(),
    minOrderAmount: moneySchema.nullish(),
    maxDiscountAmount: moneySchema.nullish(),
    usageLimit: z.number().int().positive().nullish(),
    perUserLimit: z.number().int().positive().nullish(),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema.nullish(),
    appliesToAll: z.boolean(),
    bookIds: z.array(cuidSchema).max(500).optional(),
    categoryIds: z.array(cuidSchema).max(100).optional(),
    conditions: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean(),
  })
  .strict();

type PromoData = z.output<typeof promoSchema>;

function validatePromo(value: Partial<PromoData>, context: z.RefinementCtx): void {
  if (value.discountType === "PERCENTAGE" && value.value != null) {
    const percentage = Number(value.value);
    if (percentage <= 0 || percentage > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "A percentage must be greater than zero and cannot exceed 100",
      });
    }
  }

  if (value.discountType === "FIXED_AMOUNT" && value.value != null && Number(value.value) <= 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "A fixed discount must be greater than zero",
    });
  }

  if (value.discountType === "FREE_SHIPPING" && value.value != null && Number(value.value) !== 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "A free-shipping promo must have a value of zero",
    });
  }

  if (
    value.minOrderAmount != null &&
    value.maxDiscountAmount != null &&
    Number(value.maxDiscountAmount) < Number(value.minOrderAmount)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxDiscountAmount"],
      message: "Maximum discount cannot be lower than the minimum order amount",
    });
  }

  if (value.startsAt != null && value.endsAt != null && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: "End time must be after the start time",
    });
  }
}

export const promoCreateSchema = promoSchema.superRefine(validatePromo);
export const promoUpdateSchema = promoSchema.partial().strict().superRefine(validatePromo);

export type PromoCreateInput = z.infer<typeof promoCreateSchema>;
export type PromoUpdateInput = z.infer<typeof promoUpdateSchema>;

// -----------------------------------------------------------------------------
// User, prayer, notification, and system settings
// -----------------------------------------------------------------------------

export const userSettingsSchema = z
  .object({
    language: localeSchema,
    theme: z.enum(["SYSTEM", "LIGHT", "DARK"]),
    timezone: z.string().trim().min(1).max(64),
    reducedMotion: z.boolean(),
    marketingEmails: z.boolean(),
    quietHoursStart: timeSchema.nullish(),
    quietHoursEnd: timeSchema.nullish(),
  })
  .strict();

export const prayerSettingsSchema = z
  .object({
    isEnabled: z.boolean().default(true),
    calculationMethod: z.enum([
      "MWL",
      "ISNA",
      "EGYPT",
      "MAKKAH",
      "KARACHI",
      "TEHRAN",
      "JAFAR",
      "TURKEY",
      "RUSSIA",
      "MOONSIGHTING_COMMITTEE",
      "OTHER",
    ]),
    customMethod: z.string().trim().min(1).max(80).optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    timezone: z.string().trim().min(1).max(64),
    asrMadhab: z.enum(["HANAFI", "MALIKI", "SHAFII", "HANBALI"]),
    highLatitudeRule: z.enum(["MIDDLE_OF_NIGHT", "SEVENTH_OF_NIGHT", "ANGLE_BASED"]),
    autoLocation: z.boolean().default(true),
    notificationsEnabled: z.boolean().default(true),
    minuteOffsets: z
      .record(
        z.enum(["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]),
        z.number().int().min(-180).max(180),
      )
      .default({}),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.autoLocation) return;
    if (value.latitude == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["latitude"],
        message: "Latitude is required when automatic location is disabled",
      });
    }
    if (value.longitude == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["longitude"],
        message: "Longitude is required when automatic location is disabled",
      });
    }
  });

export const notificationPreferenceSchema = z
  .object({
    channel: z.enum(["PUSH", "EMAIL", "SMS", "IN_APP"]),
    category: z.string().trim().min(1).max(80),
    isEnabled: z.boolean(),
    quietStart: timeSchema.nullish(),
    quietEnd: timeSchema.nullish(),
  })
  .strict();

export const systemSettingSchema = z
  .object({
    key: z.string().trim().min(1).max(160),
    value: z.unknown(),
    valueType: z.enum(["STRING", "INTEGER", "DECIMAL", "BOOLEAN", "JSON"]),
    group: z.string().trim().min(1).max(80).default("general"),
    description: z.string().trim().max(500).nullish(),
    isPublic: z.boolean().default(false),
  })
  .strict();

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
export type PrayerSettingsInput = z.infer<typeof prayerSettingsSchema>;
export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;
export type SystemSettingInput = z.infer<typeof systemSettingSchema>;

// -----------------------------------------------------------------------------
// Question JSON import
//
// Canonical: [{ category?, level, question, answers: [{ text, isCorrect }] }]
// Legacy:    [{ id, question, correct_answer, wrong_answers: string[] }]
// Both formats may be mixed in one import file.
// -----------------------------------------------------------------------------

export const DEFAULT_LEGACY_IMPORT_LEVEL = 1;

const questionTextSchema = z.string().trim().min(1).max(20_000);
const answerTextSchema = z.string().trim().min(1).max(5_000);
const importCategorySchema = z.string().trim().min(1).max(120);

const levelAliases = new Map<string, number>([
  ["beginner", 1],
  ["easy", 1],
  ["easy-peasy", 1],
  ["intermediate", 3],
  ["medium", 3],
  ["hard", 5],
  ["expert", 5],
]);

const importLevelSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  const alias = levelAliases.get(normalized);
  if (alias != null) return alias;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return value;
}, z.number().int().min(1).max(100));

const externalQuestionIdSchema = z.preprocess((value, context) => {
  if (typeof value !== "number") return value;
  if (!Number.isSafeInteger(value) || value < 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Question id must be a non-negative integer",
    });
  }
  return String(value);
}, z.string().trim().min(1).max(191));

function addDuplicateAnswerIssues(
  answers: readonly string[],
  pathForIndex: (index: number) => (string | number)[],
  context: z.RefinementCtx,
): void {
  const seen = new Map<string, number>();

  answers.forEach((answer, index) => {
    const normalized = answer.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const firstIndex = seen.get(normalized);
    if (firstIndex != null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: pathForIndex(index),
        message: `Duplicate answer text; it also appears at answer ${firstIndex}`,
      });
      return;
    }
    seen.set(normalized, index);
  });
}

export const canonicalQuestionImportItemSchema = z
  .object({
    category: importCategorySchema.optional(),
    level: importLevelSchema,
    points: z.number().int().nonnegative().max(1_000_000).optional(),
    question: questionTextSchema,
    explanation: z.string().trim().max(20_000).optional(),
    image: urlSchema.optional(),
    answers: z
      .array(
        z
          .object({
            text: answerTextSchema,
            isCorrect: z.boolean(),
          })
          .strict(),
      )
      .min(2, "At least two answers are required")
      .max(8, "A question cannot have more than eight answers"),
  })
  .strict()
  .superRefine((item, context) => {
    const correctAnswerCount = item.answers.filter((answer) => answer.isCorrect).length;
    if (correctAnswerCount !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answers"],
        message: "Exactly one answer must have isCorrect=true",
      });
    }
    addDuplicateAnswerIssues(
      item.answers.map((answer) => answer.text),
      (index) => ["answers", index, "text"],
      context,
    );
  });

export const legacyQuestionImportItemSchema = z
  .object({
    id: externalQuestionIdSchema,
    question: questionTextSchema,
    correct_answer: answerTextSchema,
    wrong_answers: z.array(answerTextSchema).min(1).max(7),
  })
  .strict()
  .superRefine((item, context) => {
    addDuplicateAnswerIssues(
      [item.correct_answer, ...item.wrong_answers],
      (index) => (index === 0 ? ["correct_answer"] : ["wrong_answers", index - 1]),
      context,
    );
  });

export const questionImportItemSchema = z.union([
  canonicalQuestionImportItemSchema,
  legacyQuestionImportItemSchema,
]);

export interface NormalizedQuestionImportItem {
  readonly sourceId?: string;
  readonly category?: string;
  readonly level: number;
  readonly points?: number;
  readonly question: string;
  readonly explanation?: string;
  readonly image?: string;
  readonly answers: readonly {
    readonly text: string;
    readonly isCorrect: boolean;
  }[];
}

export interface QuestionImportIssue {
  /** Zero-based array item, or null for a file-level error. */
  readonly item: number | null;
  /** Dotted/bracket path within the item, for example answers[1].text. */
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export type QuestionImportParseResult =
  | { readonly success: true; readonly data: readonly NormalizedQuestionImportItem[] }
  | { readonly success: false; readonly issues: readonly QuestionImportIssue[] };

type ParsedQuestionImportItem = z.output<typeof questionImportItemSchema>;

function normalizeQuestionImportItem(item: ParsedQuestionImportItem): NormalizedQuestionImportItem {
  if ("answers" in item) {
    return {
      category: item.category,
      level: item.level,
      points: item.points,
      question: item.question,
      explanation: item.explanation,
      image: item.image,
      answers: item.answers.map((answer) => ({ text: answer.text, isCorrect: answer.isCorrect })),
    };
  }

  return {
    sourceId: item.id,
    level: DEFAULT_LEGACY_IMPORT_LEVEL,
    question: item.question,
    answers: [
      { text: item.correct_answer, isCorrect: true },
      ...item.wrong_answers.map((text) => ({ text, isCorrect: false })),
    ],
  };
}

export const questionImportSchema = z
  .array(questionImportItemSchema)
  .min(1, "Question import must contain at least one item")
  .transform((items) => items.map(normalizeQuestionImportItem));

function formatImportField(path: readonly (string | number)[]): string {
  if (path.length === 0) return "$";

  return path.reduce<string>((result, segment, index) => {
    if (typeof segment === "number") return `${result}[${segment}]`;
    if (index === 0) return segment;
    return `${result}.${segment}`;
  }, "");
}

function mapZodIssue(
  issue: z.ZodIssue,
  item: number | null,
  fieldPath: readonly (string | number)[],
): QuestionImportIssue {
  return {
    item,
    field: formatImportField(fieldPath),
    code: issue.code,
    message: issue.message,
  };
}

/** Converts Zod's nested array paths to explicit item/field import diagnostics. */
export function formatQuestionImportIssues(error: z.ZodError): QuestionImportIssue[] {
  return error.issues.map((issue) => {
    const [item, ...fieldPath] = issue.path;
    return mapZodIssue(issue, typeof item === "number" ? item : null, fieldPath);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fileIssue(code: string, message: string): QuestionImportParseResult {
  return {
    success: false,
    issues: [{ item: null, field: "$", code, message }],
  };
}

/**
 * Parses either an already-decoded value or a JSON string. Legacy items without
 * a level are normalized to DEFAULT_LEGACY_IMPORT_LEVEL. No partial success is
 * returned: an import can be committed only when every item is valid.
 */
export function parseQuestionImportJson(input: unknown): QuestionImportParseResult {
  let decoded = input;

  if (typeof input === "string") {
    try {
      decoded = JSON.parse(input) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON";
      return fileIssue("invalid_json", message);
    }
  }

  if (!Array.isArray(decoded)) {
    return fileIssue("invalid_type", "Question import must be a JSON array");
  }
  if (decoded.length === 0) {
    return fileIssue("too_small", "Question import must contain at least one item");
  }

  const issues: QuestionImportIssue[] = [];
  const data: NormalizedQuestionImportItem[] = [];

  decoded.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({
        item: index,
        field: "$",
        code: z.ZodIssueCode.invalid_type,
        message: "Question item must be an object",
      });
      return;
    }

    const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(item, key);
    const isLegacy = has("correct_answer") || has("wrong_answers");
    const isCanonical = has("answers") || has("level") || (has("question") && !isLegacy);
    const schema = isCanonical
      ? canonicalQuestionImportItemSchema
      : legacyQuestionImportItemSchema;
    const result = schema.safeParse(item);

    if (!result.success) {
      issues.push(...result.error.issues.map((issue) => mapZodIssue(issue, index, issue.path)));
      return;
    }

    data.push(normalizeQuestionImportItem(result.data));
  });

  if (issues.length > 0) {
    return { success: false, issues };
  }
  return { success: true, data };
}

/** Zod schema variant for uploading the file body as text. */
export const questionImportJsonTextSchema = z.string().transform((value, context) => {
  const result = parseQuestionImportJson(value);
  if (!result.success) {
    for (const issue of result.issues) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: issue.item == null ? [issue.field] : [issue.item, issue.field],
        message: `${issue.field}: ${issue.message}`,
      });
    }
    return z.NEVER;
  }
  return result.data;
});

export type CanonicalQuestionImportItemInput = z.infer<typeof canonicalQuestionImportItemSchema>;
export type LegacyQuestionImportItemInput = z.infer<typeof legacyQuestionImportItemSchema>;
export type QuestionImportInput = z.infer<typeof questionImportSchema>;
