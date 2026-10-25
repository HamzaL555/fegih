import { Prisma } from '../../config/prisma-client.js';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';

export type AppNotificationType = 'DAILY_AYAH' | 'DAILY_ISLAMIC_INFO' | 'PRAYER' | 'DAILY_MISSION' | 'STREAK_REMINDER' | 'STORE' | 'ORDER_UPDATE' | 'NEW_QUIZ_QUESTIONS' | 'REWARD' | 'MESSAGE_REPLY';
const types: Record<AppNotificationType, 'SYSTEM' | 'QUIZ' | 'REWARD' | 'ORDER' | 'PROMO' | 'PRAYER' | 'TASBEEH' | 'MESSAGE'> = { DAILY_AYAH: 'SYSTEM', DAILY_ISLAMIC_INFO: 'SYSTEM', PRAYER: 'PRAYER', DAILY_MISSION: 'SYSTEM', STREAK_REMINDER: 'REWARD', STORE: 'PROMO', ORDER_UPDATE: 'ORDER', NEW_QUIZ_QUESTIONS: 'QUIZ', REWARD: 'REWARD', MESSAGE_REPLY: 'MESSAGE' };

export async function notifyUser(userId: string, category: AppNotificationType, title: string, body: string, data: Record<string, unknown> = {}) {
  const [preference, tokens] = await prisma.$transaction([prisma.notificationPreference.findFirst({ where: { userId, category, channel: 'PUSH' } }), prisma.deviceToken.findMany({ where: { userId, isActive: true }, select: { token: true } })]);
  if (preference && !preference.isEnabled) return null;
  const notification = await prisma.notification.create({ data: { userId, type: types[category], title, body, data: data as Prisma.InputJsonValue, sentAt: new Date() } });
  if (tokens.length) {
    const messages = tokens.map(({ token }) => ({ to: token, title, body, data, sound: 'default' }));
    void fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}) }, body: JSON.stringify(messages) }).catch(() => undefined);
  }
  return notification;
}
