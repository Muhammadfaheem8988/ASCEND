import { Download, Trash2, AlertTriangle, ShieldAlert, Clock, Moon, Sun, Key } from 'lucide-react';
import { db } from '../db/db';
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

const Settings = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  
  const user = useLiveQuery(() => db.users.get('local_user'));

  useEffect(() => {
    const initUser = async () => {
      const u = await db.users.get('local_user');
      if (!u) {
        await db.users.add({
          id: 'local_user',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          wake_time: '07:00',
          sleep_time: '23:00',
          planning_time: '21:00',
          bedtime_summary_time: '22:00'
        });
      }
    };
    initUser();
  }, []);

  const calculateDependentTimes = (sleepTimeStr: string) => {
    const [hours, minutes] = sleepTimeStr.split(':').map(Number);
    const planHours = (hours - 2 + 24) % 24;
    const summaryHours = (hours - 1 + 24) % 24;
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      planning_time: `${pad(planHours)}:${pad(minutes)}`,
      bedtime_summary_time: `${pad(summaryHours)}:${pad(minutes)}`
    };
  };

  const handleSleepTimeChange = async (val: string) => {
    const { planning_time, bedtime_summary_time } = calculateDependentTimes(val);
    await db.users.update('local_user', {
      sleep_time: val,
      planning_time,
      bedtime_summary_time
    });
  };

  const handleWakeTimeChange = async (val: string) => {
    await db.users.update('local_user', { wake_time: val });
  };

  const handleApiKeyChange = async (val: string) => {
    await db.users.update('local_user', { ai_api_key: val });
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = {
        items: await db.items.toArray(),
        tracks: await db.tracks.toArray(),
        trackItems: await db.track_items.toArray()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ascend_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleWipeData = async () => {
    if (!window.confirm("WARNING: This will permanently delete ALL your tasks, tracks, and analytics. This cannot be undone. Are you absolutely sure?")) return;
    
    setIsWiping(true);
    try {
      await db.items.clear();
      await db.tracks.clear();
      await db.track_items.clear();
      window.location.href = '/'; // hard reload
    } catch (e) {
      console.error('Failed to wipe data', e);
      setIsWiping(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-slide-up pb-12">
      <header>
        <h2 className="text-4xl font-bold tracking-tight mb-2">Settings</h2>
        <p className="text-slate-400 text-lg font-medium">
          Configure your Ascend experience
        </p>
      </header>

      <div className="glass-panel p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-brand" />
            <h3 className="text-lg font-medium text-slate-200">Daily Routine Schedule</h3>
          </div>
          <p className="text-sm text-slate-400 mb-6">
            Set your sleep boundaries. Ascend will automatically schedule the Nightly Planner 2 hours before bed, and an AI summary 1 hour before bed.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-dark-900/50 border border-dark-700/50 p-4 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-400" />
                  Wake Time
                </label>
              </div>
              <input 
                type="time" 
                value={user?.wake_time || '07:00'} 
                onChange={e => handleWakeTimeChange(e.target.value)}
                className="input-field w-full text-lg"
              />
            </div>
            
            <div className="bg-dark-900/50 border border-dark-700/50 p-4 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  Sleep Time
                </label>
              </div>
              <input 
                type="time" 
                value={user?.sleep_time || '23:00'} 
                onChange={e => handleSleepTimeChange(e.target.value)}
                className="input-field w-full text-lg"
              />
            </div>
          </div>
          
          {user && (
            <div className="mt-4 p-4 rounded-xl bg-brand/5 border border-brand/10">
              <h4 className="text-xs font-bold text-brand uppercase tracking-wider mb-2">Calculated Triggers</h4>
              <ul className="space-y-1 text-sm text-slate-400">
                <li className="flex justify-between">
                  <span>Nightly Planner</span>
                  <span className="text-slate-200 font-medium">{user.planning_time}</span>
                </li>
                <li className="flex justify-between">
                  <span>Bedtime AI Summary</span>
                  <span className="text-slate-200 font-medium">{user.bedtime_summary_time}</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="glass-panel p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-medium text-slate-200">AI Configuration (BYOK)</h3>
          </div>
          <p className="text-sm text-slate-400 mb-6">
            Ascend uses a Bring-Your-Own-Key (BYOK) architecture. Your API key is <strong>never</strong> sent to our servers. It is stored securely in your browser's local database and only communicates directly with Google's Gemini API. This guarantees 100% security against server breaches.
          </p>
          
          <div className="bg-dark-900/50 border border-dark-700/50 p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-slate-300">
                Google Gemini API Key
              </label>
            </div>
            <input 
              type="password" 
              placeholder="AIzaSy..."
              value={user?.ai_api_key || ''} 
              onChange={e => handleApiKeyChange(e.target.value)}
              className="input-field w-full text-sm font-mono tracking-wider"
            />
            <p className="text-xs text-slate-500 mt-2">
              Get a free API key from <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-brand hover:underline">Google AI Studio</a>.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-slate-400" />
            <h3 className="text-lg font-medium text-slate-200">Local Data</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Ascend is completely local-first. Your data never leaves your device unless you export it yourself.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={handleExportData}
              disabled={isExporting}
              className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export JSON Backup'}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 border-red-500/20 bg-red-500/5">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="text-lg font-medium text-red-400">Danger Zone</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Permanently erase all your data from this browser. Make sure you export a backup first if you want to keep it.
          </p>
          
          <button 
            onClick={handleWipeData}
            disabled={isWiping}
            className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Trash2 className="w-4 h-4" />
            {isWiping ? 'Wiping...' : 'Wipe All Data'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
