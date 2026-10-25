export const supportedLocales = ["az", "tr", "en", "ar"] as const;
export type Locale = (typeof supportedLocales)[number];

export type CurrencyCode = "AZN" | "USD" | "EUR" | "TRY" | "RUB";

export enum UserRole {
  USER = "USER",
  EDITOR = "EDITOR",
  ORDER_MANAGER = "ORDER_MANAGER",
  QUESTION_MANAGER = "QUESTION_MANAGER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

export enum QuizSessionStatus {
  CREATED = "CREATED",
  IN_PROGRESS = "IN_PROGRESS",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  ABANDONED = "ABANDONED",
  EXPIRED = "EXPIRED",
}

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  PREPARING = "PREPARING",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  REFUNDED = "REFUNDED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  AUTHORIZED = "AUTHORIZED",
  PAID = "PAID",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  REFUNDED = "REFUNDED",
}

export enum NotificationChannel {
  PUSH = "PUSH",
  EMAIL = "EMAIL",
  SMS = "SMS",
  IN_APP = "IN_APP",
}

export enum ThemeMode {
  SYSTEM = "SYSTEM",
  LIGHT = "LIGHT",
  DARK = "DARK",
}

export interface ValidationIssue {
  readonly item: number | null;
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
  readonly details?: readonly ValidationIssue[];
  readonly requestId?: string;
}

export interface PageInfo {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface Paginated<T> {
  readonly items: readonly T[];
  readonly meta: PageInfo;
}

export interface AuthUser {
  readonly id: string;
  readonly username: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly displayName: string;
  readonly profileImage: string | null;
  readonly locale: Locale;
  readonly roles: readonly UserRole[];
  readonly points: number;
  readonly level: number;
  readonly xp: number;
  readonly streak: number;
  readonly longestStreak: number;
  readonly totalGames: number;
  readonly correctAnswers: number;
  readonly wrongAnswers: number;
}

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessTokenExpiresAt: string;
  readonly refreshTokenExpiresAt: string;
}

export interface AuthResponse {
  readonly user: AuthUser;
  readonly tokens: TokenPair;
}

export interface QuizOption {
  readonly id: string;
  readonly text: string;
}

export interface QuizQuestion {
  readonly id: string;
  readonly text: string;
  readonly options: readonly QuizOption[];
  readonly order: number;
  readonly points: number;
  readonly timeLimitSeconds: number;
  readonly imageUrl: string | null;
}

export interface QuizStartResponse {
  readonly sessionId: string;
  readonly gameId: string;
  readonly status: QuizSessionStatus;
  readonly livesRemaining: number;
  readonly totalQuestions: number;
  readonly questions: readonly QuizQuestion[];
  readonly expiresAt: string | null;
}

export interface QuizAnswerResult {
  readonly sessionQuestionId: string;
  readonly isCorrect: boolean;
  readonly correctAnswerId: string;
  readonly explanation: string | null;
  readonly pointsAwarded: number;
  readonly totalScore: number;
  readonly livesRemaining: number;
  readonly completed: boolean;
}

export interface BookSummary {
  readonly id: string;
  readonly slug: string;
  readonly sku: string;
  readonly title: string;
  readonly author: string;
  readonly coverImageUrl: string | null;
  readonly price: string;
  readonly compareAtPrice: string | null;
  readonly currency: CurrencyCode;
  readonly inStock: boolean;
  readonly isFeatured: boolean;
}

export interface CartItemSummary {
  readonly id: string;
  readonly book: BookSummary;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly lineTotal: string;
}

export interface CartSummary {
  readonly id: string;
  readonly currency: CurrencyCode;
  readonly items: readonly CartItemSummary[];
  readonly subtotal: string;
  readonly itemCount: number;
  readonly updatedAt: string;
}

export interface OrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus | null;
  readonly currency: CurrencyCode;
  readonly subtotal: string;
  readonly discountAmount: string;
  readonly shippingFee: string;
  readonly totalAmount: string;
  readonly placedAt: string;
}

export interface AppNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly actionUrl: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}
