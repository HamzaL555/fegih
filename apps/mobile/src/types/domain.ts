export type EntityId = string;

export type ThemeMode = 'light' | 'dark' | 'system';
export type AppLocale = 'az' | 'tr' | 'en' | 'ar';

export interface UserProfile {
  id: EntityId;
  username: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImage?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  totalPoints?: number;
  role?: { id: EntityId; name: string };
  points?: number;
  level?: number;
  xp?: number;
  streak?: number;
  longestStreak?: number;
  totalGames?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  favorites?: Array<string | { bookId?: string; id?: string }>;
}

export interface AuthCredentials {
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  displayName?: string;
  email?: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  preferredLocale?: AppLocale;
}

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  user?: UserProfile;
  expiresAt?: string;
}

export interface Book {
  id: EntityId;
  title: string;
  subtitle?: string;
  author: string;
  description?: string;
  image?: string;
  coverImageUrl?: string;
  coverImage?: string;
  coverUrl?: string;
  price?: number;
  finalPrice?: number;
  currency?: string;
  stock?: number;
  inStock?: boolean;
  categoryId?: EntityId;
  category?: Category;
  isFeatured?: boolean;
  rating?: number;
  reviewCount?: number;
  addedAt?: string;
  createdAt?: string;
}

export interface Category {
  id: EntityId;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  iconUrl?: string;
  bookCount?: number;
  questionCount?: number;
}

export interface CategoriesData {
  books: Category[];
  questions: Category[];
}

export interface QuestionOption {
  id: EntityId;
  text: string;
}

export interface Question {
  id: EntityId;
  text: string;
  prompt?: string;
  difficulty?: string | number;
  image?: string;
  points?: number;
  index?: number;
  /** Per-question budget returned by `GET /quiz/:sessionId`. */
  timeLimitSeconds?: number;
  options: QuestionOption[];
  category?: Category;
  level?: { id: EntityId; name: string; difficulty: number; points?: number };
  categoryId?: EntityId;
  levelId?: EntityId;
}

export interface QuizGame {
  /** Session id. Every quiz mutation (`answer`, `finish`, `lifelines`) uses this. */
  id: EntityId;
  /** Id of the `QuizGame` *configuration* row this session belongs to. */
  gameId?: EntityId;
  name?: string;
  status?: string;
  /** Always `SUAL_CAVAB`: 15 levels, 10 questions each, level N worth N points. */
  mode?: 'SUAL_CAVAB';
  /** 1-based level the run is on. */
  level?: number;
  levelName?: string | null;
  /** Questions in the current level (10). */
  levelQuestions?: number;
  /** Questions already answered inside the current level. */
  levelAnswered?: number;
  levelCorrect?: number;
  /** Points a correct answer is worth at this level (the level number). */
  levelPointsPerAnswer?: number;
  /** Most points obtainable inside this level. */
  levelMaxPoints?: number;
  /** Score for the run. A wrong answer resets it to 0. */
  score?: number;
  /** Highest score in a perfect run (1200). */
  maxScore?: number;
  /** Per-level point ladder for the UI. */
  levelLadder?: Array<{ level: number; pointsPerAnswer: number; maxPoints: number }>;
  questionsPerLevel?: number;
  maxLevels?: number;
  currentQuestion?: Question | null;
  question?: Question;
  questionNumber?: number;
  totalQuestions?: number;
  answeredCount?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  earnedPoints?: number;
  points?: number;
  expiresAt?: string;
  /** Lifelines usable on the question in front of the player. */
  availableLifelines?: string[];
  /** Lifelines already spent, so the UI can show why a button disappeared. */
  spentLifelines?: string[];
}

export interface LifelineUseResult extends QuizGame {
  type?: string;
  eliminatedAnswerIds?: EntityId[];
  hint?: string;
  extraSeconds?: number;
  armedForQuestionId?: EntityId;
}

export interface AnswerResult {
  correct?: boolean;
  skipped?: boolean;
  /** A wrong answer (or a skipped question) ends the run and zeroes the score. */
  gameOver?: boolean;
  reason?: 'WRONG' | 'SKIPPED' | 'COMPLETED' | null;
  /** The whole 15-level ladder was cleared without a mistake. */
  completedRun?: boolean;
  /** 10/10 reached: the run moves on to the next level. */
  levelCleared?: boolean;
  levelAdvanced?: boolean;
  nextLevel?: number;
  level?: number;
  levelName?: string | null;
  levelPointsPerAnswer?: number;
  /** Score before a wrong answer wiped it. */
  scoreBeforeReset?: number;
  resetScore?: number;
  protectedBySecondChance?: boolean;
  correctAnswerId?: EntityId | null;
  explanation?: string | null;
  pointsEarned?: number;
  pointsAwarded?: number;
  totalPoints?: number;
  userPoints?: number;
  nextQuestion?: Question | null;
  stats?: { correctAnswers: number; wrongAnswers: number };
  game?: QuizGame;
}

export interface LeaderboardEntry {
  id?: EntityId;
  userId?: EntityId;
  username: string;
  profileImage?: string;
  avatarUrl?: string;
  displayName?: string;
  rank?: number;
  points: number;
  level?: number;
  isCurrentUser?: boolean;
}

export interface Reward {
  id: EntityId;
  title?: string;
  name?: string;
  description?: string;
  icon?: string;
  iconUrl?: string;
  points?: number;
  pointsCost?: number;
  basePoints?: number;
  bonusPoints?: number;
  day?: number;
  streakDay?: number;
  claimed?: boolean;
  claimedAt?: string;
  lifeline?: { id: EntityId; name: string; type?: string };
}

export interface RewardsData {
  points: number;
  streak: number;
  longestStreak?: number;
  canClaim: boolean;
  currentDay: number;
  rewards: Reward[];
  history: Array<{ id: EntityId; claimedAt?: string; dailyRewardId?: EntityId }>;
}

export interface Achievement {
  id: EntityId;
  code?: string;
  name: string;
  title?: string;
  description?: string;
  iconUrl?: string;
  type?: string;
  condition?: unknown;
  pointsReward?: number;
  unlocked?: boolean;
  unlockedAt?: string | null;
  progress?: number;
  target?: number;
}

export interface Mission {
  id: EntityId;
  title: string;
  description?: string;
  type?: string;
  current: number;
  target: number;
  percent?: number;
  pointsReward?: number;
  points?: number;
  completed?: boolean;
  rewardClaimed?: boolean;
  targetCount?: number;
  progress?: number;
}

export interface CartItem {
  id: EntityId;
  bookId: EntityId;
  book?: Book;
  title?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  lineTotal?: number;
  currency?: string;
}

export type MessageThreadStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

export interface MessageItem {
  id: EntityId;
  body: string;
  authorRole: 'USER' | 'ADMIN';
  createdAt: string;
  isRead: boolean;
}

export interface MessageThread {
  id: EntityId;
  subject: string;
  status: MessageThreadStatus;
  /** Unread messages on the reader's side. */
  unread: number;
  lastMessageAt: string;
  createdAt: string;
  messageCount?: number;
  messages?: MessageItem[];
  lastMessage?: { body: string; authorRole: 'USER' | 'ADMIN'; createdAt: string };
}

export type MessageThreadDetail = MessageThread & { messages: MessageItem[]; messageCount: number };

export interface Cart {
  id?: EntityId;
  items: CartItem[];
  subtotal?: number;
  total?: number;
  currency?: string;
  itemCount?: number;
  /** Loyalty tier discount applied to the cart. */
  points?: number;
  pointDiscount?: number;
  discountPercent?: number;
  discountTierPoints?: number;
  nextTierPoints?: number | null;
  nextTierPercent?: number | null;
  pointsToNextTier?: number;
  shippingFee?: number;
}

export interface OrderItem {
  id?: EntityId;
  bookId: EntityId;
  title: string;
  author?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  total?: number;
  lineTotal?: number;
  book?: Book;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  city: string;
  address: string;
  postalCode?: string;
  note?: string;
}

export interface Order {
  id: EntityId;
  orderStatus?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  orderNumber?: string;
  /** Loyalty tier snapshot recorded when the order was placed. */
  discountTierPoints?: number;
  pointDiscountPercent?: number;
  items: OrderItem[];
  subtotal?: number;
  discount?: number;
  shippingFee?: number;
  total?: number;
  totalAmount?: number;
  currency?: string;
  shippingAddress?: ShippingAddress;
  createdAt?: string;
  placedAt?: string;
  updatedAt?: string;
}

export interface OrderCreationResult {
  order: Order;
  payment?: { url?: string; sessionId?: string; [key: string]: unknown };
}

export interface QuranAyah {
  id?: EntityId;
  surahNumber: number;
  ayahNumber: number;
  number?: number;
  reference?: string;
  arabic: string;
  arabicText?: string;
  translation: string;
  translationText?: string;
  juz?: number;
  page?: number;
  isSajda?: boolean;
  surah?: string;
  englishName?: string;
  englishNameTranslation?: string;
}

export interface QuranSurah {
  number: number;
  surahNumber?: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  ayahCount: number;
  ayahs?: QuranAyah[];
}

export interface DailyAyah {
  id?: EntityId;
  day?: string;
  surahNumber?: number;
  ayahNumber?: number;
  reference?: string;
  arabicText?: string;
  translationText?: string;
  transliteration?: string;
  audioUrl?: string;
  sourceUrl?: string;
  // These aliases allow the same component to consume an explicitly
  // transformed API response without inventing content.
  arabic?: string;
  text?: string;
  ayah?: string;
  surah?: string;
  translation?: string;
}

export interface IslamicInfoItem {
  id?: EntityId;
  day?: string;
  title: string;
  summary?: string;
  content?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
}

/** Entry in the curated knowledge library served by `/islamic/info/library`. */
export interface IslamicArticle {
  id: string;
  slug: string;
  category: 'iman' | 'ibadet' | 'ahlak' | 'elmi' | 'tarix' | 'hadis';
  title: string;
  summary: string;
  content: string;
  source?: string;
  reference?: string;
}

/** Hadith from the agreed collections, always shipped with its citation. */
export interface Hadith {
  id: string;
  arabic: string;
  text: string;
  narrator?: string;
  source: string;
  /** Verifiable reference, e.g. "Buxari 1; Müslim 1907". */
  takhrij: string;
  topic: 'iman' | 'namaz' | 'zakat' | 'ahlak' | 'elm' | 'quran' | 'dua' | 'peygamber';
  grade: 'sahih' | 'hasen';
}

export interface HijriMonthDay {
  hijriDay: number;
  hijriMonth: number;
  hijriYear: number;
  gregorian: string;
  isToday: boolean;
  weekday: number;
  holidays: string[];
  events: string[];
}

export interface HijriMonth {
  hijriYear: number;
  hijriMonth: number;
  monthName: { az: string; tr: string; en: string; ar: string };
  currentHijri: { year: number; month: number; day: number };
  days: HijriMonthDay[];
}

export interface UpcomingOccasion {
  key: string;
  hijriDate: string;
  gregorian: string;
  title: string;
  daysAway: number;
}

export interface CalendarDay {
  id?: EntityId;
  date?: string;
  title: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  hijriDate?: string;
  hijri?: string;
  gregorian?: string;
  location?: string;
  venue?: string;
  imageUrl?: string;
  registrationUrl?: string;
  allDay?: boolean;
  day?: string;
  month?: string;
  year?: string;
  isToday?: boolean;
  holiday?: string;
  events?: string[];
}

export interface PrayerTimes {
  /** Requested day as `YYYY-MM-DD`. */
  date?: string;
  /** Human-readable date from the provider, e.g. "01 Oct 2026". */
  dateLabel?: string;
  /** Weekday name, e.g. "Thursday". */
  weekday?: string;
  /** Hijri date, e.g. "20-04-1448". */
  hijriDate?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  method?: number;
  fajr?: string;
  sunrise?: string;
  dhuhr?: string;
  asr?: string;
  maghrib?: string;
  isha?: string;
  Fajr?: string;
  Sunrise?: string;
  Dhuhr?: string;
  Asr?: string;
  Maghrib?: string;
  Isha?: string;
  meta?: { timezone?: string };
}

export interface AppNotification {
  id: EntityId;
  title: string;
  body: string;
  message?: string;
  type?: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  readAt?: string | null;
  read?: boolean;
  createdAt?: string;
  sentAt?: string;
}

export interface NotificationPreferencesData {
  [key: string]: boolean;
}

export interface TasbeehSession {
  id: EntityId;
  name?: string;
  status?: 'ACTIVE' | 'COMPLETED' | string;
  /**
   * The API contract is `currentCount` / `targetCount` / `totalCount`. The old
   * `count` / `total` / `target` aliases never existed server-side, so the
   * counter rendered a permanent 0.
   */
  currentCount: number;
  targetCount: number;
  totalCount: number;
  completed?: boolean;
  completedAt?: string | null;
  lastCountedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateQuizPayload {
  categoryId?: EntityId;
  levelId?: EntityId;
  level?: number;
  questionCount?: number;
  /**
   * The session the player just lost. Its questions are kept out of the new
   * draw so a restart really does serve different questions.
   */
  excludeSessionId?: EntityId;
}

export interface AnswerPayload {
  questionId?: EntityId;
  /** `null` is the wire shape the API expects for a skipped question. */
  answerId: EntityId | null;
  skipped?: boolean;
}

export interface UseQuizPayload {
  type: string;
}

export interface CreateTasbeehPayload {
  name?: string;
  target?: number;
}

export interface AddTasbeehCountPayload {
  count?: number;
}
