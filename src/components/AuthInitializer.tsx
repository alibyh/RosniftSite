import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { restoreSession, setLoading } from '../features/auth/authSlice';
import { authService } from '../services/authService';

const AuthInitializer: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const initializeAuth = async () => {
      dispatch(setLoading(true));
      
      const token = authService.getStoredToken();
      const user = authService.getStoredUser();

      if (token && user) {
        // Validate token
        const isValid = await authService.validateToken(token);
        
        if (isValid) {
          // Restore session
          dispatch(restoreSession({ user, token }));
        } else {
          // Token is invalid, clear storage
          authService.clearStoredAuth();
        }
      }
      
      dispatch(setLoading(false));
    };

    initializeAuth();
  }, [dispatch]);

  return null;
};

export default AuthInitializer;

