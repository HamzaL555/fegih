import { apiClient, unwrap, unwrapPage } from '@/api/client';
import type { ApiSuccess, Paginated, QueryFilters } from '@/types/api';
import type {
  Achievement,
  AnswerPayload,
  AnswerResult,
  AppNotification,
  AuthCredentials,
  AuthData,
  Book,
  CalendarDay,
  Cart,
  CartItem,
  Category,
  CreateQuizPayload,
  CreateTasbeehPayload,
  DailyAyah,
  EntityId,
  HijriMonth,
  Hadith,
  IslamicArticle,
  IslamicInfoItem,
  MessageItem,
  MessageThread,
  MessageThreadDetail,
  LeaderboardEntry,
  LifelineUseResult,
  Mission,
  Order,
  PrayerTimes,
  Question,
  QuranAyah,
  QuranSurah,
  QuizGame,
  RegisterPayload,
  Reward,
  TasbeehSession,
  UpcomingOccasion,
  UseQuizPayload,
  UserProfile,
} from '@/types/domain';

/**
 * The API accepts a single `identifier` that matches e-mail, phone, or
 * username. The previous email/phone sniffing sent a field the schema then
 * dropped on some payloads.
 */
function loginPayload(credentials: AuthCredentials): { identifier: string; password: string } {
  return { identifier: credentials.identifier.trim(), password: credentials.password };
}

export const preferencesApi = {
  get: () => unwrap(apiClient.get<ApiSuccess<Record<string, unknown>>>('/settings/preferences')),
  update: (payload: Record<string, unknown>) => unwrap(apiClient.put<ApiSuccess<Record<string, unknown>>>('/settings/preferences', payload)),
};

export const authApi = {
  register: (payload: RegisterPayload) =>
    unwrap(apiClient.post<ApiSuccess<AuthData>>('/auth/register', payload)),
  login: (payload: AuthCredentials) =>
    unwrap(apiClient.post<ApiSuccess<AuthData>>('/auth/login', loginPayload(payload))),
  /**
   * The API revokes the refresh token only when it receives one, so signing out
   * without it left a live 30-day token in Postgres.
   */
  logout: (refreshToken?: string | null) =>
    apiClient.post('/auth/logout', refreshToken ? { refreshToken } : {}),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiClient.post('/auth/change-password', payload),
};

export const usersApi = {
  me: () => unwrap(apiClient.get<ApiSuccess<UserProfile>>('/users/me')),
  update: (payload: Partial<UserProfile>) =>
    unwrap(apiClient.patch<ApiSuccess<UserProfile>>('/users/me', payload)),
  remove: () => apiClient.delete('/users/me'),
};

export const questionsApi = {
  list: (filters: QueryFilters = {}) =>
    unwrapPage<Question>(apiClient.get<ApiSuccess<Paginated<Question>>>('/questions', { params: filters })),
};

export const quizApi = {
  start: (payload: CreateQuizPayload = {}) =>
    unwrap(apiClient.post<ApiSuccess<QuizGame>>('/quiz/start', payload)),
  /** `sessionId` is the *session* id returned as `id`, not the game config id. */
  answer: (sessionId: EntityId, payload: AnswerPayload) =>
    unwrap(apiClient.post<ApiSuccess<AnswerResult>>(`/quiz/${sessionId}/answer`, payload)),
  finish: (sessionId: EntityId) =>
    unwrap(apiClient.post<ApiSuccess<QuizGame>>(`/quiz/${sessionId}/finish`)),
  useLifeline: (sessionId: EntityId, payload: UseQuizPayload) =>
    unwrap(apiClient.post<ApiSuccess<LifelineUseResult>>(`/quiz/${sessionId}/lifelines/${payload.type}/use`, payload)),
};

export const leaderboardApi = {
  list: (filters: QueryFilters = {}) =>
    unwrapPage<LeaderboardEntry>(apiClient.get<ApiSuccess<Paginated<LeaderboardEntry>>>('/leaderboard', { params: filters })),
};

export const rewardsApi = {
  list: (filters: QueryFilters = {}) =>
    unwrapPage<Reward>(apiClient.get<ApiSuccess<Paginated<Reward>>>('/rewards', { params: filters })),
  claim: (rewardId: EntityId) =>
    unwrap(apiClient.post<ApiSuccess<Reward>>('/rewards/claim', { rewardId })),
};

export const achievementsApi = {
  list: (filters: QueryFilters = {}) =>
    unwrapPage<Achievement>(apiClient.get<ApiSuccess<Paginated<Achievement>>>('/achievements', { params: filters })),
};

export const missionsApi = {
  list: (filters: QueryFilters = {}) =>
    unwrapPage<Mission>(apiClient.get<ApiSuccess<Paginated<Mission>>>('/missions', { params: filters })),
};

export const booksApi = {
  list: (filters: QueryFilters = {}) =>
    unwrapPage<Book>(apiClient.get<ApiSuccess<Paginated<Book>>>('/books', { params: filters })),
  byId: (id: EntityId) => unwrap(apiClient.get<ApiSuccess<Book>>(`/books/${id}`)),
  addToWishlist: async (id: EntityId) => { await apiClient.post(`/books/${id}/wishlist`); },
  removeFromWishlist: async (id: EntityId) => { await apiClient.delete(`/books/${id}/wishlist`); },
};

export const categoriesApi = {
  list: () => unwrap(apiClient.get<ApiSuccess<Paginated<Category> | Category[]>>('/categories')),
};
export const cartApi = {
  get: () => unwrap(apiClient.get<ApiSuccess<Cart>>('/cart')),
  addItem: (payload: { bookId: EntityId; quantity: number }) =>
    unwrap(apiClient.post<ApiSuccess<Cart>>('/cart/items', payload)),
  updateItem: (itemId: EntityId, payload: { quantity: number }) =>
    unwrap(apiClient.patch<ApiSuccess<Cart>>(`/cart/items/${itemId}`, payload)),
  removeItem: (itemId: EntityId) =>
    unwrap(apiClient.delete<ApiSuccess<Cart>>(`/cart/items/${itemId}`)),
  clear: () => unwrap(apiClient.delete<ApiSuccess<Cart>>('/cart')),
};

export interface PointDiscountResponse {
  points: number;
  discountPercent: number;
  tierPoints: number;
  nextTierPoints: number | null;
  nextTierPercent: number | null;
  pointsToNextTier: number;
  tiers: Array<{ tier: { points: number; discountPercent: number; label?: string }; reached: boolean; current: boolean }>;
}

/**
 * Support conversations. The user opens a thread with a question, an admin
 * answers from the admin panel, and a reply raises the inbox badge plus a push
 * notification.
 */
export const messagesApi = {
  list: () => unwrap(apiClient.get<ApiSuccess<{ threads: MessageThread[]; unreadCount: number }>>('/messages')),
  unreadCount: () => unwrap(apiClient.get<ApiSuccess<{ unreadCount: number }>>('/messages/unread-count')),
  detail: (threadId: EntityId) => unwrap(apiClient.get<ApiSuccess<MessageThreadDetail>>(`/messages/${threadId}`)),
  create: (payload: { subject: string; body: string }) =>
    unwrap(apiClient.post<ApiSuccess<MessageThreadDetail>>('/messages', payload)),
  reply: (threadId: EntityId, body: string) =>
    unwrap(apiClient.post<ApiSuccess<MessageItem & { thread: { subject: string; status: string } }>>(`/messages/${threadId}/reply`, { body })),
};

/** Loyalty ladder: the discount the balance earns and the next step towards it. */
export const storeApi = {
  pointDiscount: () => unwrap(apiClient.get<ApiSuccess<PointDiscountResponse>>('/store/point-discount')),
  pointDiscountTiers: () => unwrap(apiClient.get<ApiSuccess<{ tiers: Array<{ points: number; discountPercent: number; label?: string }> }>>('/store/point-discount/tiers')),
};

export const ordersApi = {
  list: (filters: QueryFilters = {}) =>
    unwrapPage<Order>(apiClient.get<ApiSuccess<Paginated<Order>>>('/orders', { params: filters })),
  create: (payload: { shippingAddress?: { fullName: string; phone: string; city: string; address: string; postalCode?: string; note?: string }; promoCode?: string; paymentMethod?: 'CARD' | 'CASH_ON_DELIVERY' | 'BANK_TRANSFER'; card?: { number: string; expiry: string; cvc: string; name?: string } }) =>
    unwrap(apiClient.post<ApiSuccess<{ order: Order; payment?: { url?: string | null; sessionId?: string | null } | null; requiresManualPayment?: boolean; mocked?: boolean; notifiedEmail?: string; emailDelivered?: boolean }>>('/orders', payload)),
  /** Which payment methods work right now; card needs a configured provider. */
  paymentConfig: () =>
    unwrap(apiClient.get<ApiSuccess<{ card: boolean; stripe: boolean; mocked: boolean; methods: Array<{ id: string; label: string; available: boolean }>; message?: string; notificationEmail?: string }>>('/orders/payment-config')),
};

export const islamicApi = {
  dailyAyah: (filters: QueryFilters = {}) =>
    unwrap(apiClient.get<ApiSuccess<DailyAyah>>('/daily-ayah', { params: filters })),
  info: (filters: QueryFilters = {}) =>
    unwrap(apiClient.get<ApiSuccess<IslamicInfoItem | IslamicInfoItem[]>>('/islamic-info', { params: filters })),
  articleLibrary: () => unwrap(apiClient.get<ApiSuccess<IslamicArticle[]>>('/islamic/info/library')),
  article: (slug: string) => unwrap(apiClient.get<ApiSuccess<IslamicArticle>>(`/islamic/info/library/${slug}`)),
  /** Topics come from the fixed enum, so the list is a plain array. */
  hadiths: (topic?: string) => unwrap(apiClient.get<ApiSuccess<Hadith[]>>('/islamic/hadiths', { params: topic ? { topic } : undefined })),
  hadithTopics: ['iman', 'namaz', 'zakat', 'ahlak', 'elm', 'quran', 'dua', 'peygamber'] as const,
  calendar: (filters: QueryFilters = {}) =>
    unwrap(apiClient.get<ApiSuccess<CalendarDay | CalendarDay[]>>('/calendar', { params: filters })),
  hijriMonth: (params: { year?: number; month?: number; lang?: string }) =>
    unwrap(apiClient.get<ApiSuccess<HijriMonth>>('/islamic/calendar/month', { params })),
  upcomingOccasions: () =>
    unwrap(apiClient.get<ApiSuccess<UpcomingOccasion[]>>('/islamic/calendar/upcoming')),
  prayerTimes: (filters: { latitude: number; longitude: number; date?: string }) =>
    unwrap(apiClient.get<ApiSuccess<PrayerTimes>>('/islamic/prayer-times', { params: filters })),
};

export const notificationsApi = {
  list: (filters: QueryFilters = {}) =>
    unwrapPage<AppNotification>(apiClient.get<ApiSuccess<Paginated<AppNotification>>>('/notifications', { params: filters })),
  markRead: (notificationId: EntityId) =>
    apiClient.patch(`/notifications/${notificationId}/read`),
  markAllRead: () => apiClient.patch('/notifications/read'),
  preferences: () => unwrap(apiClient.get<ApiSuccess<Record<string, boolean>>>('/notifications/preferences')),
  updatePreferences: (payload: Record<string, boolean>) => unwrap(apiClient.put<ApiSuccess<Record<string, boolean>>>('/notifications/preferences', payload)),
};

/**
 * `locale` is the language the user picked in Settings, so ayahs come back in
 * that language: az = Əlikhan Musayev, tr = Yasar Nuri Öztürk, en = Asad.
 * Arabic users get the Uthmani text itself.
 */
export const quranApi = {
  daily: (locale?: string) => unwrap(apiClient.get<ApiSuccess<QuranAyah>>('/quran/daily', { params: locale ? { locale } : undefined })),
  surahs: (search?: string) => unwrap(apiClient.get<ApiSuccess<QuranSurah[]>>('/quran/surahs', { params: search ? { search } : undefined })),
  surah: (number: number, page = 1, limit = 50, locale?: string) => unwrap(apiClient.get<ApiSuccess<QuranSurah & { ayahs: QuranAyah[] }>>(`/quran/surahs/${number}`, { params: { page, limit, ...(locale ? { locale } : {}) } })),
  ayah: (surahNumber: number, ayahNumber: number, locale?: string) => unwrap(apiClient.get<ApiSuccess<QuranAyah>>(`/quran/surahs/${surahNumber}/ayahs/${ayahNumber}`, { params: locale ? { locale } : undefined })),
  search: (query: string, locale?: string) => unwrap(apiClient.get<ApiSuccess<QuranAyah[]>>('/quran/search', { params: { q: query, ...(locale ? { locale } : {}) } })),
  locales: () => unwrap(apiClient.get<ApiSuccess<{ locales: string[]; default: string }>>('/quran/locales')),
};

export const tasbeehApi = {
  sessions: (filters: QueryFilters = {}) =>
    unwrapPage<TasbeehSession>(apiClient.get<ApiSuccess<Paginated<TasbeehSession>>>('/tasbeeh/sessions', { params: filters })),
  createSession: (payload: CreateTasbeehPayload = {}) =>
    unwrap(apiClient.post<ApiSuccess<TasbeehSession>>('/tasbeeh/sessions', payload)),
  addCount: (sessionId: EntityId, payload: { count?: number } = {}) =>
    unwrap(apiClient.post<ApiSuccess<TasbeehSession>>('/tasbeeh/counts', { sessionId, ...payload })),
  reset: (sessionId: EntityId) =>
    unwrap(apiClient.post<ApiSuccess<TasbeehSession>>(`/tasbeeh/sessions/${sessionId}/reset`)),
  remove: (sessionId: EntityId) => apiClient.delete(`/tasbeeh/sessions/${sessionId}`),
};

export type { CartItem };
