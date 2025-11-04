import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from './features/auth/components/Login';
import Marketplace from './components/Marketplace';
import ProductDetails from './components/ProductDetails';
import Navbar from './components/Navbar';
import { RootState } from './store/store';
import { Box } from '@mui/material';

function App() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // Get base path from vite config for GitHub Pages
  const basePath = import.meta.env.BASE_URL || '/';

  return (
    <Router basename={basePath}>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {isAuthenticated && <Navbar />}
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
              isAuthenticated ? (
                <Marketplace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/product-details"
            element={
              isAuthenticated ? (
                <ProductDetails />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Box>
    </Router>
  );
}

export default App;

