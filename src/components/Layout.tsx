
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutList, BarChart2, BookOpen, Settings, Flame } from 'lucide-react';
import clsx from 'clsx';

const Layout = () => {
  const navItems = [
    { name: 'Today', path: '/today', icon: LayoutList },
    { name: 'Habits', path: '/habits', icon: Flame },
    { name: 'Tracks', path: '/tracks', icon: BookOpen },
    { name: 'Analytics', path: '/analytics', icon: BarChart2 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row max-w-6xl mx-auto">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 p-6 glass-panel m-4 sticky top-4 h-[calc(100vh-2rem)]">
        <div className="flex items-center gap-3 mb-10">
          <img 
            src="/pwa-192x192.png" 
            alt="Ascend Logo" 
            className="w-10 h-10 rounded-xl shadow-lg shadow-brand/20 object-cover"
          />
          <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">
            Ascend
          </h1>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium',
                  isActive
                    ? 'bg-brand/10 text-brand-light'
                    : 'text-slate-400 hover:bg-dark-700/50 hover:text-slate-200'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 min-h-screen">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel rounded-none rounded-t-3xl border-b-0 pb-safe">
        <div className="flex justify-around items-center p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center p-3 rounded-2xl transition-all duration-200 min-w-[4rem]',
                  isActive
                    ? 'text-brand-light bg-brand/10'
                    : 'text-slate-400 hover:bg-dark-700/50'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={clsx("w-6 h-6 mb-1", isActive ? 'animate-bounce-short' : '')} />
                  <span className="text-[10px] font-medium">{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
