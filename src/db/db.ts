import Dexie, { type Table } from 'dexie';

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  category: string;
  scheduled_time?: string;
  current_streak: number;
  longest_streak: number;
  last_completed_date?: string;
  status: 'active' | 'paused';
  created_at: string;
}

export interface User {
  id: string;
  name?: string;
  timezone: string;
  wake_time: string;
  sleep_time: string;
  planning_time: string;
  bedtime_summary_time: string;
  ai_api_key?: string;
}

export interface Track {
  id: string;
  user_id: string;
  title: string;
  description: string;
  icon?: string;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
}

export interface TrackItem {
  id: string;
  track_id: string;
  title: string;
  order_index: number;
  is_completed: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  user_id: string;
  title: string;
  category: string;
  type: 'task' | 'routine' | 'goal';
  recurrence_rule?: string;
  scheduled_time?: string; // HH:mm
  duration_min?: number;
  est_minutes?: number;
  actual_minutes?: number;
  status: 'pending' | 'done' | 'skipped';
  goal_id?: string;
  planned_date?: string; // YYYY-MM-DD
  completed_date?: string; // YYYY-MM-DD
  order_index?: number;
  created_at: string; // ISO datetime
}

export interface Settings {
  id: string;
  user_id: string;
  defaults_json: string;
  gamification_enabled: boolean;
  ai_tone_preference: string;
  theme: string;
}

export class AscendDB extends Dexie {
  users!: Table<User, string>;
  items!: Table<Item, string>;
  settings!: Table<Settings, string>;
  tracks!: Table<Track, string>;
  track_items!: Table<TrackItem, string>;
  habits!: Table<Habit, string>;

  constructor() {
    super('AscendDB');
    
    // Define the final definitive schema in version 7 to fix all previous upgrade conflicts.
    // Dexie will automatically diff this against the physical database and apply the missing tables/indexes without losing data.
    this.version(7).stores({
      users: 'id',
      settings: 'id, user_id',
      tracks: 'id, user_id, status, created_at',
      track_items: 'id, track_id, is_completed, order_index',
      habits: 'id, user_id, category, status',
      items: 'id, user_id, category, type, scheduled_time, status, planned_date, completed_date, order_index, created_at'
    });
  }
}

export const db = new AscendDB();
