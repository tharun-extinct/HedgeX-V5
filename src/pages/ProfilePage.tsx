import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { User, Shield, TrendingUp, Calendar, Award, Settings, LogOut, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface UserProfile {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  createdAt: string;
  lastLogin: string;
  tradingDays: number;
  totalTrades: number;
  totalProfit: number;
}

const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        
        // Mock data for beautiful display
        setProfile({
          userId: 'usr_12345',
          username: 'trader1',
          email: 'trader@example.com',
          fullName: 'John Trader',
          createdAt: '2025-01-15T08:30:00Z',
          lastLogin: '2025-07-03T07:45:00Z',
          tradingDays: 120,
          totalTrades: 756,
          totalProfit: 125780.50
        });
        
        setError(null);
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        setError('Failed to load profile. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('sessionToken');
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Failed to logout. Please try again.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccessMessage('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (err) {
      console.error('Failed to change password:', err);
      setError('Failed to change password. Please check your current password.');
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              User Profile
            </h1>
            <p className="text-slate-600 mt-2">Manage your account and trading preferences</p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="flex items-center space-x-2 text-red-600 border-red-300 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Profile Information */}
          <Card className="lg:col-span-2 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-900">Personal Information</CardTitle>
                  <CardDescription className="text-slate-600">Your account details and preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <label className="text-sm font-semibold text-slate-600 block mb-1">Full Name</label>
                    <div className="text-lg font-bold text-slate-900">{profile.fullName}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <label className="text-sm font-semibold text-slate-600 block mb-1">Username</label>
                    <div className="text-lg font-bold text-slate-900">{profile.username}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <label className="text-sm font-semibold text-slate-600 block mb-1">Email Address</label>
                    <div className="text-lg font-bold text-slate-900">{profile.email}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <label className="text-sm font-semibold text-slate-600 block mb-1">Account Created</label>
                    <div className="text-lg font-bold text-slate-900">{new Date(profile.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <label className="text-sm font-semibold text-slate-600 block mb-1">Last Login</label>
                    <div className="text-lg font-bold text-slate-900">{new Date(profile.lastLogin).toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <label className="text-sm font-semibold text-slate-600 block mb-1">User ID</label>
                    <div className="text-lg font-mono text-slate-700">{profile.userId}</div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between bg-slate-50 rounded-b-lg p-6">
              <Button 
                variant="outline" 
                onClick={() => setIsChangingPassword(!isChangingPassword)}
                className="flex items-center space-x-2"
              >
                <Shield className="w-4 h-4" />
                <span>{isChangingPassword ? 'Cancel' : 'Change Password'}</span>
              </Button>
              <Button 
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Settings className="w-4 h-4" />
                <span>Edit Profile</span>
              </Button>
            </CardFooter>
          </Card>

          {/* Trading Summary */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">Trading Summary</CardTitle>
                  <CardDescription className="text-slate-600">Your trading performance</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <label className="text-sm font-semibold text-blue-700">Trading Days</label>
                </div>
                <div className="text-3xl font-bold text-blue-900">{profile.tradingDays}</div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <label className="text-sm font-semibold text-purple-700">Total Trades</label>
                </div>
                <div className="text-3xl font-bold text-purple-900">{profile.totalTrades}</div>
              </div>
              
              <div className={`bg-gradient-to-r ${profile.totalProfit >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'} rounded-xl p-4 border`}>
                <div className="flex items-center space-x-2 mb-2">
                  <Award className={`w-5 h-5 ${profile.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  <label className={`text-sm font-semibold ${profile.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>Total Profit</label>
                </div>
                <div className={`text-3xl font-bold ${profile.totalProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {profile.totalProfit >= 0 ? '+' : ''}₹{profile.totalProfit.toFixed(2)}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 rounded-b-lg p-6">
              <Button 
                variant="outline" 
                className="w-full flex items-center space-x-2" 
                onClick={() => navigate('/analytics')}
              >
                <TrendingUp className="w-4 h-4" />
                <span>View Detailed Analytics</span>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Change Password Form */}
        {isChangingPassword && (
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">Change Password</CardTitle>
                  <CardDescription className="text-slate-600">Update your account password</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="currentPassword" className="text-sm font-semibold text-slate-700 block">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200 pr-12"
                      placeholder="Enter your current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-semibold text-slate-700 block">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200 pr-12"
                      placeholder="Enter your new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-sm text-slate-500">Password must be at least 8 characters long.</p>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700 block">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200 pr-12"
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsChangingPassword(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Security & Sessions */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">Security & Sessions</CardTitle>
                <CardDescription className="text-slate-600">Manage your account security and active sessions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 rounded-xl p-6 hover:bg-slate-100 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-900 mb-2">Two-Factor Authentication</h3>
                    <p className="text-sm text-slate-600">Add an extra layer of security to your account</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4 text-green-600 border-green-300 hover:bg-green-50">
                  Enable 2FA
                </Button>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-6 hover:bg-slate-100 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-900 mb-2">API Key Management</h3>
                    <p className="text-sm text-slate-600">Manage your Zerodha API keys and permissions</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4" 
                  onClick={() => navigate('/settings')}
                >
                  Manage Keys
                </Button>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-6 hover:bg-slate-100 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-900 mb-2">Active Sessions</h3>
                    <p className="text-sm text-slate-600">View and manage your active login sessions</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4">
                  View Sessions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;