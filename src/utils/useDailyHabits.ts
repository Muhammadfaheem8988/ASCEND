import { useEffect } from 'react';
import { db } from '../db/db';
import { addDays, format } from 'date-fns';

export const useDailyHabits = () => {
  useEffect(() => {
    const generateDailyHabits = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        
        const activeHabits = await db.habits.where({ status: 'active' }).toArray();
        const scheduledItems = await db.items
          .filter(i => (i.planned_date === today || i.planned_date === tomorrow) && i.type === 'routine')
          .toArray();
        
        for (const habit of activeHabits) {
          for (const plannedDate of [today, tomorrow]) {
            const alreadyExists = scheduledItems.some(i => i.goal_id === habit.id && i.planned_date === plannedDate);
            if (!alreadyExists) {
              await db.items.add({
                id: crypto.randomUUID(),
                user_id: 'local_user',
                title: habit.title,
                category: habit.category || 'Routine',
                type: 'routine',
                scheduled_time: habit.scheduled_time,
                status: 'pending',
                goal_id: habit.id,
                planned_date: plannedDate,
                order_index: Date.now() - 1000000,
                created_at: new Date().toISOString()
              });
              scheduledItems.push({ goal_id: habit.id, planned_date: plannedDate } as typeof scheduledItems[number]);
            }
          }
        }
      } catch (e) {
        console.error("Failed to generate daily habits", e);
      }
    };
    
    generateDailyHabits();
    const interval = setInterval(generateDailyHabits, 60 * 60 * 1000); // 1 hour check
    return () => clearInterval(interval);
  }, []);
};
