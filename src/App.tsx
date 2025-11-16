import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from './features/auth/components/Login';
import Marketplace from './components/Marketplace';
import ProductDetails from './components/ProductDetails';
import AdminPanel from './components/AdminPanel';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AuthInitializer from './components/AuthInitializer';
import { RootState } from './store/store';
import { Box } from '@mui/material';

function App() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const isLoading = useSelector((state: RootState) => state.auth.isLoading);

  // Get base path from vite config for GitHub Pages
  const basePath = import.meta.env.BASE_URL || '/';

  return (
    <Router 
      basename={basePath}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthInitializer />
      <Box sx={{ display: 'flex', flexDirection: 'column', width:'90%', minHeight: '100vh' }}>
        {isAuthenticated && <Navbar />}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#FED208' }}>
            Loading...
          </Box>
        ) : (
          <Routes>
            <Route
              path="/"
              element={isAuthenticated ? <Navigate to="/marketplace" replace /> : <Login />}
            />
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to="/marketplace" replace /> : <Login />}
            />
            <Route
              path="/marketplace"
              element={
                <ProtectedRoute>
                  <Marketplace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/product-details"
              element={
                <ProtectedRoute>
                  <ProductDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPanel />
                </AdminRoute>
              }
            />
          </Routes>
        )}
      </Box>
    </Router>
  );
}

export default App;

