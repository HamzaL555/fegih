import { Prisma } from '../../config/prisma-client.js';
import { applyPointChange } from '../rewards/points.js';

export type MissionEvent = 'QUIZ_PLAYED' | 'QUESTION_ANSWERED' | 'CORRECT_ANSWER' | 'LOGIN' | 'AYAH_READ' | 'INFO_READ';
interface MissionCondition { lifelineType?: 'FIFTY_FIFTY' | 'SECOND_CHANCE' | 'HINT' | 'SKIP' | 'EXTRA_TIME'; lifelineQuantity?: number }

function matches(metric: string, event: MissionEvent) {
  if (metric === 'ANY' || metric === event) return true;
  const aliases: Record<MissionEvent, string[]> = {
    QUIZ_PLAYED: ['PLAY_QUIZ', 'PLAY_QUIZZES'],
    QUESTION_ANSWERED: ['ANSWER_QUESTIONS', 'QUESTIONS_ANSWERED'],
    CORRECT_ANSWER: ['CORRECT_ANSWERS', 'GET_CORRECT_ANSWERS'],
    LOGIN: ['DAILY_LOGIN', 'LOGIN_TODAY'],
    AYAH_READ: ['READ_DAILY_AYAH', 'DAILY_AYAH'],
    INFO_READ: ['READ_ISLAMIC_INFO', 'DAILY_INFO'],
  };
  return aliases[event].includes(metric);
}

function dayStart(date = new Date()) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

export async function updateMissions(tx: Prisma.TransactionClient, userId: string, event: MissionEvent, amount = 1) {
  const now = new Date();
  const missions = await tx.mission.findMany({ where: { isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] } });
  const completed: Array<{ id: string; name: string; rewardPoints: number }> = [];
  for (const mission of missions) {
    if (!matches(mission.metric, event)) continue;
    const existing = await tx.missionProgress.findUnique({ where: { userId_missionId: { userId, missionId: mission.id } } });
    let progress;
    if (!existing) {
      progress = await tx.missionProgress.create({ data: { userId, missionId: mission.id, currentCount: amount, lastActivityAt: now } });
    } else if (mission.type === 'DAILY' && existing.lastActivityAt < dayStart(now)) {
      progress = await tx.missionProgress.update({ where: { id: existing.id }, data: { status: 'ACTIVE', currentCount: amount, completedAt: null, claimedAt: null, lastActivityAt: now } });
    } else {
      progress = await tx.missionProgress.update({ where: { id: existing.id }, data: { currentCount: { increment: amount }, lastActivityAt: now } });
    }
    if (progress.currentCount < mission.targetCount || progress.status === 'CLAIMED' || progress.status === 'EXPIRED') continue;
    const claimed = await tx.missionProgress.update({ where: { id: progress.id }, data: { status: 'CLAIMED', completedAt: progress.completedAt ?? new Date(), claimedAt: new Date() } });
    if (mission.pointsReward > 0) {
      await applyPointChange(tx, { userId, amount: mission.pointsReward, type: 'MISSION', description: `Mission: ${mission.title}`, sourceType: 'MISSION', sourceId: mission.id, idempotencyKey: `mission:${claimed.id}` });
    }
    const condition = (mission.condition ?? {}) as MissionCondition;
    if (condition.lifelineType && (condition.lifelineQuantity ?? 0) > 0) {
      await tx.userLifelineInventory.upsert({
        where: { userId_type: { userId, type: condition.lifelineType } },
        update: { quantity: { increment: condition.lifelineQuantity }, version: { increment: 1 } },
        create: { userId, type: condition.lifelineType, quantity: condition.lifelineQuantity! },
      });
    }
    completed.push({ id: mission.id, name: mission.title, rewardPoints: mission.pointsReward });
  }
  return completed;
}
