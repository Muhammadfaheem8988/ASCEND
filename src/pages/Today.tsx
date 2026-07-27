import { useState } from 'react';
import { createPortal } from 'react-dom';
import { format, subDays, addDays } from 'date-fns';
import { CheckCircle2, Circle, Plus, Clock, MoreVertical, Moon, Trash2, Star, Flame, Sparkles } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { parseTaskInput, getDefaultTiming } from '../utils/timingEngine';
import NightlyPlanningModal from '../components/NightlyPlanningModal';
import BedtimeSummaryModal from '../components/BedtimeSummaryModal';
import clsx from 'clsx';
import { audio } from '../utils/audio';

const Today = () => {
  const [quickAddText, setQuickAddText] = useState('');
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [nextLessonPrompt, setNextLessonPrompt] = useState<any>(null);
  
  const data = useLiveQuery(
    async () => {
      const todayDate = format(new Date(), 'yyyy-MM-dd');
      const tomorrowDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      const allPending = await db.items.where('status').equals('pending').toArray();
      const allDone = await db.items.where('status').equals('done').toArray();
      
      const pendingItems = allPending.filter(i => !i.planned_date || i.planned_date === todayDate || i.planned_date < todayDate);
      const doneItems = allDone.filter(i => !i.planned_date || i.planned_date === todayDate);
      const tomorrowItems = allPending.filter(i => i.planned_date === tomorrowDate);
      
      const sortByOrder = (a: any, b: any) => {
        if (a.order_index !== undefined && b.order_index !== undefined) {
          if (a.order_index !== b.order_index) return a.order_index - b.order_index;
        }
        if (a.order_index !== undefined) return -1;
        if (b.order_index !== undefined) return 1;
        
        if (!a.scheduled_time && !b.scheduled_time) return 0;
        if (!a.scheduled_time) return 1;
        if (!b.scheduled_time) return -1;
        return a.scheduled_time.localeCompare(b.scheduled_time);
      };
      
      return {
        today: [...pendingItems.sort(sortByOrder), ...doneItems.sort(sortByOrder)],
        tomorrow: tomorrowItems.sort(sortByOrder)
      };
    },
    []
  ) || { today: [], tomorrow: [] };

  const { today: items, tomorrow: tomorrowItems } = data;

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddText.trim()) return;

    const { title, time, category } = parseTaskInput(quickAddText);
    let finalTime = time;
    let duration = 30;

    if (!finalTime) {
      const defaultTiming = await getDefaultTiming(category);
      finalTime = defaultTiming.time;
      duration = defaultTiming.duration;
    }

    const newItem = {
      id: crypto.randomUUID(),
      user_id: 'local_user',
      title: title || 'New Task',
      category,
      type: 'task' as const,
      scheduled_time: finalTime,
      duration_min: duration,
      is_top_focus: false,
      status: 'pending' as const,
      planned_date: format(new Date(), 'yyyy-MM-dd'),
      order_index: Date.now(),
      created_at: new Date().toISOString(),
    };

    await db.items.add(newItem);
    setQuickAddText('');
  };

  const toggleItem = async (id: string, currentStatus: string, goalId?: string) => {
    const newStatus = currentStatus === 'pending' ? 'done' : 'pending';
    const item = await db.items.get(id);
    
    if (newStatus === 'done') {
      audio.playSuccess();
      
      if (item?.type === 'routine' && item.goal_id) {
        const habit = await db.habits.get(item.goal_id);
        if (habit) {
          const today = format(new Date(), 'yyyy-MM-dd');
          if (habit.last_completed_date !== today) {
            const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
            let newStreak = 1;
            if (habit.last_completed_date === yesterday) {
              newStreak = habit.current_streak + 1;
            }
            const newLongest = Math.max(newStreak, habit.longest_streak);
            
            await db.habits.update(habit.id, {
              current_streak: newStreak,
              longest_streak: newLongest,
              last_completed_date: today
            });
          }
        }
      }
    } else if (newStatus === 'pending' && item?.type === 'routine' && item.goal_id) {
        const habit = await db.habits.get(item.goal_id);
        const today = format(new Date(), 'yyyy-MM-dd');
        if (habit && habit.last_completed_date === today) {
           const newStreak = Math.max(0, habit.current_streak - 1);
           await db.habits.update(habit.id, {
             current_streak: newStreak,
             last_completed_date: format(subDays(new Date(), 1), 'yyyy-MM-dd') 
           });
        }
    }
    
    const updateData: any = { status: newStatus };
    if (newStatus === 'done') {
      updateData.completed_date = format(new Date(), 'yyyy-MM-dd');
    } else if (newStatus === 'pending') {
      updateData.completed_date = undefined;
    }
    
    await db.items.update(id, updateData);

    if (newStatus === 'done' && goalId) {
      const trackItem = await db.track_items.get(goalId);
      if (trackItem) {
        await db.track_items.update(goalId, { is_completed: true });
        
        // check track completion
        const allTrackItems = await db.track_items.where({ track_id: trackItem.track_id }).toArray();
        const incompleteItems = allTrackItems.filter(i => !i.is_completed && i.id !== goalId);
        
        if (incompleteItems.length === 0) {
          await db.tracks.update(trackItem.track_id, { status: 'completed' });
        } else {
          // Sort to find the next logical item
          incompleteItems.sort((a, b) => a.order_index - b.order_index);
          const nextItem = incompleteItems[0];
          const track = await db.tracks.get(trackItem.track_id);
          
          setNextLessonPrompt({
            trackTitle: track?.title || 'Track',
            nextItemId: nextItem.id,
            nextItemTitle: nextItem.title,
            category: `Track: ${track?.title}`
          });
        }
      }
    } else if (newStatus === 'pending' && goalId) {
      await db.track_items.update(goalId, { is_completed: false });
    }
  };

  const handleAcceptNextLesson = async () => {
    if (!nextLessonPrompt) return;
    
    await db.items.add({
      id: crypto.randomUUID(),
      user_id: 'local_user',
      title: nextLessonPrompt.nextItemTitle,
      category: nextLessonPrompt.category,
      type: 'task',
      goal_id: nextLessonPrompt.nextItemId,
      status: 'pending',
      planned_date: format(new Date(), 'yyyy-MM-dd'),
      order_index: Date.now(),
      created_at: new Date().toISOString()
    });
    setNextLessonPrompt(null);
  };

  const handleDelete = async (id: string) => {
    await db.items.delete(id);
    setActiveDropdownId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const pending = items?.filter(i => i.status === 'pending') || [];
    const draggedIndex = pending.findIndex(i => i.id === draggedId);
    const targetIndex = pending.findIndex(i => i.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newItems = [...pending];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    const updates = newItems.map((item, index) => 
      db.items.update(item.id, { order_index: index })
    );
    await Promise.all(updates);
    setDraggedId(null);
  };

  const renderItem = (item: any, index: number, isPendingToday: boolean = false) => {
    const isPriority1 = isPendingToday && index === 0;
    const isPriority2 = isPendingToday && index === 1;
    const isPriority3 = isPendingToday && index === 2;
    
    return (
      <div
        key={item.id}
        draggable={item.status === 'pending'}
        onDragStart={() => setDraggedId(item.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, item.id)}
        onDragEnd={() => setDraggedId(null)}
        className={clsx(
          "glass-panel p-4 flex items-center gap-4 transition-all duration-300 group cursor-grab active:cursor-grabbing relative",
          item.status === 'done' ? 'opacity-50 grayscale cursor-default' : '',
          draggedId === item.id ? 'opacity-30 scale-95 z-40' : '',
          activeDropdownId === item.id ? 'z-50' : 'z-0',
          isPriority1 ? 'border-brand/60 bg-brand/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 
          isPriority2 ? 'border-brand/40 bg-brand/5 shadow-[0_0_10px_rgba(99,102,241,0.1)]' : 
          isPriority3 ? 'border-brand/20 bg-brand/5' : 'hover:border-brand/30'
        )}
      >
        <button
          onClick={() => toggleItem(item.id, item.status, item.goal_id)}
          className="flex-shrink-0 text-slate-400 hover:text-brand transition-colors"
        >
          {item.status === 'done' ? (
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          ) : (
            <Circle className={clsx("w-7 h-7", isPriority1 && "text-brand", isPriority2 && "text-brand/80", isPriority3 && "text-brand/60")} />
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isPriority1 && <Star className="w-4 h-4 text-brand fill-brand shrink-0" />}
            {isPriority2 && <Star className="w-3 h-3 text-brand/80 fill-brand/80 shrink-0" />}
            <h4 className={clsx(
              "font-medium text-lg truncate transition-all", 
              item.status === 'done' ? 'line-through text-slate-500' : 'text-slate-200',
              isPriority1 && 'text-brand-light font-bold text-xl',
              isPriority2 && 'text-brand-light font-bold'
            )}>
              {item.title}
            </h4>
          </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
          <span className="px-2 py-0.5 rounded-md bg-dark-700/50 font-medium flex items-center gap-1">
            {item.type === 'routine' && <Flame className="w-3.5 h-3.5 text-orange-500" />}
            {item.category}
          </span>
          {item.scheduled_time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {item.scheduled_time}
            </span>
          )}
        </div>
      </div>

        {/* Actions Dropdown */}
        <div className="relative ml-2 sm:ml-4">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdownId(activeDropdownId === item.id ? null : item.id);
            }}
            className="p-2 rounded-xl hover:bg-dark-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {activeDropdownId === item.id && (
            <div className="absolute right-0 top-full mt-2 w-32 bg-dark-800 border border-dark-700 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-100 origin-top-right">
              <button 
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleDelete(item.id);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-dark-700 transition-colors text-left"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
    </div>
  );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-slide-up">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-2">Good morning</h2>
          <p className="text-slate-400 text-lg font-medium">
            {format(new Date(), 'EEEE, MMMM do')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-primary text-sm px-3 py-1.5 flex items-center gap-2 bg-gradient-to-r from-brand to-indigo-600 border-none shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all" onClick={() => setIsSummaryModalOpen(true)}>
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI Review</span>
          </button>
          <button className="btn-secondary text-sm px-3 py-1.5" onClick={() => setIsPlanningModalOpen(true)}>
            <Moon className="w-4 h-4" />
            Plan
          </button>
        </div>
      </header>

      {/* Quick Add Bar */}
      <form onSubmit={handleQuickAdd} className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Plus className="h-5 w-5 text-brand" />
        </div>
        <input
          type="text"
          value={quickAddText}
          onChange={(e) => setQuickAddText(e.target.value)}
          className="input-field pl-12 h-14 text-lg bg-dark-800/80 backdrop-blur-md placeholder-slate-500 shadow-lg shadow-black/20"
          placeholder="e.g., Workout 7am..."
        />
        <button
          type="submit"
          className="absolute inset-y-2 right-2 bg-brand hover:bg-brand-light text-white px-4 rounded-lg font-medium transition-colors"
        >
          Add
        </button>
      </form>

      {/* Today's Schedule Timeline */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-300">Today's Plan</h3>
        
        <div className="space-y-3">
          {items?.length === 0 ? (
            <div className="glass-panel p-8 text-center text-slate-400 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-dark-700/50 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-slate-500" />
              </div>
              <p>Nothing planned for today yet.</p>
              <p className="text-sm mt-1">Use the quick add above to get started.</p>
            </div>
          ) : (
            items?.map((item, index) => renderItem(item, index, item.status === 'pending'))
          )}
        </div>
      </div>

      {/* Tomorrow's Plan (if any) */}
      {tomorrowItems?.length > 0 && (
        <div className="space-y-4 pt-8 border-t border-dark-700">
          <h3 className="text-xl font-bold text-slate-400">Tomorrow's Plan</h3>
          <div className="space-y-3 opacity-80">
            {tomorrowItems.map((item, index) => renderItem(item, index, false))}
          </div>
        </div>
      )}

      {/* Next Lesson Prompt Modal */}
      {nextLessonPrompt && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-dark-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-dark-800 border border-brand/30 rounded-2xl shadow-[0_0_50px_rgba(99,102,241,0.15)] flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
            <div className="p-6 text-center space-y-4 overflow-y-auto flex-1">
                <div className="mx-auto w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center text-brand-light mb-4 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-200">Track Progress!</h3>
                <p className="text-slate-400 text-lg">
                  You just completed a step in <span className="text-slate-200 font-medium">{nextLessonPrompt.trackTitle}</span>.
                </p>
                <div className="bg-dark-900/50 border border-dark-700 rounded-xl p-4 my-4">
                  <p className="text-sm text-brand-light font-medium uppercase tracking-wider mb-1">Next Lesson</p>
                  <p className="text-slate-200 font-medium">{nextLessonPrompt.nextItemTitle}</p>
                </div>
                <p className="text-slate-300">Would you like to pull the next lesson into Today's plan right now?</p>
              </div>
              <div className="p-6 border-t border-dark-700 flex gap-3 bg-dark-800/50">
                <button onClick={() => setNextLessonPrompt(null)} className="btn-secondary flex-1 py-3 text-base">Not Yet</button>
                <button onClick={handleAcceptNextLesson} className="btn-primary flex-1 py-3 text-base">Send to Today</button>
              </div>
            </div>
        </div>,
        document.body
      )}

      <NightlyPlanningModal 
        isOpen={isPlanningModalOpen} 
        onClose={() => setIsPlanningModalOpen(false)} 
      />

      <BedtimeSummaryModal 
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
      />
    </div>
  );
};

export default Today;
