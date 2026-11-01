import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import { useShop } from '../context/ShopContext';
import Input from '../components/Input';
import Button from '../components/Button';
import {
  KeyRound,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';

export const ForgotPasswordPage = () => {
  const { showToast } = useShop();
  const navigate = useNavigate();

  // Step 1 = Request Code by Email, Step 2 = Enter Code & New Password
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [devCode, setDevCode] = useState(null);

  // 60-second Resend countdown timer for step 2
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            setCanResend(true);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Handle Step 1: Send Password Reset Code
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please enter your account email address.');
      return;
    }

    setLoading(true);
    try {
      const data = await authService.forgotPassword(email.trim());
      showToast('Password reset code sent to your email.');
      if (data.otp_code) {
        setDevCode(data.otp_code);
      }
      setStep(2);
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to request password reset code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend Code in Step 2
  const handleResend = async () => {
    if (!canResend) return;
    setError(null);
    setLoading(true);
    try {
      const data = await authService.forgotPassword(email.trim());
      showToast('A fresh reset code has been sent to your email.');
      if (data.otp_code) {
        setDevCode(data.otp_code);
      }
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Submit Code & Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);

    if (!code.trim() || code.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({
        email: email.trim(),
        code: code.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword
      });

      showToast('Password reset successful! Please log in with your new password.');
      navigate('/login');
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.detail) {
        setError(resp.detail);
      } else if (resp?.new_password) {
        setError(Array.isArray(resp.new_password) ? resp.new_password[0] : resp.new_password);
      } else {
        setError('Failed to reset password. Please check your code and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#0B0F0D]">
      <div className="max-w-md w-full bg-[#131915] border border-[#1E2922] p-8 shadow-2xl space-y-6">
        {/* Branding & Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mx-auto text-[#10B981]">
            <KeyRound size={24} />
          </div>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#F3F4F6]">
            {step === 1 ? 'Forgot Password' : 'Reset Password'}
          </h2>
          <p className="text-xs text-gray-400 font-light">
            {step === 1
              ? 'Enter your registered email address to receive a 6-digit password recovery code.'
              : `Enter the verification code sent to ${email} and choose your new password.`}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dev Code Helper */}
        {devCode && step === 2 && (
          <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs flex items-center justify-between">
            <span>Development OTP Code:</span>
            <strong className="font-mono text-sm tracking-widest">{devCode}</strong>
          </div>
        )}

        {/* Step 1: Email Form */}
        {step === 1 && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              icon={ArrowRight}
            >
              Send Reset Code
            </Button>
          </form>
        )}

        {/* Step 2: Code and New Password Form */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center font-mono text-2xl tracking-[0.3em] py-3 bg-[#0B0F0D] border border-[#1E2922] focus:border-[#10B981] text-[#F3F4F6] outline-hidden"
                required
              />
            </div>

            <div className="relative">
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                icon={Lock}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-9 text-gray-400 hover:text-[#10B981]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Input
              label="Confirm New Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-type new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={Lock}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              icon={CheckCircle2}
            >
              Confirm Password Reset
            </Button>

            {/* Resend and change email links */}
            <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-[#1E2922]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-[#10B981] transition-colors"
              >
                Change Email
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend || loading}
                className={`font-semibold transition-colors ${
                  canResend
                    ? 'text-[#10B981] hover:underline cursor-pointer'
                    : 'text-gray-600 cursor-not-allowed'
                }`}
              >
                {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
              </button>
            </div>
          </form>
        )}

        {/* Back to Login */}
        <div className="pt-4 border-t border-[#1E2922] text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400 hover:text-[#10B981] font-semibold transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
