import { useEffect } from 'react';
import { db } from '../db/db';
import { format } from 'date-fns';

export const useDailyHabits = () => {
  useEffect(() => {
    const generateDailyHabits = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        
        const activeHabits = await db.habits.where({ status: 'active' }).toArray();
        const todaysItems = await db.items.filter(i => i.planned_date === today && i.type === 'routine').toArray();
        
        for (const habit of activeHabits) {
          const alreadyExists = todaysItems.some(i => i.goal_id === habit.id);
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
              planned_date: today,
              order_index: Date.now() - 1000000,
              created_at: new Date().toISOString()
            });
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
