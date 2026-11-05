import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Input from '../components/Input';
import Button from '../components/Button';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  ShieldCheck,
  Check,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import authService from '../services/authService';

export const SignupPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { register, verifyEmail, resendOTP, getOTPStatus, loginWithGoogle } = useAuth();
  const { showToast } = useShop();

  // Wizard Step: 'form' | 'verify' | 'success'
  const [currentStep, setCurrentStep] = useState(
    location.state?.step === 'verify' ? 'verify' : 'form'
  );

  // Form State
  const [formData, setFormData] = useState({
    firstName: location.state?.firstName || '',
    lastName: location.state?.lastName || '',
    email: location.state?.email || '',
    password: '',
    confirmPassword: '',
    agreeTerms: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorList, setErrorList] = useState([]);

  // Inline OTP Verification State (starts clean and empty for user entry)
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const errorBannerRef = useRef(null);
  const otpInputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ];

  // Cooldown countdown effect
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first empty OTP box when entering 'verify' step
  useEffect(() => {
    if (currentStep === 'verify') {
      const emptyIdx = otp.findIndex((d) => !d);
      const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
      if (otpInputRefs[targetIdx]?.current) {
        otpInputRefs[targetIdx].current.focus();
      }
    }
  }, [currentStep]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    const snakeName = name.replace(/([A-Z])/g, '_$1').toLowerCase();
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      delete next[snakeName];
      if (name === 'password' || name === 'confirmPassword') {
        delete next.password;
        delete next.confirm_password;
        delete next.confirmPassword;
      }
      return next;
    });
  };

  const getFieldError = (fieldName) => {
    let err = errors[fieldName];
    if (!err) {
      const altName = fieldName.includes('_')
        ? fieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        : fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
      err = errors[altName];
    }
    if (!err) return null;
    if (typeof err === 'string') return err;
    if (Array.isArray(err)) return err.join(' ');
    return String(err);
  };

  // Jump straight to OTP step for an existing pending email
  const handleSwitchToVerify = async (targetEmail) => {
    const emailToVerify = (targetEmail || formData.email).trim();
    if (!emailToVerify) {
      setErrors({ email: 'Please enter your email address first.' });
      return;
    }
    setFormData((prev) => ({ ...prev, email: emailToVerify }));
    localStorage.setItem('pending_verify_email', emailToVerify);
    setOtpError('');
    setOtpSuccess('');
    setOtp(['', '', '', '', '', '']);
    setOtpLoading(true);
    try {
      const statusRes = await getOTPStatus(emailToVerify);
      if (statusRes.is_verified) {
        showToast('This account is already verified! Please sign in.', 'info');
        navigate('/login', { state: { registeredEmail: emailToVerify } });
        return;
      }
      setCurrentStep('verify');
      if (statusRes?.is_expired) {
        setOtpError('Your previous verification code has expired. Click "Resend Code" below to receive a new code.');
      } else {
        setOtpSuccess('Please enter the 6-digit verification code sent to your email.');
      }
    } catch (e) {
      setCurrentStep('verify');
    } finally {
      setOtpLoading(false);
    }
  };

  // ----------------------------------------------------
  // STEP 1: SUBMIT SIGNUP (Registers user & triggers OTP)
  // ----------------------------------------------------
  const handleSignup = async (e) => {
    e.preventDefault();
    setErrors({});
    setErrorList([]);

    const newErrors = {};
    const errorMessages = [];
    const trimmedFirstName = formData.firstName.trim();
    const trimmedLastName = formData.lastName.trim();
    const trimmedEmail = formData.email.trim();

    if (!trimmedFirstName) {
      newErrors.first_name = 'First name is required.';
      errorMessages.push('First name is required.');
    } else if (trimmedFirstName.length < 2) {
      newErrors.first_name = 'First name must be at least 2 characters.';
      errorMessages.push('First name must be at least 2 characters.');
    }

    if (!trimmedLastName) {
      newErrors.last_name = 'Last name is required.';
      errorMessages.push('Last name is required.');
    } else if (trimmedLastName.length < 2) {
      newErrors.last_name = 'Last name must be at least 2 characters.';
      errorMessages.push('Last name must be at least 2 characters.');
    }

    if (!trimmedEmail) {
      newErrors.email = 'Email address is required.';
      errorMessages.push('Email address is required.');
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address.';
      errorMessages.push('Please enter a valid email address.');
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
      errorMessages.push('Password is required.');
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long.';
      errorMessages.push('Password must be at least 8 characters long.');
    }

    if (!formData.confirmPassword) {
      newErrors.confirm_password = 'Please confirm your password.';
      errorMessages.push('Please confirm your password.');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirm_password = 'Passwords do not match.';
      errorMessages.push('Passwords do not match.');
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the Terms of Service to create an account.';
      errorMessages.push('Please agree to the Terms of Service.');
    }

    if (Object.keys(newErrors).length > 0) {
      const firstError = errorMessages[0] || 'Please fix the highlighted errors below before creating your account.';
      setErrors({
        ...newErrors,
        general: firstError
      });
      setErrorList(errorMessages);
      showToast(firstError, 'error');
      if (errorBannerRef.current) {
        errorBannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    setLoading(true);

    try {
      const regData = await register({
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        email: trimmedEmail,
        password: formData.password,
        confirm_password: formData.confirmPassword
      });

      localStorage.setItem('pending_verify_email', trimmedEmail);
      // Clean OTP state for user entry (no auto-fill)
      setOtp(['', '', '', '', '', '']);
      setOtpError('');
      const successMsg = regData?.message || 'Verification code sent to your email. Please check your inbox.';
      setOtpSuccess(successMsg);
      showToast('Registration submitted! Please verify with your 6-digit code.', 'info');
      setCooldown(60);

      // Switch to inline OTP step right on this page!
      setCurrentStep('verify');
    } catch (err) {
      const normalized = {};
      const serverErrorList = [];
      let primaryMessage = 'Unable to register account. Please check your network connection.';

      if (err.response && err.response.data) {
        const data = err.response.data;
        const emailMsg = Array.isArray(data.email) ? data.email.join(' ') : String(data.email || '');

        if (emailMsg.toLowerCase().includes('pending verification')) {
          showToast('An account for this email is pending verification. Please enter your code.', 'info');
          await handleSwitchToVerify(trimmedEmail);
          return;
        }

        if (err.response.status === 503 && (data.email || data.user?.email)) {
          localStorage.setItem('pending_verify_email', trimmedEmail);
          setOtp(['', '', '', '', '', '']);
          setOtpSuccess('');
          setOtpError(data.detail || 'Verification email could not be delivered. Please click Resend Code to try again.');
          showToast('Account registered, but verification email could not be delivered. Please click Resend Code.', 'warning');
          setCooldown(0); // Allow immediate resend retry
          setCurrentStep('verify');
          return;
        }

        if (typeof data === 'string') {
          primaryMessage = data;
          normalized.general = data;
          serverErrorList.push(data);
        } else if (data.detail && typeof data.detail === 'string') {
          primaryMessage = data.detail;
          normalized.general = data.detail;
          serverErrorList.push(data.detail);
        } else {
          Object.entries(data).forEach(([key, val]) => {
            if (key === 'detail') return;
            const msg = Array.isArray(val) ? val.join(' ') : String(val);
            normalized[key] = msg;
            serverErrorList.push(msg);
          });

          primaryMessage = serverErrorList[0] || data.detail || 'Registration failed. Please check the errors below.';
          normalized.general = primaryMessage;
        }
      } else if (err.message) {
        primaryMessage = err.message.includes('Network')
          ? 'Network error. Please check your internet connection and backend server.'
          : err.message;
        normalized.general = primaryMessage;
        serverErrorList.push(primaryMessage);
      } else {
        normalized.general = primaryMessage;
        serverErrorList.push(primaryMessage);
      }

      setErrors(normalized);
      setErrorList(serverErrorList.length > 0 ? serverErrorList : [primaryMessage]);
      showToast(primaryMessage, 'error');

      if (errorBannerRef.current) {
        errorBannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // STEP 2: INLINE OTP VERIFICATION (PROPER WORKFLOW)
  // ----------------------------------------------------
  const handleOtpChange = (index, value) => {
    const cleanedDigits = value.replace(/\D/g, '');

    // Handle multiple digits (e.g. system paste or browser autofill)
    if (cleanedDigits.length > 1) {
      const newOtp = [...otp];
      const digitsToFill = cleanedDigits.slice(0, 6).split('');
      digitsToFill.forEach((d, i) => {
        if (index + i < 6) {
          newOtp[index + i] = d;
        }
      });
      setOtp(newOtp);
      if (otpError) setOtpError('');
      const nextIndex = Math.min(index + digitsToFill.length, 5);
      if (otpInputRefs[nextIndex]?.current) {
        otpInputRefs[nextIndex].current.focus();
      }
      return;
    }

    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    const newChar = value.slice(-1);
    newOtp[index] = newChar;
    setOtp(newOtp);
    if (otpError) setOtpError('');

    if (newChar && index < 5 && otpInputRefs[index + 1]?.current) {
      otpInputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0 && otpInputRefs[index - 1]?.current) {
        otpInputRefs[index - 1].current.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs[index - 1]?.current?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs[index + 1]?.current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    const cleanedDigits = pastedData.replace(/\D/g, '');
    if (cleanedDigits.length >= 6) {
      const digits = cleanedDigits.slice(0, 6).split('');
      setOtp(digits);
      if (otpInputRefs[5]?.current) otpInputRefs[5].current.focus();
    }
  };

  const maskEmail = (emailStr) => {
    if (!emailStr || typeof emailStr !== 'string' || !emailStr.includes('@')) {
      return emailStr || '';
    }
    const [localPart, domain] = emailStr.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0]}*@${domain}`;
    }
    const maskedLocal = localPart[0] + '*'.repeat(Math.min(localPart.length - 2, 5)) + localPart.slice(-1);
    return `${maskedLocal}@${domain}`;
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setOtpError('');
    setOtpSuccess('');

    const targetEmail = formData.email.trim();
    if (!targetEmail) {
      setOtpError('Email address is missing. Please go back to enter your email.');
      setCurrentStep('form');
      return;
    }

    const code = otp.join('').trim();
    if (code.length < 6) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }

    setOtpLoading(true);

    try {
      const res = await verifyEmail(targetEmail, code);
      localStorage.removeItem('pending_verify_email');
      setCurrentStep('success');
      showToast(res?.message || 'Email verified successfully! Welcome to DEPORT.');

      setTimeout(() => {
        navigate('/login', { state: { registeredEmail: targetEmail, message: 'Email verified successfully! Please sign in.' } });
      }, 1500);
    } catch (err) {
      if (err.response && err.response.data) {
        const data = err.response.data;
        if (data.already_verified) {
          setCurrentStep('success');
          showToast('Account is already verified! Welcome to DEPORT.');
          setTimeout(() => {
            navigate('/login', { state: { registeredEmail: targetEmail, message: 'Account is already verified. Please sign in.' } });
          }, 1500);
          return;
        }
        if (data.reason === 'EXPIRED') {
          setOtp(['', '', '', '', '', '']);
          setOtpError(data.detail || 'Your verification code has expired. Please click Resend Code to request a new code.');
          if (otpInputRefs[0]?.current) otpInputRefs[0].current.focus();
          return;
        }
        const detail = data.detail || data.non_field_errors?.[0];
        setOtpError(detail || 'Invalid verification code. Please check and try again.');
      } else {
        setOtpError('Unable to connect to the authentication server. Please check your network connection.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const targetEmail = formData.email.trim();
    if (!targetEmail) {
      setOtpError('Please enter your email address.');
      setCurrentStep('form');
      return;
    }

    if (cooldown > 0) return;
    setOtpError('');
    setOtpSuccess('');
    setOtpResending(true);

    try {
      const res = await resendOTP(targetEmail);
      setOtp(['', '', '', '', '', '']);
      const msg = res?.message || 'A fresh verification code has been sent to your email.';
      setOtpSuccess(msg);
      showToast(msg, 'info');
      setCooldown(res?.cooldown || 60);
      if (otpInputRefs[0]?.current) otpInputRefs[0].current.focus();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 429 && err.response?.data?.remaining_seconds) {
        setCooldown(err.response.data.remaining_seconds);
      } else if (err.response?.status === 503) {
        setCooldown(0);
      }
      setOtpError(detail || 'Failed to resend code. Please try again.');
    } finally {
      setOtpResending(false);
    }
  };

  const handleGoogleSignup = async () => {
    setErrors({});
    setErrorList([]);
    setGoogleLoading(true);

    try {
      const config = await authService.getGoogleConfig().catch(() => null);
      const clientId = config?.google_client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const currentOrigin = window.location.origin;
      const redirectUri = `${currentOrigin}/auth/google/callback`;

      if (!clientId) {
        const msg = 'Google Sign-In is not configured yet. Please configure GOOGLE_CLIENT_ID in the backend environment (.env).';
        setErrors({ general: msg });
        setErrorList([msg]);
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
              setErrors({ general: errDetail });
              setErrorList([errDetail]);
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
                showToast('Two-step verification code sent to your email.');
                navigate('/login', {
                  state: {
                    twoStepEmail: resp.email,
                    requiresTwoStep: true,
                    otpCode: resp.otp_code || ''
                  }
                });
                return;
              }
              showToast('Account created and signed in with Google successfully!');
              navigate('/');
            } catch (err) {
              const msg = err.response?.data?.detail || 'Google sign-up failed. Please try again.';
              setErrors({ general: msg });
              setErrorList([msg]);
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
              setErrors({ general: originMsg });
              setErrorList([originMsg]);
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
      const msg = err.response?.data?.detail || err.message || 'Google sign-up failed. Please try again.';
      setErrors({ general: msg });
      setErrorList([msg]);
      showToast(msg, 'error');
      setGoogleLoading(false);
    }
  };

  const emailAlreadyRegistered =
    getFieldError('email') &&
    getFieldError('email').toLowerCase().includes('already exists');

  const passwordsMatch =
    formData.confirmPassword &&
    formData.password === formData.confirmPassword;

  return (
    <div className="min-h-[85vh] grid grid-cols-1 lg:grid-cols-12 bg-[#0B0F0D]">
      {/* Left Column: Brand Visual Banner (Matches LoginPage) */}
      <div className="lg:col-span-6 relative hidden lg:block bg-[#070A08] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=80"
          alt="DEPORT Atelier Luxury Leathercraft"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F0D] via-[#0B0F0D]/40 to-transparent"></div>
        <div className="absolute bottom-16 left-12 right-12 text-white">
          <span className="text-[#10B981] text-xs font-bold tracking-[0.25em] uppercase block mb-3">
            JOIN DEPORT ATELIER
          </span>
          <h2 className="font-serif text-3xl font-light tracking-wide leading-snug mb-4">
            Crafted for Distinction, Made for You.
          </h2>
          <p className="text-gray-300 text-xs font-light max-w-md leading-relaxed mb-6">
            Become a DEPORT member to unlock bespoke privileges, private previews of seasonal leather drops, and personal order tracking.
          </p>
          <div className="space-y-2.5 pt-4 border-t border-white/10 text-xs text-gray-300">
            <div className="flex items-center gap-2.5">
              <Sparkles size={15} className="text-[#10B981] shrink-0" />
              <span>Complimentary global express shipping on all orders</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={15} className="text-[#10B981] shrink-0" />
              <span>Lifetime craftsmanship warranty on full-grain leather</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={15} className="text-[#10B981] shrink-0" />
              <span>Curated invitations to exclusive atelier salon releases</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Dynamic Signup / Inline OTP Card */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-6 bg-[#131915] p-8 sm:p-10 border border-[#10B981]/20 shadow-2xl">

          {/* ======================================================== */}
          {/* STATE A: STEP 1 - DETAILS FORM                           */}
          {/* ======================================================== */}
          {currentStep === 'form' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header */}
              <div className="text-center space-y-2">
                <span className="font-serif text-2xl tracking-[0.25em] text-[#10B981] font-bold block">
                  DEPORT
                </span>
                <h1 className="font-serif text-3xl font-medium tracking-wide text-white">
                  Create Your Account
                </h1>
                <p className="text-xs text-[#9CA3AF] font-light">
                  Step 1 of 2: Enter your details to join our private atelier
                </p>
              </div>

              {/* Error Alert Banner */}
              {errors.general && (
                <div
                  ref={errorBannerRef}
                  className="p-4 bg-rose-950/90 border-2 border-rose-500 text-rose-200 text-xs shadow-xl animate-in fade-in duration-200"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <p className="font-bold text-rose-100 text-sm tracking-wide">Registration Issue</p>
                      <p className="text-rose-200 leading-relaxed">{errors.general}</p>
                      {errorList.length > 1 && (
                        <ul className="list-disc list-inside space-y-1 pt-1 text-rose-300">
                          {errorList.map((errItem, idx) => (
                            <li key={idx} className="leading-relaxed">{errItem}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setErrors((prev) => ({ ...prev, general: null }));
                        setErrorList([]);
                      }}
                      className="text-rose-400 hover:text-white p-1"
                      title="Dismiss error"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSignup} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="signup-first-name"
                    label="First Name"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    error={getFieldError('first_name')}
                    icon={User}
                    required
                  />
                  <Input
                    id="signup-last-name"
                    label="Last Name"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    error={getFieldError('last_name')}
                    icon={User}
                    required
                  />
                </div>

                <div>
                  <Input
                    id="signup-email"
                    label="Email Address"
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    error={getFieldError('email')}
                    icon={Mail}
                    required
                  />

                  {/* Email Assistance Card for existing accounts */}
                  {emailAlreadyRegistered && (
                    <div className="mt-3 p-3.5 bg-[#161D19] border border-[#10B981]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-[#10B981] shrink-0" />
                        <span className="text-xs text-gray-200">Email already registered</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSwitchToVerify(formData.email.trim())}
                          className="bg-[#10B981] hover:bg-[#059669] text-black font-bold text-[11px] uppercase tracking-wider py-1.5 px-3 transition-colors shadow-sm text-center"
                        >
                          Verify Code
                        </button>
                        <Link
                          to="/login"
                          state={{ registeredEmail: formData.email.trim() }}
                          className="text-xs text-gray-300 hover:text-white underline ml-1"
                        >
                          Sign In
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Input
                    id="signup-password"
                    label="Password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    error={getFieldError('password')}
                    icon={Lock}
                    required
                    rightElement={
                      <button
                        type="button"
                        id="signup-toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#10B981] hover:text-white transition-colors"
                        aria-label="Toggle Password Visibility"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px] text-[#9CA3AF]">
                    <span>At least 8 characters</span>
                    {formData.password && (
                      <span
                        className={`font-medium ${
                          formData.password.length >= 8 ? 'text-[#10B981]' : 'text-amber-400'
                        }`}
                      >
                        {formData.password.length >= 8 ? '✓ Length OK' : `${formData.password.length}/8 chars`}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <Input
                    id="signup-confirm-password"
                    label="Confirm Password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    error={getFieldError('confirm_password')}
                    icon={Lock}
                    required
                    rightElement={
                      <button
                        type="button"
                        id="signup-toggle-confirm-password"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="text-[#10B981] hover:text-white transition-colors"
                        aria-label="Toggle Confirm Password Visibility"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                  />
                  {formData.confirmPassword && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                      {passwordsMatch ? (
                        <span className="text-[#10B981] flex items-center gap-1 font-medium">
                          <Check size={13} /> Passwords match
                        </span>
                      ) : (
                        <span className="text-rose-400 font-medium">
                          Passwords do not match yet
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Terms agreement checkbox */}
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-300">
                    <input
                      id="signup-agree-terms"
                      type="checkbox"
                      name="agreeTerms"
                      checked={formData.agreeTerms}
                      onChange={handleChange}
                      className="mt-0.5 accent-[#10B981] w-4 h-4 cursor-pointer rounded"
                    />
                    <span className="leading-relaxed">
                      I agree to the DEPORT Atelier{' '}
                      <span className="text-[#10B981] underline">Terms of Service</span> and{' '}
                      <span className="text-[#10B981] underline">Privacy Policy</span>.
                    </span>
                  </label>
                  {getFieldError('agreeTerms') && (
                    <span className="text-xs text-rose-400 block mt-1">
                      {getFieldError('agreeTerms')}
                    </span>
                  )}
                </div>

                <Button
                  id="signup-submit-btn"
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  loading={loading}
                  disabled={loading || googleLoading}
                  className="mt-2 tracking-wider uppercase font-bold text-xs py-3.5"
                >
                  {loading ? 'Creating Your Account...' : 'Continue to Verification'}
                </Button>
              </form>

              {/* Social Login */}
              <div className="space-y-4 pt-2">
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-4 text-[10px] uppercase tracking-widest text-[#9CA3AF] font-bold">
                    Or continue with
                  </span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <button
                  type="button"
                  id="signup-google-btn"
                  onClick={handleGoogleSignup}
                  disabled={loading || googleLoading}
                  className="w-full bg-[#161D19] text-white border border-[#10B981]/30 hover:border-[#10B981] hover:bg-[#10B981] hover:text-black font-semibold text-xs uppercase tracking-wider py-3.5 px-4 flex items-center justify-center gap-2.5 transition-all duration-300 disabled:opacity-50 shadow-sm"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{googleLoading ? 'Connecting Google...' : 'Continue with Google'}</span>
                </button>
              </div>

              {/* Footer */}
              <div className="pt-2 text-center text-xs text-[#9CA3AF] space-y-2">
                <p>
                  Already have an account?{' '}
                  <Link to="/login" className="text-[#10B981] font-bold hover:underline">
                    Sign In
                  </Link>
                </p>
                {formData.email && (
                  <p className="text-[11px] text-gray-400">
                    Already received a code?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchToVerify()}
                      className="text-[#10B981] underline hover:text-emerald-300 ml-1 font-semibold"
                    >
                      Verify Code Here
                    </button>
                  </p>
                )}
                <div className="border-t border-white/10 pt-3">
                  <Link
                    to="/"
                    className="text-xs text-[#9CA3AF] hover:text-[#10B981] transition-colors inline-flex items-center gap-1 font-semibold tracking-wide"
                  >
                    ← Return to Home Page
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STATE B: STEP 2 - INLINE OTP VERIFICATION                */}
          {/* ======================================================== */}
          {currentStep === 'verify' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-[#10B981]/15 text-[#10B981] rounded-full flex items-center justify-center mx-auto mb-2 border border-[#10B981]/30">
                  <ShieldCheck size={24} />
                </div>
                <span className="font-serif text-2xl tracking-[0.25em] text-[#10B981] font-bold block">
                  DEPORT
                </span>
                <h1 className="font-serif text-3xl font-medium tracking-wide text-white">
                  Verify Your Email
                </h1>
                <p className="text-xs text-[#9CA3AF] font-light">
                  Step 2 of 2: Enter the 6-digit code sent to activate your account
                </p>
              </div>

              {/* Target Email Banner */}
              <div className="bg-[#161D19] p-3.5 border border-[#10B981]/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Mail size={16} className="text-[#10B981] shrink-0" />
                  <span className="truncate text-gray-300">
                    Code sent to: <strong className="text-white font-medium">{maskEmail(formData.email)}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep('form')}
                  className="text-[#10B981] hover:underline text-[11px] font-semibold shrink-0 ml-2"
                >
                  Edit Email
                </button>
              </div>

              {/* Error Alert */}
              {otpError && (
                <div className="p-3.5 bg-rose-950/80 border-l-4 border-rose-500 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{otpError}</span>
                </div>
              )}

              {/* Success Alert */}
              {otpSuccess && (
                <div className="p-3.5 bg-[#10B981]/10 border-l-4 border-[#10B981] text-[#10B981] text-xs flex items-start gap-2.5 animate-in fade-in">
                  <Check size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{otpSuccess}</span>
                </div>
              )}

              {/* OTP Input Form */}
              <form onSubmit={handleVerifyOtp} className="space-y-6" noValidate>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block mb-3 text-center">
                    Enter 6-Digit Code Sent to Your Email
                  </label>
                  <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={otpInputRefs[idx]}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        maxLength={2}
                        value={digit}
                        onFocus={(e) => e.target.select()}
                        onPaste={handlePaste}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono bg-[#161D19] text-[#F3F4F6] border transition-all duration-200 focus:outline-none ${
                          otpError
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-[#10B981]/30 focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]'
                        }`}
                        disabled={otpLoading}
                        required
                      />
                    ))}
                  </div>
                </div>

                <Button
                  id="signup-verify-btn"
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  loading={otpLoading}
                  disabled={otpLoading || otp.join('').length < 6 || !formData.email.trim()}
                  className="uppercase font-bold tracking-wider text-xs py-3.5"
                >
                  {otpLoading ? 'Activating Account...' : 'Verify & Activate Account'}
                </Button>
              </form>

              {/* Resend OTP */}
              <div className="text-center pt-2 space-y-2 border-t border-white/10">
                <p className="text-xs text-[#9CA3AF]">
                  Didn't receive the verification code?
                </p>
                <button
                  type="button"
                  id="signup-resend-otp-btn"
                  onClick={handleResendOtp}
                  disabled={otpResending || otpLoading || cooldown > 0 || !formData.email.trim()}
                  className="text-xs font-bold uppercase tracking-wider text-[#10B981] hover:underline inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:no-underline"
                >
                  <RefreshCw size={13} className={otpResending ? 'animate-spin' : ''} />
                  {otpResending
                    ? 'Generating Code...'
                    : cooldown > 0
                    ? `Resend OTP in ${cooldown}s`
                    : 'Resend OTP'}
                </button>
              </div>

              {/* Return to details link */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-[#9CA3AF]">
                <button
                  type="button"
                  onClick={() => setCurrentStep('form')}
                  className="hover:text-white transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft size={13} /> Back to Details
                </button>
                <Link
                  to="/login"
                  state={{ registeredEmail: formData.email.trim() }}
                  className="text-[#10B981] hover:underline font-semibold"
                >
                  Sign In Instead →
                </Link>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STATE C: STEP 3 - SUCCESS / ACTIVATED                     */}
          {/* ======================================================== */}
          {currentStep === 'success' && (
            <div className="py-8 text-center space-y-6 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-[#10B981]/20 text-[#10B981] rounded-full flex items-center justify-center mx-auto border-2 border-[#10B981]/50 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                <CheckCircle2 size={36} className="text-[#10B981]" />
              </div>

              <div className="space-y-2">
                <h2 className="font-serif text-3xl text-white font-medium">
                  Welcome to DEPORT
                </h2>
                <p className="text-xs text-gray-300 leading-relaxed max-w-xs mx-auto">
                  Your account for <strong className="text-white">{formData.email}</strong> is now activated and verified.
                </p>
                <p className="text-[11px] text-[#10B981] font-mono tracking-wider pt-2">
                  Entering the Atelier boutique...
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => navigate('/login', { state: { registeredEmail: formData.email.trim(), message: 'Email verified successfully! Please sign in.' } })}
                  className="uppercase font-bold tracking-wider text-xs py-3.5"
                >
                  Proceed to Sign In <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SignupPage;
