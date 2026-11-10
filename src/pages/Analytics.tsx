import { useState } from 'react';
import { BarChart2, CheckCircle2, TrendingUp, Target, ChevronDown, ChevronUp, BookOpen, ListTodo } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { format, subDays, parseISO } from 'date-fns';
import clsx from 'clsx';

const Analytics = () => {
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [showLessonDetail, setShowLessonDetail] = useState(false);

  const stats = useLiveQuery(async () => {
    const allItems = await db.items.toArray();
    const trackItems = await db.track_items.toArray();
    const tracks = await db.tracks.toArray();
    
    const completedTasks = allItems.filter(i => i.status === 'done').length;
    const completedLessons = trackItems.filter(i => i.is_completed).length;
    
    const last7Days = Array.from({length: 7}).map((_, i) => {
      const d = subDays(new Date(), i);
      return format(d, 'yyyy-MM-dd');
    }).reverse();
    
    let last7Total = 0;
    let last7Done = 0;
    
    const dayStats = last7Days.map(dateStr => {
      const itemsForDay = allItems.filter(i => i.planned_date === dateStr || (i.created_at && i.created_at.startsWith(dateStr) && !i.planned_date));
      const doneForDay = itemsForDay.filter(i => i.status === 'done').length;
      
      last7Total += itemsForDay.length;
      last7Done += doneForDay;
      
      return {
        date: dateStr,
        dayName: format(parseISO(dateStr), 'EEE'),
        total: itemsForDay.length,
        done: doneForDay,
        rate: itemsForDay.length > 0 ? (doneForDay / itemsForDay.length) * 100 : 0
      };
    });
    
    const weeklyRate = last7Total > 0 ? Math.round((last7Done / last7Total) * 100) : 0;
    
    // Detailed Breakdowns
    const completedTrackItems = trackItems.filter(i => i.is_completed);
    const lessonsByTrack: Record<string, typeof trackItems> = {};
    for (const item of completedTrackItems) {
      const track = tracks.find(t => t.id === item.track_id);
      const trackName = track ? track.title : 'Deleted Track';
      if (!lessonsByTrack[trackName]) lessonsByTrack[trackName] = [];
      lessonsByTrack[trackName].push(item);
    }
    
    const completedTasksList = allItems.filter(i => i.status === 'done');
    const tasksThisWeek: typeof allItems = [];
    const tasksOlder: typeof allItems = [];
    const sevenDaysAgoStr = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    
    completedTasksList.forEach(t => {
      const dateToUse = t.planned_date || (t.created_at ? t.created_at.split('T')[0] : 'Unknown');
      if (dateToUse >= sevenDaysAgoStr) {
        tasksThisWeek.push(t);
      } else {
        tasksOlder.push(t);
      }
    });
    
    return {
      completedTasks,
      completedLessons,
      weeklyRate,
      dayStats,
      lessonsByTrack,
      tasksThisWeek,
      tasksOlder
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-slide-up">
      <header>
        <h2 className="text-4xl font-bold tracking-tight mb-2">Analytics</h2>
        <p className="text-slate-400 text-lg font-medium">
          Your progress over time
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4 text-brand-light">
            <TrendingUp className="w-5 h-5" />
            <h3 className="font-medium">Weekly Rate</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-bold text-slate-100">{stats?.weeklyRate || 0}%</span>
          </div>
        </div>
        
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <h3 className="font-medium">Tasks Done</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-bold text-slate-100">{stats?.completedTasks || 0}</span>
            <span className="text-slate-400 mb-2">all time</span>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4 text-indigo-400">
            <Target className="w-5 h-5" />
            <h3 className="font-medium">Lessons</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-bold text-slate-100">{stats?.completedLessons || 0}</span>
            <span className="text-slate-400 mb-2">mastered</span>
          </div>
        </div>
      </div>
      
      {/* Detailed Breakdown Sections */}
      <div className="space-y-4">
        {/* Tasks Detail */}
        <div className="glass-panel overflow-hidden">
          <button 
            onClick={() => setShowTaskDetail(!showTaskDetail)}
            className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-dark-700/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400">
                <ListTodo className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-200">Completed Tasks Breakdown</h3>
            </div>
            {showTaskDetail ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>
          
          {showTaskDetail && (
            <div className="p-4 md:p-6 pt-0 border-t border-dark-700/50">
              <div className="space-y-6 mt-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">This Week ({stats?.tasksThisWeek.length})</h4>
                  {stats?.tasksThisWeek.length === 0 ? (
                    <p className="text-slate-500 text-sm">No tasks completed this week yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {stats?.tasksThisWeek.map(t => (
                        <li key={t.id} className="flex items-center gap-2 text-slate-300 bg-dark-900/50 p-2 rounded-md border border-dark-700/30">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="flex-1">{t.title}</span>
                          <span className="text-xs text-slate-500">{t.planned_date || (t.created_at ? t.created_at.split('T')[0] : 'Unknown')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Older ({stats?.tasksOlder.length})</h4>
                  {stats?.tasksOlder.length === 0 ? (
                    <p className="text-slate-500 text-sm">No older completed tasks.</p>
                  ) : (
                    <ul className="space-y-2">
                      {stats?.tasksOlder.map(t => (
                        <li key={t.id} className="flex items-center gap-2 text-slate-300 bg-dark-900/50 p-2 rounded-md border border-dark-700/30">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="flex-1">{t.title}</span>
                          <span className="text-xs text-slate-500">{t.planned_date || (t.created_at ? t.created_at.split('T')[0] : 'Unknown')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lessons Detail */}
        <div className="glass-panel overflow-hidden">
          <button 
            onClick={() => setShowLessonDetail(!showLessonDetail)}
            className="w-full p-4 md:p-6 flex items-center justify-between hover:bg-dark-700/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-200">Track Lessons Breakdown</h3>
            </div>
            {showLessonDetail ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>
          
          {showLessonDetail && (
            <div className="p-4 md:p-6 pt-0 border-t border-dark-700/50">
              <div className="space-y-6 mt-4">
                {Object.keys(stats?.lessonsByTrack || {}).length === 0 ? (
                  <p className="text-slate-500 text-sm">No lessons completed yet.</p>
                ) : (
                  Object.entries(stats?.lessonsByTrack || {}).map(([trackName, lessons]) => (
                    <div key={trackName}>
                      <h4 className="text-sm font-medium text-indigo-400 uppercase tracking-wider mb-3">{trackName} ({lessons.length})</h4>
                      <ul className="space-y-2">
                        {lessons.map(l => (
                          <li key={l.id} className="flex items-center gap-2 text-slate-300 bg-dark-900/50 p-2 rounded-md border border-dark-700/30">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>{l.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="glass-panel p-6 md:p-8 mt-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-slate-200">Last 7 Days</h3>
          <BarChart2 className="w-6 h-6 text-slate-500" />
        </div>
        
        <div className="h-56 flex items-end justify-between gap-2 sm:gap-4 mt-4">
          {stats?.dayStats.map((day, idx) => (
            <div key={day.date} className="w-full h-full flex flex-col items-center gap-3 group relative">
              {/* Tooltip */}
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-dark-700 text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none shadow-lg">
                {day.done} / {day.total} tasks
              </div>
              
              {/* Bar Container */}
              <div className="w-full flex-1 bg-dark-900/60 border border-dark-700/50 rounded-t-lg relative overflow-hidden flex flex-col justify-end">
                <div 
                  className={clsx(
                    "w-full rounded-t-lg transition-all duration-1000",
                    day.rate === 100 ? "bg-emerald-500 shadow-[0_-10px_20px_rgba(16,185,129,0.3)]" : 
                    day.rate > 0 ? "bg-brand shadow-[0_-10px_20px_rgba(99,102,241,0.2)]" : "bg-transparent"
                  )}
                  style={{ height: `${Math.max(day.rate, 2)}%` }}
                />
              </div>
              
              {/* Label */}
              <span className={clsx(
                "text-xs font-medium uppercase tracking-wider shrink-0",
                idx === 6 ? "text-brand-light" : "text-slate-500"
              )}>
                {day.dayName}
              </span>
              <span className="text-[10px] text-slate-500 tabular-nums shrink-0" aria-label={`${day.done} of ${day.total} tasks completed`}>
                {day.done}/{day.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
