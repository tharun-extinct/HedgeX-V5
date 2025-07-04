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
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar for larger screens */}
      <div className="hidden md:flex md:flex-col md:w-64 bg-muted/50 border-r">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold">HedgeX</h1>
          <p className="text-sm text-muted-foreground">High-Frequency Trading</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`
                  }
                >
                  <span className={`mr-3 text-lg icon-${link.icon}`}>
                    {/* Icon would be here in a real implementation */}
                    {link.icon === 'chart-bar' && '📊'}
                    {link.icon === 'puzzle' && '🧩'}
                    {link.icon === 'list' && '📋'}
                    {link.icon === 'chart-line' && '📈'}
                    {link.icon === 'cog' && '⚙️'}
                    {link.icon === 'user' && '👤'}
                  </span>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile header */}
      <div className="md:hidden bg-background border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">HedgeX</h1>
        <button
          onClick={toggleMobileMenu}
          className="text-2xl"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background">
          <div className="p-4 flex justify-between items-center border-b">
            <h1 className="text-xl font-bold">HedgeX</h1>
            <button
              onClick={toggleMobileMenu}
              className="text-2xl"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          <nav className="p-4">
            <ul className="space-y-4">
              {navLinks.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-3 rounded-md transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`
                    }
                    onClick={toggleMobileMenu}
                  >
                    <span className={`mr-3 text-lg icon-${link.icon}`}>
                      {link.icon === 'chart-bar' && '📊'}
                      {link.icon === 'puzzle' && '🧩'}
                      {link.icon === 'list' && '📋'}
                      {link.icon === 'chart-line' && '📈'}
                      {link.icon === 'cog' && '⚙️'}
                      {link.icon === 'user' && '👤'}
                    </span>
                    {link.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;