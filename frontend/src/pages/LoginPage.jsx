import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Input from '../components/Input';
import Button from '../components/Button';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import authService from '../services/authService';

export const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, loginWithGoogle, verifyTwoFactor } = useAuth();
  const { showToast } = useShop();

  // Remember me & initial email
  const rememberedEmail = localStorage.getItem('deport_remembered_email') || '';
  const initialEmail = location.state?.registeredEmail || rememberedEmail || '';

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Error states
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState(location.state?.message || '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [unverifiedOtpCode, setUnverifiedOtpCode] = useState('');

  const errorBannerRef = useRef(null);

  // Two-Step Verification Modal State
  const [isTwoStepOpen, setIsTwoStepOpen] = useState(false);
  const [twoStepEmail, setTwoStepEmail] = useState('');
  const [twoStepDevCode, setTwoStepDevCode] = useState('');
  const [twoStepInputCode, setTwoStepInputCode] = useState('');
  const [twoStepLoading, setTwoStepLoading] = useState(false);
  const [twoStepError, setTwoStepError] = useState('');

  useEffect(() => {
    if (location.state?.registeredEmail) {
      setEmail(location.state.registeredEmail);
    }
    if (location.state?.message) {
      setInfoMessage(location.state.message);
    }
  }, [location.state]);

  const validateForm = () => {
    const errs = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errs.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setUnverifiedEmail('');
    setUnverifiedOtpCode('');
    setFieldErrors({});

    if (!validateForm()) {
      const msg = !email.trim() ? 'Please enter your email address.' : !password ? 'Please enter your password.' : 'Please correct the errors in the form.';
      setErrorMessage(msg);
      showToast(msg, 'error');
      return;
    }

    setLoading(true);

    try {
      const resp = await login({ email: email.trim(), password });

      // Handle remember me preference
      if (rememberMe) {
        localStorage.setItem('deport_remembered_email', email.trim());
      } else {
        localStorage.removeItem('deport_remembered_email');
      }

      if (resp?.requires_two_step) {
        setTwoStepEmail(resp.email || email.trim());
        setTwoStepDevCode(resp.otp_code || '');
        setTwoStepInputCode('');
        setTwoStepError('');
        setIsTwoStepOpen(true);
        showToast('Two-step verification code sent to your email.');
        return;
      }

      showToast('Welcome back to DEPORT!');
      navigate('/');
    } catch (err) {
      let mainError = 'Invalid email or password. Please try again.';

      if (err.response && err.response.data) {
        const data = err.response.data;

        if (data.is_unverified) {
          setUnverifiedEmail(data.email || email.trim());
          setUnverifiedOtpCode(data.otp_code || '');
          mainError = data.detail || 'Your email address is not yet verified. Please verify your account.';
        } else if (typeof data === 'string') {
          mainError = data;
        } else if (data.detail && typeof data.detail === 'string') {
          mainError = data.detail;
        } else if (data.non_field_errors) {
          mainError = Array.isArray(data.non_field_errors) ? data.non_field_errors.join(' ') : data.non_field_errors;
        } else if (typeof data === 'object') {
          const fErrs = {};
          const msgParts = [];
          Object.entries(data).forEach(([key, val]) => {
            const msg = Array.isArray(val) ? val.join(' ') : String(val);
            fErrs[key] = msg;
            msgParts.push(msg);
          });
          setFieldErrors(fErrs);
          mainError = msgParts[0] || 'Invalid credentials provided.';
        }
      } else if (err.message) {
        mainError = err.message.includes('Network')
          ? 'Network error. Please check your connection and ensure the server is active.'
          : err.message;
      }

      setErrorMessage(mainError);
      showToast(mainError, 'error');

      if (errorBannerRef.current) {
        errorBannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTwoFactor = async (e) => {
    e.preventDefault();
    if (!twoStepInputCode || twoStepInputCode.length !== 6) {
      setTwoStepError('Please enter a valid 6-digit verification code.');
      showToast('Please enter a valid 6-digit code.', 'error');
      return;
    }

    setTwoStepLoading(true);
    setTwoStepError('');
    try {
      await verifyTwoFactor(twoStepEmail, twoStepInputCode);
      showToast('Two-step verification successful! Welcome back.');
      setIsTwoStepOpen(false);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid verification code. Please check and try again.';
      setTwoStepError(msg);
      showToast(msg, 'error');
    } finally {
      setTwoStepLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setFieldErrors({});
    setGoogleLoading(true);

    try {
      const config = await authService.getGoogleConfig().catch(() => null);
      const clientId = config?.google_client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const currentOrigin = window.location.origin;
      const redirectUri = `${currentOrigin}/auth/google/callback`;

      if (!clientId) {
        const msg = 'Google Sign-In is not configured yet. Please configure GOOGLE_CLIENT_ID in the backend environment (.env).';
        setErrorMessage(msg);
        showToast(msg, 'error');
        setGoogleLoading(false);
        return;
      }

      const redirectToGoogleOAuth = () => {
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&access_type=offline&prompt=select_account`;
        window.location.href = googleAuthUrl;
      };

      // Ensure Google Identity Services SDK script is loaded
      if (!window.google?.accounts?.oauth2 && !window.google?.accounts?.id) {
        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Google Sign-In library.'));
            document.head.appendChild(script);
          });
        } catch (scriptErr) {
          redirectToGoogleOAuth();
          return;
        }
      }

      // Primary: Modern Google OAuth2 Token Client Popup
      if (window.google?.accounts?.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              const errDetail = tokenResponse.error_description || 'Google sign-in was cancelled or denied.';
              if (tokenResponse.error === 'popup_closed_by_user') {
                setGoogleLoading(false);
                return;
              }
              setErrorMessage(errDetail);
              showToast(errDetail, 'error');
              setGoogleLoading(false);
              return;
            }

            try {
              setGoogleLoading(true);
              const resp = await loginWithGoogle({
                token: tokenResponse.access_token,
                redirect_uri: redirectUri
              });
              if (resp?.requires_two_step) {
                setTwoStepEmail(resp.email);
                setTwoStepDevCode(resp.otp_code || '');
                setIsTwoStepOpen(true);
                return;
              }
              showToast('Signed in with Google successfully!');
              navigate('/');
            } catch (err) {
              const msg = err.response?.data?.detail || 'Google sign-in failed. Please try again.';
              setErrorMessage(msg);
              showToast(msg, 'error');
            } finally {
              setGoogleLoading(false);
            }
          },
          error_callback: (nonOAuthError) => {
            console.warn('Google GIS Popup error:', nonOAuthError);
            const errStr = String(nonOAuthError?.message || nonOAuthError?.type || JSON.stringify(nonOAuthError) || '');
            if (errStr.includes('origin_mismatch') || nonOAuthError?.type === 'origin_mismatch') {
              const originMsg = `Google OAuth Error: Origin '${currentOrigin}' is not registered in Google Cloud Console. Please add '${currentOrigin}' under 'Authorized JavaScript origins'.`;
              setErrorMessage(originMsg);
              showToast(originMsg, 'error');
              setGoogleLoading(false);
              return;
            }
            redirectToGoogleOAuth();
          }
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      }

      // Fallback: Standard Google OAuth2 redirect flow
      redirectToGoogleOAuth();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Unable to initiate Google sign-in.';
      setErrorMessage(msg);
      showToast(msg, 'error');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] grid grid-cols-1 lg:grid-cols-12 bg-[#0B0F0D]">
      {/* Left Column: Brand Visual Banner */}
      <div className="lg:col-span-6 relative hidden lg:block bg-[#070A08] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80"
          alt="DEPORT Premium Bag Visual"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F0D] via-[#0B0F0D]/40 to-transparent"></div>
        <div className="absolute bottom-16 left-12 right-12 text-white">
          <span className="text-[#10B981] text-xs font-bold tracking-[0.25em] uppercase block mb-3">
            Handcrafted Luxury
          </span>
          <h2 className="font-serif text-3xl font-light tracking-wide leading-snug mb-4">
            Carry Elegance, Anywhere You Go.
          </h2>
          <p className="text-gray-300 text-xs font-light max-w-md leading-relaxed">
            Welcome back to DEPORT. Access your curated selections, orders, and personalized bag preferences.
          </p>
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8 bg-[#131915] p-8 border border-[#10B981]/20 shadow-2xl">
          {/* Header */}
          <div className="text-center space-y-2">
            <span className="font-serif text-2xl tracking-[0.25em] text-[#10B981] font-bold block">
              DEPORT
            </span>
            <h1 className="font-serif text-3xl font-medium tracking-wide text-white">
              Client Sign In
            </h1>
            <p className="text-xs text-[#9CA3AF] font-light">
              Enter your credentials to access your luxury account
            </p>
          </div>

          {/* Prominent Error Alert Banner */}
          {errorMessage && (
            <div
              ref={errorBannerRef}
              className="p-4 bg-rose-950/90 border-2 border-rose-500 text-rose-200 text-xs shadow-xl animate-in fade-in duration-200"
            >
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-bold text-rose-100 text-sm tracking-wide">Sign In Issue</p>
                  <p className="text-rose-200 leading-relaxed">{errorMessage}</p>

                  {/* Unverified Account Assistance Link */}
                  {unverifiedEmail && (
                    <div className="pt-2 border-t border-rose-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-300 font-medium">Verification pending for this email:</span>
                      <Link
                        to="/verify-email"
                        state={{ email: unverifiedEmail, otpCode: unverifiedOtpCode }}
                        className="inline-flex items-center gap-1 bg-[#10B981] hover:bg-[#059669] text-black font-bold text-[11px] uppercase tracking-wider py-1.5 px-3 transition-colors shadow-sm text-center"
                      >
                        Verify Email Now <ArrowRight size={12} />
                      </Link>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage('')}
                  className="text-rose-400 hover:text-white p-1"
                  title="Dismiss error"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {infoMessage && (
            <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#10B981] shrink-0" />
                <span>{infoMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setInfoMessage('')}
                className="text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            <Input
              id="login-email"
              name="email"
              label="Email Address"
              type="email"
              placeholder="e.g. yourname@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                if (errorMessage) setErrorMessage('');
              }}
              error={fieldErrors.email}
              icon={Mail}
              required
            />

            <Input
              id="login-password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: '' });
                if (errorMessage) setErrorMessage('');
              }}
              error={fieldErrors.password}
              icon={Lock}
              required
              rightElement={
                <button
                  type="button"
                  id="login-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#10B981] hover:text-white transition-colors"
                  aria-label="Toggle Password Visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <div className="flex items-center justify-between text-xs">
              <label htmlFor="login-remember-me" className="flex items-center gap-2 cursor-pointer text-[#E5E7EB]">
                <input
                  id="login-remember-me"
                  name="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-[#10B981] w-3.5 h-3.5 cursor-pointer"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-[#10B981] hover:underline font-semibold">
                Forgot password?
              </Link>
            </div>

            {/* Bottom Error Bar right above the Submit button */}
            {errorMessage && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span className="truncate">{errorMessage}</span>
              </div>
            )}

            <Button
              id="login-submit-btn"
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              disabled={loading || googleLoading}
            >
              {loading ? 'Logging in...' : 'Sign In to DEPORT'}
            </Button>
          </form>

          {/* Social Single Sign-On Buttons */}
          <div className="space-y-4">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-4 text-[10px] uppercase tracking-widest text-[#9CA3AF] font-bold">
                Or continue with
              </span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div>
              {/* Google SSO */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
                className="w-full bg-[#161D19] text-white border border-[#10B981]/30 hover:border-[#10B981] hover:bg-[#10B981] hover:text-black font-semibold text-xs uppercase tracking-wider py-3.5 px-4 flex items-center justify-center gap-2.5 transition-all duration-300 disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-[#9CA3AF]">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#10B981] font-bold hover:underline">
              Create Account
            </Link>
          </p>

          <div className="text-center pt-2">
            <Link to="/" className="text-xs text-[#9CA3AF] hover:text-[#10B981] transition-colors inline-flex items-center gap-1 font-semibold tracking-wide">
              ← Return to Home Page
            </Link>
          </div>
        </div>
      </div>

      {/* Two-Step Verification Modal */}
      {isTwoStepOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#131915] border border-[#10B981]/40 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mx-auto text-[#10B981]">
                <ShieldCheck size={24} />
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#F3F4F6]">
                Two-Step Verification
              </h3>
              <p className="text-xs text-gray-400">
                A 6-digit verification code has been sent to <strong className="text-white">{twoStepEmail}</strong>.
              </p>
            </div>



            {twoStepError && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{twoStepError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyTwoFactor} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-300 mb-2 text-center">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  value={twoStepInputCode}
                  onChange={(e) => setTwoStepInputCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center font-mono text-2xl tracking-[0.4em] py-3.5 bg-[#0B0F0D] border border-[#1E2922] focus:border-[#10B981] text-white outline-hidden"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                loading={twoStepLoading}
                disabled={twoStepInputCode.length < 6}
              >
                Verify &amp; Sign In
              </Button>

              <button
                type="button"
                onClick={() => setIsTwoStepOpen(false)}
                className="w-full text-center text-xs text-gray-400 hover:text-white transition-colors"
              >
                Cancel and use different account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
