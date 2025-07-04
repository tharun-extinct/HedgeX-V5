import { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import StrategiesPage from "./pages/StrategiesPage";
import TradesPage from "./pages/TradesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import DashboardLayout from "./layouts/DashboardLayout";
import "./App.css";

// Create auth context for global state management
interface AuthContextType {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// This component handles scrolling to top on route changes
const ScrollToTop = () => {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("sessionToken")
  );

  // Function to update auth state when user logs in
  const login = (token: string) => {
    localStorage.setItem("sessionToken", token);
    setIsAuthenticated(true);
  };

  // Function to update auth state when user logs out
  const logout = () => {
    localStorage.removeItem("sessionToken");
    setIsAuthenticated(false);
  };

  // Listen for changes to the sessionToken in localStorage from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sessionToken") {
        setIsAuthenticated(!!e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route 
            path="/" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} 
          />
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} 
          />
          <Route 
            path="/signup" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <SignupPage />} 
          />
          
          {/* Protected routes using the dashboard layout */}
          <Route element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/strategies" element={<StrategiesPage />} />
            <Route path="/trades" element={<TradesPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
