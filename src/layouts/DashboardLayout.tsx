import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { Menu, X, ChevronRight, LayoutDashboard, Layers, ListOrdered, BarChart2, Settings, User, LogOut } from 'lucide-react';

// Declare the __TAURI__ global property
declare global {
  interface Window {
    __TAURI__?: any;
  }
}

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
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { to: '/strategies', label: 'Strategies', icon: <Layers className="w-5 h-5" /> },
    { to: '/trades', label: 'Trades', icon: <ListOrdered className="w-5 h-5" /> },
    { to: '/analytics', label: 'Analytics', icon: <BarChart2 className="w-5 h-5" /> },
    { to: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
    { to: '/profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border">
        <div className="p-6 border-b border-border flex items-center space-x-3">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold">HX</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">HedgeX</h1>
            <p className="text-xs text-muted-foreground">High-Frequency Trading</p>
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`
              }
            >
              <span className="mr-3 transition-colors duration-150 ease-in-out">
                {link.icon}
              </span>
              <span>{link.label}</span>
              {link.to === '/dashboard' && (
                <span className="ml-auto bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                  New
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Trader</p>
                <p className="text-xs text-muted-foreground">Pro Account</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="w-full justify-start text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile menu button and header */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="bg-card border-b border-border shadow-sm z-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Mobile menu button */}
              <div className="flex items-center md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMobileMenu}
                  className="text-foreground"
                  aria-label="Toggle mobile menu"
                >
                  <Menu className="w-5 h-5" />
                </Button>
                <div className="flex items-center ml-3">
                  <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center mr-2">
                    <span className="text-primary-foreground font-bold text-xs">HX</span>
                  </div>
                  <h1 className="text-lg font-bold text-foreground">HedgeX</h1>
                </div>
              </div>

              {/* Right-side buttons */}
              <div className="flex items-center space-x-3">
                <ThemeToggle />
                
                {/* User Profile Button - Mobile only */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => navigate('/profile')}
                >
                  <User className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm md:hidden">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center mr-3">
                    <span className="text-primary-foreground font-bold">HX</span>
                  </div>
                  <h1 className="text-xl font-bold text-foreground">HedgeX</h1>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMobileMenu}
                  className="text-foreground"
                  aria-label="Close mobile menu"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {navLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={toggleMobileMenu}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`
                    }
                  >
                    <span className="mr-3">{link.icon}</span>
                    <span>{link.label}</span>
                    <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                  </NavLink>
                ))}
              </nav>
              <div className="p-4 border-t border-border space-y-4">
                <div className="flex items-center justify-between px-2 py-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Trader</p>
                      <p className="text-xs text-muted-foreground">Pro Account</p>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleLogout}
                  className="w-full justify-start text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;