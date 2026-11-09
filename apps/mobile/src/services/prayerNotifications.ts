import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PrayerTimes } from '@/types/domain';

const CHANNEL_ID = 'prayer-reminders';
const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
type PrayerKey = (typeof PRAYER_KEYS)[number];

function timeValue(value: string | undefined): string | undefined {
  return value?.trim().match(/^\d{1,2}:\d{2}/)?.[0];
}

function nextReminderDate(time: string, now: Date): Date | undefined {
  const [rawHours, rawMinutes] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  const reminder = new Date(now);
  reminder.setHours(hours, minutes - 15, 0, 0);
  if (reminder.getTime() <= now.getTime()) reminder.setDate(reminder.getDate() + 1);
  return reminder;
}

export async function schedulePrayerNotifications(times: PrayerTimes, enabled: boolean, labels: Record<PrayerKey, string>): Promise<void> {
  if (!enabled) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, { name: 'Prayer reminders', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250], lightColor: '#0F766E' });
  }

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.filter((item) => item.content.data?.source === 'prayer-reminder').map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  const now = new Date();
  for (const key of PRAYER_KEYS) {
    const time = timeValue(times[key] ?? times[key.toUpperCase() as keyof PrayerTimes] as string | undefined);
    const reminderAt = time ? nextReminderDate(time, now) : undefined;
    if (!reminderAt) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Fəqih · Namaz vaxtı', body: `${labels[key]} ${time} — namazdan 15 dəqiq əvvəl`, data: { source: 'prayer-reminder', prayer: key } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderAt, channelId: CHANNEL_ID },
    });
  }
}
