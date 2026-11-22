import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import userService from '../services/userService';
import authService from '../services/authService';
import addressService from '../services/addressService';
import { validateIndianPhoneNumber } from '../utils/phoneValidation';
import AccountSidebar from '../components/AccountSidebar';
import Input from '../components/Input';
import Button from '../components/Button';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Lock,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const { showToast } = useShop();
  const navigate = useNavigate();

  // Default address state
  const [defaultAddress, setDefaultAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);

  // 2FA Toggle state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [changingPassword, setChangingPassword] = useState(false);

  // Phone Update Modal State
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneFieldError, setPhoneFieldError] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [updatingPhone, setUpdatingPhone] = useState(false);

  useEffect(() => {
    if (user) {
      setTwoFactorEnabled(Boolean(user.is_two_factor_enabled));
    }
  }, [user]);

  // Fetch addresses to show default address on profile display
  useEffect(() => {
    const fetchAddress = async () => {
      try {
        const addresses = await addressService.getAddresses();
        const def = addresses.find((a) => a.is_default) || addresses[0] || null;
        setDefaultAddress(def);
      } catch (e) {
        // Silently catch
      } finally {
        setLoadingAddress(false);
      }
    };
    fetchAddress();
  }, []);

  if (!user) return null;

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U';

  // Phone Update Handlers
  const openPhoneModal = () => {
    const currentPhone = user?.phone || '';
    setPhoneInput(currentPhone);
    setPhoneSuccess('');
    setPhoneError('');
    if (currentPhone) {
      const res = validateIndianPhoneNumber(currentPhone, true);
      setPhoneFieldError(res.isValid ? '' : res.error);
      setIsPhoneValid(res.isValid);
    } else {
      setPhoneFieldError('');
      setIsPhoneValid(false);
    }
    setIsPhoneModalOpen(true);
  };

  const handlePhoneInputChange = (e) => {
    const val = e.target.value;
    setPhoneInput(val);
    setPhoneSuccess('');
    setPhoneError('');

    const res = validateIndianPhoneNumber(val, true);
    if (!res.isValid) {
      setPhoneFieldError(res.error);
      setIsPhoneValid(false);
    } else {
      setPhoneFieldError('');
      setIsPhoneValid(true);
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setPhoneError('');
    setPhoneSuccess('');

    const res = validateIndianPhoneNumber(phoneInput, true);
    if (!res.isValid) {
      setPhoneFieldError(res.error);
      setIsPhoneValid(false);
      return;
    }

    setUpdatingPhone(true);
    try {
      await userService.updateMyProfile({ phone: res.cleaned });
      await refreshUser();
      setPhoneSuccess('Phone number updated successfully.');
      showToast('Phone number updated successfully.');
      setTimeout(() => {
        setIsPhoneModalOpen(false);
        setPhoneSuccess('');
      }, 1000);
    } catch (err) {
      const resp = err.response?.data;
      const errMsg = resp?.phone || resp?.detail || 'Failed to update phone number. Please try again.';
      const formatted = Array.isArray(errMsg) ? errMsg[0] : String(errMsg);
      setPhoneError(formatted);
      setPhoneFieldError(formatted);
      showToast(formatted, 'error');
    } finally {
      setUpdatingPhone(false);
    }
  };

  // Toggle Two-Step Verification
  const handleToggleTwoFactor = async () => {
    setToggling2FA(true);
    try {
      const targetState = !twoFactorEnabled;
      const resp = await authService.toggleTwoFactor(targetState);
      setTwoFactorEnabled(resp.is_two_factor_enabled);
      await refreshUser();
      showToast(resp.message || `Two-step verification ${targetState ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update two-step verification.', 'error');
    } finally {
      setToggling2FA(false);
    }
  };

  // Change Password Handler
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordErrors({});

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordErrors({ confirm_password: 'New passwords do not match.' });
      return;
    }

    if (passwordData.new_password.length < 8) {
      setPasswordErrors({ new_password: ['Password must be at least 8 characters long.'] });
      return;
    }

    setChangingPassword(true);
    try {
      await userService.changePassword({
        old_password: passwordData.old_password,
        new_password: passwordData.new_password,
        confirm_password: passwordData.confirm_password
      });

      showToast('Password updated successfully.');
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
      setIsPasswordModalOpen(false);
    } catch (err) {
      if (err.response?.data) {
        setPasswordErrors(err.response.data);
      } else {
        setPasswordErrors({ general: 'Failed to update password.' });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-[#F3F4F6]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#1E2922] mb-10 gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            CLIENT ATELIER
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F3F4F6]">
            My Account &amp; Profile
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Review your personal client records, security authentication, and delivery settings.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Edit2}
          onClick={() => navigate('/profile/edit')}
        >
          Edit Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3">
          <AccountSidebar />
        </div>

        {/* Display Profile Content */}
        <div className="lg:col-span-9 space-y-8">
          {/* Main Profile Summary Card */}
          <div className="bg-[#131915] border border-[#1E2922] p-6 sm:p-8 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-[#1E2922]">
              {user.profile_image ? (
                <img
                  src={user.profile_image}
                  alt={user.full_name}
                  className="w-24 h-24 rounded-full object-cover border-2 border-[#10B981] shadow-lg shrink-0"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#0B0F0D] border-2 border-[#10B981] text-[#10B981] font-serif text-3xl font-bold flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}

              <div className="flex-1 text-center sm:text-left space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h2 className="font-serif text-2xl font-bold text-[#F3F4F6]">
                    {user.full_name}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 text-[10px] font-bold uppercase tracking-wider self-center sm:self-auto">
                    <ShieldCheck size={13} />
                    Verified Client
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-gray-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Mail size={14} className="text-[#10B981]" />
                    {user.email}
                  </span>
                  {user.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone size={14} className="text-[#10B981]" />
                      {user.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-[#10B981]" />
                    Member since {new Date(user.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">
                  First Name
                </span>
                <p className="text-sm font-medium text-[#F3F4F6]">{user.first_name || '—'}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">
                  Last Name
                </span>
                <p className="text-sm font-medium text-[#F3F4F6]">{user.last_name || '—'}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block">
                    Phone Number
                  </span>
                  <button
                    type="button"
                    onClick={openPhoneModal}
                    className="text-[11px] text-[#10B981] hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                  >
                    <Edit2 size={11} />
                    <span>{user.phone ? 'Update' : 'Add'}</span>
                  </button>
                </div>
                <p className="text-sm font-medium text-[#F3F4F6] font-mono">{user.phone || 'Not provided'}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">
                  Auth Method
                </span>
                <p className="text-sm font-medium text-[#10B981] uppercase tracking-wider font-mono">
                  {user.auth_provider || 'Email'}
                </p>
              </div>
            </div>
          </div>

          {/* Account Security & Two-Step Verification Section */}
          <div className="bg-[#131915] border border-[#1E2922] p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
                    Security &amp; Two-Step Verification
                  </h3>
                  <p className="text-xs text-gray-400">
                    Add an extra layer of security to protect your orders and personal data.
                  </p>
                </div>
              </div>
            </div>

            {/* 2FA Toggle Card */}
            <div className="p-4 bg-[#0B0F0D] border border-[#1E2922] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-sm text-[#F3F4F6]">
                    Two-Step Verification (2FA)
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${
                    twoFactorEnabled
                      ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30'
                      : 'bg-stone-800 text-stone-400 border-stone-700'
                  }`}>
                    {twoFactorEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  When enabled, signing in requires a 6-digit verification code sent to your registered email inbox.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleTwoFactor}
                disabled={toggling2FA}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                  twoFactorEnabled
                    ? 'bg-rose-950/20 text-rose-300 border-rose-800 hover:bg-rose-950/40'
                    : 'bg-[#10B981] text-black border-[#10B981] hover:bg-[#10B981]/90'
                }`}
              >
                {toggling2FA ? (
                  <span>Updating...</span>
                ) : twoFactorEnabled ? (
                  <>
                    <ToggleRight size={16} />
                    <span>Disable 2FA</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft size={16} />
                    <span>Enable 2FA</span>
                  </>
                )}
              </button>
            </div>

            {/* Password Management */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div>
                <span className="font-serif font-bold text-sm text-[#F3F4F6] block">
                  Password &amp; Credentials
                </span>
                <p className="text-xs text-gray-400">
                  Ensure you use a strong, unique password with at least 8 characters.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                icon={Lock}
                onClick={() => setIsPasswordModalOpen(true)}
              >
                Change Password
              </Button>
            </div>
          </div>

          {/* Delivery Address Snapshot Card */}
          <div className="bg-[#131915] border border-[#1E2922] p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
                    Primary Delivery Address
                  </h3>
                  <p className="text-xs text-gray-400">
                    Your default destination for complimentary luxury express shipping.
                  </p>
                </div>
              </div>

              <Link
                to="/addresses"
                className="inline-flex items-center gap-1.5 text-xs text-[#10B981] hover:underline font-semibold uppercase tracking-wider"
              >
                <span>Manage All</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {loadingAddress ? (
              <div className="p-6 text-center text-xs text-gray-400 uppercase tracking-wider">
                Loading primary address...
              </div>
            ) : defaultAddress ? (
              <div className="p-4 bg-[#0B0F0D] border border-[#1E2922] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-serif font-bold text-sm text-[#F3F4F6]">
                    {defaultAddress.full_name}
                  </span>
                  <span className="px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 text-[10px] font-bold uppercase tracking-wider">
                    {defaultAddress.address_type || 'Default'}
                  </span>
                </div>
                <p className="text-xs text-gray-300">
                  {defaultAddress.address_line_1}
                  {defaultAddress.address_line_2 && `, ${defaultAddress.address_line_2}`}
                </p>
                <p className="text-xs text-gray-400">
                  {defaultAddress.city}, {defaultAddress.state} {defaultAddress.postal_code}, {defaultAddress.country}
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  Phone: {defaultAddress.phone}
                </p>
              </div>
            ) : (
              <div className="p-6 bg-[#0B0F0D] border border-[#1E2922] text-center space-y-3">
                <p className="text-xs text-gray-400">
                  No default delivery address registered yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/addresses')}
                  icon={MapPin}
                >
                  Add Delivery Address
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#131915] border border-[#1E2922] p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <div className="flex items-center gap-2.5 text-[#10B981]">
                <Lock size={20} />
                <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
                  Change Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {passwordErrors.general && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {passwordErrors.general}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                placeholder="Enter current password"
                value={passwordData.old_password}
                onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                error={passwordErrors.old_password?.[0]}
                icon={Lock}
                required
              />

              <Input
                label="New Password"
                type="password"
                placeholder="Minimum 8 characters"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                error={passwordErrors.new_password?.[0]}
                icon={Lock}
                required
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter new password"
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                error={passwordErrors.confirm_password}
                icon={Lock}
                required
              />

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPasswordModalOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={changingPassword}
                >
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phone Number Update Modal */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#131915] border border-[#1E2922] p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <div className="flex items-center gap-2.5 text-[#10B981]">
                <Phone size={20} />
                <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
                  Update Phone Number
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPhoneModalOpen(false);
                  setPhoneError('');
                  setPhoneSuccess('');
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {phoneSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{phoneSuccess}</span>
              </div>
            )}

            {phoneError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{phoneError}</span>
              </div>
            )}

            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <Input
                  label="Indian Mobile Number"
                  type="tel"
                  placeholder="e.g. 9876543210 or +91 9876543210"
                  value={phoneInput}
                  onChange={handlePhoneInputChange}
                  error={phoneFieldError}
                  icon={Phone}
                  required
                />
                {phoneInput && !phoneFieldError && (
                  <p className="text-xs text-[#10B981] mt-1.5 flex items-center gap-1 font-medium">
                    <CheckCircle2 size={13} />
                    Valid 10-digit Indian mobile number
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  10-digit Indian mobile number starting with 6, 7, 8, or 9 (optional +91).
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPhoneModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={updatingPhone}
                  disabled={!isPhoneValid || updatingPhone}
                >
                  Save Phone Number
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
