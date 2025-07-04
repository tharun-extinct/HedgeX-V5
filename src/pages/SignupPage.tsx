import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { TrendingUp, Shield, Zap, Eye, EyeOff, Check, X } from 'lucide-react';
import { useAuth } from '../App';

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Password strength validation
  const getPasswordStrength = (password: string) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    return { checks, score };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isTauri) {
        // Import invoke dynamically only when in Tauri environment
        const { invoke } = await import('@tauri-apps/api/core');
        
        const result = await invoke<{ success: boolean; message?: string; token?: string }>('create_user', {
          fullName,
          email,
          username,
          password
        });
        
        if (result.success) {
          if (result.token) {
            // Login the user immediately using the returned token
            login(result.token);
            navigate('/dashboard');
          } else {
            // Fallback to login page if no token is returned
            navigate('/login', { state: { message: 'Account created successfully. Please log in.' } });
          }
        } else {
          setError(result.message || 'Failed to create account');
        }
      } else {
        // Fallback for web browser environment (development/testing)
        console.warn('Running in web browser - Tauri APIs not available. Simulating signup...');
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For demo purposes, simulate successful signup with immediate login
        const mockSessionToken = `mock-session-${Date.now()}`;
        login(mockSessionToken);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Signup failed:', err);
      if (isTauri) {
        setError('Failed to create account. Please try again.');
      } else {
        setError('Running in web browser mode. Please use the Tauri desktop app for full functionality.');
      }
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
            <CardHeader className="space-y-4 text-center pb-6">
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
                Join HedgeX
              </CardTitle>
              <CardDescription className="text-white/80 font-medium">
                Create your trading account
                {!isTauri && (
                  <div 
                    className="mt-3 text-xs border rounded-xl p-3 backdrop-blur-sm"
                    style={{
                      background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.2) 0%, rgba(217, 119, 6, 0.2) 100%)',
                      borderColor: 'rgba(251, 146, 60, 0.3)',
                      color: '#fed7aa'
                    }}
                  >
                    ⚠️ Running in web browser mode - limited functionality
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="text-sm font-semibold text-white/90 block">
                      Full Name
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      className={cn(
                        "flex h-12 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-white",
                        "placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40",
                        "transition-all duration-300 hover:bg-white/15 hover:border-white/30"
                      )}
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-semibold text-white/90 block">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      className={cn(
                        "flex h-12 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-white",
                        "placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40",
                        "transition-all duration-300 hover:bg-white/15 hover:border-white/30"
                      )}
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="username" className="text-sm font-semibold text-white/90 block">
                      Username
                    </label>
                    <input
                      id="username"
                      type="text"
                      className={cn(
                        "flex h-12 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-white",
                        "placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40",
                        "transition-all duration-300 hover:bg-white/15 hover:border-white/30"
                      )}
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-semibold text-white/90 block">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className={cn(
                          "flex h-12 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-white pr-12",
                          "placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40",
                          "transition-all duration-300 hover:bg-white/15 hover:border-white/30"
                        )}
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        minLength={8}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/60 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    
                    {/* Password strength indicator */}
                    {password && (
                      <div className="space-y-3 mt-3">
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={cn(
                                "h-2 flex-1 rounded-full transition-all duration-300",
                                passwordStrength.score >= level
                                  ? passwordStrength.score <= 2
                                    ? "bg-red-400"
                                    : passwordStrength.score <= 3
                                    ? "bg-yellow-400"
                                    : "bg-green-400"
                                  : "bg-white/20"
                              )}
                            />
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(passwordStrength.checks).map(([key, passed]) => (
                            <div key={key} className={cn("flex items-center space-x-2", passed ? "text-green-300" : "text-white/50")}>
                              {passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                              <span className="capitalize">
                                {key === 'length' ? '8+ chars' : 
                                 key === 'uppercase' ? 'Uppercase' :
                                 key === 'lowercase' ? 'Lowercase' :
                                 key === 'number' ? 'Number' : 'Special'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-semibold text-white/90 block">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={cn(
                          "flex h-12 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-white pr-12",
                          "placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40",
                          "transition-all duration-300 hover:bg-white/15 hover:border-white/30",
                          confirmPassword && password !== confirmPassword ? "border-red-400/50 ring-1 ring-red-400/30" : ""
                        )}
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/60 hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-300 flex items-center space-x-1 mt-2">
                        <X className="w-3 h-3" />
                        <span>Passwords do not match</span>
                      </p>
                    )}
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
                  disabled={isLoading || password !== confirmPassword}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </div>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </CardContent>
            
            <CardFooter className="flex flex-col items-center space-y-6 pt-4">
              <div className="text-sm text-white/70">
                Already have an account?{' '}
                <Link to="/login" className="text-white font-semibold hover:text-white/80 transition-colors underline decoration-2 underline-offset-4">
                  Sign In
                </Link>
              </div>
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              <p className="text-xs text-white/50 text-center leading-relaxed">
                © {new Date().getFullYear()} HedgeX. By creating an account, you agree to our Terms of Service.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;