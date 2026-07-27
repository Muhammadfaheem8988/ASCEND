import { db } from '../db/db';
import { format } from 'date-fns';

export async function generateBedtimeSummary(): Promise<string> {
  const user = await db.users.get('local_user');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  // Fetch today's items: items planned for today OR items actually completed today
  const items = await db.items.filter(i => 
    i.planned_date === todayStr || 
    i.completed_date === todayStr ||
    (i.status === 'done' && i.planned_date === todayStr) // fallback for items completed before we added completed_date
  ).toArray();
  
  const completed = items.filter(i => i.status === 'done');
  const pending = items.filter(i => i.status === 'pending');
  const routines = items.filter(i => i.type === 'routine');

  const prompt = `
You are Ascend, a highly encouraging, premium, and concise AI productivity companion.
The user is ending their day. Here is their data for today (${todayStr}):

Completed Tasks & Routines:
${completed.map(i => `- ${i.title} (${i.type})`).join('\n') || 'None'}

Incomplete Tasks & Routines:
${pending.map(i => `- ${i.title} (${i.type})`).join('\n') || 'None'}

Total Routines (Habits) scheduled today: ${routines.length}

Please write a short, inspiring bedtime summary.
1. Praise them for what they completed.
2. Provide a gentle, non-judgmental perspective on what they missed.
3. Give them one small piece of actionable advice or an encouraging thought for tomorrow.

Keep it under 4 short paragraphs. Use a warm, professional, and slightly futuristic tone. Do not use markdown formatting like **bold** excessively, just clean text.
`;

  try {
    if (!user || !user.ai_api_key) {
      throw new Error('No API key');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${user.ai_api_key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google API Error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Empty response');
    }
    
    return text;
  } catch (error: any) {
    // Rule-based fallback summary
    const completedCount = completed.length;
    const pendingCount = pending.length;
    
    let summary = `You completed ${completedCount} items today. `;
    
    if (completedCount === 0 && pendingCount > 0) {
      summary += "It looks like today didn't go as planned, and that is completely okay. Rest up, and tomorrow is a fresh start.";
    } else if (pendingCount === 0 && completedCount > 0) {
      summary += "Incredible work! You cleared your entire schedule today. Take some time to celebrate your consistency.";
    } else if (completedCount > pendingCount) {
      summary += `Great job getting the majority of your tasks done! Don't worry about the ${pendingCount} items left over—focus on resting now.`;
    } else {
      summary += `A solid effort today. Even small steps forward matter. Let's aim to tackle the remaining ${pendingCount} items tomorrow.`;
    }
    
    if (routines.length > 0) {
      summary += `\n\nYou are building strong habits with your ${routines.length} daily routines. Keep the momentum going!`;
    }

    return summary;
  }
}

export async function generateTrackSyllabus(topic: string): Promise<string[]> {
  const user = await db.users.get('local_user');
  if (!user || !user.ai_api_key) throw new Error('No API key configured in Settings.');

  const prompt = `You are an expert curriculum designer. The user wants to learn or master the following topic: "${topic}".
Create a logical, step-by-step track of lessons or milestones. Break it down into highly actionable, specific steps.
Return ONLY a valid JSON array of strings, where each string is a step title. Example: ["Introduction to Topic", "Core Concepts", "Advanced Patterns"].
Provide roughly 8 to 15 well-paced steps. Do not include any other markdown or text.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${user.ai_api_key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'API request failed');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from AI');

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(s => String(s));
    throw new Error('AI did not return a valid array');
  } catch (err) {
    throw new Error('Failed to parse AI response into steps');
  }
}
