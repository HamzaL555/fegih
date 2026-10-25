/**
 * Removes development leftovers from the database.
 *
 * Two kinds of rows are matched: accounts and catalogue items whose identity is
 * obviously generated (`pm179197…`, `TEST-…`, `Demo kitab`). Everything else —
 * the seeded admin, real accounts, the 819 questions, 6236 Quran verses — is
 * left untouched.
 *
 * Deletion order matters. Prisma refuses to remove a parent row while a child
 * still points at it, and every table below is reached through the ones above
 * it, so this walks the foreign keys from the leaves upwards. It prints what it
 * removed and is safe to run twice.
 *
 *   node --import tsx scripts/clean-test-data.ts [--apply]
 *
 * Without `--apply` it only reports.
 */
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

/**
 * Generated identities from past test runs.
 *
 * Every test address is on the project's own `fegih.az` domain and carries a
 * timestamp in its local part. Matching on the domain rather than an explicit
 * prefix list means a new test script does not leave another account behind.
 * The seeded admin is excluded by name.
 */
const TEST_EMAIL = /^(?!admin$)[\w%+-]+@fegih\.az$/i;
const GENERATED_LOCAL = /\d{6,}/;
const TEST_USERNAME = /^p[a-z]\d{6,}$/i;

/** Catalogue rows that exist purely to exercise checkout. */
const isJunkSku = (sku: string) => /^(TEST|DEMO|TEST-|DEMO-)/i.test(sku) || /^\d{10,}$/.test(sku);
const isJunkTitle = (title: string) => /\b(demo|test)\b/i.test(title);

type Row = { id: string; label: string };

async function main() {
  console.log(apply ? 'Təmizləmə başlayır (--apply)\n' : 'Yalnız hesabat (--apply yoxdur)\n');

  // Prisma has no regex filter on PostgreSQL, and the user table is small, so
  // the identity check happens here rather than in the query.
  const candidates = await prisma.user.findMany({
    select: { id: true, email: true, username: true },
    orderBy: { createdAt: 'asc' },
  });
  const junkUsers = candidates.filter((u) => {
    const email = (u.email ?? '').toLowerCase();
    // A `@fegih.az` address is only a test account if it also looks generated;
    // a hand-made one on that domain should survive.
    if (TEST_EMAIL.test(email) && GENERATED_LOCAL.test(email.split('@')[0] ?? '')) return true;
    return TEST_USERNAME.test(u.username ?? '');
  });
  const junkBooks = await prisma.book.findMany({
    where: { OR: [{ sku: { startsWith: 'TEST' } }, { sku: { startsWith: 'DEMO' } }, { title: { contains: 'Demo kitab' } }, { title: { contains: 'Test kitab' } }] },
    select: { id: true, sku: true, title: true },
  });

  const userIds = junkUsers.map((u) => u.id);
  const bookIds = junkBooks.map((b) => b.id);

  console.log(`Test istifadəçiləri : ${junkUsers.length}`);
  for (const u of junkUsers) console.log(`  ${u.email} (${u.username})`);
  console.log(`Demo/test kitablari: ${junkBooks.length}`);
  for (const b of junkBooks) console.log(`  ${b.sku} — ${b.title}`);

  /** Every table that can reference a user, ordered leaves-first. */
  const perUser = async () => {
    const rows: Record<string, number> = {};
    const count = async (label: string, run: () => Promise<{ count: number }>) => {
      if (!userIds.length) return;
      rows[label] = (await run()).count;
    };
    await count('pointLedgerEntry', () => prisma.pointLedgerEntry.count({ where: { userId: { in: userIds } } }));
    await count('notification', () => prisma.notification.count({ where: { userId: { in: userIds } } }));
    await count('notificationPreference', () => prisma.notificationPreference.count({ where: { userId: { in: userIds } } }));
    await count('deviceToken', () => prisma.deviceToken.count({ where: { userId: { in: userIds } } }));
    await count('userPreference', () => prisma.userPreference.count({ where: { userId: { in: userIds } } }));
    await count('refreshToken', () => prisma.refreshToken.count({ where: { userId: { in: userIds } } }));
    await count('passwordResetToken', () => prisma.passwordResetToken.count({ where: { userId: { in: userIds } } }));
    await count('favoriteQuestion', () => prisma.favoriteQuestion.count({ where: { userId: { in: userIds } } }));
    await count('quizSession', () => prisma.quizSession.count({ where: { userId: { in: userIds } } }));
    await count('dailyReward', () => prisma.dailyReward.count({ where: { userId: { in: userIds } } }));
    await count('userAchievement', () => prisma.userAchievement.count({ where: { userId: { in: userIds } } }));
    await count('missionProgress', () => prisma.missionProgress.count({ where: { userId: { in: userIds } } }));
    await count('bookReview', () => prisma.bookReview.count({ where: { userId: { in: userIds } } }));
    await count('wishlistItem', () => prisma.wishlistItem.count({ where: { userId: { in: userIds } } }));
    await count('userLifelineInventory', () => prisma.userLifelineInventory.count({ where: { userId: { in: userIds } } }));
    await count('tasbeehSession', () => prisma.tasbeehSession.count({ where: { userId: { in: userIds } } }));
    await count('messageThread', () => prisma.messageThread.count({ where: { OR: [{ userId: { in: userIds } }, { messages: { some: { authorId: { in: userIds } } } }] } }));
    return rows;
  };

  const userCounts = await perUser();

  const orderCount = userIds.length
    ? await prisma.order.count({ where: { userId: { in: userIds } } })
    : 0;

  console.log('\nBağlı cədvəllər (silinəcək):');
  for (const [label, n] of Object.entries(userCounts)) if (n) console.log(`  ${label}: ${n}`);
  if (orderCount) console.log(`  order (+ item + payment): ${orderCount}`);

  if (!apply) {
    console.log('\nHeç nə silinmədi. Silmək üçün: node --import tsx scripts/clean-test-data.ts --apply');
    return;
  }

  if (!userIds.length && !bookIds.length) {
    console.log('\nTəmizləmək heç nə yoxdur.');
    return;
  }

  const removed: Row[] = [];
  const step = async (label: string, run: () => Promise<unknown>) => {
    const result = (await run()) as { count?: number };
    const count = result?.count ?? 0;
    if (count) {
      removed.push({ id: String(count), label: `${label}: ${count}` });
      console.log(`  silindi  ${label} — ${count}`);
    }
  };

  console.log('\nSilinir:');

  // --- Orders first: items and payments hang off them.
  const orders = userIds.length
    ? await prisma.order.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    : [];
  const orderIds = orders.map((o) => o.id);
  await step('promoRedemption', () => prisma.promoRedemption.deleteMany({ where: { orderId: { in: orderIds } } }));
  await step('orderItem', () => prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }));
  await step('payment', () => prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } }));
  await step('order', () => prisma.order.deleteMany({ where: { userId: { in: userIds } } }));

  // --- Carts: items hang off them, and the converted carts are referenced by
  //     the orders deleted above.
  const carts = userIds.length
    ? await prisma.cart.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    : [];
  const cartIds = carts.map((c) => c.id);
  await step('cartItem', () => prisma.cartItem.deleteMany({ where: { cartId: { in: cartIds } } }));
  await step('cart', () => prisma.cart.deleteMany({ where: { userId: { in: userIds } } }));

  // --- Quiz sessions: answers, lifelines and inventory hang off them.
  const sessions = userIds.length
    ? await prisma.quizSession.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    : [];
  const sessionIds = sessions.map((s) => s.id);
  // Answers hang off a session question, which cascades from the session.
  await step('sessionQuestion (answers cascade)', () => prisma.sessionQuestion.deleteMany({ where: { sessionId: { in: sessionIds } } }));
  await step('quizSessionAnswer', () => prisma.quizSessionAnswer.deleteMany({ where: { sessionQuestion: { sessionId: { in: sessionIds } } } }));
  await step('quizSessionLifeline', () => prisma.quizSessionLifeline.deleteMany({ where: { sessionId: { in: sessionIds } } }));
  await step('quizSession', () => prisma.quizSession.deleteMany({ where: { userId: { in: userIds } } }));
  await step('userLifelineInventory', () => prisma.userLifelineInventory.deleteMany({ where: { userId: { in: userIds } } }));

  // --- Messages: replies hang off the thread.
  const threads = userIds.length
    ? await prisma.messageThread.findMany({
        where: { OR: [{ userId: { in: userIds } }, { messages: { some: { authorId: { in: userIds } } } }] },
        select: { id: true },
      })
    : [];
  const threadIds = threads.map((t) => t.id);
  await step('message', () => prisma.message.deleteMany({ where: { OR: [{ threadId: { in: threadIds } }, { authorId: { in: userIds } }] } }));
  await step('messageThread', () => prisma.messageThread.deleteMany({ where: { id: { in: threadIds } } }));

  // --- Tasbeeh entries hang off their session.
  const tasbeeh = userIds.length
    ? await prisma.tasbeehSession.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    : [];
  await step('tasbeehEntry', () => prisma.tasbeehEntry.deleteMany({ where: { sessionId: { in: tasbeeh.map((t) => t.id) } } }));
  await step('tasbeehSession', () => prisma.tasbeehSession.deleteMany({ where: { userId: { in: userIds } } }));

  // --- Everything else that hangs directly off the user.
  await step('pointLedgerEntry', () => prisma.pointLedgerEntry.deleteMany({ where: { userId: { in: userIds } } }));
  await step('dailyReward', () => prisma.dailyReward.deleteMany({ where: { userId: { in: userIds } } }));
  await step('userAchievement', () => prisma.userAchievement.deleteMany({ where: { userId: { in: userIds } } }));
  await step('missionProgress', () => prisma.missionProgress.deleteMany({ where: { userId: { in: userIds } } }));
  await step('favoriteQuestion', () => prisma.favoriteQuestion.deleteMany({ where: { userId: { in: userIds } } }));
  await step('bookReview', () => prisma.bookReview.deleteMany({ where: { userId: { in: userIds } } }));
  await step('wishlistItem', () => prisma.wishlistItem.deleteMany({ where: { userId: { in: userIds } } }));
  await step('notification', () => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }));
  await step('notificationPreference', () => prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } }));
  await step('deviceToken', () => prisma.deviceToken.deleteMany({ where: { userId: { in: userIds } } }));
  await step('userPreference', () => prisma.userPreference.deleteMany({ where: { userId: { in: userIds } } }));
  await step('refreshToken', () => prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }));
  await step('passwordResetToken', () => prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } }));
  await step('auditLog', () => prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } }));
  await step('userRole', () => prisma.userRole.deleteMany({ where: { userId: { in: userIds } } }));
  await step('user', () => prisma.user.deleteMany({ where: { id: { in: userIds } } }));

  // --- Catalogue.
  // A book cannot be removed while a cart row still points at it. Those rows go
  // too, which does empty the basket of anyone who had picked up a demo title —
  // reported explicitly rather than silently.
  if (bookIds.length) {
    const stranded = await prisma.cartItem.findMany({
      where: { bookId: { in: bookIds } },
      select: { quantity: true, cart: { select: { user: { select: { email: true } } } } },
    });
    for (const item of stranded) {
      console.log(`  səbətdən demo kitab çıxarıldı: ${item.cart.user?.email ?? 'qonaq'} (${item.quantity} ədəd)`);
    }
  }
  await step('cartItem (junk book)', () => prisma.cartItem.deleteMany({ where: { bookId: { in: bookIds } } }));
  await step('bookCategoryLink', () => prisma.bookCategoryLink.deleteMany({ where: { bookId: { in: bookIds } } }));
  await step('promoBook', () => prisma.promoBook.deleteMany({ where: { bookId: { in: bookIds } } }));
  await step('wishlistItem (book)', () => prisma.wishlistItem.deleteMany({ where: { bookId: { in: bookIds } } }));
  await step('book', () => prisma.book.deleteMany({ where: { id: { in: bookIds } } }));

  console.log(`\nCəmi ${removed.reduce((sum, r) => sum + Number(r.id), 0)} sətir silindi.`);
  console.log('Yoxlama üçün: node --import tsx scripts/clean-test-data.ts');
}

main()
  .catch((error) => {
    console.error('Xəta:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());