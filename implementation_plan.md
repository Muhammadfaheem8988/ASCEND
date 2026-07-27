# Ascend MVP Implementation Plan

Based on the `Ascend_Product_Spec`, we will build a local-first, Progressive Web App (PWA) designed as an AI Personal Growth Companion. The initial focus is completely on Phase 1 (MVP) to ensure a solid foundation before adding AI and cloud sync capabilities.

## User Review Required

> [!IMPORTANT]
> The product specification emphasizes a **Mobile-first, Premium Dark Mode UI** and **Local-First PWA Architecture**. Please review the plan below. I will initialize a new React + Vite + TypeScript application in the current directory and install all required dependencies once approved.

> [!WARNING]
> Since we are starting over, any existing files in this directory (aside from the specification and local logs) will be overwritten or ignored. The app will be scaffolded directly in `D:\CODING\Python_Projects\ASCEND`.

## Open Questions

- **UI Aesthetics**: The spec calls for a premium dark mode design. Do you have a preferred accent color palette (e.g., deep purples, neon blues, emerald greens) to match the "Ascend" branding? If not, I will choose a vibrant, modern dark mode palette with subtle gradients and glassmorphism.
- **Iconography**: I plan to use `lucide-react` for beautiful, lightweight icons. Does this sound good?

## Proposed Changes

### Phase 1: Foundation & Project Setup

1. **Scaffolding:** 
   - Run `npx -y create-vite@latest ./ --template react-ts`
   - Clean up default boilerplate.
2. **Dependencies:**
   - Install `tailwindcss`, `postcss`, `autoprefixer` for styling.
   - Install `dexie` and `dexie-react-hooks` for local IndexedDB storage.
   - Install `date-fns` for robust local date/time manipulation.
   - Install `lucide-react` for icons.
   - Install `vite-plugin-pwa` to configure the app shell and Service Worker.
3. **Styling & Theming:**
   - Initialize Tailwind config (`tailwind.config.js`).
   - Define custom color tokens and utility classes in `index.css` to achieve a dynamic, visually stunning dark mode UI.

---

### Phase 2: Local Database (Dexie.js)

1. **Database Definition (`src/db/db.ts`):**
   - Create tables matching Section 7.1 of the spec: `users`, `items`, `goals`, `habits`, `tracks`, `track_items`, `daily_logs`, `notifications`, `settings`.
2. **Initial Seed/Defaults:**
   - Pre-populate default categories (Study, Workout, Personal Branding, Custom).
   - Set up the Default Timing Engine configuration in the `settings` table.

---

### Phase 3: Core UI & The 5-Screen Shell

1. **App Layout (`src/App.tsx` & `src/components/Layout.tsx`):**
   - Implement bottom navigation for mobile / side navigation for desktop.
   - Core routes/views: Today, Tracks, Analytics, Settings, Plan Tonight.
2. **Today Screen (`src/pages/Today.tsx`):**
   - Greeting + Date header.
   - Timeline list of today's schedule (sorted by time).
   - Checkboxes with micro-interactions for completing items.
   - Active "Today's lesson" card if any tracks are active.
3. **Quick-Add Interface:**
   - Free-text input field (e.g., "Workout 7am").
   - Logic to parse the string into title + time, falling back to the Default Timing Engine if no time is provided.

---

### Phase 4: Business Logic (Rule-Based Fallbacks)

1. **Nightly Planning Flow:**
   - A modal/screen triggered in the evening asking "What are your goals for tomorrow?"
   - Quick-pick chips for categories and time inputs.
2. **Habit Tracking & Streaks:**
   - Simple logic to increment current streak when completing an item of `type: 'routine'`.
3. **Notifications (Local):**
   - Setup Web Push API / Service Worker local notification timers to fire reminders for scheduled items.

## Verification Plan

### Automated/Local Testing
- Start the Vite development server (`npm run dev`).
- Verify Tailwind CSS classes compile correctly and the UI looks premium and dynamic.
- Ensure Vite PWA plugin registers the service worker.

### Manual Verification
- Add a new task with no time to see the Default Timing Engine assign a time.
- Mark an item as "Done" and verify it persists in IndexedDB across page reloads.
- Disconnect from the internet (offline mode in DevTools) and verify the app continues to function flawlessly.
