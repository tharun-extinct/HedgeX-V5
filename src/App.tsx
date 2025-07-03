import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import "./App.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("sessionToken")
  );

  // Placeholder for dashboard - would be a separate component in full implementation
  const Dashboard = () => (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">HedgeX Dashboard</h1>
      <p>Welcome to the HedgeX trading platform!</p>
      <div className="mt-4">
        <button 
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          onClick={() => {
            localStorage.removeItem("sessionToken");
            setIsAuthenticated(false);
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <Router>
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
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
