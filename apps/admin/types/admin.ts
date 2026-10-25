import type { Entity, Nullable } from "@/types/api";

export interface AdminUser extends Entity {
  email?: Nullable<string>;
  username?: Nullable<string>;
  fullName?: string | null;
  displayName?: Nullable<string>;
  firstName?: Nullable<string>;
  lastName?: Nullable<string>;
  name?: string | null;
  avatarUrl?: Nullable<string>;
  profileImage?: Nullable<string>;
  role?: string | { id?: string; name?: string; code?: string } | null;
  isBlocked?: boolean;
  status?: string | null;
  deletedAt?: string | null;
  points?: number | null;
  createdAt?: string | null;
}

export interface QuestionAnswer {
  id?: string;
  text: string;
  isCorrect: boolean;
}

export interface Question extends Entity {
  question?: string | null;
  questionText?: string | null;
  text?: string | null;
  answers?: QuestionAnswer[];
  answerCount?: number | null;
  categoryId?: Nullable<string>;
  category?: Nullable<{ id: string; name: string } | string>;
  levelId?: Nullable<string>;
  level?: Nullable<{ id: string; name: string } | string>;
  points?: number | null;
  imageUrl?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface QuestionCategory extends Entity {
  name: string;
  slug?: Nullable<string>;
  description?: Nullable<string>;
  position?: number | null;
  isActive?: boolean | null;
  questionCount?: number | null;
}

export interface QuestionLevel extends Entity {
  name: string;
  code?: Nullable<string>;
  difficulty?: number | null;
  defaultPoints?: number | null;
  defaultTimeLimit?: number | null;
  position?: number | null;
  isActive?: boolean | null;
  points?: number | null;
  order?: number | null;
  questionCount?: number | null;
}

export interface Book extends Entity {
  title: string;
  description?: Nullable<string>;
  author?: Nullable<string>;
  categoryId?: Nullable<string>;
  category?: Nullable<{ id: string; name: string } | string>;
  price?: number | null;
  compareAtPrice?: number | null;
  stock?: number | null;
  pageCount?: number | null;
  publisher?: string | null;
  language?: string | null;
  imageUrl?: Nullable<string>;
  coverUrl?: Nullable<string>;
  coverImageUrl?: Nullable<string>;
  image?: Nullable<string>;
  bookUrl?: Nullable<string>;
  fileUrl?: Nullable<string>;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BookCategory extends Entity {
  name: string;
  description?: Nullable<string>;
  bookCount?: number | null;
  count?: number | null;
  _count?: { books?: number };
}

export interface Order extends Entity {
  userId?: Nullable<string>;
  user?: Nullable<{ id: string; email?: string; fullName?: string }>;
  status?: Nullable<string>;
  total?: number | null;
  currency?: Nullable<string>;
  orderNumber?: Nullable<string>;
  /** Flattened from the payment row by `serializeOrder`. */
  paymentStatus?: Nullable<string>;
  paymentMethod?: Nullable<string>;
  customerEmail?: Nullable<string>;
  customerPhone?: Nullable<string>;
  itemCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Achievement extends Entity {
  name?: string | null;
  title?: string | null;
  description?: Nullable<string>;
  icon?: Nullable<string>;
  condition?: Nullable<string>;
  points?: number | null;
  isActive?: boolean;
  createdAt?: string | null;
}

export interface Mission extends Entity {
  title?: string | null;
  name?: string | null;
  description?: Nullable<string>;
  type?: Nullable<string>;
  target?: number | null;
  rewardPoints?: number | null;
  isActive?: boolean;
  createdAt?: string | null;
}

export interface Notification extends Entity {
  title?: Nullable<string>;
  message?: Nullable<string>;
  type?: Nullable<string>;
  isRead?: boolean;
  createdAt?: string | null;
}

export type Settings = Record<string, unknown>;

export interface DashboardStat {
  label: string;
  value: number;
  change?: number | null;
}

export interface ChartDatum {
  label: string;
  value: number;
}

export interface DashboardData {
  stats: DashboardStat[];
  activity: ChartDatum[];
  distribution: ChartDatum[];
  recentActivity: Array<{
    id: string;
    label: string;
    detail?: string | null;
    createdAt?: string | null;
  }>;
}

export interface ImportFieldError {
  field: string;
  message: string;
}

export interface ImportRowResult {
  row: number;
  valid: boolean;
  fieldErrors: ImportFieldError[];
  message?: string | null;
  raw?: unknown;
}

export interface ImportPreview {
  rows: ImportRowResult[];
  total: number;
  valid: number;
  invalid: number;
}
