# 🚀 ASCEND: AI-Powered Personal Growth Companion

Ascend is a privacy-first, fully local Progressive Web App (PWA) designed to act as your ultimate personal growth companion. It helps you plan daily goals, track habits, learn new skills through AI-generated tracks, and reflect on your progress with a personalized AI nightly summary. 

Unlike bloated "Life OS" dashboards that become overwhelming, Ascend focuses on simplicity: **One clear screen per moment of the day — plan at night, execute during the day, review before bed.**

---

## ✨ Core Features

*   🎯 **The "Today" Screen:** A single, focused view of your day. See your habits, one-off tasks, and exactly one lesson from your active learning tracks. No overwhelming backlogs.
  <br/>
  ![Today Screen](docs/today_screen.png)
*   🤖 **AI Nightly Review (Gemini 3.6 Flash):** One hour before bed, Ascend generates a personalized summary of your day. It praises your consistency, gently reframes missed tasks, and provides actionable advice for tomorrow.
*   🧠 **AI Curriculum Generator:** Want to master a new skill? Type the topic (e.g., "Fullstack React Developer") and the AI will automatically generate a perfectly paced 8-15 step learning syllabus for you.
  <br/>
  ![Tracks Screen](docs/tracks_screen.png)
*   🔔 **Smart Notifications & Reminders:** Get local, offline-capable push notifications reminding you of scheduled tasks, habits, and your nightly planning ritual, powered by Service Workers.
*   🌙 **Nightly Planning Ritual:** A focused flow to plan your next day, utilizing a smart default timing engine if you don't specify explicit times.
*   📈 **Habit Streaks & Analytics:** Visual streak counters, a GitHub-style consistency heatmap, and a custom interactive donut chart tracking your all-time mastery.
  <br/>
  ![Analytics Screen](docs/analytics_screen.png)
*   📱 **Installable PWA:** Install it directly to your desktop or mobile home screen as a native-feeling app.
*   🔒 **100% Local-First & Private:** Your tasks, habits, and journal entries never leave your device. All data is stored locally in IndexedDB. AI requests are made directly from your browser using your own API key (Bring-Your-Own-Key).

---

## 🛠️ Tech Stack

*   **Frontend Framework:** React 19 + TypeScript + Vite
*   **Styling:** Tailwind CSS (Custom utility classes, glassmorphism, micro-animations)
*   **Database:** Dexie.js (IndexedDB wrapper for local-first storage)
*   **Icons:** Lucide React
*   **AI Engine:** Google Gemini API (gemini-3.6-flash) via direct REST
*   **PWA:** `vite-plugin-pwa` (Offline support, manifests, service workers)

---

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   A free Google Gemini API Key (Get one from Google AI Studio)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/ascend.git
   cd ascend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Add your API Key:**
   * Open the app in your browser (usually `http://localhost:5173`).
   * Navigate to the **Settings** tab.
   * Paste your Gemini API key into the designated field. Your key is stored securely in your browser's local database.

---

## 🧠 How the AI Engine Works

Ascend utilizes a Bring-Your-Own-Key (BYOK) architecture. When the AI features are triggered (like the Daily Review or Track Generator), the app sends a direct API request from your browser to Google's generative language servers.

**Graceful Fallbacks:** If you are offline, or if you choose not to provide an API key, the app will never crash. It utilizes a robust rule-based fallback system to generate template-based summaries based on your raw completion stats for the day.

---

## 🎨 Design Philosophy

Ascend is built on three core principles:
1.  **Progressive Disclosure:** Advanced settings and analytics are kept out of the way. The primary view is always just what you need to do *right now*.
2.  **Anti-Burnout:** Missing a day doesn't wipe your history or punish you. The system encourages scaling down habits rather than breaking streaks.
3.  **Aesthetic Excellence:** Smooth micro-animations, tailored dark-mode colors, and glassmorphic panels make the app feel incredibly premium and rewarding to interact with.

---

## 📜 License

MIT License. Free to use, modify, and distribute.
