import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, MapPin, Package, Heart, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';

export const AccountSidebar = () => {
  const { user, logout } = useAuth();
  const { showToast } = useShop();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    showToast("You've been logged out successfully.", 'info');
    navigate('/login');
  };

  const navItems = [
    { name: 'Profile', path: '/profile', icon: User },
    { name: 'Orders', path: '/orders', icon: Package },
    { name: 'Addresses', path: '/addresses', icon: MapPin },
    { name: 'Wishlist', path: '/wishlist', icon: Heart }
  ];

  if (!user) return null;

  // Generate Initials
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U';

  return (
    <aside className="w-full bg-[#131915] border border-[#1E2922] p-5 shadow-xs">
      {/* User Header */}
      <div className="flex items-center gap-4 pb-5 mb-5 border-b border-[#1E2922]">
        {user.profile_image ? (
          <img
            src={user.profile_image}
            alt={`${user.first_name} ${user.last_name}`}
            className="w-12 h-12 rounded-full object-cover border border-[#10B981]"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#161D19] text-[#10B981] font-serif text-lg font-bold flex items-center justify-center border border-[#10B981]">
            {initials}
          </div>
        )}
        <div className="overflow-hidden">
          <h4 className="font-serif text-base font-semibold text-[#F3F4F6] truncate">
            {user.first_name} {user.last_name}
          </h4>
          <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path === '/profile' && (location.pathname === '/profile' || location.pathname === '/profile/edit'));
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center justify-between px-4 py-3 text-xs uppercase tracking-wider font-semibold transition-all duration-200 border-l-2 ${
                isActive
                  ? 'bg-[#161D19] text-[#10B981] border-[#10B981]'
                  : 'text-[#F3F4F6] hover:bg-[#161D19] border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={16} />
                <span>{item.name}</span>
              </div>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-wider font-semibold text-rose-500 hover:bg-rose-950/40 transition-colors mt-4 border-t border-[#1E2922] w-full text-left"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
};

export default AccountSidebar;
