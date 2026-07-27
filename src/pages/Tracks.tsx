import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Plus, X, ListTodo, Target, ChevronDown, ChevronUp, CheckCircle2, Circle, Send, Pause, Play, Edit2, GripVertical, Trash2, Sparkles } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { format } from 'date-fns';
import { audio } from '../utils/audio';
import { generateTrackSyllabus } from '../utils/aiEngine';
import clsx from 'clsx';

const Tracks = () => {
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackDesc, setNewTrackDesc] = useState('');
  const [lessons, setLessons] = useState<string[]>(['']);
  const [isGeneratingSyllabus, setIsGeneratingSyllabus] = useState(false);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  
  // Edit Track State
  const [editingTrack, setEditingTrack] = useState<{
    id: string;
    title: string;
    description: string;
    items: { id: string, title: string, is_completed: boolean, isNew?: boolean }[];
  } | null>(null);
  const [draggedEditIdx, setDraggedEditIdx] = useState<number | null>(null);

  const tracks = useLiveQuery(() => db.tracks.toArray(), []);
  const trackItems = useLiveQuery(
    () => expandedTrackId ? db.track_items.where({ track_id: expandedTrackId }).sortBy('order_index') : Promise.resolve([] as any[]),
    [expandedTrackId]
  );

  const handleAddLesson = () => setLessons([...lessons, '']);
  
  const handleLessonChange = (index: number, val: string) => {
    const newL = [...lessons];
    newL[index] = val;
    setLessons(newL);
  };

  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackTitle.trim()) return;

    const trackId = crypto.randomUUID();
    await db.tracks.add({
      id: trackId,
      user_id: 'local_user',
      title: newTrackTitle,
      description: newTrackDesc,
      status: 'active',
      created_at: new Date().toISOString()
    });

    const validLessons = lessons.filter(l => l.trim().length > 0);
    for (let i = 0; i < validLessons.length; i++) {
      await db.track_items.add({
        id: crypto.randomUUID(),
        track_id: trackId,
        title: validLessons[i],
        order_index: i,
        is_completed: false,
        created_at: new Date().toISOString()
      });
    }

    setIsNewModalOpen(false);
    setNewTrackTitle('');
    setNewTrackDesc('');
    setLessons(['']);
  };

  const handleSendToToday = async (trackTitle: string, item: any) => {
    // Prevent duplicating the exact same track item on the same day or if it's already pending
    const existing = await db.items.filter(i => i.goal_id === item.id).toArray();
    const isAlreadySent = existing.some(i => i.status === 'pending' || i.planned_date === format(new Date(), 'yyyy-MM-dd'));
    
    if (isAlreadySent) {
      alert("This lesson is already in Today's plan!");
      return;
    }

    await db.items.add({
      id: crypto.randomUUID(),
      user_id: 'local_user',
      title: item.title,
      category: `Track: ${trackTitle}`,
      type: 'task',
      goal_id: item.id,
      status: 'pending',
      planned_date: format(new Date(), 'yyyy-MM-dd'),
      order_index: Date.now(),
      created_at: new Date().toISOString()
    });
  };

  const handleToggleTrackStatus = async (e: React.MouseEvent, trackId: string, currentStatus: string) => {
    e.stopPropagation();
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await db.tracks.update(trackId, { status: newStatus as any });
  };

  const openEditModal = async (e: React.MouseEvent, track: any) => {
    e.stopPropagation();
    const items = await db.track_items.where({ track_id: track.id }).toArray();
    items.sort((a,b) => a.order_index - b.order_index);
    
    setEditingTrack({
      id: track.id,
      title: track.title,
      description: track.description || '',
      items: items.map(i => ({ id: i.id, title: i.title, is_completed: i.is_completed }))
    });
  };

  const handleEditLessonChange = (idx: number, val: string) => {
    if (!editingTrack) return;
    const newItems = [...editingTrack.items];
    newItems[idx].title = val;
    setEditingTrack({...editingTrack, items: newItems});
  };

  const handleRemoveEditLesson = (idx: number) => {
    if (!editingTrack) return;
    const newItems = [...editingTrack.items];
    newItems.splice(idx, 1);
    setEditingTrack({...editingTrack, items: newItems});
  };

  const handleAddEditLesson = () => {
    if (!editingTrack) return;
    setEditingTrack({
      ...editingTrack, 
      items: [...editingTrack.items, { id: crypto.randomUUID(), title: '', is_completed: false, isNew: true }]
    });
    audio.playClick();
  };

  const handleGenerateSyllabus = async () => {
    if (!newTrackTitle.trim()) {
      alert("Please enter a Track Title first so the AI knows what to teach you.");
      return;
    }
    setIsGeneratingSyllabus(true);
    try {
      const generatedLessons = await generateTrackSyllabus(newTrackTitle);
      if (generatedLessons.length > 0) {
        setLessons(generatedLessons);
        audio.playSuccess();
      }
    } catch (e: any) {
      alert(e.message || "Failed to generate track.");
    } finally {
      setIsGeneratingSyllabus(false);
    }
  };

  const handleEditDragEnter = (idx: number) => {
    if (!editingTrack || draggedEditIdx === null || draggedEditIdx === idx) return;
    const newItems = [...editingTrack.items];
    const draggedItem = newItems[draggedEditIdx];
    newItems.splice(draggedEditIdx, 1);
    newItems.splice(idx, 0, draggedItem);
    setDraggedEditIdx(idx);
    setEditingTrack({...editingTrack, items: newItems});
  };

  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrack || !editingTrack.title.trim()) return;
    
    await db.tracks.update(editingTrack.id, {
      title: editingTrack.title,
      description: editingTrack.description
    });
    
    const existingItems = await db.track_items.where({ track_id: editingTrack.id }).toArray();
    const editItemIds = editingTrack.items.map(i => i.id);
    
    for (const ex of existingItems) {
      if (!editItemIds.includes(ex.id)) {
        await db.track_items.delete(ex.id);
      }
    }
    
    for (let i = 0; i < editingTrack.items.length; i++) {
      const item = editingTrack.items[i];
      if (item.title.trim().length === 0) continue;
      
      if (item.isNew) {
        await db.track_items.add({
          id: item.id,
          track_id: editingTrack.id,
          title: item.title,
          order_index: i,
          is_completed: item.is_completed,
          created_at: new Date().toISOString()
        });
      } else {
        await db.track_items.update(item.id, {
          title: item.title,
          order_index: i
        });
      }
    }
    
    setEditingTrack(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-slide-up">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-2">Tracks</h2>
          <p className="text-slate-400 text-lg font-medium">
            Sequential learning and courses
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsNewModalOpen(true)}>
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New Track</span>
        </button>
      </header>

      {tracks?.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-dark-700/50 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-300 mb-2">No active tracks</h3>
          <p className="max-w-md mx-auto">
            Tracks let you progress through courses one lesson at a time, without the overwhelm of a huge backlog.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tracks?.map(track => {
            const isExpanded = expandedTrackId === track.id;
            return (
              <div key={track.id} className="glass-panel p-6 hover:border-brand/30 transition-colors group">
                <div 
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedTrackId(isExpanded ? null : track.id)}
                >
                  <div>
                    <h3 className="text-xl font-bold text-slate-200 group-hover:text-brand-light transition-colors flex items-center gap-2">
                      {track.title}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                    </h3>
                    <p className="text-slate-400 mt-1">{track.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => openEditModal(e, track)}
                      className="p-1.5 rounded-md hover:bg-dark-700 text-slate-400 hover:text-brand transition-colors"
                      title="Edit Track"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleToggleTrackStatus(e, track.id, track.status)}
                      className="p-1.5 rounded-md hover:bg-dark-700 text-slate-400 hover:text-brand transition-colors"
                      title={track.status === 'active' ? "Pause Track" : "Resume Track"}
                    >
                      {track.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider",
                      track.status === 'active' ? "bg-brand/10 text-brand-light" : "bg-dark-700 text-slate-400"
                    )}>
                      {track.status}
                    </span>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-dark-700 space-y-3">
                    <h4 className="font-medium text-slate-300 text-sm tracking-wide uppercase">Curriculum</h4>
                    {trackItems?.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-dark-900/50 rounded-xl border border-dark-700/50 group/item hover:border-dark-600 transition-colors">
                        <div className="flex items-center gap-3">
                          {item.is_completed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-600 shrink-0" />
                          )}
                          <span className={`text-slate-300 ${item.is_completed ? 'line-through opacity-50' : ''}`}>
                            <span className="text-slate-500 mr-2">{idx + 1}.</span>
                            {item.title}
                          </span>
                        </div>
                        {!item.is_completed && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSendToToday(track.title, item); }}
                            className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 hover:text-brand-light rounded-lg transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Send to Today
                          </button>
                        )}
                      </div>
                    ))}
                    {!trackItems?.length && <p className="text-slate-500 text-sm">No lessons found.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Track Modal */}
      {isNewModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-dark-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-brand/20 p-2 rounded-lg text-brand-light">
                  <Target className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-200">Create New Track</h3>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateTrack} className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Track Title</label>
                  <input 
                    type="text" required autoFocus
                    value={newTrackTitle} onChange={e => setNewTrackTitle(e.target.value)}
                    className="input-field w-full" placeholder="e.g. Master React 19"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Description (Optional)</label>
                  <textarea 
                    value={newTrackDesc} onChange={e => setNewTrackDesc(e.target.value)}
                    className="input-field w-full h-20 resize-none" placeholder="What will you achieve?"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-dark-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300 font-medium">
                    <ListTodo className="w-5 h-5 text-brand" />
                    <h4>Curriculum / Lessons</h4>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleGenerateSyllabus}
                    disabled={isGeneratingSyllabus}
                    className="text-xs font-medium px-3 py-1.5 bg-brand/10 hover:bg-brand/20 text-brand-light rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {isGeneratingSyllabus ? (
                      <span className="w-3.5 h-3.5 border-2 border-brand-light border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {isGeneratingSyllabus ? 'Generating...' : 'Generate with AI'}
                  </button>
                </div>
                <p className="text-sm text-slate-400">List the steps. You'll only see one step at a time on your Today screen.</p>
                
                {lessons.map((lesson, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium w-6 text-right">{idx + 1}.</span>
                    <input 
                      type="text" 
                      value={lesson} 
                      onChange={e => handleLessonChange(idx, e.target.value)}
                      className="input-field flex-1 bg-dark-900/50" 
                      placeholder="e.g. Watch chapter 1"
                    />
                  </div>
                ))}
                
                <button type="button" onClick={handleAddLesson} className="text-brand hover:text-brand-light text-sm font-medium flex items-center gap-1 mt-2">
                  <Plus className="w-4 h-4" /> Add another step
                </button>
              </div>

              <div className="p-6 border-t border-dark-700 flex justify-end gap-3 shrink-0 bg-dark-800">
                <button type="button" onClick={() => setIsNewModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={!newTrackTitle.trim()}>Create Track</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Track Modal */}
      {editingTrack && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-dark-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-brand/20 p-2 rounded-lg text-brand-light">
                  <Edit2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-200">Edit Track</h3>
              </div>
              <button onClick={() => setEditingTrack(null)} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveTrack} className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Track Title</label>
                  <input 
                    type="text" required
                    value={editingTrack.title} onChange={e => setEditingTrack({...editingTrack, title: e.target.value})}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Description (Optional)</label>
                  <textarea 
                    value={editingTrack.description} onChange={e => setEditingTrack({...editingTrack, description: e.target.value})}
                    className="input-field w-full h-20 resize-none"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-dark-700">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <ListTodo className="w-5 h-5 text-brand" />
                  <h4>Curriculum</h4>
                </div>
                <p className="text-sm text-slate-400">Drag to reorder. Completed lessons stay locked but can be renamed.</p>
                
                <div className="space-y-2">
                  {editingTrack.items.map((item, idx) => (
                    <div 
                      key={item.id} 
                      className={clsx(
                        "flex items-center gap-2 p-2 bg-dark-900/50 rounded-lg border border-dark-700/50 group transition-all",
                        draggedEditIdx === idx && "opacity-50 ring-2 ring-brand border-brand"
                      )}
                      draggable
                      onDragStart={() => setDraggedEditIdx(idx)}
                      onDragEnter={() => handleEditDragEnter(idx)}
                      onDragEnd={() => setDraggedEditIdx(null)}
                      onDragOver={e => e.preventDefault()}
                    >
                      <button type="button" className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing p-1">
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <div className="shrink-0 flex items-center justify-center w-6">
                        {item.is_completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <span className="text-xs font-medium text-slate-500">{idx + 1}.</span>
                        )}
                      </div>
                      <input 
                        type="text" 
                        value={item.title} 
                        onChange={e => handleEditLessonChange(idx, e.target.value)}
                        className={clsx(
                          "input-field flex-1 py-1.5 px-3 bg-dark-800 text-sm",
                          item.is_completed && "line-through text-slate-400"
                        )} 
                        placeholder="Lesson title..."
                      />
                      <button 
                        type="button" 
                        onClick={() => handleRemoveEditLesson(idx)}
                        className="text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete lesson"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <button type="button" onClick={handleAddEditLesson} className="text-brand hover:text-brand-light text-sm font-medium flex items-center gap-1 mt-3 px-2 py-1 hover:bg-brand/10 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Add Lesson
                </button>
              </div>

              <div className="p-6 border-t border-dark-700 flex justify-end gap-3 shrink-0 bg-dark-800 -mx-6 -mb-6 mt-6">
                <button type="button" onClick={() => setEditingTrack(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={!editingTrack.title.trim()}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Tracks;
