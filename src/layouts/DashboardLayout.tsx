import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

const DashboardLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      // Check if we're running in a Tauri environment
      if (window.__TAURI__) {
        // Dynamically import invoke to avoid errors when not in Tauri
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('logout');
      }
      
      // Clear session data
      localStorage.removeItem('sessionToken');
      
      // Redirect to login page
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      
      // Even if Tauri command fails, still clear local data and redirect
      localStorage.removeItem('sessionToken');
      navigate('/login');
    }
  };

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: 'chart-bar' },
    { to: '/strategies', label: 'Strategies', icon: 'puzzle' },
    { to: '/trades', label: 'Trades', icon: 'list' },
    { to: '/analytics', label: 'Analytics', icon: 'chart-line' },
    { to: '/settings', label: 'Settings', icon: 'cog' },
    { to: '/profile', label: 'Profile', icon: 'user' },
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Horizontal Header Navigation */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-slate-900">HedgeX</h1>
              <span className="ml-2 text-sm text-slate-500 hidden sm:block">High-Frequency Trading</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <span className={`mr-2 text-lg`}>
                    {link.icon === 'chart-bar' && '📊'}
                    {link.icon === 'puzzle' && '🧩'}
                    {link.icon === 'list' && '📋'}
                    {link.icon === 'chart-line' && '📈'}
                    {link.icon === 'cog' && '⚙️'}
                    {link.icon === 'user' && '👤'}
                  </span>
                  {link.label}
                </NavLink>
              ))}
            </nav>

            {/* Desktop Logout Button */}
            <div className="hidden md:flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Logout
              </Button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={toggleMobileMenu}
                className="text-slate-600 hover:text-slate-900 focus:outline-none focus:text-slate-900 p-2"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                  onClick={toggleMobileMenu}
                >
                  <span className={`mr-3 text-lg`}>
                    {link.icon === 'chart-bar' && '📊'}
                    {link.icon === 'puzzle' && '🧩'}
                    {link.icon === 'list' && '📋'}
                    {link.icon === 'chart-line' && '📈'}
                    {link.icon === 'cog' && '⚙️'}
                    {link.icon === 'user' && '👤'}
                  </span>
                  {link.label}
                </NavLink>
              ))}
              <div className="pt-2 border-t">
                <Button 
                  variant="outline" 
                  className="w-full text-red-600 border-red-300 hover:bg-red-50"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;