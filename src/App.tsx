
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Today from './pages/Today';
import Tracks from './pages/Tracks';
import Habits from './pages/Habits';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { useNotifications } from './utils/useNotifications';
import { useDailyHabits } from './utils/useDailyHabits';
import { audio } from './utils/audio';
import { useEffect } from 'react';

function App() {
  useNotifications();
  useDailyHabits();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('[role="button"]') || target.tagName.toLowerCase() === 'input') {
        audio.playClick();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today" element={<Today />} />
          <Route path="habits" element={<Habits />} />
          <Route path="tracks" element={<Tracks />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
