import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';

const DEFAULT_FORM_DATA = {
  label: 'Home',
  full_name: '',
  phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'India',
  is_default: false,
};

export const AddressFormModal = ({
  isOpen,
  onClose,
  initialValues = null,
  onSave,
  isSubmitting = false,
}) => {
  const isEditMode = Boolean(initialValues && initialValues.id);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        setFormData({
          label: initialValues.label || 'Home',
          full_name: initialValues.full_name || '',
          phone: initialValues.phone || '',
          address_line_1: initialValues.address_line_1 || '',
          address_line_2: initialValues.address_line_2 || '',
          city: initialValues.city || '',
          state: initialValues.state || '',
          postal_code: initialValues.postal_code || '',
          country: initialValues.country || 'India',
          is_default: Boolean(initialValues.is_default),
        });
      } else {
        setFormData(DEFAULT_FORM_DATA);
      }
      setErrors({});
    }
  }, [isOpen, initialValues]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.label || !['Home', 'Office', 'Other'].includes(formData.label)) {
      newErrors.label = 'Label must be Home, Office, or Other.';
    }
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required.';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required.';
    } else if (!/^[+\d\s-]{7,20}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number.';
    }
    if (!formData.address_line_1.trim()) {
      newErrors.address_line_1 = 'Address line 1 is required.';
    }
    if (!formData.city.trim()) {
      newErrors.city = 'City is required.';
    }
    if (!formData.state.trim()) {
      newErrors.state = 'State is required.';
    }
    if (!formData.postal_code.trim()) {
      newErrors.postal_code = 'Postal code is required.';
    }
    if (!formData.country.trim()) {
      newErrors.country = 'Country is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      // Backend error will be handled or displayed via toast by caller
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Address' : 'Add New Address'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Address Label Selection */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="address-label-select" className="text-xs uppercase tracking-wider font-semibold text-gray-300">
            Address Label <span className="text-[#10B981]">*</span>
          </label>
          <select
            id="address-label-select"
            name="label"
            value={formData.label}
            onChange={handleChange}
            className={`w-full bg-[#161D19] text-[#F3F4F6] text-sm px-4 py-3 border transition-all duration-200 focus:outline-none ${
              errors.label
                ? 'border-rose-500 focus:border-rose-600'
                : 'border-[#1E2922] focus:border-[#10B981]'
            }`}
          >
            <option value="Home" className="bg-[#161D19] text-[#F3F4F6]">Home</option>
            <option value="Office" className="bg-[#161D19] text-[#F3F4F6]">Office</option>
            <option value="Other" className="bg-[#161D19] text-[#F3F4F6]">Other</option>
          </select>
          {errors.label && (
            <span className="text-xs text-rose-500 font-medium">{errors.label}</span>
          )}
        </div>

        {/* Full Name & Phone Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Full Name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="John Doe"
            error={errors.full_name}
            required
          />
          <Input
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+91 98765 43210"
            error={errors.phone}
            required
          />
        </div>

        {/* Address Lines */}
        <Input
          label="Address Line 1"
          name="address_line_1"
          value={formData.address_line_1}
          onChange={handleChange}
          placeholder="123 Main Street"
          error={errors.address_line_1}
          required
        />
        <Input
          label="Address Line 2 (Optional)"
          name="address_line_2"
          value={formData.address_line_2}
          onChange={handleChange}
          placeholder="Apartment 4B, Suite, etc."
          error={errors.address_line_2}
        />

        {/* City & State */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="City"
            name="city"
            value={formData.city}
            onChange={handleChange}
            placeholder="Taliparamba"
            error={errors.city}
            required
          />
          <Input
            label="State"
            name="state"
            value={formData.state}
            onChange={handleChange}
            placeholder="Kerala"
            error={errors.state}
            required
          />
        </div>

        {/* Postal Code & Country */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Postal Code"
            name="postal_code"
            value={formData.postal_code}
            onChange={handleChange}
            placeholder="670141"
            error={errors.postal_code}
            required
          />
          <Input
            label="Country"
            name="country"
            value={formData.country}
            onChange={handleChange}
            placeholder="India"
            error={errors.country}
            required
          />
        </div>

        {/* Default Address Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer pt-2 text-xs text-[#F3F4F6] font-medium">
          <input
            type="checkbox"
            name="is_default"
            checked={formData.is_default}
            onChange={handleChange}
            className="accent-[#10B981] w-4 h-4 cursor-pointer"
          />
          Set as default address
        </label>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-[#1E2922] flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Saving...'
              : isEditMode
              ? 'Save Changes'
              : 'Save Address'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddressFormModal;
