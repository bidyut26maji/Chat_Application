import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import RoomEntry from './components/RoomEntry';
import RoomChat from './components/RoomChat';
import MyRooms from './components/MyRooms';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return user ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return !user ? children : <Navigate to="/" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Routes>
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } 
            />
            <Route 
              path="/" 
              element={
                <PrivateRoute>
                  <SocketProvider>
                    <RoomEntry />
                  </SocketProvider>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/rooms" 
              element={
                <PrivateRoute>
                  <SocketProvider>
                    <RoomEntry />
                  </SocketProvider>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/room/:roomId" 
              element={
                <PrivateRoute>
                  <SocketProvider>
                    <RoomChat />
                  </SocketProvider>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/my-rooms" 
              element={
                <PrivateRoute>
                  <SocketProvider>
                    <MyRooms />
                  </SocketProvider>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/chat" 
              element={
                <PrivateRoute>
                  <SocketProvider>
                    <Chat />
                  </SocketProvider>
                </PrivateRoute>
              } 
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
