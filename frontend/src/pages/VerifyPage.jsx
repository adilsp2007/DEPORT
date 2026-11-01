import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/Button';
import {
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Mail,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';

export const VerifyPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, resendOTP, getOTPStatus } = useAuth();
  const { showToast } = useShop();

  const initialEmail = location.state?.email || localStorage.getItem('pending_verify_email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(!initialEmail);
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [accountStatus, setAccountStatus] = useState(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  const [isSuccessVerified, setIsSuccessVerified] = useState(false);

  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ];

  // Check email status from backend
  const checkStatus = useCallback(async (targetEmail) => {
    if (!targetEmail || !targetEmail.includes('@')) return;
    try {
      const res = await getOTPStatus(targetEmail);
      setAccountStatus(res);
      if (res.is_verified) {
        setErrorMessage('');
      } else if (res?.otp_code) {
        setSuccessMessage(`Verification code: ${res.otp_code} (check console or email)`);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setAccountStatus({ not_found: true });
      }
    }
  }, [getOTPStatus]);

  useEffect(() => {
    if (email) {
      checkStatus(email.trim());
    }
  }, [email, checkStatus]);

  useEffect(() => {
    if (initialEmail) {
      localStorage.setItem('pending_verify_email', initialEmail);
    }
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
    }
  }, [initialEmail, location.state]);

  useEffect(() => {
    if (!isEditingEmail && !accountStatus?.is_verified && inputRefs[0].current && !otp[0]) {
      inputRefs[0].current.focus();
    }
  }, [isEditingEmail, accountStatus]);

  // Cooldown timer
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleOtpChange = (index, value) => {
    const cleanedDigits = value.replace(/\D/g, '');
    if (cleanedDigits.length > 1) {
      const newOtp = [...otp];
      const digitsToFill = cleanedDigits.slice(0, 6).split('');
      digitsToFill.forEach((d, i) => {
        if (index + i < 6) {
          newOtp[index + i] = d;
        }
      });
      setOtp(newOtp);
      if (errorMessage) setErrorMessage('');
      const nextIndex = Math.min(index + digitsToFill.length, 5);
      if (inputRefs[nextIndex]?.current) {
        inputRefs[nextIndex].current.focus();
      }
      return;
    }

    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (errorMessage) setErrorMessage('');

    if (value && index < 5 && inputRefs[index + 1]?.current) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0 && inputRefs[index - 1]?.current) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    const cleanedDigits = pastedData.replace(/\D/g, '');
    if (cleanedDigits.length >= 6) {
      const digits = cleanedDigits.slice(0, 6).split('');
      setOtp(digits);
      if (inputRefs[5]?.current) inputRefs[5].current.focus();
    }
  };

  const handleSaveEmail = (e) => {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    setEmail(trimmed);
    localStorage.setItem('pending_verify_email', trimmed);
    setIsEditingEmail(false);
    setErrorMessage('');
    checkStatus(trimmed);
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

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const targetEmail = email.trim();
    if (!targetEmail) {
      setErrorMessage('Please enter your email address.');
      setIsEditingEmail(true);
      return;
    }

    const code = otp.join('').trim();
    if (code.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      const res = await verifyEmail(targetEmail, code);
      localStorage.removeItem('pending_verify_email');
      setIsSuccessVerified(true);
      showToast(res?.message || 'Email verified successfully! Welcome to DEPORT.');
      setTimeout(() => {
        navigate('/login', { state: { registeredEmail: targetEmail, message: 'Email verified successfully! Please sign in.' } });
      }, 1500);
    } catch (err) {
      if (err.response && err.response.data) {
        const data = err.response.data;
        if (data.already_verified) {
          setIsSuccessVerified(true);
          showToast('Account is already verified! Welcome to DEPORT.');
          setTimeout(() => {
            navigate('/login', { state: { registeredEmail: targetEmail, message: 'Account is already verified. Please sign in.' } });
          }, 1500);
          return;
        }
        if (data.reason === 'EXPIRED') {
          setOtp(['', '', '', '', '', '']);
          setErrorMessage(data.detail || 'Your verification code has expired. Please click Resend Code to request a new code.');
          if (inputRefs[0]?.current) inputRefs[0].current.focus();
          return;
        }
        const detail = data.detail || data.non_field_errors?.[0];
        setErrorMessage(detail || 'Invalid verification code. Please check the code and try again.');
      } else {
        setErrorMessage('Unable to connect to the authentication server. Please check your network connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setErrorMessage('Please enter your email address to resend code.');
      setIsEditingEmail(true);
      return;
    }

    if (cooldown > 0) return;
    setErrorMessage('');
    setSuccessMessage('');
    setResending(true);

    try {
      const res = await resendOTP(targetEmail);
      localStorage.setItem('pending_verify_email', targetEmail);
      setOtp(['', '', '', '', '', '']);
      const msg = res?.otp_code
        ? `New verification code: ${res.otp_code} (check console or email)`
        : (res?.message || 'A new verification code has been sent to your email.');
      setSuccessMessage(msg);
      showToast(msg, 'info');
      setCooldown(res?.cooldown || 60);
      if (inputRefs[0]?.current) inputRefs[0].current.focus();
    } catch (err) {
      if (err.response && err.response.data) {
        const detail = err.response.data.detail;
        if (err.response.status === 429 && err.response.data.remaining_seconds) {
          setCooldown(err.response.data.remaining_seconds);
        }
        setErrorMessage(detail || 'Failed to resend verification code. Please try again.');
      } else {
        setErrorMessage('Failed to resend verification code. Please check your connection.');
      }
    } finally {
      setResending(false);
    }
  };

  const isAlreadyVerified = accountStatus?.is_verified || isSuccessVerified;

  return (
    <div className="min-h-[85vh] grid grid-cols-1 lg:grid-cols-12 bg-[#0B0F0D]">
      {/* Left Column: Brand Visual Banner (Matches LoginPage & SignupPage) */}
      <div className="lg:col-span-6 relative hidden lg:block bg-[#070A08] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80"
          alt="DEPORT Atelier Luxury Bag"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F0D] via-[#0B0F0D]/40 to-transparent"></div>
        <div className="absolute bottom-16 left-12 right-12 text-white">
          <span className="text-[#10B981] text-xs font-bold tracking-[0.25em] uppercase block mb-3">
            ATELIER SECURITY
          </span>
          <h2 className="font-serif text-3xl font-light tracking-wide leading-snug mb-4">
            Protecting Your Bespoke Experience.
          </h2>
          <p className="text-gray-300 text-xs font-light max-w-md leading-relaxed mb-6">
            We safeguard your account with high-grade cryptographic verification to guarantee secure orders, private releases, and personalized bag tailoring.
          </p>
          <div className="space-y-2.5 pt-4 border-t border-white/10 text-xs text-gray-300">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={15} className="text-[#10B981] shrink-0" />
              <span>Instant encrypted email verification</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Sparkles size={15} className="text-[#10B981] shrink-0" />
              <span>Direct activation into the DEPORT Atelier network</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Verification Form */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-6 bg-[#131915] p-8 sm:p-10 border border-[#10B981]/20 shadow-2xl">
          {/* Top Brand Tag & Heading */}
          <div className="text-center space-y-2">
            <span className="font-serif text-2xl tracking-[0.25em] text-[#10B981] font-bold block">
              DEPORT
            </span>
            <h1 className="font-serif text-3xl font-medium tracking-wide text-white">
              {isAlreadyVerified ? 'Email Verified' : 'Verify Your Email'}
            </h1>
            <p className="text-xs text-[#9CA3AF] font-light">
              {isAlreadyVerified
                ? 'Your account is active and verified'
                : 'Enter your 6-digit verification code below'}
            </p>
          </div>

          {/* STATE 1: ALREADY VERIFIED */}
          {isAlreadyVerified ? (
            <div className="py-6 text-center space-y-6 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-[#10B981]/20 text-[#10B981] rounded-full flex items-center justify-center mx-auto border-2 border-[#10B981]/50 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
                <CheckCircle2 size={36} className="text-[#10B981]" />
              </div>

              <div className="space-y-2 bg-[#161D19] p-4 border border-[#10B981]/30">
                <p className="text-xs font-bold uppercase tracking-wider text-[#10B981]">
                  Account Confirmed & Active
                </p>
                <p className="text-xs text-gray-200 leading-relaxed">
                  The email address <strong className="text-white font-mono">{email}</strong> has completed verification. No further code is needed.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  id="verified-login-btn"
                  to="/login"
                  state={{ registeredEmail: email.trim() }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-black font-bold text-xs uppercase tracking-wider py-3.5 px-6 transition-all shadow-md"
                >
                  Sign In to DEPORT <ArrowRight size={15} />
                </Link>

                <Link
                  to="/"
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#161D19] hover:bg-[#1E2922] text-gray-300 border border-white/10 font-bold text-xs uppercase tracking-wider py-3.5 px-6 transition-all text-center"
                >
                  Explore Storefront
                </Link>
              </div>
            </div>
          ) : accountStatus?.not_found ? (
            /* STATE 2: ACCOUNT NOT FOUND */
            <div className="py-6 text-center space-y-5 animate-in fade-in duration-300">
              <div className="w-14 h-14 bg-amber-950/80 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-600">
                <AlertCircle size={28} />
              </div>
              <div className="space-y-2 bg-[#161D19] p-4 border border-amber-500/30 text-amber-200">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Account Not Registered
                </p>
                <p className="text-xs leading-relaxed">
                  No account was found for <strong className="text-white">{email}</strong>. Please create an account to begin.
                </p>
              </div>
              <Link
                to="/signup"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-black font-bold text-xs uppercase tracking-wider py-3.5 px-6 transition-all shadow-md"
              >
                Go to Sign Up <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            /* STATE 3: PENDING VERIFICATION */
            <>
              {/* Target Email Row with Change option */}
              <div className="bg-[#161D19] p-3.5 border border-[#10B981]/30 text-xs">
                {isEditingEmail ? (
                  <form onSubmit={handleSaveEmail} className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-gray-300 block">
                      Change Target Email
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="name@example.com"
                        className="flex-1 bg-[#0B0F0D] text-[#F3F4F6] text-xs px-3 py-2 border border-[#10B981]/50 focus:outline-none"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-[#10B981] hover:bg-[#059669] text-black text-xs font-bold px-3 py-2"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingEmail(false)}
                        className="text-gray-400 hover:text-white text-xs px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Mail size={16} className="text-[#10B981] shrink-0" />
                      <span className="truncate text-gray-300">
                        Code sent to: <strong className="text-white font-medium">{maskEmail(email)}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailInput(email);
                        setIsEditingEmail(true);
                      }}
                      className="text-[#10B981] hover:underline text-[11px] font-semibold shrink-0 ml-2"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3.5 bg-rose-950/80 border-l-4 border-rose-500 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {/* Success Alert */}
              {successMessage && (
                <div className="p-3.5 bg-[#10B981]/10 border-l-4 border-[#10B981] text-[#10B981] text-xs flex items-start gap-2.5 animate-in fade-in">
                  <Check size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{successMessage}</span>
                </div>
              )}

              {/* OTP Form */}
              <form onSubmit={handleVerify} className="space-y-6" noValidate>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block mb-3 text-center">
                    Enter 6-Digit Code Sent to Your Email
                  </label>
                  <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={inputRefs[idx]}
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
                          errorMessage
                            ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                            : 'border-[#10B981]/30 focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]'
                        }`}
                        disabled={loading}
                        required
                      />
                    ))}
                  </div>
                </div>

                <Button
                  id="verify-email-submit-btn"
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  loading={loading}
                  disabled={loading || otp.join('').length < 6 || !email.trim()}
                  className="uppercase font-bold tracking-wider text-xs py-3.5"
                >
                  {loading ? 'Verifying Account...' : 'Verify Email'}
                </Button>
              </form>

              {/* Resend OTP */}
              <div className="text-center pt-2 space-y-2 border-t border-white/10">
                <p className="text-xs text-[#9CA3AF]">
                  Didn't receive the verification code?
                </p>
                <button
                  type="button"
                  id="resend-otp-btn"
                  onClick={handleResendCode}
                  disabled={resending || loading || cooldown > 0 || !email.trim()}
                  className="text-xs font-bold uppercase tracking-wider text-[#10B981] hover:underline inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:no-underline"
                >
                  <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                  {resending
                    ? 'Generating Code...'
                    : cooldown > 0
                    ? `Resend OTP in ${cooldown}s`
                    : 'Resend OTP'}
                </button>
              </div>

              {/* Navigation Links */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-[#9CA3AF]">
                <Link
                  to="/signup"
                  className="hover:text-white transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft size={13} /> Back to Signup
                </Link>
                <Link
                  to="/login"
                  className="text-[#10B981] hover:underline font-semibold"
                >
                  Sign In Instead →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyPage;
