import { useState } from 'react';
import { format } from 'date-fns';
import { Flame, Plus, Clock, Play, Pause, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import clsx from 'clsx';
import { audio } from '../utils/audio';

const Habits = () => {
  const habits = useLiveQuery(() => db.habits.toArray());
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayItems = useLiveQuery(() => db.items.where('planned_date').equals(today).toArray(), [today]) || [];
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const habitId = crypto.randomUUID();
    await db.habits.add({
      id: habitId,
      user_id: 'local_user',
      title: newTitle.trim(),
      category: 'Routine',
      scheduled_time: newTime || undefined,
      current_streak: 0,
      longest_streak: 0,
      status: 'active',
      created_at: new Date().toISOString()
    });
    
    // Inject today's instance immediately
    await db.items.add({
      id: crypto.randomUUID(),
      user_id: 'local_user',
      title: newTitle.trim(),
      category: 'Routine',
      type: 'routine',
      scheduled_time: newTime || undefined,
      status: 'pending',
      goal_id: habitId,
      planned_date: new Date().toISOString().split('T')[0],
      order_index: Date.now() - 1000000,
      created_at: new Date().toISOString()
    });

    setNewTitle('');
    setNewTime('');
    audio.playClick();
  };

  const toggleStatus = async (id: string, current: string) => {
    audio.playClick();
    await db.habits.update(id, { status: current === 'active' ? 'paused' : 'active' });
  };
  
  const deleteHabit = async (id: string) => {
    if(confirm("Delete this habit? You will lose its streak history.")) {
      await db.habits.delete(id);
    }
  };

  const toggleToday = async (habitId: string) => {
    const item = todayItems.find(entry => entry.goal_id === habitId && entry.type === 'routine');
    if (!item) return;
    const done = item.status === 'done';
    await db.items.update(item.id, {
      status: done ? 'pending' : 'done',
      completed_date: done ? undefined : today,
    });
    const habit = await db.habits.get(habitId);
    if (habit) await db.habits.update(habitId, {
      current_streak: done ? Math.max(0, habit.current_streak - 1) : habit.current_streak + (habit.last_completed_date === today ? 0 : 1),
      longest_streak: done ? habit.longest_streak : Math.max(habit.longest_streak, habit.current_streak + (habit.last_completed_date === today ? 0 : 1)),
      last_completed_date: done ? undefined : today,
    });
    audio.playClick();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-slide-up">
      <header>
        <h2 className="text-4xl font-bold tracking-tight mb-2">Daily Habits</h2>
        <p className="text-slate-400 text-lg font-medium">Build consistency and track your streaks.</p>
      </header>

      {/* Add Habit */}
      <form onSubmit={handleAddHabit} className="glass-panel p-2 flex items-center gap-2">
        <input 
          type="text" 
          value={newTitle} 
          onChange={e => setNewTitle(e.target.value)} 
          placeholder="New habit (e.g. Morning Workout)..." 
          className="flex-1 bg-transparent border-none focus:ring-0 text-slate-200 placeholder:text-slate-500 px-4"
        />
        <input
          type="time"
          value={newTime}
          onChange={e => setNewTime(e.target.value)}
          className="bg-dark-800 border-none rounded-lg text-slate-300 focus:ring-1 focus:ring-brand"
        />
        <button type="submit" className="btn-primary p-3 rounded-xl" disabled={!newTitle.trim()}>
          <Plus className="w-5 h-5" />
        </button>
      </form>

      {/* List */}
      <div className="space-y-4">
        {habits?.map(habit => (
          <div key={habit.id} className={clsx("glass-panel p-4 flex items-center gap-4 transition-all", habit.status === 'paused' && 'opacity-50')}>
            <div className="bg-brand/10 p-3 rounded-xl flex flex-col items-center justify-center min-w-[60px]">
              <Flame className={clsx("w-6 h-6", habit.current_streak > 0 ? "text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" : "text-slate-500")} />
              <span className={clsx("font-bold text-sm", habit.current_streak > 0 ? "text-orange-400" : "text-slate-500")}>
                {habit.current_streak}
              </span>
            </div>
            
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-200">{habit.title}</h3>
              <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                {habit.scheduled_time && (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {habit.scheduled_time}</span>
                )}
                <span>Best Streak: {habit.longest_streak}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => toggleToday(habit.id)} disabled={habit.status !== 'active' || !todayItems.some(entry => entry.goal_id === habit.id && entry.type === 'routine')} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-dark-700 disabled:opacity-40">
                {todayItems.some(entry => entry.goal_id === habit.id && entry.type === 'routine' && entry.status === 'done') ? <><CheckCircle2 className="h-5 w-5 text-emerald-400" /> Done today</> : <><Circle className="h-5 w-5" /> Mark done</>}
              </button>
              <button onClick={() => toggleStatus(habit.id, habit.status)} className="p-2 hover:bg-dark-700 rounded-lg text-slate-400 transition-colors">
                {habit.status === 'active' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button onClick={() => deleteHabit(habit.id)} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-slate-500 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {habits?.length === 0 && (
          <div className="text-center p-8 text-slate-500">
            No habits yet. Add one above to start a streak!
          </div>
        )}
      </div>
    </div>
  );
};
export default Habits;
