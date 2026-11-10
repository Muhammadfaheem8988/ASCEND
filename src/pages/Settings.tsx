import { Download, Upload, Trash2, AlertTriangle, ShieldAlert, Clock, Moon, Sun, Key } from 'lucide-react';
import { db } from '../db/db';
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

const Settings = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dataNotice, setDataNotice] = useState('');
  const [includeApiKeyInBackup, setIncludeApiKeyInBackup] = useState(false);
  
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
    setKeySaved(false);
    await db.users.update('local_user', { ai_api_key: val });
    setKeySaved(true);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = {
        format: 'ascend-backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        tombstones: await db.tombstones.toArray(),
        items: await db.items.toArray(),
        habits: await db.habits.toArray(),
        tracks: await db.tracks.toArray(),
        track_items: await db.track_items.toArray(),
        users: (await db.users.toArray()).map(backupUser => {
          if (includeApiKeyInBackup) return backupUser;
          const { ai_api_key: _apiKey, ...userWithoutApiKey } = backupUser;
          return userWithoutApiKey;
        }),
        settings: await db.settings.toArray()
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
      setDataNotice(includeApiKeyInBackup
        ? 'Backup downloaded with your Gemini API key. Keep the file private.'
        : 'Backup downloaded. Your Gemini API key was excluded.');
    } catch (e) {
      console.error('Failed to export', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    setDataNotice('');
    try {
      const backup = JSON.parse(await file.text());
      const tables = ['items', 'habits', 'tracks', 'track_items', 'users', 'settings'] as const;
      const currentFormat = backup?.format === 'ascend-backup' && [1, 2].includes(backup?.version) && tables.every(name => Array.isArray(backup[name]));
      const legacyFormat = backup?.format === undefined
        && Array.isArray(backup?.items)
        && Array.isArray(backup?.tracks)
        && Array.isArray(backup?.trackItems);
      if (!currentFormat && !legacyFormat) {
        throw new Error('This is not a supported Ascend backup file.');
      }
      const restoreData = legacyFormat
        ? { items: backup.items, habits: [], tracks: backup.tracks, track_items: backup.trackItems, users: [], settings: [] }
        : backup;
      const requiredFields: Record<typeof tables[number], string[]> = {
        items: ['id', 'title', 'category', 'type', 'status', 'created_at'],
        habits: ['id', 'title', 'category', 'current_streak', 'longest_streak', 'status', 'created_at'],
        tracks: ['id', 'title', 'status', 'created_at'],
        track_items: ['id', 'track_id', 'title', 'order_index', 'is_completed', 'created_at'],
        users: ['id', 'timezone', 'wake_time', 'sleep_time', 'planning_time', 'bedtime_summary_time'],
        settings: ['id', 'user_id', 'defaults_json', 'gamification_enabled', 'ai_tone_preference', 'theme'],
      };
      for (const tableName of tables) {
        const rows = restoreData[tableName];
        if (!Array.isArray(rows) || rows.some((row: unknown) =>
          !row || typeof row !== 'object' || Array.isArray(row) ||
          requiredFields[tableName].some(field => !(field in row))
        )) {
          throw new Error(`Backup contains invalid ${tableName} records. Your current data was not changed.`);
        }
      }
      if (!window.confirm('Restore this backup? It will replace all current Ascend data in this browser.')) return;
      db.suppressSyncHooks = true;
      await db.transaction('rw', [db.items, db.habits, db.tracks, db.track_items, db.users, db.settings, db.tombstones], async () => {
        for (const name of tables) await db.table(name).clear();
        for (const name of tables) {
          const rows = restoreData[name];
          if (rows.length) await db.table(name).bulkAdd(rows);
        }
        await db.tombstones.clear();
        if (backup.version === 2 && Array.isArray(backup.tombstones) && backup.tombstones.length) {
          await db.tombstones.bulkPut(backup.tombstones);
        }
      });
      db.suppressSyncHooks = false;
      setDataNotice(legacyFormat
        ? 'Older backup restored. It did not contain habits, user settings, or API key.'
        : 'Backup restored successfully.');
    } catch (error) {
      setDataNotice(error instanceof Error ? error.message : 'Could not restore this backup.');
    } finally {
      db.suppressSyncHooks = false;
      setIsImporting(false);
    }
  };

  const handleMergeData = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    setDataNotice('');
    try {
      const backup = JSON.parse(await file.text());
      const names = ['items', 'habits', 'tracks', 'track_items', 'users', 'settings'] as const;
      if (backup?.format !== 'ascend-backup' || ![1, 2].includes(backup?.version) || !names.every(name => Array.isArray(backup[name]))) {
        throw new Error('Merge requires a current Ascend backup.');
      }
      const tombstones = backup.version === 2 && Array.isArray(backup.tombstones) ? backup.tombstones : [];
      const badTombstone = tombstones.some((entry: any) => !entry || typeof entry.table_name !== 'string' || typeof entry.record_id !== 'string' || typeof entry.deleted_at !== 'string');
      if (badTombstone) throw new Error('Backup contains invalid deletion history. No data was changed.');
      const required: Record<typeof names[number], string[]> = {
        items: ['id', 'title', 'category', 'type', 'status', 'created_at'],
        habits: ['id', 'title', 'category', 'current_streak', 'longest_streak', 'status', 'created_at'],
        tracks: ['id', 'title', 'status', 'created_at'],
        track_items: ['id', 'track_id', 'title', 'order_index', 'is_completed', 'created_at'],
        users: ['id', 'timezone', 'wake_time', 'sleep_time', 'planning_time', 'bedtime_summary_time'],
        settings: ['id', 'user_id', 'defaults_json', 'gamification_enabled', 'ai_tone_preference', 'theme'],
      };
      for (const name of names) {
        if (backup[name].some((row: any) => !row || typeof row !== 'object' || Array.isArray(row) || required[name].some(field => !(field in row)))) {
          throw new Error(`Backup contains invalid ${name} records. No data was changed.`);
        }
      }
      if (!window.confirm('Merge this backup with current data? Newer records win for matching IDs. Deletions are applied when their recorded time is newer than the record.')) return;

      db.suppressSyncHooks = true;
      await db.transaction('rw', [db.items, db.habits, db.tracks, db.track_items, db.users, db.settings, db.tombstones], async () => {
        const mergedTombstones = new Map<string, { table_name: string; record_id: string; deleted_at: string }>();
        for (const entry of [...await db.tombstones.toArray(), ...tombstones]) {
          const key = `${entry.table_name}:${entry.record_id}`;
          const old = mergedTombstones.get(key);
          if (!old || entry.deleted_at > old.deleted_at) mergedTombstones.set(key, entry);
        }
        await db.tombstones.bulkPut([...mergedTombstones.values()]);

        for (const name of names) {
          const localRows = await db.table(name).toArray();
          const rows = new Map<string, any>(localRows.map((row: any) => [row.id, row]));
          for (const incoming of backup[name]) {
            if (!incoming || typeof incoming.id !== 'string') throw new Error(`Backup contains invalid ${name} records. No data was changed.`);
            const local = rows.get(incoming.id);
            const localTime = local?.updated_at || local?.created_at || '';
            const incomingTime = incoming.updated_at || incoming.created_at || backup.exportedAt || '';
            if (!local || incomingTime > localTime) {
              if (name === 'users' && local?.ai_api_key && !incoming.ai_api_key) incoming.ai_api_key = local.ai_api_key;
              rows.set(incoming.id, incoming);
            } else if (name === 'users' && local && !local.ai_api_key && incoming.ai_api_key) {
              rows.set(incoming.id, { ...local, ai_api_key: incoming.ai_api_key });
            }
          }
          const alive = [...rows.values()].filter((row: any) => {
            const tombstone = mergedTombstones.get(`${name}:${row.id}`);
            return !tombstone || (row.updated_at || row.created_at || '') > tombstone.deleted_at;
          });
          await db.table(name).bulkPut(alive);
          for (const tombstone of mergedTombstones.values()) {
            if (tombstone.table_name === name) await db.table(name).delete(tombstone.record_id);
          }
        }
      });
      db.suppressSyncHooks = false;
      setDataNotice('Backup merged. Newer edits were kept, and recorded deletions were applied.');
    } catch (error) {
      setDataNotice(error instanceof Error ? error.message : 'Could not merge this backup.');
    } finally {
      db.suppressSyncHooks = false;
      setIsImporting(false);
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
            {keySaved && <p className="mt-2 text-xs text-emerald-400" role="status" aria-live="polite">Saved locally in this browser.</p>}
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
            Export or restore tasks, habits, tracks, and settings. Your Gemini API key is excluded by default.
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
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={includeApiKeyInBackup} onChange={e => setIncludeApiKeyInBackup(e.target.checked)} className="accent-brand" />
              Include Gemini API key
            </label>
            <label className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer">
              <Upload className="w-4 h-4" />
              {isImporting ? 'Restoring...' : 'Restore JSON Backup'}
              <input type="file" accept="application/json,.json" className="sr-only" disabled={isImporting} onChange={e => { void handleImportData(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            </label>
            <label className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer">
              <Upload className="w-4 h-4" />
              {isImporting ? 'Merging...' : 'Merge JSON Backup'}
              <input type="file" accept="application/json,.json" className="sr-only" disabled={isImporting} onChange={e => { void handleMergeData(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            </label>
          </div>
          {dataNotice && <p className="mt-3 text-sm text-slate-300" role="status">{dataNotice}</p>}
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
