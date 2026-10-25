export const queryKeys = {
  dashboard: ["admin", "dashboard"] as const,
  users: (params?: unknown) => ["admin", "users", params] as const,
  questions: (params?: unknown) => ["admin", "questions", params] as const,
  questionCategories: ["admin", "question-categories"] as const,
  questionLevels: ["admin", "question-levels"] as const,
  books: (params?: unknown) => ["admin", "books", params] as const,
  bookCategories: ["admin", "book-categories"] as const,
  orders: (params?: unknown) => ["admin", "orders", params] as const,
  achievements: (params?: unknown) => ["admin", "achievements", params] as const,
  missions: (params?: unknown) => ["admin", "missions", params] as const,
  notifications: (params?: unknown) => ["admin", "notifications", params] as const,
  messages: (params?: unknown) => ["admin", "messages", params] as const,
  message: (id: string) => ["admin", "messages", id] as const,
  settings: ["admin", "settings"] as const,
  reward: (resource: string) => ["admin", "rewards", resource] as const
};
