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
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"
          style={{
            top: '-10rem',
            right: '-10rem',
            width: '20rem',
            height: '20rem',
            background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)',
            animationDelay: '0s',
            animationDuration: '4s'
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"
          style={{
            bottom: '-10rem',
            left: '-10rem',
            width: '20rem',
            height: '20rem',
            background: 'linear-gradient(45deg, #4834d4, #686de0)',
            animationDelay: '2s',
            animationDuration: '6s'
          }}
        ></div>
        <div 
          className="absolute rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '20rem',
            height: '20rem',
            background: 'linear-gradient(45deg, #0abde3, #006ba6)',
            animationDelay: '4s',
            animationDuration: '8s'
          }}
        ></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full opacity-20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          ></div>
        ))}
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
            <CardHeader className="space-y-4 text-center pb-8">
              <div 
                className="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                <TrendingUp className="w-10 h-10 text-white" />
              </div>
              <CardTitle 
                className="text-4xl font-bold text-transparent bg-clip-text"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                }}
              >
                HedgeX
              </CardTitle>
              <CardDescription className="text-white/80 text-lg font-medium">
                High-Frequency Trading for NIFTY 50
              </CardDescription>
              
              {/* Feature highlights */}
              <div className="flex justify-center space-x-8 pt-6">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center backdrop-blur-sm">
                    <Shield className="w-6 h-6 text-green-300" />
                  </div>
                  <span className="text-xs text-white/70 font-medium">Secure</span>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center backdrop-blur-sm">
                    <Zap className="w-6 h-6 text-yellow-300" />
                  </div>
                  <span className="text-xs text-white/70 font-medium">Fast</span>
                </div>
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center backdrop-blur-sm">
                    <TrendingUp className="w-6 h-6 text-blue-300" />
                  </div>
                  <span className="text-xs text-white/70 font-medium">Profitable</span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {successMessage && (
                <div 
                  className="rounded-xl border p-4 text-sm backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(21, 128, 61, 0.2) 100%)',
                    borderColor: 'rgba(34, 197, 94, 0.3)',
                    color: '#dcfce7'
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>{successMessage}</span>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label
                    htmlFor="username"
                    className="text-sm font-semibold text-white/90 block"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    className={cn(
                      "flex h-14 w-full rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm px-6 py-4 text-white text-lg",
                      "placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40",
                      "transition-all duration-300 hover:bg-white/15 hover:border-white/30"
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
                    className="text-sm font-semibold text-white/90 block"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className={cn(
                        "flex h-14 w-full rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm px-6 py-4 text-white text-lg pr-14",
                        "placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40",
                        "transition-all duration-300 hover:bg-white/15 hover:border-white/30"
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
                      className="absolute inset-y-0 right-0 flex items-center pr-6 text-white/60 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                {error && (
                  <div 
                    className="rounded-xl border p-4 text-sm backdrop-blur-sm"
                    style={{
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.2) 100%)',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                      color: '#fecaca'
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                      <span>{error}</span>
                    </div>
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full h-14 text-white font-bold rounded-2xl text-lg transition-all duration-300 transform hover:scale-[1.02] shadow-2xl hover:shadow-3xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border-0"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </CardContent>
            
            <CardFooter className="flex flex-col items-center space-y-6 pt-6">
              <div className="text-sm text-white/70">
                Don't have an account?{' '}
                <Link to="/signup" className="text-white font-semibold hover:text-white/80 transition-colors underline decoration-2 underline-offset-4">
                  Create Account
                </Link>
              </div>
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              <p className="text-xs text-white/50 text-center leading-relaxed">
                © {new Date().getFullYear()} HedgeX. Secure trading platform with enterprise-grade encryption.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;