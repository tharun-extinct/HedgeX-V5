import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { TrendingUp, Shield, Zap, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../App';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

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
        // Use the context's login function to update state and localStorage
        login(sessionToken);
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
        // Use the context's login function to update state and localStorage
        login(mockSessionToken);
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/20 opacity-50"></div>
      
      {/* Animated shapes */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary bg-[length:400%] animate-gradient"></div>
      
      <div className="absolute w-96 h-96 bg-primary/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
      <div className="absolute w-96 h-96 bg-secondary/10 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse [animation-delay:2s]"></div>
      
      <Card className="w-full max-w-md relative backdrop-blur-sm bg-card/80 border-border/50 shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">HedgeX</CardTitle>
          <CardDescription className="text-muted-foreground">
            High-Frequency Trading Platform
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {successMessage && (
            <div className="mb-4 p-3 rounded-md bg-success/10 border border-success/20 text-success text-sm">
              {successMessage}
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Username
              </label>
              <input
                id="username"
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Password
                </label>
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 mr-1" />
                  )}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  Log in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          <div className="text-sm text-center text-muted-foreground">
            <span>Don't have an account? </span>
            <Link to="/signup" className="text-primary hover:text-primary/90 hover:underline font-medium">
              Sign up
            </Link>
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <div className="flex items-center">
              <Shield className="h-3 w-3 mr-1" />
              <span>Secure Login</span>
            </div>
            <span>•</span>
            <div className="flex items-center">
              <Zap className="h-3 w-3 mr-1" />
              <span>Fast Execution</span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;