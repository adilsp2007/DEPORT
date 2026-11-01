import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import addressService from '../services/addressService';
import orderService from '../services/orderService';
import Button from '../components/Button';
import Input from '../components/Input';
import { formatINR } from '../utils/currencyUtils';
import {
  ShieldCheck,
  Truck,
  CreditCard,
  Banknote,
  MapPin,
  Plus,
  Edit2,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  X,
  Lock,
  Zap,
  ExternalLink
} from 'lucide-react';
import { loadRazorpayScript } from '../utils/razorpay';

export const CheckoutPage = () => {
  const queryClient = useQueryClient();
  const {
    cart,
    cartSubtotal,
    clearCart,
    showToast,
    appliedCoupon,
    appliedDiscount,
    applyCoupon,
    removeCoupon
  } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Address states
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  // Address Modal state (Add / Edit)
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    full_name: '',
    phone: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United States',
    is_default: false
  });
  const [addressErrors, setAddressErrors] = useState({});
  const [savingAddress, setSavingAddress] = useState(false);

  // Checkout order states (Razorpay is primary online gateway)
  const [paymentMethod, setPaymentMethod] = useState('Razorpay');
  const [couponCode, setCouponCode] = useState(appliedCoupon?.code || '');
  const [couponMessage, setCouponMessage] = useState(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    if (appliedCoupon?.code) {
      setCouponCode(appliedCoupon.code);
      setCouponMessage({
        type: 'success',
        text: appliedCoupon.message || `Coupon ${appliedCoupon.code} active (-${formatINR(appliedDiscount)})`
      });
    } else {
      setCouponMessage(null);
    }
  }, [appliedCoupon, appliedDiscount]);

  // Redirect if cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      navigate('/cart', { replace: true });
    }
  }, [cart, navigate]);

  // Load user saved addresses
  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const data = await addressService.getAddresses();
      const addrList = Array.isArray(data) ? data : data.results || [];
      setAddresses(addrList);

      if (addrList.length > 0) {
        const defaultAddr = addrList.find((a) => a.is_default) || addrList[0];
        setSelectedAddressId(defaultAddr.id);
      }
    } catch (err) {
      showToast('Could not load saved addresses.', 'error');
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  // Pricing calculations
  const shippingCost = cartSubtotal >= 300 || cartSubtotal === 0 ? 0 : 25;
  const taxRate = 0.05; // 5% Luxury atelier tax
  const estimatedTax = Number((cartSubtotal * taxRate).toFixed(2));
  const finalPrice = Math.max(0, cartSubtotal + shippingCost + estimatedTax - appliedDiscount);

  // Apply coupon code via backend validation API
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    setCouponMessage(null);
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    const res = await applyCoupon(code);
    if (res.success) {
      setCouponMessage({ type: 'success', text: res.data.message || `Coupon ${res.data.code} applied!` });
      showToast(res.data.message || `Coupon ${res.data.code} applied! -${formatINR(res.data.discount_amount || 0)}`);
    } else {
      setCouponMessage({ type: 'error', text: res.detail });
      showToast(res.detail, 'error');
    }
  };

  const handleRemoveCoupon = async () => {
    await removeCoupon();
    setCouponCode('');
    setCouponMessage(null);
    showToast('Promo code removed.', 'info');
  };

  // Open modal to add address
  const handleOpenAddAddress = () => {
    setEditingAddress(null);
    setAddressForm({
      label: 'Home',
      full_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '',
      phone: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'United States',
      is_default: addresses.length === 0
    });
    setAddressErrors({});
    setIsAddressModalOpen(true);
  };

  // Open modal to edit address
  const handleOpenEditAddress = (addr, e) => {
    e.stopPropagation();
    setEditingAddress(addr);
    setAddressForm({
      label: addr.label || 'Home',
      full_name: addr.full_name || '',
      phone: addr.phone || '',
      address_line_1: addr.address_line_1 || '',
      address_line_2: addr.address_line_2 || '',
      city: addr.city || '',
      state: addr.state || '',
      postal_code: addr.postal_code || '',
      country: addr.country || 'United States',
      is_default: addr.is_default || false
    });
    setAddressErrors({});
    setIsAddressModalOpen(true);
  };

  // Save address from modal
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!addressForm.full_name.trim()) errs.full_name = 'Full name is required.';
    if (!addressForm.phone.trim()) errs.phone = 'Contact phone is required.';
    if (!addressForm.address_line_1.trim()) errs.address_line_1 = 'Street address is required.';
    if (!addressForm.city.trim()) errs.city = 'City is required.';
    if (!addressForm.state.trim()) errs.state = 'State / Province is required.';
    if (!addressForm.postal_code.trim()) errs.postal_code = 'Postal / ZIP code is required.';

    if (Object.keys(errs).length > 0) {
      setAddressErrors(errs);
      return;
    }

    setSavingAddress(true);
    try {
      let saved;
      if (editingAddress) {
        saved = await addressService.updateAddress(editingAddress.id, addressForm);
        showToast('Delivery address updated successfully.');
      } else {
        saved = await addressService.createAddress(addressForm);
        showToast('New delivery address added successfully.');
      }

      await loadAddresses();
      if (saved?.id) {
        setSelectedAddressId(saved.id);
      }
      setIsAddressModalOpen(false);
    } catch (err) {
      if (err.response?.data) {
        setAddressErrors(err.response.data);
      } else {
        showToast('Failed to save address. Please try again.', 'error');
      }
    } finally {
      setSavingAddress(false);
    }
  };

  // Place Order Handler (Razorpay Standard Checkout & Cash on Delivery)
  const handlePlaceOrder = async () => {
    if (submittingOrder) return;
    if (!selectedAddressId) {
      showToast('Please select or add a shipping address to proceed.', 'error');
      return;
    }

    setSubmittingOrder(true);
    const idempotencyKey = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payload = {
        address_id: selectedAddressId,
        payment_method: paymentMethod,
        coupon_code: (appliedCoupon?.code || couponCode || '').trim().toUpperCase(),
        idempotency_key: idempotencyKey
      };

      const res = await orderService.checkout(payload);
      const createdOrder = res.order || res;

      // Invalidate products query cache so stock changes reflect immediately
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });

      // If Razorpay Online Payment Gateway
      if (paymentMethod === 'Razorpay') {
        const razorpayOrderId = res.razorpay_order_id;
        const razorpayKeyId = res.razorpay_key_id;
        const amountInPaise = res.amount || res.amount_in_paise;
        const currency = res.currency || 'INR';

        if (!razorpayKeyId) {
          showToast('Razorpay Key ID is not configured on the server. Please check backend configuration.', 'error');
          if (clearCart) clearCart();
          navigate(`/orders/${createdOrder.order_number || createdOrder.id}`);
          return;
        }

        let RazorpayClass;
        try {
          RazorpayClass = await loadRazorpayScript();
        } catch (loadErr) {
          showToast('Failed to load Razorpay checkout script. Please check your internet connection or ad-blocker.', 'error');
          if (clearCart) clearCart();
          navigate(`/orders/${createdOrder.order_number || createdOrder.id}`);
          return;
        }

        const rzpOptions = {
          key: razorpayKeyId,
          amount: amountInPaise,
          currency: currency,
          name: 'DEPORT Atelier',
          description: `Order #${createdOrder.order_number}`,
          order_id: razorpayOrderId,
          prefill: {
            name: selectedAddress?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
            email: user?.email || '',
            contact: selectedAddress?.phone || ''
          },
          notes: {
            order_id: String(createdOrder.id),
            order_number: createdOrder.order_number
          },
          theme: {
            color: '#10B981',
            backdrop_color: 'rgba(11, 15, 13, 0.95)'
          },
          handler: async function (response) {
            try {
              showToast('Verifying payment signature with atelier gateway...', 'info');
              const verifyRes = await orderService.verifyPayment(createdOrder.id, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });

              if (clearCart) clearCart();
              showToast('Payment verified successfully! Welcome to DEPORT.');
              navigate(`/order-success/${createdOrder.order_number || createdOrder.id}`, {
                replace: true,
                state: { order: verifyRes.order || createdOrder }
              });
            } catch (verifyErr) {
              const errMsg = verifyErr.response?.data?.detail || 'Cryptographic signature verification failed. Please contact support.';
              showToast(errMsg, 'error');
              if (clearCart) clearCart();
              navigate(`/orders/${createdOrder.order_number || createdOrder.id}`, { replace: true });
            }
          },
          modal: {
            ondismiss: async function () {
              try {
                await orderService.failPayment(createdOrder.id, {
                  reason: 'Customer dismissed Razorpay Checkout modal',
                  razorpay_order_id: razorpayOrderId
                });
              } catch {}
              if (clearCart) clearCart();
              showToast('Payment window dismissed. Your order is saved as Pending in Order History.', 'info');
              navigate(`/orders/${createdOrder.order_number || createdOrder.id}`, { replace: true });
            }
          }
        };

        const rzp = new RazorpayClass(rzpOptions);

        rzp.on('payment.failed', async function (failedResponse) {
          const failReason = failedResponse.error?.description || failedResponse.error?.reason || 'Payment failed at gateway';
          try {
            await orderService.failPayment(createdOrder.id, {
              reason: failReason,
              error_code: failedResponse.error?.code,
              error_description: failedResponse.error?.description,
              razorpay_order_id: razorpayOrderId,
              transaction_id: failedResponse.error?.metadata?.payment_id
            });
          } catch {}
          if (clearCart) clearCart();
          showToast(failReason, 'error');
          navigate(`/orders/${createdOrder.order_number || createdOrder.id}`, { replace: true });
        });

        rzp.open();
        return;
      }

      // Cash on Delivery
      if (clearCart) clearCart();
      showToast(`Order ${createdOrder.order_number} placed successfully!`);
      navigate(`/order-success/${createdOrder.order_number || createdOrder.id}`, {
        replace: true,
        state: { order: createdOrder }
      });
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to place order. Please check item availability.';
      showToast(msg, 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-[#F3F4F6]">
      {/* Checkout Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-xs text-gray-400">
        <Link to="/cart" className="hover:text-[#10B981] transition-colors">Shopping Bag</Link>
        <ChevronRight size={14} />
        <span className="text-[#10B981] font-semibold">Checkout & Fulfillment</span>
      </nav>

      {/* Page Title */}
      <div className="mb-10 pb-6 border-b border-[#1E2922] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            SECURE ATELIER CHECKOUT
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F3F4F6]">
            Complete Your Purchase
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400 bg-[#131915] px-3.5 py-2 border border-[#1E2922]">
          <Lock size={14} className="text-[#10B981]" />
          <span>256-Bit SSL Encrypted Checkout</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Column: Shipping Address & Payment Selection (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-10">
          {/* STEP 1: Shipping Address Selection */}
          <section className="bg-[#131915] border border-[#1E2922] p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[#10B981] text-black font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="font-serif text-xl font-medium text-[#F3F4F6]">
                  Shipping Address
                </h3>
              </div>

              <button
                type="button"
                onClick={handleOpenAddAddress}
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#10B981] hover:text-[#059669] transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Add New Address</span>
              </button>
            </div>

            {loadingAddresses ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading saved addresses...</div>
            ) : addresses.length === 0 ? (
              <div className="p-6 bg-[#161D19] border border-dashed border-[#1E2922] text-center space-y-3">
                <MapPin size={28} className="text-[#10B981] mx-auto opacity-70" />
                <p className="text-sm text-gray-300">You don't have any saved shipping addresses yet.</p>
                <Button variant="outline" size="sm" icon={Plus} onClick={handleOpenAddAddress}>
                  Add Delivery Address
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.id;
                  return (
                    <div
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`relative p-5 border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#161D19] border-[#10B981] shadow-lg shadow-[#10B981]/5'
                          : 'bg-[#0B0F0D] border-[#1E2922] hover:border-gray-700'
                      }`}
                    >
                      {/* Selection Indicator */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 border border-[#10B981]/20">
                          {addr.label || 'Home'}
                          {addr.is_default && ' • Default'}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditAddress(addr, e)}
                            className="text-gray-400 hover:text-white p-1"
                            title="Edit address"
                          >
                            <Edit2 size={13} />
                          </button>
                          {isSelected && (
                            <CheckCircle2 size={16} className="text-[#10B981]" />
                          )}
                        </div>
                      </div>

                      <h4 className="font-serif text-sm font-semibold text-[#F3F4F6] mb-1">
                        {addr.full_name}
                      </h4>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {addr.address_line_1}
                        {addr.address_line_2 && `, ${addr.address_line_2}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {addr.city}, {addr.state} {addr.postal_code}
                      </p>
                      <p className="text-xs text-gray-400">{addr.country}</p>
                      <p className="text-[11px] text-gray-500 font-mono mt-2">
                        Phone: {addr.phone}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* STEP 2: Payment Method (Cash on Delivery) */}
          <section className="bg-[#131915] border border-[#1E2922] p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#1E2922]">
              <span className="w-7 h-7 rounded-full bg-[#10B981] text-black font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="font-serif text-xl font-medium text-[#F3F4F6]">
                Payment Method
              </h3>
            </div>

            <div className="space-y-4">
              {/* Razorpay Standard Checkout (Primary & Recommended) */}
              <label
                onClick={() => setPaymentMethod('Razorpay')}
                className={`flex items-start gap-4 p-5 border cursor-pointer transition-all ${
                  paymentMethod === 'Razorpay'
                    ? 'bg-[#161D19] border-[#10B981] shadow-lg shadow-[#10B981]/10 ring-1 ring-[#10B981]/50'
                    : 'bg-[#0B0F0D] border-[#1E2922] hover:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="Razorpay"
                  checked={paymentMethod === 'Razorpay'}
                  onChange={() => setPaymentMethod('Razorpay')}
                  className="mt-1 accent-[#10B981]"
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CreditCard size={20} className="text-[#10B981]" />
                      <span className="font-serif text-base font-semibold text-[#F3F4F6]">
                        Razorpay Standard Checkout
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 border border-[#10B981]/30">
                        Cards &bull; UPI &bull; NetBanking &bull; Wallets
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed font-light">
                    Pay securely using UPI (Google Pay, PhonePe, Paytm), Credit / Debit Cards, NetBanking, or Digital Wallets powered by Razorpay's 256-bit SSL encrypted gateway.
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-500 font-mono">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <ShieldCheck size={13} /> 100% Secure Checkout
                    </span>
                    <span>&bull;</span>
                    <span>Test Mode Supported</span>
                  </div>
                </div>
              </label>

              {/* Cash on Delivery Option */}
              <label
                onClick={() => setPaymentMethod('Cash on Delivery')}
                className={`flex items-start gap-4 p-5 border cursor-pointer transition-all ${
                  paymentMethod === 'Cash on Delivery'
                    ? 'bg-[#161D19] border-[#10B981] shadow-lg shadow-[#10B981]/10 ring-1 ring-[#10B981]/50'
                    : 'bg-[#0B0F0D] border-[#1E2922] hover:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="Cash on Delivery"
                  checked={paymentMethod === 'Cash on Delivery'}
                  onChange={() => setPaymentMethod('Cash on Delivery')}
                  className="mt-1 accent-[#10B981]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote size={20} className="text-[#10B981]" />
                      <span className="font-serif text-base font-semibold text-[#F3F4F6]">
                        Cash on Delivery (COD)
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 bg-gray-800/40 px-2 py-0.5 border border-gray-700/50">
                      Zero Surcharge
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed font-light">
                    Pay securely in cash or via mobile courier upon receipt of your DEPORT package.
                    No advance online transaction or card details required.
                  </p>
                </div>
              </label>
            </div>
          </section>
        </div>

        {/* Right Column: Order Products Summary & Final Price (4 cols) */}
        <div className="lg:col-span-4 bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-xl space-y-6 sticky top-28">
          <div className="pb-4 border-b border-[#1E2922] flex items-center justify-between">
            <h3 className="font-serif text-xl font-medium text-[#F3F4F6]">
              Order Summary
            </h3>
            <span className="text-xs text-gray-400">
              {cart.reduce((c, i) => c + i.quantity, 0)} Items
            </span>
          </div>

          {/* Purchased Products Listing */}
          <div className="space-y-4 max-h-72 overflow-y-auto pr-1 divide-y divide-[#1E2922]">
            {cart.map((item) => {
              const product = item.product;
              const img =
                product.primary_image ||
                (Array.isArray(product.images) && (product.images[0]?.image || product.images[0])) ||
                null;
              const unitPrice = parseFloat(product.price) || 0;
              const itemTotal = unitPrice * item.quantity;

              return (
                <div key={item.id} className="pt-3 first:pt-0 flex items-center gap-3.5">
                  <div className="w-14 h-16 bg-[#161D19] border border-[#1E2922] flex-shrink-0 overflow-hidden">
                    {img ? (
                      <img src={img} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-serif text-xs text-[#10B981] font-bold">
                        LX
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h5 className="font-serif text-xs font-semibold text-[#F3F4F6] truncate">
                      {product.name}
                    </h5>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[10px] text-gray-400 font-mono">
                        Qty: {item.quantity} × <strong className="text-white">{formatINR(unitPrice)}</strong>
                      </p>
                      {product.compare_at_price && Number(product.compare_at_price) > unitPrice && (
                        <span className="text-[9px] text-gray-500 line-through">
                          {formatINR(product.compare_at_price)}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="font-serif text-xs font-bold text-[#10B981]">
                    {formatINR(itemTotal)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Coupon Code Input */}
          <form onSubmit={handleApplyCoupon} className="pt-4 border-t border-[#1E2922] space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Promo Code (e.g. DEPORT10)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                disabled={appliedDiscount > 0}
                className="flex-1 bg-[#161D19] text-[#F3F4F6] text-xs px-3 py-2 border border-[#1E2922] focus:outline-none focus:border-[#10B981] uppercase font-mono disabled:opacity-60"
              />
              {appliedDiscount > 0 ? (
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="px-4 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1E2922] hover:bg-[#10B981] text-white hover:text-black text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Apply
                </button>
              )}
            </div>
            {couponMessage && (
              <p
                className={`text-[11px] font-medium ${
                  couponMessage.type === 'success' ? 'text-[#10B981]' : 'text-rose-400'
                }`}
              >
                {couponMessage.text}
              </p>
            )}
          </form>

          {/* Price Breakdown */}
          <div className="pt-4 border-t border-[#1E2922] space-y-2.5 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-[#F3F4F6] font-medium font-mono">{formatINR(cartSubtotal)}</span>
            </div>

            <div className="flex justify-between">
              <span>Estimated Taxes (5%)</span>
              <span className="text-[#F3F4F6] font-medium font-mono">{formatINR(estimatedTax)}</span>
            </div>

            {appliedDiscount > 0 && (
              <div className="flex justify-between text-[#10B981]">
                <span>Promotional Atelier Discount</span>
                <span className="font-medium font-mono">-{formatINR(appliedDiscount)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Global Express Shipping</span>
              <span className={shippingCost === 0 ? 'text-[#10B981] font-semibold' : 'text-[#F3F4F6] font-mono'}>
                {shippingCost === 0 ? 'COMPLIMENTARY' : formatINR(shippingCost)}
              </span>
            </div>

            <div className="pt-4 border-t border-[#1E2922] flex justify-between items-baseline">
              <span className="font-serif text-base text-[#F3F4F6]">Final Price</span>
              <span className="font-serif text-2xl font-bold text-[#10B981]">
                {formatINR(finalPrice)}
              </span>
            </div>
          </div>

          {/* Place Order CTA Button */}
          <Button
            variant="primary"
            fullWidth
            size="lg"
            icon={ArrowRight}
            loading={submittingOrder}
            onClick={handlePlaceOrder}
            disabled={!selectedAddressId || submittingOrder}
          >
            {submittingOrder
              ? 'Processing Order...'
              : paymentMethod === 'Cash on Delivery'
              ? 'Place Order (Cash on Delivery)'
              : `Proceed to Payment (${formatINR(finalPrice)})`}
          </Button>

          {/* Perks */}
          <div className="pt-4 border-t border-[#1E2922] space-y-2 text-[11px] text-gray-400">
            <div className="flex items-center gap-2">
              <Truck size={14} className="text-[#10B981]" />
              <span>Complimentary insured shipping on all luxury bags</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#10B981]" />
              <span>DEPORT Lifetime Heritage Warranty Guarantee</span>
            </div>
          </div>
        </div>
      </div>

      {/* Address Modal (Add / Edit) */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922] mb-6">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-[#10B981]" />
                <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">
                  {editingAddress ? 'Edit Delivery Address' : 'Add New Delivery Address'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
                    Address Label
                  </label>
                  <select
                    value={addressForm.label}
                    onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                    className="w-full bg-[#161D19] text-[#F3F4F6] text-xs p-2.5 border border-[#1E2922] focus:outline-none focus:border-[#10B981]"
                  >
                    <option value="Home">Home</option>
                    <option value="Office">Office</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <Input
                  label="Contact Phone"
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  error={addressErrors.phone}
                  required
                />
              </div>

              <Input
                label="Recipient Full Name"
                value={addressForm.full_name}
                onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })}
                placeholder="Eleanor Vance"
                error={addressErrors.full_name}
                required
              />

              <Input
                label="Street Address Line 1"
                value={addressForm.address_line_1}
                onChange={(e) => setAddressForm({ ...addressForm, address_line_1: e.target.value })}
                placeholder="742 Evergreen Terrace"
                error={addressErrors.address_line_1}
                required
              />

              <Input
                label="Address Line 2 (Apartment, Suite, Unit)"
                value={addressForm.address_line_2}
                onChange={(e) => setAddressForm({ ...addressForm, address_line_2: e.target.value })}
                placeholder="Apt 4B"
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="City"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  placeholder="New York"
                  error={addressErrors.city}
                  required
                />

                <Input
                  label="State / Province"
                  value={addressForm.state}
                  onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                  placeholder="NY"
                  error={addressErrors.state}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Postal / ZIP Code"
                  value={addressForm.postal_code}
                  onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                  placeholder="10001"
                  error={addressErrors.postal_code}
                  required
                />

                <Input
                  label="Country"
                  value={addressForm.country}
                  onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                  placeholder="United States"
                  required
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={addressForm.is_default}
                  onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                  className="accent-[#10B981] w-4 h-4"
                />
                <span>Set as default shipping address</span>
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2922]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddressModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={savingAddress}>
                  Save & Select Address
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;
