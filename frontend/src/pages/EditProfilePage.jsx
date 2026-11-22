import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import userService from '../services/userService';
import authService from '../services/authService';
import { validateIndianPhoneNumber } from '../utils/phoneValidation';
import { parseApiError } from '../utils/errorHandler';
import AccountSidebar from '../components/AccountSidebar';
import Input from '../components/Input';
import Button from '../components/Button';
import {
  Camera,
  Trash2,
  Mail,
  Phone,
  User,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Save,
  KeyRound,
  ShieldCheck,
  X
} from 'lucide-react';

export const EditProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const { showToast } = useShop();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  });

  const [previewImage, setPreviewImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRemovingImage, setIsRemovingImage] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // Email Change OTP Verification State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState('');
  const [devOtpCode, setDevOtpCode] = useState('');

  // Sync user data on load
  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
      setPreviewImage(user.profile_image || null);
      setSelectedFile(null);
      setIsRemovingImage(false);
      setIsDirty(false);
    }
  }, [user]);

  if (!user) return null;

  const initials = `${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}`.toUpperCase() || 'U';
  const isEmailChanged = user.email && formData.email.trim().toLowerCase() !== user.email.toLowerCase();

  const getFieldError = (fieldName) => {
    const err = errors[fieldName];
    if (!err) return null;
    if (Array.isArray(err)) return err.join(' ');
    if (typeof err === 'string') return err;
    return String(err);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);

    if (name === 'phone') {
      const phoneRes = validateIndianPhoneNumber(value, true);
      if (!phoneRes.isValid) {
        setErrors((prev) => ({ ...prev, phone: phoneRes.error }));
      } else {
        setErrors((prev) => ({ ...prev, phone: null }));
      }
    } else if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ profile_image: ['File size cannot exceed 5 MB.'] });
        return;
      }

      setSelectedFile(file);
      setIsRemovingImage(false);
      setIsDirty(true);
      setErrors({});

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPreviewImage(null);
    setIsRemovingImage(true);
    setIsDirty(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Trigger Email Change OTP Request
  const handleRequestEmailChange = async () => {
    const newEmail = formData.email.trim();
    if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) {
      setErrors((prev) => ({ ...prev, email: 'Please enter a valid email address.' }));
      return;
    }

    setEmailOtpLoading(true);
    setEmailOtpError('');
    try {
      const resp = await authService.requestEmailChange(newEmail);
      showToast(`Verification code sent to ${newEmail}`);
      if (resp.otp_code) {
        setDevOtpCode(resp.otp_code);
      }
      setIsEmailModalOpen(true);
    } catch (err) {
      const parsed = parseApiError(err, 'Failed to send email verification code.');
      const emailErr = parsed.fieldErrors?.newEmail || parsed.fieldErrors?.new_email || parsed.fieldErrors?.email;
      if (emailErr) {
        setErrors((prev) => ({ ...prev, email: emailErr }));
      }
      showToast(parsed.message, 'error');
    } finally {
      setEmailOtpLoading(false);
    }
  };

  // Confirm Email Change with OTP
  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    if (!emailOtpCode || emailOtpCode.length !== 6) {
      setEmailOtpError('Please enter a 6-digit verification code.');
      return;
    }

    setEmailOtpLoading(true);
    setEmailOtpError('');
    try {
      await authService.verifyEmailChange(emailOtpCode.trim());
      await refreshUser();
      showToast('Email address verified and updated successfully!');
      setIsEmailModalOpen(false);
      setEmailOtpCode('');
      setDevOtpCode('');
    } catch (err) {
      const parsed = parseApiError(err, 'The OTP you entered is incorrect. Please try again.');
      setEmailOtpError(parsed.message);
    } finally {
      setEmailOtpLoading(false);
    }
  };

  // Save General Profile (Names, Phone, Photo)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side validation
    const newErrors = {};
    const trimmedFirstName = formData.first_name.trim();
    const trimmedLastName = formData.last_name.trim();
    const trimmedPhone = formData.phone.trim();

    if (!trimmedFirstName) {
      newErrors.first_name = 'First name is required.';
    } else if (trimmedFirstName.length < 2) {
      newErrors.first_name = 'First name must be at least 2 characters.';
    }

    const phoneRes = validateIndianPhoneNumber(trimmedPhone, true);
    if (!phoneRes.isValid) {
      newErrors.phone = phoneRes.error;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrMsg = Object.values(newErrors)[0];
      showToast(typeof firstErrMsg === 'string' ? firstErrMsg : 'Please correct the errors in the form.', 'error');
      return;
    }

    const cleanedPhone = phoneRes.cleaned;

    // If user changed email but didn't verify it via OTP, prompt them
    if (isEmailChanged) {
      showToast('Please verify your new email address with OTP before saving other profile changes.', 'info');
      handleRequestEmailChange();
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      if (selectedFile || isRemovingImage) {
        const payload = new FormData();
        payload.append('first_name', trimmedFirstName);
        payload.append('last_name', trimmedLastName);
        payload.append('phone', cleanedPhone);

        if (selectedFile) {
          payload.append('profile_image', selectedFile);
        } else if (isRemovingImage) {
          payload.append('remove_image', 'true');
        }

        await userService.updateMyProfile(payload);
      } else {
        await userService.updateMyProfile({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          phone: cleanedPhone
        });
      }

      await refreshUser();
      showToast('Profile information updated successfully.');
      setIsDirty(false);
      navigate('/profile');
    } catch (err) {
      const parsed = parseApiError(err, 'Failed to update profile. Please try again.');
      setErrors(parsed.fieldErrors);
      showToast(parsed.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-[#F3F4F6]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#1E2922] mb-10 gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#10B981] transition-colors mb-2 cursor-pointer font-semibold uppercase tracking-wider"
          >
            <ArrowLeft size={14} />
            <span>Return to Profile</span>
          </button>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F3F4F6]">
            Edit Profile Information
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Update your personal identity details, contact numbers, and verified email address.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3">
          <AccountSidebar />
        </div>

        {/* Edit Form Panel */}
        <div className="lg:col-span-9 bg-[#131915] border border-[#1E2922] p-6 sm:p-8 space-y-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* General Errors */}
            {errors.general && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {errors.general}
              </div>
            )}

            {/* Profile Avatar Editor */}
            <div className="pb-8 border-b border-[#1E2922]">
              <h3 className="font-serif text-lg font-bold text-[#F3F4F6] mb-4">
                Profile Photograph
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Avatar Preview"
                      className="w-24 h-24 rounded-full object-cover border-2 border-[#10B981] shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-[#0B0F0D] border-2 border-[#1E2922] text-[#10B981] font-serif text-2xl font-bold flex items-center justify-center">
                      {initials}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-[#10B981] text-black rounded-full hover:bg-white transition-colors shadow-md"
                    title="Upload New Photograph"
                  >
                    <Camera size={14} />
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />

                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      icon={Camera}
                    >
                      Change Photograph
                    </Button>

                    {(previewImage || user.profile_image) && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={handleRemovePhoto}
                        icon={Trash2}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    JPG, PNG or WEBP. Max file size: 5 MB.
                  </p>
                  {errors.profile_image && (
                    <p className="text-xs text-rose-400 font-medium">
                      {getFieldError('profile_image')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <div className="pb-8 border-b border-[#1E2922] space-y-6">
              <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
                Personal Identity
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="e.g. Eleanor"
                  error={getFieldError('first_name')}
                  icon={User}
                  required
                />

                <Input
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="e.g. Vance"
                  error={getFieldError('last_name')}
                  icon={User}
                  required
                />
              </div>

              <div>
                <Input
                  label="Phone Number (Indian Mobile)"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210 or +91 9876543210"
                  error={getFieldError('phone')}
                  icon={Phone}
                  required
                />
                {formData.phone && !getFieldError('phone') && (
                  <p className="text-xs text-[#10B981] mt-1.5 flex items-center gap-1 font-medium">
                    <CheckCircle2 size={13} />
                    Valid 10-digit Indian mobile number
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  10-digit Indian mobile number starting with 6, 7, 8, or 9 (optional +91).
                </p>
              </div>
            </div>

            {/* Email Edit with OTP Verification */}
            <div className="pb-8 border-b border-[#1E2922] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
                    Email Address Verification
                  </h3>
                  <p className="text-xs text-gray-400">
                    Changing your email address requires entering a 6-digit OTP code sent to your new inbox.
                  </p>
                </div>
                {user.is_email_verified && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30">
                    <ShieldCheck size={12} />
                    Verified
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                <div className="flex-1 w-full">
                  <Input
                    label="Primary Account Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                    icon={Mail}
                    required
                  />
                </div>

                {isEmailChanged && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleRequestEmailChange}
                    loading={emailOtpLoading}
                    icon={KeyRound}
                    className="shrink-0 mb-1"
                  >
                    Verify New Email
                  </Button>
                )}
              </div>

              {isEmailChanged && (
                <p className="text-xs text-amber-400 font-medium">
                  * You have changed your email address. Click "Verify New Email" to send an OTP and confirm your new address.
                </p>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => navigate('/profile')}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={saving}
                disabled={Boolean(getFieldError('phone')) || saving}
                icon={Save}
              >
                Save Profile Changes
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Email Change OTP Verification Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#131915] border border-[#1E2922] p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <div className="flex items-center gap-2.5 text-[#10B981]">
                <Mail size={22} />
                <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
                  Verify New Email
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              We sent a 6-digit confirmation code to <strong className="text-[#10B981]">{formData.email}</strong>.
              Enter it below to complete your email address update.
            </p>



            {emailOtpError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {emailOtpError}
              </div>
            )}

            <form onSubmit={handleVerifyEmailOtp} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-300 mb-2 text-center">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  value={emailOtpCode}
                  onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center font-mono text-2xl tracking-[0.4em] py-3.5 bg-[#0B0F0D] border border-[#1E2922] focus:border-[#10B981] text-white outline-hidden"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEmailModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={emailOtpLoading}
                >
                  Confirm &amp; Update Email
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfilePage;
