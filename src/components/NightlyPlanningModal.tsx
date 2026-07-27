import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Moon, Plus } from 'lucide-react';
import { db } from '../db/db';
import { parseTaskInput, getDefaultTiming } from '../utils/timingEngine';
import { addDays, format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = ['Study', 'Workout', 'Personal Branding', 'Custom'];

export default function NightlyPlanningModal({ isOpen, onClose }: Props) {
  const [inputText, setInputText] = useState('');
  const [draftItems, setDraftItems] = useState<any[]>([]);

  const activeTrackSuggestions = useLiveQuery(async () => {
    const activeTracks = await db.tracks.where('status').equals('active').toArray();
    const suggestions = [];
    for (const track of activeTracks) {
      const items = await db.track_items.where({ track_id: track.id }).toArray();
      items.sort((a, b) => a.order_index - b.order_index);
      const nextItem = items.find(i => !i.is_completed);
      
      if (nextItem) {
        suggestions.push({
          trackId: track.id,
          trackTitle: track.title,
          itemId: nextItem.id,
          itemTitle: nextItem.title
        });
      }
    }
    return suggestions;
  }, []);

  if (!isOpen) return null;

  const handleAddDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const { title, time, category } = parseTaskInput(inputText);
    let finalTime = time;
    let duration = 30;

    if (!finalTime) {
      const defaultTiming = await getDefaultTiming(category);
      finalTime = defaultTiming.time;
      duration = defaultTiming.duration;
    }

    const newItem = {
      id: crypto.randomUUID(),
      title: title || 'New Task',
      category,
      time: finalTime,
      duration,
    };

    setDraftItems([...draftItems, newItem]);
    setInputText('');
  };

  const handleAddTrackDraft = (s: any) => {
    if (draftItems.some(i => i.goal_id === s.itemId)) return;
    
    setDraftItems([...draftItems, {
      id: crypto.randomUUID(),
      title: s.itemTitle,
      category: `Track: ${s.trackTitle}`,
      time: '',
      duration: 30,
      goal_id: s.itemId
    }]);
  };

  const handleRemoveDraft = (id: string) => {
    setDraftItems(draftItems.filter(item => item.id !== id));
  };

  const handleConfirmPlan = async () => {
    const tomorrowDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    for (let i = 0; i < draftItems.length; i++) {
      const item = draftItems[i];
      await db.items.add({
        id: crypto.randomUUID(),
        user_id: 'local_user',
        title: item.title,
        category: item.category,
        type: 'task',
        scheduled_time: item.time,
        duration_min: item.duration,
        status: 'pending',
        goal_id: item.goal_id,
        planned_date: tomorrowDate,
        order_index: Date.now() + i,
        created_at: new Date().toISOString(),
      });
    }
    onClose();
    setDraftItems([]);
  };

  const addChip = (cat: string) => {
    setInputText(cat + ' ');
    // focus input would go here in a real app
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-dark-900/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-dark-700 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
              <Moon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-200">Plan Tomorrow</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <p className="text-slate-400">What are your goals for tomorrow? Let's set them now so you wake up ready.</p>
          
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button 
                key={cat}
                onClick={() => addChip(cat)}
                className="bg-dark-700 hover:bg-dark-600 text-slate-300 text-sm px-3 py-1.5 rounded-full transition-colors"
              >
                + {cat}
              </button>
            ))}
          </div>

          {activeTrackSuggestions && activeTrackSuggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Continue your tracks</h4>
              <div className="flex flex-col gap-2">
                {activeTrackSuggestions.map(s => {
                  const isAdded = draftItems.some(i => i.goal_id === s.itemId);
                  if (isAdded) return null;
                  return (
                    <button 
                      key={s.itemId}
                      onClick={() => handleAddTrackDraft(s)}
                      className="flex items-center justify-between p-3 rounded-xl bg-brand/10 border border-brand/20 hover:bg-brand/20 transition-colors text-left group"
                    >
                      <div>
                        <p className="text-brand-light font-medium">{s.itemTitle}</p>
                        <p className="text-xs text-brand/60">From {s.trackTitle}</p>
                      </div>
                      <Plus className="w-5 h-5 text-brand group-hover:text-brand-light" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleAddDraft} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. Read chapter 2 at 9am..."
              className="input-field flex-1"
              autoFocus
            />
            <button type="submit" className="btn-primary px-4">
              <Plus className="w-5 h-5" />
            </button>
          </form>

          {draftItems.length > 0 && (
            <div className="space-y-3 pt-4">
              <h4 className="font-medium text-slate-300">Draft Plan</h4>
              {draftItems.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-dark-900/50 p-3 rounded-xl border border-dark-700">
                  <div>
                    <p className="font-medium text-slate-200">{item.title}</p>
                    <p className="text-sm text-slate-400">{item.category} • {item.time}</p>
                  </div>
                  <button onClick={() => handleRemoveDraft(item.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-dark-700 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button 
            onClick={handleConfirmPlan} 
            disabled={draftItems.length === 0}
            className="btn-primary"
          >
            Looks Good
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
