import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from './features/auth/components/Login';
import { RootState } from './store/store';

function App() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return (
    <Router>
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
              <div>Marketplace Page - Coming Soon</div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

