import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import cartService from '../services/cartService';
import addressService from '../services/addressService';
import authService from '../services/authService';
import orderService from '../services/orderService';

const getAuthToken = () => {
  return localStorage.getItem('deport_access_token') || localStorage.getItem('luxora_access_token');
};

const ShopContext = createContext();

export const ShopProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const [products] = useState([]);
  const [categories] = useState([]);
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('deport_cart') || localStorage.getItem('luxora_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [wishlist, setWishlist] = useState([]);
  const [user, setUser] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(() => {
    try {
      const saved = sessionStorage.getItem('deport_applied_coupon') || sessionStorage.getItem('luxora_applied_coupon');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Sync appliedCoupon to sessionStorage
  useEffect(() => {
    try {
      if (appliedCoupon) {
        sessionStorage.setItem('deport_applied_coupon', JSON.stringify(appliedCoupon));
      } else {
        sessionStorage.removeItem('deport_applied_coupon');
        sessionStorage.removeItem('luxora_applied_coupon');
      }
    } catch {}
  }, [appliedCoupon]);

  // UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Fetch Cart from backend if user is authenticated
  const syncCartFromBackend = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setCartLoading(true);
      const data = await cartService.getCart();
      if (data && data.items) {
        const normalizedItems = data.items.map((item) => ({
          id: item.id,
          product: item.product_detail || { id: item.product },
          quantity: item.quantity,
          selectedColor: { name: 'Default', hex: '#1E1B18' },
          itemTotal: item.item_total,
          is_in_stock: item.is_in_stock,
          has_sufficient_stock: item.has_sufficient_stock,
          max_allowed_quantity: item.max_allowed_quantity || 10,
        }));
        setCart(normalizedItems);
      }
    } catch (err) {
      // Graceful fallback to local cart if network error or unauthenticated
    } finally {
      setCartLoading(false);
    }
  }, []);

  // Fetch Addresses from backend if authenticated
  const syncAddressesFromBackend = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setAddresses([]);
      return;
    }
    try {
      const data = await addressService.getAddresses();
      if (Array.isArray(data)) {
        setAddresses(data);
      }
    } catch {
      // Graceful error fallback
    }
  }, []);

  useEffect(() => {
    syncCartFromBackend();
    syncAddressesFromBackend();
  }, [syncCartFromBackend, syncAddressesFromBackend]);

  // Persist local cart for guest users
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      try {
        localStorage.setItem('deport_cart', JSON.stringify(cart));
      } catch {}
    }
  }, [cart]);

  const addToCart = async (product, color = null, quantity = 1) => {
    // 1. Prevent adding blocked / unlisted products
    if (product.is_active === false || product.is_deleted === true) {
      showToast(`"${product.name}" is unlisted or unavailable.`, 'error');
      return { success: false, blocked: true };
    }

    if (product.category && (product.category.is_active === false || product.category.is_deleted === true)) {
      showToast(`Category for "${product.name}" is currently unlisted.`, 'error');
      return { success: false, blocked: true };
    }

    // 2. Check stock availability
    const availableStock = product.stock_quantity ?? 10;
    if (availableStock <= 0) {
      showToast(`"${product.name}" is currently out of stock.`, 'error');
      return { success: false, outOfStock: true };
    }

    const MAX_LIMIT = 10;
    const token = getAuthToken();

    // Helper to invalidate and update wishlist across UI (Navbar & Wishlist page)
    const removeProductFromWishlistCache = (prodId) => {
      setWishlist((prev) => prev.filter((p) => (p.id || p) !== prodId));
      queryClient.setQueryData(['wishlist'], (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item) => (item.product?.id || item.product) !== prodId);
      });
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    };

    // Try backend cart first if authenticated
    if (token) {
      try {
        setCartLoading(true);
        const res = await cartService.addToCart(product.id, quantity);
        showToast(`Added ${product.name} to your shopping bag`);
        await syncCartFromBackend();

        // 3. Remove product from wishlist state & React Query cache
        removeProductFromWishlistCache(product.id);
        return { success: true };
      } catch (err) {
        const errorMsg = err.response?.data?.detail || 'Failed to add item to shopping bag.';
        showToast(errorMsg, 'error');
        const isBlocked = err.response?.status === 400 && (
          errorMsg.toLowerCase().includes('unlisted') ||
          errorMsg.toLowerCase().includes('unavailable') ||
          errorMsg.toLowerCase().includes('inactive')
        );
        return { success: false, blocked: isBlocked, message: errorMsg };
      } finally {
        setCartLoading(false);
      }
    }

    // Guest fallback handling
    const selectedColor = color || (product.colors && product.colors[0]) || { name: 'Default', hex: '#1E1B18' };

    let validationFailed = false;
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.product.id === product.id && item.selectedColor.name === selectedColor.name
      );

      if (existingIndex > -1) {
        const currentQty = prevCart[existingIndex].quantity;
        const newQty = currentQty + quantity;

        if (newQty > availableStock) {
          showToast(`Only ${availableStock} units available in stock.`, 'error');
          validationFailed = true;
          return prevCart;
        }

        if (newQty > MAX_LIMIT) {
          showToast(`Maximum limit of ${MAX_LIMIT} units reached for this item.`, 'error');
          validationFailed = true;
          return prevCart;
        }

        const updated = [...prevCart];
        updated[existingIndex].quantity = newQty;
        return updated;
      }

      if (quantity > availableStock) {
        showToast(`Only ${availableStock} units available in stock.`, 'error');
        validationFailed = true;
        return prevCart;
      }

      if (quantity > MAX_LIMIT) {
        showToast(`Maximum limit of ${MAX_LIMIT} units per item.`, 'error');
        validationFailed = true;
        return prevCart;
      }

      return [
        ...prevCart,
        {
          id: `local-${Date.now()}`,
          product,
          selectedColor,
          quantity,
          is_in_stock: availableStock > 0,
          has_sufficient_stock: availableStock >= quantity,
          max_allowed_quantity: Math.min(availableStock, MAX_LIMIT),
        }
      ];
    });

    if (!validationFailed) {
      showToast(`Added ${product.name} to your shopping bag`);
      // Remove product from wishlist state & React Query cache
      removeProductFromWishlistCache(product.id);
      return { success: true };
    }
    return { success: false };
  };

  const updateCartQuantity = async (productId, colorName, newQuantity) => {
    const token = getAuthToken();
    const MAX_LIMIT = 10;

    if (token) {
      try {
        setCartLoading(true);
        await cartService.updateQuantity(productId, newQuantity);
        await syncCartFromBackend();
        return;
      } catch (err) {
        const errorMsg = err.response?.data?.detail || 'Failed to update quantity.';
        showToast(errorMsg, 'error');
        return;
      } finally {
        setCartLoading(false);
      }
    }

    if (newQuantity <= 0) {
      removeFromCart(productId, colorName);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId && (!colorName || item.selectedColor.name === colorName)) {
          const stock = item.product.stock_quantity ?? 10;
          if (newQuantity > stock) {
            showToast(`Cannot increase: only ${stock} in stock.`, 'error');
            return item;
          }
          if (newQuantity > MAX_LIMIT) {
            showToast(`Maximum order limit is ${MAX_LIMIT} units per item.`, 'error');
            return item;
          }
          return {
            ...item,
            quantity: newQuantity,
            has_sufficient_stock: stock >= newQuantity,
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = async (productId, colorName) => {
    const token = getAuthToken();

    if (token) {
      try {
        setCartLoading(true);
        await cartService.removeItem(productId);
        showToast('Removed item from shopping bag', 'info');
        await syncCartFromBackend();
        return;
      } catch (err) {
        showToast('Failed to remove item', 'error');
      } finally {
        setCartLoading(false);
      }
    }

    setCart((prevCart) =>
      prevCart.filter(
        (item) => !(item.product.id === productId && (!colorName || item.selectedColor.name === colorName))
      )
    );
    showToast('Removed item from shopping bag', 'info');
  };

  const clearCart = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        await cartService.clearCart();
      } catch {}
    }
    setCart([]);
    setAppliedCoupon(null);
  };

  const toggleWishlist = (product) => {
    setWishlist((prev) => {
      const exists = prev.some((p) => (p.id || p) === product.id);
      if (exists) {
        showToast(`Removed ${product.name} from wishlist`, 'info');
        return prev.filter((p) => (p.id || p) !== product.id);
      } else {
        showToast(`Saved ${product.name} to wishlist`);
        return [...prev, product];
      }
    });
  };

  const isWishlisted = (productId) => {
    return wishlist.some((p) => (p.id || p) === productId);
  };

  // Subtotal calculation
  const cartSubtotal = cart.reduce(
    (sum, item) => sum + (parseFloat(item.product.price) || 0) * item.quantity,
    0
  );

  const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);

  // Dynamic discount calculation based on current cartSubtotal
  const appliedDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    const minOrder = parseFloat(appliedCoupon.min_order_amount || 0);
    if (cartSubtotal < minOrder || cartSubtotal <= 0) {
      return 0;
    }
    if (appliedCoupon.discount_type === 'percentage') {
      const pct = parseFloat(appliedCoupon.discount_value || 0);
      let disc = Number(((cartSubtotal * pct) / 100).toFixed(2));
      if (appliedCoupon.max_discount_amount) {
        disc = Math.min(disc, parseFloat(appliedCoupon.max_discount_amount));
      }
      return Math.min(disc, cartSubtotal);
    } else {
      const fixed = parseFloat(appliedCoupon.discount_value || 0);
      let disc = Math.min(fixed, cartSubtotal);
      if (appliedCoupon.max_discount_amount) {
        disc = Math.min(disc, parseFloat(appliedCoupon.max_discount_amount));
      }
      return disc;
    }
  }, [appliedCoupon, cartSubtotal]);

  // Apply Coupon via backend validation API
  const applyCoupon = async (code) => {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) {
      return { success: false, detail: 'Please enter a promo code.' };
    }
    try {
      const res = await orderService.validateCoupon(normalized, cartSubtotal);
      if (res.valid) {
        setAppliedCoupon(res);
        return { success: true, data: res };
      }
      return { success: false, detail: res.detail || 'Coupon is not valid.' };
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.error || 'Invalid or expired promo code.';
      return { success: false, detail };
    }
  };

  // Remove Coupon via backend endpoint
  const removeCoupon = async () => {
    try {
      await orderService.removeCoupon(cartSubtotal);
    } catch {}
    setAppliedCoupon(null);
  };

  // Stock and Checkout Validation
  const getCheckoutStatus = () => {
    if (cart.length === 0) {
      return { canCheckout: false, reason: 'Your shopping bag is currently empty.' };
    }

    for (const item of cart) {
      const p = item.product;
      const stock = p.stock_quantity ?? 10;
      const isUnlisted = p.is_active === false || p.is_deleted === true;

      if (isUnlisted) {
        return {
          canCheckout: false,
          reason: `"${p.name}" is no longer available or unlisted. Please remove it from your bag to proceed.`,
        };
      }

      if (stock === 0) {
        return {
          canCheckout: false,
          reason: `"${p.name}" is sold out. Please remove it from your shopping bag before checkout.`,
        };
      }

      if (item.quantity > stock) {
        return {
          canCheckout: false,
          reason: `"${p.name}" only has ${stock} available in stock, but you have ${item.quantity} in your bag. Please adjust quantity.`,
        };
      }
    }

    return { canCheckout: true, reason: null };
  };

  const { canCheckout, reason: checkoutBlockReason } = getCheckoutStatus();

  const addAddress = async (newAddress) => {
    const token = getAuthToken();
    if (token) {
      try {
        const saved = await addressService.createAddress(newAddress);
        showToast('New address saved successfully');
        await syncAddressesFromBackend();
        return saved;
      } catch (err) {
        const msg = err.response?.data?.detail || 'Failed to save address';
        showToast(msg, 'error');
        throw err;
      }
    } else {
      const addressWithId = {
        ...newAddress,
        id: `addr-${Date.now()}`,
        is_default: addresses.length === 0 ? true : Boolean(newAddress.is_default || newAddress.isDefault)
      };
      setAddresses(prev => [...prev, addressWithId]);
      showToast('New address saved successfully');
      return addressWithId;
    }
  };

  const deleteAddress = async (addressId) => {
    const token = getAuthToken();
    if (token && typeof addressId === 'number') {
      try {
        await addressService.deleteAddress(addressId);
        showToast('Address removed', 'info');
        await syncAddressesFromBackend();
        return;
      } catch {
        showToast('Failed to remove address', 'error');
      }
    }
    setAddresses(prev => prev.filter(a => a.id !== addressId));
    showToast('Address removed', 'info');
  };

  const setDefaultAddress = async (addressId) => {
    const token = getAuthToken();
    if (token && typeof addressId === 'number') {
      try {
        await addressService.setDefaultAddress(addressId);
        showToast('Default shipping address updated');
        await syncAddressesFromBackend();
        return;
      } catch {
        showToast('Failed to update default address', 'error');
      }
    }
    setAddresses(prev =>
      prev.map(a => ({
        ...a,
        is_default: a.id === addressId,
        isDefault: a.id === addressId
      }))
    );
    showToast('Default shipping address updated');
  };

  return (
    <ShopContext.Provider
      value={{
        products,
        categories,
        cart,
        cartLoading,
        wishlist,
        user,
        addresses,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        toggleWishlist,
        isWishlisted,
        cartSubtotal,
        cartItemCount,
        appliedCoupon,
        appliedDiscount,
        applyCoupon,
        removeCoupon,
        setAppliedCoupon,
        canCheckout,
        checkoutBlockReason,
        syncCartFromBackend,
        searchQuery,
        setSearchQuery,
        isSearchOpen,
        setIsSearchOpen,
        isFilterDrawerOpen,
        setIsFilterDrawerOpen,
        toast,
        showToast,
        addAddress,
        deleteAddress,
        setDefaultAddress
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => useContext(ShopContext);
export default ShopContext;
