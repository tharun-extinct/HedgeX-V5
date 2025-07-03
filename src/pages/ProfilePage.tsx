import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        
        // In a real implementation, this would be an actual Tauri command
        const userData = await invoke<UserProfile>('get_user_profile');
        setProfile(userData);
        
        setError(null);
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        setError('Failed to load profile. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();

    // Mock data for development
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
  }, []);

  const handleLogout = async () => {
    try {
      // In a real implementation, this would be an actual Tauri command
      await invoke('logout');
      
      // Clear session data
      localStorage.removeItem('sessionToken');
      
      // Redirect to login page
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

    // Basic validation
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      // In a real implementation, this would be an actual Tauri command
      await invoke('change_password', {
        currentPassword,
        newPassword
      });
      
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
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent mx-auto"></div>
          <p className="mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">User Profile</h1>
        <Button variant="outline" onClick={handleLogout}>Logout</Button>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md mb-6">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md mb-6">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your account details and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Username</label>
                <div className="font-medium mt-1">{profile.username}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                <div className="font-medium mt-1">{profile.fullName}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <div className="font-medium mt-1">{profile.email}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                <div className="font-medium mt-1">{new Date(profile.createdAt).toLocaleDateString()}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Last Login</label>
                <div className="font-medium mt-1">{new Date(profile.lastLogin).toLocaleString()}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">User ID</label>
                <div className="font-medium mt-1">{profile.userId}</div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsChangingPassword(!isChangingPassword)}>
              {isChangingPassword ? 'Cancel' : 'Change Password'}
            </Button>
            <Button variant="outline">Edit Profile</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trading Summary</CardTitle>
            <CardDescription>Your trading activity and performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Trading Days</label>
              <div className="font-medium text-xl mt-1">{profile.tradingDays}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total Trades</label>
              <div className="font-medium text-xl mt-1">{profile.totalTrades}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total Profit</label>
              <div className={`font-medium text-xl mt-1 ${profile.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profile.totalProfit >= 0 ? '+' : ''}₹{profile.totalProfit.toFixed(2)}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => navigate('/analytics')}>
              View Detailed Analytics
            </Button>
          </CardFooter>
        </Card>
      </div>

      {isChangingPassword && (
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="currentPassword"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                           ring-offset-background file:border-0 file:bg-transparent
                           file:text-sm file:font-medium placeholder:text-muted-foreground
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                           focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label
                  htmlFor="newPassword"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                           ring-offset-background file:border-0 file:bg-transparent
                           file:text-sm file:font-medium placeholder:text-muted-foreground
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                           focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters long.
                </p>
              </div>
              
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                           ring-offset-background file:border-0 file:bg-transparent
                           file:text-sm file:font-medium placeholder:text-muted-foreground
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                           focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsChangingPassword(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Security & Sessions</CardTitle>
          <CardDescription>Manage your account security and active sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">Two-Factor Authentication</h3>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
              </div>
              <Button variant="outline">Enable 2FA</Button>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">API Key Management</h3>
                <p className="text-sm text-muted-foreground">Manage your Zerodha API keys and permissions</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/settings')}>Manage Keys</Button>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">Active Sessions</h3>
                <p className="text-sm text-muted-foreground">View and manage your active login sessions</p>
              </div>
              <Button variant="outline">View Sessions</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
