import { apiClient, unwrapData } from "@/lib/api/client";
import type { ListParams, Paginated } from "@/types/api";
import { isRecord } from "@/lib/utils";
import type {
  Achievement,
  Book,
  BookCategory,
  DashboardData,
  ImportPreview,
  Mission,
  Notification,
  Order,
  Question,
  QuestionCategory,
  QuestionLevel,
  Settings,
} from "@/types/admin";

export interface PaginatedResponse<T> extends Paginated<T> {}

export async function getList<T>(path: string, params?: ListParams): Promise<PaginatedResponse<T>> {
  const response = await apiClient.get(path, { params });
  const payload = response.data;
  if (isRecord(payload) && Array.isArray(payload.data) && isRecord(payload.meta)) {
    return payload as unknown as PaginatedResponse<T>;
  }
  const data = unwrapData<PaginatedResponse<T> | T[]>(payload);
  if (Array.isArray(data)) {
    const total = data.length;
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    return {
      data,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
    };
  }
  return data;
}

export async function getOne<T>(path: string): Promise<T> {
  const response = await apiClient.get(path);
  return unwrapData<T>(response.data);
}

export async function getDashboard(): Promise<DashboardData> {
  return getOne<DashboardData>("/admin/dashboard");
}

export async function updateUser(id: string, payload: { isBlocked: boolean }) {
  return apiClient.patch(`/admin/users/${encodeURIComponent(id)}`, payload).then((r) => unwrapData(r.data));
}

export const questionsApi = {
  list: (params?: ListParams) => getList<Question>("/admin/questions", params),
  create: (payload: unknown) => apiClient.post("/admin/questions", payload).then((r) => unwrapData<Question>(r.data)),
  update: (id: string, payload: unknown) => apiClient.patch(`/admin/questions/${encodeURIComponent(id)}`, payload).then((r) => unwrapData<Question>(r.data)),
  remove: (id: string) => apiClient.delete(`/admin/questions/${encodeURIComponent(id)}`),
  restore: (id: string) => apiClient.post(`/admin/questions/${encodeURIComponent(id)}/restore`).then((r) => unwrapData<Question>(r.data)),
  categories: () => getList<QuestionCategory>("/admin/question-categories"),
  levels: () => getList<QuestionLevel>("/admin/question-levels"),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return apiClient.post("/admin/uploads", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => unwrapData<unknown>(r.data));
  }
};

export const questionLevelsApi = {
  list: () => getList<QuestionLevel>("/admin/question-levels"),
  create: (payload: unknown) => apiClient.post("/admin/question-levels", payload).then((r) => unwrapData<QuestionLevel>(r.data)),
  update: (id: string, payload: unknown) => apiClient.patch(`/admin/question-levels/${encodeURIComponent(id)}`, payload).then((r) => unwrapData<QuestionLevel>(r.data)),
  remove: (id: string) => apiClient.delete(`/admin/question-levels/${encodeURIComponent(id)}`)
};

export const questionCategoriesApi = {
  list: () => getList<QuestionCategory>("/admin/question-categories"),
  create: (payload: unknown) => apiClient.post("/admin/question-categories", payload).then((r) => unwrapData<QuestionCategory>(r.data)),
  update: (id: string, payload: unknown) => apiClient.patch(`/admin/question-categories/${encodeURIComponent(id)}`, payload).then((r) => unwrapData<QuestionCategory>(r.data)),
  remove: (id: string) => apiClient.delete(`/admin/question-categories/${encodeURIComponent(id)}`)
};

export const importBatchesApi = {
  list: (params?: ListParams) => getList<Record<string, unknown>>("/admin/questions/import", params),
  detail: (id: string) => getOne<Record<string, unknown>>(`/admin/questions/import/${encodeURIComponent(id)}`)
};

export const booksApi = {
  list: (params?: ListParams) => getList<Book>("/admin/books", params),
  create: (payload: unknown) => apiClient.post("/admin/books", payload).then((r) => unwrapData<Book>(r.data)),
  update: (id: string, payload: unknown) => apiClient.patch(`/admin/books/${encodeURIComponent(id)}`, payload).then((r) => unwrapData<Book>(r.data)),
  remove: (id: string) => apiClient.delete(`/admin/books/${encodeURIComponent(id)}`),
  categories: () => getList<BookCategory>("/admin/book-categories"),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return apiClient.post("/admin/uploads", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => unwrapData<unknown>(r.data));
  }
};

export const bookCategoriesApi = {
  list: () => getList<BookCategory>("/admin/book-categories"),
  create: (payload: unknown) => apiClient.post("/admin/book-categories", payload).then((r) => unwrapData<BookCategory>(r.data)),
  update: (id: string, payload: unknown) => apiClient.patch(`/admin/book-categories/${encodeURIComponent(id)}`, payload).then((r) => unwrapData<BookCategory>(r.data)),
  remove: (id: string) => apiClient.delete(`/admin/book-categories/${encodeURIComponent(id)}`)
};

export const ordersApi = {
  list: (params?: ListParams) => getList<Order>("/admin/orders", params),
  updateStatus: (id: string, status: string) => apiClient.patch(`/admin/orders/${encodeURIComponent(id)}/status`, { status }).then((r) => unwrapData<Order>(r.data)),
  /** Cash / bank-transfer orders have no Stripe webhook, so an admin closes them out by hand. */
  markPaid: (id: string) => apiClient.post(`/admin/orders/${encodeURIComponent(id)}/mark-paid`).then((r) => unwrapData<Order>(r.data))
};

export const achievementsApi = {
  list: (params?: ListParams) => getList<Achievement>("/admin/achievements", params),
  create: (payload: unknown) => apiClient.post("/admin/achievements", payload).then((r) => unwrapData<Achievement>(r.data)),
  update: (id: string, payload: unknown) => apiClient.patch(`/admin/achievements/${encodeURIComponent(id)}`, payload).then((r) => unwrapData<Achievement>(r.data)),
  remove: (id: string) => apiClient.delete(`/admin/achievements/${encodeURIComponent(id)}`)
};

export const missionsApi = {
  list: (params?: ListParams) => getList<Mission>("/admin/missions", params),
  create: (payload: unknown) => apiClient.post("/admin/missions", payload).then((r) => unwrapData<Mission>(r.data)),
  update: (id: string, payload: unknown) => apiClient.patch(`/admin/missions/${encodeURIComponent(id)}`, payload).then((r) => unwrapData<Mission>(r.data)),
  remove: (id: string) => apiClient.delete(`/admin/missions/${encodeURIComponent(id)}`)
};

export const contentApi = {
  ayahs: () => getList<Record<string, unknown>>("/admin/daily-ayah"),
  createAyah: (payload: unknown) => apiClient.post("/admin/daily-ayah", payload).then((r) => unwrapData(r.data)),
  infos: () => getList<Record<string, unknown>>("/admin/islamic-info"),
  createInfo: (payload: unknown) => apiClient.post("/admin/islamic-info", payload).then((r) => unwrapData(r.data)),
  events: () => getList<Record<string, unknown>>("/admin/events"),
  createEvent: (payload: unknown) => apiClient.post("/admin/events", payload).then((r) => unwrapData(r.data)),
};

export const settingsApi = {
  get: () => getOne<Settings>("/admin/settings"),
  update: (payload: Settings) => apiClient.put("/admin/settings", payload).then((r) => unwrapData<Settings>(r.data))
};

export const notificationsApi = {
  list: (params?: ListParams) => getList<Notification>("/admin/notifications", params)
};

export interface MessageThreadSummary {
  id: string;
  subject: string;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  unread: number;
  lastMessageAt: string;
  createdAt: string;
  messageCount?: number;
  user?: { id: string; email: string | null; username: string; displayName: string };
  lastMessage?: { body: string; authorRole: "USER" | "ADMIN"; createdAt: string };
}

export interface MessageItem {
  id: string;
  body: string;
  authorRole: "USER" | "ADMIN";
  createdAt: string;
  isRead: boolean;
}

export interface MessageThreadDetail extends MessageThreadSummary {
  messages: MessageItem[];
}

/** Support inbox: questions from the app answered from here. */
export const messagesApi = {
  list: (params?: ListParams) => getList<MessageThreadSummary>("/admin/messages", params),
  detail: (id: string) =>
    apiClient.get(`/admin/messages/${id}`).then((r) => unwrapData<MessageThreadDetail>(r.data)),
  reply: (id: string, body: string) =>
    apiClient.post(`/admin/messages/${id}/reply`, { body }).then((r) => unwrapData<MessageItem>(r.data)),
  setStatus: (id: string, status: "OPEN" | "ANSWERED" | "CLOSED") =>
    apiClient.patch(`/admin/messages/${id}`, { status }).then((r) => unwrapData<{ id: string; status: string }>(r.data))
};

export async function previewQuestionImport(file: File): Promise<ImportPreview> {
  const form = new FormData();
  form.append("file", file);
  return apiClient.post("/admin/questions/import/preview", form, {
    headers: { "Content-Type": "multipart/form-data" }
  }).then((r) => unwrapData<ImportPreview>(r.data));
}

export async function importQuestions(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiClient.post("/admin/questions/import", form, {
    headers: { "Content-Type": "multipart/form-data" }
  }).then((r) => unwrapData<unknown>(r.data));
}

export type RewardConfig = Record<string, unknown> | unknown[];

export const rewardApi = {
  get: (resource: "question-levels" | "lifelines" | "first-login" | "daily-rewards" | "point-discounts") =>
    getOne<RewardConfig>(`/admin/rewards/${resource}`),
  update: (resource: "question-levels" | "lifelines" | "first-login" | "daily-rewards" | "point-discounts", payload: RewardConfig) =>
    apiClient.put(`/admin/rewards/${resource}`, payload).then((r) => unwrapData<RewardConfig>(r.data))
};
