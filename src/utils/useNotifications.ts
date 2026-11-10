import { useEffect, useRef } from 'react';
import { db } from '../db/db';
import { addDays, format, parse, subMinutes } from 'date-fns';
import { audio } from './audio';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';

const stableId = (value: string) => {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 2_000_000_000) + 1;
};

export const useNotifications = () => {
  const notifiedSet = useRef<Set<string>>(new Set());
  const nativeScheduleSignature = useRef('');

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    let nativeActionListener: { remove: () => Promise<void> } | undefined;

    const scheduleNativeReminders = async () => {
      const permission = await LocalNotifications.checkPermissions();
      const granted = permission.display === 'granted'
        || (permission.display === 'prompt' && (await LocalNotifications.requestPermissions()).display === 'granted');
      if (!granted) return;

      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
      const [items, user] = await Promise.all([
        db.items.where('planned_date').anyOf([today, tomorrow]).toArray(),
        db.users.get('local_user'),
      ]);
      const notifications: LocalNotificationSchema[] = [];
      for (const item of items) {
        if (item.status !== 'pending' || !item.scheduled_time || !item.planned_date) continue;
        const start = parse(`${item.planned_date} ${item.scheduled_time}`, 'yyyy-MM-dd HH:mm', now);
        if (isNaN(start.getTime())) continue;
        for (const minutes of [15, 5]) {
          const at = subMinutes(start, minutes);
          if (at <= now) continue;
          notifications.push({
            id: stableId(`${item.id}-${minutes}-${item.planned_date}`),
            title: minutes === 15 ? 'Upcoming Task' : 'Task Starting Soon',
            body: `"${item.title}" starts in ${minutes} minutes.`,
            schedule: { at, allowWhileIdle: true },
            extra: { screen: 'today', kind: 'task', itemId: item.id },
          });
        }
      }

      for (const [screen, time, title, body] of [
        ['plan', user?.planning_time, 'Nightly Planning', "It's time to plan your tasks for tomorrow!"],
        ['review', user?.bedtime_summary_time, 'Daily Summary', 'Time for your Bedtime Summary and review.'],
      ] as const) {
        if (!time) continue;
        const at = parse(`${today} ${time}`, 'yyyy-MM-dd HH:mm', now);
        if (isNaN(at.getTime()) || at <= now) continue;
        notifications.push({
          id: stableId(`${screen}-${today}`),
          title,
          body,
          schedule: { at, allowWhileIdle: true },
          extra: { screen, kind: 'trigger' },
        });
      }

      const signature = JSON.stringify(notifications.map(({ id, schedule }) => [id, schedule?.at?.toISOString()]));
      if (signature === nativeScheduleSignature.current) return;
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications });
      if (notifications.length) await LocalNotifications.schedule({ notifications });
      nativeScheduleSignature.current = signature;
    };

    const openScreen = (screen: 'plan' | 'review' | 'today') => {
      window.location.assign(screen === 'today' ? '/today' : `/today?open=${screen}`);
    };

    if (isNative) {
      void scheduleNativeReminders();
      void LocalNotifications.addListener('localNotificationActionPerformed', action => {
        const screen = action.notification.extra?.screen;
        if (screen === 'plan' || screen === 'review') openScreen(screen);
        else openScreen('today');
      }).then(listener => { nativeActionListener = listener; });
    }

    const checkNotifications = async () => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      try {
        if (isNative) {
          await scheduleNativeReminders();
          const user = await db.users.get('local_user');
          if (document.visibilityState === 'visible' && user?.planning_time) {
            const planDiff = Math.round((parse(user.planning_time, 'HH:mm', now).getTime() - now.getTime()) / 60000);
            if (planDiff === 0 && sessionStorage.getItem(`ascend-opened-plan-${today}`) !== '1') {
              sessionStorage.setItem(`ascend-opened-plan-${today}`, '1');
              openScreen('plan');
            }
          }
          if (document.visibilityState === 'visible' && user?.bedtime_summary_time) {
            const reviewDiff = Math.round((parse(user.bedtime_summary_time, 'HH:mm', now).getTime() - now.getTime()) / 60000);
            if (reviewDiff === 0 && sessionStorage.getItem(`ascend-opened-review-${today}`) !== '1') {
              sessionStorage.setItem(`ascend-opened-review-${today}`, '1');
              openScreen('review');
            }
          }
        }

        if (isNative) return;

        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const items = await db.items.filter(i => i.planned_date === today).toArray();
        const pendingItems = items.filter(i => i.status === 'pending' && i.scheduled_time);

        pendingItems.forEach(item => {
          const scheduledDate = parse(item.scheduled_time!, 'HH:mm', now);
          if (isNaN(scheduledDate.getTime())) return;
          const diffMins = Math.round((scheduledDate.getTime() - now.getTime()) / 60000);
          for (const minutes of [15, 5]) {
            if (diffMins !== minutes) continue;
            const key = `${item.id}-${minutes}-${today}`;
            if (notifiedSet.current.has(key)) continue;
            audio.playNotification();
            const notification = new Notification(minutes === 15 ? 'Upcoming Task' : 'Task Starting Soon', {
              body: `"${item.title}" starts in ${minutes} minutes.`,
              data: { screen: 'today' },
            });
            notification.onclick = () => { window.focus(); window.location.assign('/today'); notification.close(); };
            notifiedSet.current.add(key);
          }
        });

        const user = await db.users.get('local_user');
        if (!user) return;
        const sendTriggerNotification = (title: string, body: string, screen: 'plan' | 'review') => {
          const notification = new Notification(title, { body, tag: `ascend-${screen}-${today}`, data: { screen } });
          notification.onclick = () => { window.focus(); openScreen(screen); notification.close(); };
          if (document.visibilityState === 'visible') {
            sessionStorage.setItem(`ascend-opened-${screen}-${today}`, '1');
            openScreen(screen);
          }
        };
        if (user.planning_time) {
          const planDiff = Math.round((parse(user.planning_time, 'HH:mm', now).getTime() - now.getTime()) / 60000);
          if (planDiff === 0 && !notifiedSet.current.has(`plan-${today}`) && sessionStorage.getItem(`ascend-opened-plan-${today}`) !== '1') {
            audio.playNotification();
            sendTriggerNotification('Nightly Planning', "It's time to plan your tasks for tomorrow!", 'plan');
            notifiedSet.current.add(`plan-${today}`);
          }
        }
        if (user.bedtime_summary_time) {
          const reviewDiff = Math.round((parse(user.bedtime_summary_time, 'HH:mm', now).getTime() - now.getTime()) / 60000);
          if (reviewDiff === 0 && !notifiedSet.current.has(`summary-${today}`) && sessionStorage.getItem(`ascend-opened-review-${today}`) !== '1') {
            audio.playNotification();
            sendTriggerNotification('Daily Summary', 'Time for your Bedtime Summary and review.', 'review');
            notifiedSet.current.add(`summary-${today}`);
          }
        }
      } catch (error) {
        console.error('Notification check failed', error);
      }
    };

    void checkNotifications();
    const interval = setInterval(checkNotifications, 60 * 1000);
    return () => {
      clearInterval(interval);
      void nativeActionListener?.remove();
    };
  }, []);
};
