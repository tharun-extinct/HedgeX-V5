import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { TrendingUp, Shield, Zap, Eye, EyeOff } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check for success message from signup page
  useEffect(() => {
    if (location.state && location.state.message) {
      setSuccessMessage(location.state.message);
      // Clear the message from location state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Check if we're running in Tauri environment
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
      
      if (isTauri) {
        // Dynamic import for Tauri environment
        const { invoke } = await import('@tauri-apps/api/core');
        const sessionToken = await invoke<string>('login', { username, password });
        localStorage.setItem('sessionToken', sessionToken);
      } else {
        // Fallback for web browser environment (development)
        // Simulate login validation
        if (username.trim() === '' || password.trim() === '') {
          throw new Error('Username and password are required');
        }
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For demo purposes, accept any non-empty credentials
        const mockSessionToken = `mock-session-${Date.now()}`;
        localStorage.setItem('sessionToken', mockSessionToken);
      }
      
      navigate('/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
      setError('Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40"></div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
          <CardHeader className="space-y-4 text-center pb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              HedgeX
            </CardTitle>
            <CardDescription className="text-gray-300 text-lg">
              High-Frequency Trading for NIFTY 50
            </CardDescription>
            
            {/* Feature highlights */}
            <div className="flex justify-center space-x-6 pt-4">
              <div className="flex flex-col items-center space-y-1">
                <Shield className="w-5 h-5 text-green-400" />
                <span className="text-xs text-gray-400">Secure</span>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span className="text-xs text-gray-400">Fast</span>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <span className="text-xs text-gray-400">Profitable</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {successMessage && (
              <div className="rounded-lg bg-green-500/20 border border-green-500/30 p-4 text-sm text-green-300 backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>{successMessage}</span>
                </div>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-gray-300 block"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  className={cn(
                    "flex h-12 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-3 text-white",
                    "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                    "transition-all duration-200 hover:bg-white/15"
                  )}
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-300 block"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className={cn(
                      "flex h-12 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-3 text-white pr-12",
                      "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                      "transition-all duration-200 hover:bg-white/15"
                    )}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="rounded-lg bg-red-500/20 border border-red-500/30 p-4 text-sm text-red-300 backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span>{error}</span>
                  </div>
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="flex flex-col items-center space-y-4 pt-6">
            <div className="text-sm text-gray-400">
              Don't have an account?{' '}
              <Link to="/signup" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Create Account
              </Link>
            </div>
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <p className="text-xs text-gray-500 text-center">
              © {new Date().getFullYear()} HedgeX. Secure trading platform with enterprise-grade encryption.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;