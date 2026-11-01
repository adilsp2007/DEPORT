import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { ShoppingBag, Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, RotateCcw } from 'lucide-react';

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { user, adminLogin, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');

  // If already logged in as admin, redirect directly to admin dashboard
  useEffect(() => {
    if (isAuthenticated && user && (user.is_staff || user.is_superuser)) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Ensure fields start completely blank without browser credential manager autofill
  useEffect(() => {
    const timer = setTimeout(() => {
      setEmail('');
      setPassword('');
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const validateForm = () => {
    const errs = {};
    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await adminLogin({
        email: email.trim(),
        password: password
      });
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data;

        if (status === 403) {
          setGeneralError(data.detail || 'Access denied. You do not have administrator permissions.');
        } else if (status === 401) {
          setGeneralError(data.detail || 'Invalid email or password.');
        } else if (data.detail) {
          setGeneralError(data.detail);
        } else {
          setErrors(data);
        }
      } else {
        setGeneralError('Network error. Unable to reach the server. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F0D] text-[#F3F4F6] flex flex-col justify-between selection:bg-[#10B981] selection:text-black">
      {/* Background Subtle Gradient Overlay */}
      <div className="fixed inset-0 bg-radial from-[#10B981]/5 via-transparent to-transparent pointer-events-none" />

      {/* Top Bar Branding */}
      <header className="relative z-10 p-6 md:p-8 flex items-center justify-between border-b border-[#1E2922]/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
            <ShoppingBag size={20} />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-wider text-[#F3F4F6]">
              DEPORT
            </span>
            <span className="text-[10px] block uppercase tracking-[0.25em] text-[#10B981] font-semibold">
              Admin Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium bg-[#131915] px-3 py-1.5 border border-[#1E2922]">
          <ShieldCheck size={14} className="text-[#10B981]" />
          <span>Secure Encrypted Session</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-[#131915] border border-[#1E2922] p-8 md:p-10 shadow-2xl shadow-black/80 relative overflow-hidden">
          {/* Card Top Border Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#10B981] to-transparent" />

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 bg-[#10B981]/10 border border-[#10B981]/20 rounded-full text-[#10B981] mb-4">
              <Lock size={22} />
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#F3F4F6] tracking-wide">
              Administrator Login
            </h1>
            <p className="text-xs text-gray-400 mt-2 font-light">
              Sign in with your DEPORT staff or superuser credentials to manage store operations.
            </p>
          </div>

          {/* Alert Error Banner */}
          {generalError && (
            <div className="mb-6 p-4 bg-rose-950/70 border-l-4 border-rose-500 text-rose-300 text-xs font-medium flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div>{generalError}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate autoComplete="off">
            {/* Hidden dummy decoy inputs to intercept aggressive browser autofill engines */}
            <input type="text" name="fake_admin_user" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
            <input type="password" name="fake_admin_pass" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="admin-email-input" className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                  Admin Email Address <span className="text-[#10B981]">*</span>
                </label>
                {(email || password) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('');
                      setPassword('');
                      setErrors({});
                    }}
                    className="text-[11px] text-gray-400 hover:text-[#10B981] flex items-center gap-1 transition-colors font-medium"
                    title="Clear entered credentials"
                  >
                    <RotateCcw size={11} />
                    <span>Clear fields</span>
                  </button>
                )}
              </div>

              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-[#10B981] pointer-events-none">
                  <Mail size={18} />
                </div>
                <input
                  id="admin-email-input"
                  type="email"
                  name="deport_admin_identifier"
                  placeholder="admin@deport.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                  }}
                  required
                  autoComplete="off"
                  className={`
                    w-full bg-[#161D19] text-[#F3F4F6] text-sm px-4 py-3 pl-11 border transition-all duration-200 focus:outline-none placeholder-[#9CA3AF]/50
                    ${errors.email
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-[#10B981]/30 focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]'
                    }
                  `}
                />
              </div>
              {errors.email && (
                <span className="text-xs text-rose-500 font-medium tracking-wide">
                  {errors.email}
                </span>
              )}
            </div>

            {/* Password input with show/hide toggle */}
            <div className="w-full flex flex-col gap-1.5">
              <label htmlFor="admin-password-input" className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                Password <span className="text-[#10B981]">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-[#10B981] pointer-events-none">
                  <Lock size={18} />
                </div>
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  name="deport_admin_secret_key"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  required
                  autoComplete="new-password"
                  className={`
                    w-full bg-[#161D19] text-[#F3F4F6] text-sm px-4 py-3 pl-11 pr-11 border transition-all duration-200 focus:outline-none placeholder-[#9CA3AF]/50
                    ${errors.password
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-[#10B981]/30 focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]'
                    }
                  `}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-gray-400 hover:text-[#10B981] transition-colors focus:outline-none"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <span className="text-xs text-rose-500 font-medium tracking-wide">
                  {errors.password}
                </span>
              )}
            </div>

            {/* Login Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading}
              className="w-full justify-center text-sm uppercase tracking-widest font-bold py-3.5 shadow-lg shadow-[#10B981]/10 mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In to Admin Dashboard'}
            </Button>
          </form>

          {/* Footer note */}
          <div className="mt-8 pt-6 border-t border-[#1E2922] text-center text-xs text-gray-500 font-light">
            Need customer shopping support?{' '}
            <a href="/" className="text-[#10B981] hover:underline font-medium">
              Return to DEPORT Store
            </a>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-gray-500 border-t border-[#1E2922]/60">
        &copy; {new Date().getFullYear()} DEPORT Luxury Bags. All rights reserved. Admin System.
      </footer>
    </div>
  );
};

export default AdminLoginPage;
