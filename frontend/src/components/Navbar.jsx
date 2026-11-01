import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Heart, ShoppingBag, User, Menu, X, LogOut, MapPin, Package } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../hooks/useWishlist';
import SearchBar from './SearchBar';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const { cartItemCount, isSearchOpen, setIsSearchOpen, showToast } = useShop();
  const { user, isAuthenticated, logout } = useAuth();
  const { wishlistCount } = useWishlist();

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserDropdownOpen(false);
  }, [location]);

  const handleLogout = async () => {
    await logout();
    showToast("You've been logged out.", 'info');
    navigate('/signup');
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: 'Collections', path: '/shop?category=all' },
    { name: 'New Arrivals', path: '/shop?is_new=true' }
  ];

  return (
    <>
      {/* Top Announcement Bar */}
      <div className="bg-[#070A08] text-[#10B981] text-[11px] uppercase tracking-widest py-2 text-center font-medium border-b border-[#10B981]/20">
        Complimentary Global Express Shipping & Luxury Gift Packaging on Orders Over ₹300
      </div>

      {/* Main Header Nav */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#0B0F0D]/95 backdrop-blur-md shadow-xl py-4 border-b border-[#10B981]/30'
            : 'bg-[#0B0F0D] border-b border-[#10B981]/20 py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Mobile Hamburger Menu Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-[#E5E7EB] hover:text-[#10B981] p-1"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Desktop Navigation Links (Left) */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`text-xs uppercase tracking-widest font-semibold transition-colors duration-200 relative ${
                    isActive
                      ? 'text-[#10B981]'
                      : 'text-[#E5E7EB] hover:text-[#10B981]'
                  }`}
                >
                  {link.name}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-[#10B981]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Brand Logo Center */}
          <Link to="/" className="flex flex-col items-center group text-center">
            <span className="font-serif text-2xl md:text-3xl tracking-widest font-normal text-white group-hover:text-[#10B981] transition-colors">
              DEPORT
            </span>
            <span className="text-[9px] uppercase tracking-[0.25em] text-[#10B981] -mt-0.5 font-semibold">
              Carry Your Style
            </span>
          </Link>

          {/* Action Icons Right */}
          <div className="flex items-center gap-5 sm:gap-6">
            {/* Search Icon */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="text-[#E5E7EB] hover:text-[#10B981] transition-colors p-1"
              aria-label="Search Products"
            >
              <Search size={20} />
            </button>

            {/* Wishlist Icon */}
            <Link
              to="/wishlist"
              className="text-[#E5E7EB] hover:text-[#10B981] transition-colors relative p-1"
              aria-label="View Wishlist"
            >
              <Heart size={20} />
              {isAuthenticated && wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-[#10B981] text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Bag Icon */}
            <Link
              to="/cart"
              className="text-[#E5E7EB] hover:text-[#10B981] transition-colors relative p-1"
              aria-label="View Cart"
            >
              <ShoppingBag size={20} />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-[#10B981] text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Link>

            {/* User Account / Profile Icon with Dropdown */}
            <div className="relative hidden sm:block">
              {isAuthenticated ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-[#E5E7EB] hover:text-[#10B981] transition-colors p-1"
                  >
                    <User size={20} />
                    <span className="hidden md:inline font-medium text-xs">
                      Hi, {user.first_name || 'Client'}
                    </span>
                  </button>

                  {/* Account Dropdown Menu */}
                  {isUserDropdownOpen && (
                    <div className="absolute right-0 mt-3 w-56 bg-[#131915] border border-[#10B981]/30 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-[#E5E7EB]">
                      <div className="px-4 py-3 border-b border-[#10B981]/20 bg-[#0B0F0D]">
                        <p className="text-xs font-serif font-bold text-white">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-[11px] text-[#9CA3AF] truncate">{user.email}</p>
                      </div>

                      <Link
                        to="/profile"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#E5E7EB] hover:bg-[#1A241F] hover:text-[#10B981] transition-colors"
                      >
                        <User size={15} /> My Profile
                      </Link>

                      <Link
                        to="/orders"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#E5E7EB] hover:bg-[#1A241F] hover:text-[#10B981] transition-colors"
                      >
                        <Package size={15} /> My Orders
                      </Link>

                      <Link
                        to="/addresses"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#E5E7EB] hover:bg-[#1A241F] hover:text-[#10B981] transition-colors"
                      >
                        <MapPin size={15} /> My Addresses
                      </Link>

                      <Link
                        to="/wishlist"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#E5E7EB] hover:bg-[#1A241F] hover:text-[#10B981] transition-colors"
                      >
                        <Heart size={15} /> Saved Wishlist
                      </Link>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-950/40 transition-colors border-t border-[#10B981]/20 text-left"
                      >
                        <LogOut size={15} /> Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Link
                    to="/login"
                    className="text-xs font-semibold uppercase tracking-wider text-[#E5E7EB] hover:text-[#10B981] transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="text-xs font-semibold uppercase tracking-wider text-[#10B981] hover:text-white transition-colors"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-xs top-[108px]">
            <div className="bg-[#131915] text-[#E5E7EB] w-full max-w-sm h-full p-6 flex flex-col justify-between border-r border-[#10B981]/30 shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex flex-col gap-6">
                <div className="pb-4 border-b border-[#10B981]/20">
                  <span className="font-serif text-xl tracking-widest text-white">DEPORT</span>
                  <p className="text-xs text-[#10B981]">Carry Your Style</p>
                </div>

                <nav className="flex flex-col gap-3">
                  {navLinks.map((link) => (
                    <Link
                      key={link.name}
                      to={link.path}
                      className="text-sm font-serif uppercase tracking-widest text-[#E5E7EB] hover:text-[#10B981] py-2 border-b border-white/5"
                    >
                      {link.name}
                    </Link>
                  ))}

                  {isAuthenticated ? (
                    <>
                      <Link
                        to="/profile"
                        className="text-sm font-serif uppercase tracking-widest text-[#E5E7EB] hover:text-[#10B981] py-2 border-b border-white/5 flex items-center gap-3"
                      >
                        <User size={18} /> My Profile ({user.first_name})
                      </Link>
                      <Link
                        to="/orders"
                        className="text-sm font-serif uppercase tracking-widest text-[#E5E7EB] hover:text-[#10B981] py-2 border-b border-white/5 flex items-center gap-3"
                      >
                        <Package size={18} /> My Orders
                      </Link>
                      <Link
                        to="/wishlist"
                        className="text-sm font-serif uppercase tracking-widest text-[#E5E7EB] hover:text-[#10B981] py-2 border-b border-white/5 flex items-center gap-3"
                      >
                        <Heart size={18} /> Saved Wishlist
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="text-xs font-bold uppercase tracking-widest text-rose-400 py-2 flex items-center gap-2 mt-2"
                      >
                        <LogOut size={16} /> Logout
                      </button>
                    </>
                  ) : (
                    <div className="pt-4 flex flex-col gap-3 border-t border-white/10">
                      <Link
                        to="/login"
                        className="text-xs font-bold uppercase tracking-widest text-[#E5E7EB] hover:text-[#10B981]"
                      >
                        Login to Account
                      </Link>
                      <Link
                        to="/signup"
                        className="text-xs font-bold uppercase tracking-widest text-[#10B981] hover:text-white"
                      >
                        Create Account / Sign Up
                      </Link>
                    </div>
                  )}
                </nav>
              </div>

              <div className="text-xs text-[#9CA3AF] pt-6 border-t border-white/10">
                <p>© 2026 DEPORT Leather Atelier. All rights reserved.</p>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Global Search Overlay */}
      <SearchBar isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};

export default Navbar;
