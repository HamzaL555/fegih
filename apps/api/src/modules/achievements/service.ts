import { Prisma } from '../../config/prisma-client.js';
import { applyPointChange } from '../rewards/points.js';

interface AchievementCondition { metric: string; target: number; lifelineType?: 'FIFTY_FIFTY' | 'SECOND_CHANCE' | 'HINT' | 'SKIP' | 'EXTRA_TIME'; lifelineQuantity?: number }

function metric(user: { totalGames: number; correctAnswers: number; wrongAnswers: number; streak: number; longestStreak: number; points: number; xp: number }, type: string) {
  switch (type) {
    case 'TOTAL_GAMES': case 'QUIZ_GAMES': case 'FIRST_QUIZ': return user.totalGames;
    case 'CORRECT_ANSWERS': return user.correctAnswers;
    case 'TOTAL_ANSWERS': return user.correctAnswers + user.wrongAnswers;
    case 'STREAK': return user.streak;
    case 'LONGEST_STREAK': return user.longestStreak;
    case 'POINTS': return user.points;
    case 'XP': return user.xp;
    default: return -1;
  }
}

export async function evaluateAchievements(tx: Prisma.TransactionClient, userId: string) {
  const [user, achievements, unlocked] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, totalGames: true, correctAnswers: true, wrongAnswers: true, streak: true, longestStreak: true, points: true, xp: true } }),
    tx.achievement.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
    tx.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);
  const unlockedIds = new Set(unlocked.map((item) => item.achievementId));
  const newlyUnlocked: Array<{ id: string; name: string; rewardPoints: number }> = [];

  for (const achievement of achievements) {
    if (unlockedIds.has(achievement.id)) continue;
    const condition = achievement.condition as unknown as AchievementCondition;
    const value = metric(user, condition.metric);
    if (value < 0 || value < condition.target) continue;
    const userAchievement = await tx.userAchievement.create({ data: { userId, achievementId: achievement.id, progress: value, progressTarget: condition.target, unlockedAt: new Date() } });
    if (achievement.pointsReward > 0) {
      await applyPointChange(tx, { userId, amount: achievement.pointsReward, type: 'ACHIEVEMENT', description: `Achievement: ${achievement.name}`, sourceType: 'ACHIEVEMENT', sourceId: achievement.id, idempotencyKey: `achievement:${userAchievement.id}` });
    }
    if (condition.lifelineType && (condition.lifelineQuantity ?? 0) > 0) {
      await tx.userLifelineInventory.upsert({
        where: { userId_type: { userId, type: condition.lifelineType } },
        update: { quantity: { increment: condition.lifelineQuantity! }, version: { increment: 1 } },
        create: { userId, type: condition.lifelineType, quantity: condition.lifelineQuantity! },
      });
    }
    newlyUnlocked.push({ id: achievement.id, name: achievement.name, rewardPoints: achievement.pointsReward });
  }
  return newlyUnlocked;
}
