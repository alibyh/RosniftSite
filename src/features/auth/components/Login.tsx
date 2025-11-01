import React, { useState, FormEvent } from 'react';
import './Login.css';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { loginStart, loginSuccess, loginFailure, clearError } from '../authSlice';
import { authService } from '../../../services/authService';
import RosneftLogo from '../../../assets/Rosneft_logo.svg';



const Login: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ru' ? 'en' : 'ru';
    i18n.changeLanguage(newLang);
  };

  // In Login.tsx handleSubmit
const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  dispatch(clearError());

  if (!username.trim() || !password) {
    dispatch(loginFailure(t('login.errorRequired')));
    return;
  }

  dispatch(loginStart());

  try {
    const response = await authService.login({ username, password });
    
    // Store token securely
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('authToken', response.token);
    storage.setItem('userSession', JSON.stringify(response.user));

    dispatch(loginSuccess({ user: response.user, token: response.token }));
    navigate('/marketplace');
  } catch (error) {
    let errorMessage = t('login.error');
    
    if (error instanceof Error) {
      const errorCode = error.message;
      switch (errorCode) {
        case 'INVALID_CREDENTIALS':
          errorMessage = t('login.error');
          break;
        case 'LOGIN_FAILED':
          errorMessage = t('login.errorLoginFailed');
          break;
        case 'SERVER_ERROR':
          errorMessage = t('login.errorNetwork');
          break;
        case 'Network request failed':
        case 'Failed to fetch':
          errorMessage = t('login.errorNetwork');
          break;
        default:
          // If it's a translated message already, use it; otherwise use default
          errorMessage = errorCode.includes('Неверное') || errorCode.includes('Invalid') 
            ? errorCode 
            : t('login.error');
      }
    }
    
    dispatch(loginFailure(errorMessage));
  }
};

  const getCompanyForUser = (username: string): string => {
    const mockCompanies: Record<string, string> = {
      admin: 'Роснефть',
      company1: 'Дочерняя компания А',
      company2: 'Дочерняя компания Б',
      company3: 'Дочерняя компания В',
    };
    return mockCompanies[username.toLowerCase()] || `Компания ${username}`;
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-container">
            <div className="logo-round">
              <img src={RosneftLogo} alt="Rosneft Logo" className="logo-icon" />
            </div>
          </div>
          <h1>{t('login.title')}</h1>
          <p className="subtitle">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">{t('login.username')}</label>
            <div className="input-wrapper">
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('login.usernamePlaceholder')}
                required
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('login.password')}</label>
            <div className="input-wrapper">
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  {showPassword ? (
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
              <span className="checkmark"></span>
              <span className="checkbox-label">{t('login.rememberMe')}</span>
            </label>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button type="submit" className={`login-button ${isLoading ? 'loading' : ''}`} disabled={isLoading}>
            <span className="button-text">{isLoading ? t('login.signingIn') : t('login.signIn')}</span>
            <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M5 12h14M12 5l7 7-7 7"></path>
            </svg>
          </button>

          <div className="language-toggle">
            <button type="button" onClick={toggleLanguage} className="lang-button">
              {i18n.language === 'ru' ? 'EN' : 'RU'}
            </button>
          </div>
        </form>

        <div className="login-footer">
          <p>{t('login.footer')}</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

