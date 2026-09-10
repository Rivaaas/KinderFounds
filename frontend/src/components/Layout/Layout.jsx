import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header  from './Header';
import Footer  from './Footer';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-kinder-sky dark:bg-kinder-dark">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="animate-fadeIn max-w-7xl mx-auto">
            <Outlet />
          </div>
          <Footer className="max-w-7xl mx-auto mt-8 pt-6 border-t border-gray-100 dark:border-kinder-border" />
        </main>
      </div>
    </div>
  );
}
