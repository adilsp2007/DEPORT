import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import Button from './Button';

export const Footer = () => {
  return (
    <footer className="bg-[#070A08] text-[#F3F4F6] pt-16 pb-12 border-t border-[#10B981]/20">
      {/* Value Proposition Highlights */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 border-b border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div className="flex flex-col items-center md:items-start">
            <div className="w-12 h-12 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center mb-4">
              <Truck size={22} />
            </div>
            <h4 className="font-serif text-lg font-medium text-white mb-2">Global Express Shipping</h4>
            <p className="text-xs text-[#9CA3AF] leading-relaxed max-w-xs">
              Complimentary trackable luxury delivery directly to your doorstep worldwide.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <div className="w-12 h-12 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center mb-4">
              <ShieldCheck size={22} />
            </div>
            <h4 className="font-serif text-lg font-medium text-white mb-2">Lifetime Craftsmanship</h4>
            <p className="text-xs text-[#9CA3AF] leading-relaxed max-w-xs">
              Every bag is crafted with full-grain Italian leather and backed by our guarantee.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <div className="w-12 h-12 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center justify-center mb-4">
              <RefreshCw size={22} />
            </div>
            <h4 className="font-serif text-lg font-medium text-white mb-2">Seamless 30-Day Returns</h4>
            <p className="text-xs text-[#9CA3AF] leading-relaxed max-w-xs">
              Try your piece at home with our complimentary return and exchange service.
            </p>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Newsletter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand Info */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block mb-4">
              <span className="font-serif text-3xl tracking-widest text-white">DEPORT</span>
              <span className="block text-[10px] uppercase tracking-[0.25em] text-[#10B981] mt-0.5 font-semibold">
                Carry Your Style
              </span>
            </Link>
            <p className="text-xs text-[#9CA3AF] leading-relaxed mb-6 max-w-sm">
              DEPORT creates luxury leather handbags, totes, travel duffels, and accessories designed to accompany life’s most elegant moments.
            </p>
            {/* Custom SVG Social Icons */}
            <div className="flex items-center gap-4 text-[#F3F4F6]/80">
              <a href="#" className="p-2.5 bg-white/5 hover:bg-[#10B981] hover:text-black transition-colors rounded-none" aria-label="Instagram">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="#" className="p-2.5 bg-white/5 hover:bg-[#10B981] hover:text-black transition-colors rounded-none" aria-label="Twitter">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="#" className="p-2.5 bg-white/5 hover:bg-[#10B981] hover:text-black transition-colors rounded-none" aria-label="Pinterest">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026l.032-.026z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-xs uppercase font-bold tracking-widest text-[#10B981] mb-6">
              Shop Collections
            </h4>
            <ul className="space-y-3 text-xs text-[#9CA3AF]">
              <li><Link to="/shop?category=handbags" className="hover:text-[#10B981] transition-colors">Handbags</Link></li>
              <li><Link to="/shop?category=tote-bags" className="hover:text-[#10B981] transition-colors">Tote Bags</Link></li>
              <li><Link to="/shop?category=crossbody" className="hover:text-[#10B981] transition-colors">Crossbody Bags</Link></li>
              <li><Link to="/shop?category=backpacks" className="hover:text-[#10B981] transition-colors">Backpacks</Link></li>
              <li><Link to="/shop?category=travel-bags" className="hover:text-[#10B981] transition-colors">Travel Bags</Link></li>
              <li><Link to="/shop?category=wallets" className="hover:text-[#10B981] transition-colors">Wallets & Leather</Link></li>
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h4 className="text-xs uppercase font-bold tracking-widest text-[#10B981] mb-6">
              Customer Care
            </h4>
            <ul className="space-y-3 text-xs text-[#9CA3AF]">
              <li><Link to="/profile" className="hover:text-[#10B981] transition-colors">My Account</Link></li>
              <li><Link to="/addresses" className="hover:text-[#10B981] transition-colors">Shipping Addresses</Link></li>
              <li><a href="#" className="hover:text-[#10B981] transition-colors">Order Tracking</a></li>
              <li><a href="#" className="hover:text-[#10B981] transition-colors">Shipping & Returns</a></li>
              <li><a href="#" className="hover:text-[#10B981] transition-colors">Leather Care Guide</a></li>
              <li><a href="#" className="hover:text-[#10B981] transition-colors">Contact Atelier</a></li>
            </ul>
          </div>

          {/* Newsletter Signup */}
          <div>
            <h4 className="text-xs uppercase font-bold tracking-widest text-[#10B981] mb-6">
              Join The Club
            </h4>
            <p className="text-xs text-[#9CA3AF] mb-4 leading-relaxed">
              Subscribe to receive exclusive invitations to private collection previews and limited edition releases.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="bg-[#131915] text-[#F3F4F6] text-xs px-4 py-3 border border-[#10B981]/30 focus:border-[#10B981] focus:outline-none placeholder-[#9CA3AF]/50"
              />
              <Button variant="primary" size="sm">
                Subscribe
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Legal Copyright */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9CA3AF]">
        <p>© 2026 DEPORT Leather Atelier Inc. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Cookie Preferences</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
