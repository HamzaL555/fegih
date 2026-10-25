import type { Book, DashboardData, Question } from "@/types/admin";
import { asNumber, firstString, isRecord } from "@/lib/utils";

const knownDashboardLabels: Record<string, string> = {
  totalUsers: "İstifadəçilər",
  users: "İstifadəçilər",
  totalQuestions: "Suallar",
  questions: "Suallar",
  totalBooks: "Kitablar",
  books: "Kitablar",
  totalOrders: "Sifarişlər",
  orders: "Sifarişlər",
  pendingOrders: "Gözləyən sifarişlər",
  activeUsers: "Aktiv istifadəçilər",
  activeUsersToday: "Bu gün aktiv istifadəçilər",
  quizGames: "Oyunlar",
  totalSales: "Ümumi satış",
  pointsDistributed: "Paylanan xal",
  pointsSpent: "Xarc edilmiş xal",
  reviews: "Rəylər",
  averageBookRating: "Orta kitab reytinqi",
  totalPoints: "Toplam xal"
};

function asChartData(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const label = firstString(item.label, item.name, item.date, item.month, item.day);
    const numeric = asNumber(item.value ?? item.count ?? item.total ?? item.plays ?? item.quantity ?? item.games ?? item.answers ?? item.orders, Number.NaN);
    if (!label || !Number.isFinite(numeric)) return [];
    return [{ label, value: numeric }];
  });
}

export function normalizeDashboard(value: unknown): DashboardData {
  if (!isRecord(value)) {
    return { stats: [], activity: [], distribution: [], recentActivity: [] };
  }

  const sourceStats = isRecord(value.totals) ? value.totals : isRecord(value.stats) ? value.stats : value;
  const stats = Object.entries(sourceStats)
    .filter(([key]) => !["activity", "chart", "charts", "distribution", "questionDistribution", "recentActivity", "stats", "totals", "orderStatuses"].includes(key))
    .flatMap(([key, raw]) => {
      const numeric = asNumber(raw, Number.NaN);
      if (!Number.isFinite(numeric)) return [];
      return [{
        label: firstString(knownDashboardLabels[key], key.replace(/([A-Z])/g, " $1")) || key,
        value: numeric,
        change: isRecord(raw) ? null : null
      }];
    });

  const activitySource = value.activity ?? value.chart ?? value.charts;
  const activity = isRecord(activitySource)
    ? asChartData(activitySource.userGrowth ?? activitySource.activity ?? activitySource.questions ?? activitySource.users ?? activitySource.quizActivity)
    : asChartData(activitySource);
  const distribution = asChartData(
    value.distribution
      ?? value.questionDistribution
      ?? (isRecord(value.charts) ? value.charts.popularQuizCategories : undefined)
  );

  const recent = Array.isArray(value.recentActivity) ? value.recentActivity : [];
  const recentActivity = recent.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = firstString(item.id, item.userId, item.orderId);
    const label = firstString(item.label, item.title, item.name, item.email, item.action);
    if (!id || !label) return [];
    return [{
      id,
      label,
      detail: firstString(item.detail, item.description),
      createdAt: firstString(item.createdAt, item.date)
    }];
  });

  return { stats, activity, distribution, recentActivity };
}

export function questionText(question: Question) {
  return question.question || question.questionText || question.text || "—";
}

export function relationName(value: Book["category"] | Question["category"] | Question["level"]) {
  if (typeof value === "string") return value;
  return value?.name || "—";
}

export function bookImage(book: Book) {
  return book.imageUrl || book.coverUrl || book.coverImageUrl || book.image || null;
}

export function achievementName(value: { name?: string | null; title?: string | null }) {
  return value.name || value.title || "—";
}

export function missionName(value: { name?: string | null; title?: string | null }) {
  return value.name || value.title || "—";
}
