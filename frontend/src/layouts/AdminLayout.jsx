import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingBag,
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  FolderTree,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
  User as UserIcon,
  Clock,
  Mail,
  Ticket,
  Image as ImageIcon
} from 'lucide-react';

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'User Management', path: '/admin/users', icon: Users },
    { label: 'Product Management', path: '/admin/products', icon: Package },
    { label: 'Inventory / Stock', path: '/admin/inventory', icon: Boxes },
    { label: 'Categories', path: '/admin/categories', icon: FolderTree },
    { label: 'Orders', path: '/admin/orders', icon: ShoppingBag },
    { label: 'Coupons & Discounts', path: '/admin/coupons', icon: Ticket },
    { label: 'Banners & Hero', path: '/admin/banners', icon: ImageIcon },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  // Derive current page title & breadcrumb
  const currentNavItem = navItems.find((item) => location.pathname.startsWith(item.path));
  const currentPageTitle = currentNavItem ? currentNavItem.label : 'Admin Portal';

  // Admin Initials
  const adminInitials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || (user?.email?.[0] || 'A').toUpperCase();

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Just now (Active)';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Just now (Active)';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0F0D] text-[#F3F4F6] flex flex-col lg:flex-row selection:bg-[#10B981] selection:text-black">
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#131915] border-r border-[#1E2922] flex flex-col justify-between
          transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div>
          {/* Store Branding */}
          <div className="p-6 border-b border-[#1E2922] flex items-center justify-between">
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-3 group"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="w-9 h-9 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] group-hover:scale-105 transition-transform">
                <ShoppingBag size={20} />
              </div>
              <div>
                <span className="font-serif text-xl font-bold tracking-wider text-[#F3F4F6]">
                  DEPORT
                </span>
                <span className="text-[10px] block uppercase tracking-[0.25em] text-[#10B981] font-semibold">
                  Admin Panel
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-gray-400 hover:text-[#F3F4F6] p-1"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              Management
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-3.5 py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-200 border
                    ${isActive
                      ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/40 shadow-xs'
                      : 'text-gray-400 border-transparent hover:text-[#F3F4F6] hover:bg-[#161D19]'
                    }
                  `}
                >
                  <Icon size={18} className={isActive ? 'text-[#10B981]' : 'text-gray-400'} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Admin Profile Summary & Logout */}
        <div className="p-4 border-t border-[#1E2922] bg-[#0E1310] space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#10B981] text-black font-bold text-xs flex items-center justify-center font-serif shadow-xs shrink-0">
              {adminInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#F3F4F6] truncate">
                {user?.full_name || 'Administrator'}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-[#10B981] truncate font-mono" title={user?.email}>
                <Mail size={11} className="shrink-0" />
                <span className="truncate">{user?.email || 'admin@deport.com'}</span>
              </div>
            </div>
          </div>

          {/* Admin Login Time in Sidebar */}
          <div className="px-2.5 py-1.5 bg-[#131915] border border-[#1E2922] flex items-center gap-2 text-[10px] text-gray-400">
            <Clock size={12} className="text-[#10B981] shrink-0" />
            <span className="truncate">Login: <strong className="text-gray-200">{formatDateTime(user?.last_login)}</strong></span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-300 text-xs font-semibold uppercase tracking-wider transition-colors"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Navigation Bar */}
        <header className="sticky top-0 z-30 bg-[#131915]/90 backdrop-blur-md border-b border-[#1E2922] px-4 md:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-gray-300 hover:text-[#10B981] p-1.5 bg-[#161D19] border border-[#1E2922]"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb & Title */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                <Link to="/admin/dashboard" className="hover:text-[#10B981] transition-colors">
                  Admin
                </Link>
                <ChevronRight size={12} />
                <span className="text-[#10B981]">{currentPageTitle}</span>
              </div>
              <h1 className="font-serif text-xl md:text-2xl font-bold text-[#F3F4F6]">
                {currentPageTitle}
              </h1>
            </div>
          </div>

          {/* Top Right Admin Profile Header Display */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Login Time Display */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-300 bg-[#161D19] px-3 py-1.5 border border-[#1E2922]">
              <Clock size={13} className="text-[#10B981] shrink-0" />
              <span className="text-[11px]">Last Login: <strong className="text-white font-medium">{formatDateTime(user?.last_login)}</strong></span>
            </div>

            <div className="hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#10B981] bg-[#10B981]/10 px-2.5 py-1.5 border border-[#10B981]/30">
              <ShieldCheck size={13} />
              <span>{user?.is_superuser ? 'Superadmin' : 'Staff Admin'}</span>
            </div>

            {/* Admin Identity with Avatar, Name & Email */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-[#1E2922]">
              <div className="w-8 h-8 rounded-full bg-[#10B981] text-black font-bold text-xs flex items-center justify-center font-serif shrink-0 shadow-xs">
                {adminInitials}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold text-[#F3F4F6] leading-tight">
                  {user?.full_name || 'Admin'}
                </p>
                <p className="text-[10px] text-[#10B981] font-mono leading-tight" title={user?.email}>
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
