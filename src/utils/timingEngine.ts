import { db } from '../db/db';
import { addMinutes, format, parse } from 'date-fns';

export const DEFAULT_TIMINGS: Record<string, { time: string; duration: number }> = {
  'Study': { time: '09:00', duration: 45 },
  'Workout': { time: '07:00', duration: 45 },
  'Personal Branding': { time: '18:00', duration: 30 },
  'Custom': { time: '12:00', duration: 30 },
  'General': { time: '', duration: 30 }, // Calculated dynamically
};

/**
 * Assigns a default time based on the category.
 * If the category is General, it finds the next free 30-minute slot today.
 */
export async function getDefaultTiming(category: string): Promise<{ time: string; duration: number }> {
  // Read from user settings if available (Phase 2), for now use constants
  const defaultSetting = DEFAULT_TIMINGS[category] || DEFAULT_TIMINGS['Custom'];
  
  if (category !== 'General') {
    return defaultSetting;
  }

  // Logic for finding the next free slot
  const todayItems = await db.items
    .where('status')
    .equals('pending')
    .toArray();
    
  // Simple heuristic: just place it at 10:00 AM if no items, else 1 hour after the last item
  if (todayItems.length === 0) {
    return { time: '10:00', duration: 30 };
  }

  // Find the latest scheduled item
  const itemsWithTime = todayItems.filter(i => i.scheduled_time);
  if (itemsWithTime.length === 0) {
    return { time: '10:00', duration: 30 };
  }

  const latestItem = itemsWithTime.reduce((latest, current) => {
    if (!latest.scheduled_time) return current;
    if (!current.scheduled_time) return latest;
    return current.scheduled_time > latest.scheduled_time ? current : latest;
  });

  if (latestItem.scheduled_time) {
    const timeDate = parse(latestItem.scheduled_time, 'HH:mm', new Date());
    const nextSlot = addMinutes(timeDate, (latestItem.duration_min || 30) + 15); // 15 min buffer
    return { time: format(nextSlot, 'HH:mm'), duration: 30 };
  }

  return { time: '10:00', duration: 30 };
}

/**
 * Basic natural language parsing for the MVP quick add.
 * Examples: "Workout 7am", "Read chapter 1 (Study)", "Post on LinkedIn 5pm (Personal Branding)"
 */
export function parseTaskInput(input: string): { title: string; time?: string; category: string } {
  let title = input.trim();
  let time: string | undefined = undefined;
  let category = 'General';

  // Extract category if enclosed in parentheses at the end
  const categoryMatch = title.match(/\(([^)]+)\)$/);
  if (categoryMatch) {
    category = categoryMatch[1].trim();
    // Capitalize first letter of category
    category = category.charAt(0).toUpperCase() + category.slice(1);
    title = title.replace(/\([^)]+\)$/, '').trim();
  }

  // Basic time extraction (e.g., "7am", "5:30pm", "14:00")
  const timeRegex = /\b([1-9]|1[0-2])(:[0-5][0-9])?\s*(am|pm)\b|\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/i;
  const timeMatch = title.match(timeRegex);
  
  if (timeMatch) {
    let rawTime = timeMatch[0].toLowerCase();
    title = title.replace(timeMatch[0], '').trim();
    
    // Convert to HH:mm
    if (rawTime.includes('am') || rawTime.includes('pm')) {
      const isPm = rawTime.includes('pm');
      rawTime = rawTime.replace('am', '').replace('pm', '').trim();
      let [hours, minutes = '00'] = rawTime.split(':');
      let h = parseInt(hours, 10);
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
      time = `${h.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    } else {
      // already 24h format
      const [hours, minutes] = rawTime.split(':');
      time = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    }
  }

  // Auto-detect category based on keywords if not explicitly provided
  if (category === 'General') {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('workout') || titleLower.includes('gym') || titleLower.includes('run')) {
      category = 'Workout';
    } else if (titleLower.includes('study') || titleLower.includes('read') || titleLower.includes('learn')) {
      category = 'Study';
    } else if (titleLower.includes('post') || titleLower.includes('tweet') || titleLower.includes('linkedin')) {
      category = 'Personal Branding';
    }
  }

  // Clean up extra spaces
  title = title.replace(/\s+/g, ' ');

  return { title, time, category };
}
