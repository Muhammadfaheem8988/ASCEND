import { useEffect, useRef } from 'react';
import { db } from '../db/db';
import { format, parse } from 'date-fns';
import { audio } from './audio';

export const useNotifications = () => {
  const notifiedSet = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Request permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkNotifications = async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      
      try {
        const items = await db.items.filter(i => i.planned_date === today).toArray();
        const pendingItems = items.filter(i => i.status === 'pending' && i.scheduled_time);

        pendingItems.forEach(item => {
          const scheduledDate = parse(item.scheduled_time!, 'HH:mm', now);
          if (isNaN(scheduledDate.getTime())) return;

          const diffMins = Math.round((scheduledDate.getTime() - now.getTime()) / 60000);

          if (diffMins === 15) {
            const key = `${item.id}-15-${today}`;
            if (!notifiedSet.current.has(key)) {
              audio.playNotification();
              new Notification('Upcoming Task', {
                body: `"${item.title}" starts in 15 minutes!`,
              });
              notifiedSet.current.add(key);
            }
          }

          if (diffMins === 5) {
            const key = `${item.id}-5-${today}`;
            if (!notifiedSet.current.has(key)) {
              audio.playNotification();
              new Notification('Task Starting Soon', {
                body: `"${item.title}" starts in 5 minutes! Get ready.`,
              });
              notifiedSet.current.add(key);
            }
          }
        });

        // Check daily triggers
        const user = await db.users.get('local_user');
        if (user) {
          if (user.planning_time) {
            const planDate = parse(user.planning_time, 'HH:mm', now);
            const planDiff = Math.round((planDate.getTime() - now.getTime()) / 60000);
            if (planDiff === 0 && !notifiedSet.current.has(`plan-${today}`)) {
              audio.playNotification();
              new Notification('Nightly Planning', { body: "It's time to plan your tasks for tomorrow!" });
              notifiedSet.current.add(`plan-${today}`);
            }
          }

          if (user.bedtime_summary_time) {
            const sumDate = parse(user.bedtime_summary_time, 'HH:mm', now);
            const sumDiff = Math.round((sumDate.getTime() - now.getTime()) / 60000);
            if (sumDiff === 0 && !notifiedSet.current.has(`summary-${today}`)) {
              audio.playNotification();
              new Notification('Daily Summary', { body: "Time for your Bedtime Summary and review." });
              notifiedSet.current.add(`summary-${today}`);
            }
          }
        }
      } catch (e) {
        console.error("Notification check failed", e);
      }
    };

    checkNotifications();
    // Check every minute
    const interval = setInterval(checkNotifications, 60 * 1000);

    return () => clearInterval(interval);
  }, []);
};
