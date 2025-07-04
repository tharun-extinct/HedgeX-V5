import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { TrendingUp, Shield, Zap, Eye, EyeOff, Check, X } from 'lucide-react';

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
        
        const result = await invoke<{ success: boolean; message?: string }>('create_user', {
          fullName,
          email,
          username,
          password
        });
        
        if (result.success) {
          // Redirect to login page after successful signup
          navigate('/login', { state: { message: 'Account created successfully. Please log in.' } });
        } else {
          setError(result.message || 'Failed to create account');
        }
      } else {
        // Fallback for web browser environment (development/testing)
        console.warn('Running in web browser - Tauri APIs not available. Simulating signup...');
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For demo purposes, simulate successful signup
        navigate('/login', { state: { message: 'Account created successfully. Please log in.' } });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-40"></div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
          <CardHeader className="space-y-4 text-center pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Join HedgeX
            </CardTitle>
            <CardDescription className="text-gray-300">
              Create your trading account
              {!isTauri && (
                <div className="mt-2 text-xs text-orange-400 bg-orange-500/20 border border-orange-500/30 rounded-lg p-2 backdrop-blur-sm">
                  ⚠️ Running in web browser mode - limited functionality
                </div>
              )}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="text-sm font-medium text-gray-300 block">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    className={cn(
                      "flex h-11 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-white",
                      "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                      "transition-all duration-200 hover:bg-white/15"
                    )}
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-300 block">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={cn(
                      "flex h-11 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-white",
                      "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                      "transition-all duration-200 hover:bg-white/15"
                    )}
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium text-gray-300 block">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    className={cn(
                      "flex h-11 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-white",
                      "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                      "transition-all duration-200 hover:bg-white/15"
                    )}
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-gray-300 block">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className={cn(
                        "flex h-11 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-white pr-12",
                        "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                        "transition-all duration-200 hover:bg-white/15"
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
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {/* Password strength indicator */}
                  {password && (
                    <div className="space-y-2 mt-2">
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-colors",
                              passwordStrength.score >= level
                                ? passwordStrength.score <= 2
                                  ? "bg-red-500"
                                  : passwordStrength.score <= 3
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                                : "bg-white/20"
                            )}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {Object.entries(passwordStrength.checks).map(([key, passed]) => (
                          <div key={key} className={cn("flex items-center space-x-1", passed ? "text-green-400" : "text-gray-500")}>
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
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-300 block">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={cn(
                        "flex h-11 w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-white pr-12",
                        "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                        "transition-all duration-200 hover:bg-white/15",
                        confirmPassword && password !== confirmPassword ? "border-red-500/50" : ""
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
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-400 flex items-center space-x-1">
                      <X className="w-3 h-3" />
                      <span>Passwords do not match</span>
                    </p>
                  )}
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
                disabled={isLoading || password !== confirmPassword}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating Account...</span>
                  </div>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="flex flex-col items-center space-y-4 pt-4">
            <div className="text-sm text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Sign In
              </Link>
            </div>
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <p className="text-xs text-gray-500 text-center">
              © {new Date().getFullYear()} HedgeX. By creating an account, you agree to our Terms of Service.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;