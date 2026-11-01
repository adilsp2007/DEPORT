import { useState, useEffect, useCallback } from 'react';
import addressService from '../services/addressService';
import { useShop } from '../context/ShopContext';

export const useAddresses = () => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useShop();

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await addressService.getAddresses();
      setAddresses(Array.isArray(data) ? data : (data?.results || []));
    } catch (err) {
      setError('Unable to load your addresses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const createAddress = async (addrData) => {
    try {
      const newAddr = await addressService.createAddress(addrData);
      showToast('Address added successfully.');
      await fetchAddresses();
      return newAddr;
    } catch (err) {
      showToast(err.response?.data?.detail || 'Unable to save address.', 'error');
      throw err;
    }
  };

  const updateAddress = async (id, addrData) => {
    try {
      const updated = await addressService.updateAddress(id, addrData);
      showToast('Address updated successfully.');
      await fetchAddresses();
      return updated;
    } catch (err) {
      showToast(err.response?.data?.detail || 'Unable to update address.', 'error');
      throw err;
    }
  };

  const deleteAddress = async (id) => {
    try {
      await addressService.deleteAddress(id);
      showToast('Address deleted successfully.', 'info');
      await fetchAddresses();
    } catch (err) {
      showToast('Unable to delete address.', 'error');
      throw err;
    }
  };

  const setDefaultAddress = async (id) => {
    try {
      await addressService.setDefaultAddress(id);
      showToast('Default address updated.');
      await fetchAddresses();
    } catch (err) {
      showToast('Unable to update default address.', 'error');
      throw err;
    }
  };

  return {
    addresses,
    loading,
    error,
    fetchAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress
  };
};

export default useAddresses;
