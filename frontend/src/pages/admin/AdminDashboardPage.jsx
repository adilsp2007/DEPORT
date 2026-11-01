import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import adminService from '../../services/adminService';
import {
  Users,
  UserCheck,
  UserX,
  Package,
  ShoppingBag,
  IndianRupee,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  ShieldCheck,
  Ticket
} from 'lucide-react';
import { formatINR } from '../../utils/currencyUtils';

export const AdminDashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getDashboardStats();
      setStats(data);
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to load dashboard statistics. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatCurrency = (amount) => formatINR(amount);

  const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return 'Just now (Active)';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Just now (Active)';
    if (includeTime) {
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-[#131915] border border-[#1E2922] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            STORE DASHBOARD
          </span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#F3F4F6]">
            Welcome back, {user?.first_name || 'Administrator'}
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Here is a real-time overview of your DEPORT bag store operations and user activity.
          </p>

          {/* Admin Session Credentials & Login Time Pill */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-[#1E2922]/60 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161D19] border border-[#1E2922] text-gray-300">
              <Mail size={13} className="text-[#10B981]" />
              <span className="font-mono text-gray-200">{user?.email || 'admin@deport.com'}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161D19] border border-[#1E2922] text-gray-300">
              <Clock size={13} className="text-[#10B981]" />
              <span>Last Login: <strong className="text-white font-medium">{formatDate(user?.last_login, true)}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] uppercase text-[10px] font-bold tracking-wider">
              <ShieldCheck size={12} />
              <span>{user?.is_superuser ? 'Superadmin' : 'Staff Admin'}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-xs font-semibold uppercase tracking-wider text-gray-300 hover:text-[#10B981] transition-all disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#10B981]' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 bg-rose-950/60 border-l-4 border-rose-600 text-rose-300 text-xs font-medium flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchStats}
            className="px-3 py-1 bg-rose-900/80 hover:bg-rose-800 text-white text-xs uppercase font-bold tracking-wider"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Users Card */}
        <div className="bg-[#131915] border border-[#1E2922] p-6 hover:border-[#10B981]/40 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
              Total Users
            </span>
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
              <Users size={20} />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-[#F3F4F6]">
            {loading ? <span className="animate-pulse text-gray-600">...</span> : (stats?.total_users ?? 0)}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 font-light">
            Registered customer & staff accounts
          </p>
        </div>

        {/* Active Users Card */}
        <div className="bg-[#131915] border border-[#1E2922] p-6 hover:border-[#10B981]/40 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
              Active Users
            </span>
            <div className="p-2.5 bg-[#10B981]/10 text-[#10B981] rounded-full border border-[#10B981]/20">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-[#10B981]">
            {loading ? <span className="animate-pulse text-gray-600">...</span> : (stats?.active_users ?? 0)}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 font-light">
            Accounts in good standing
          </p>
        </div>

        {/* Blocked Users Card */}
        <div className="bg-[#131915] border border-[#1E2922] p-6 hover:border-[#10B981]/40 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
              Blocked Users
            </span>
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">
              <UserX size={20} />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-rose-400">
            {loading ? <span className="animate-pulse text-gray-600">...</span> : (stats?.blocked_users ?? 0)}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 font-light">
            Suspended customer accounts
          </p>
        </div>

        {/* Total Products Card */}
        <div className="bg-[#131915] border border-[#1E2922] p-6 hover:border-[#10B981]/40 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
              Total Products
            </span>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
              <Package size={20} />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-[#F3F4F6]">
            {loading ? <span className="animate-pulse text-gray-600">...</span> : (stats?.total_products ?? 0)}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 font-light">
            Active product catalog items
          </p>
        </div>

        {/* Total Orders Card */}
        <div className="bg-[#131915] border border-[#1E2922] p-6 hover:border-[#10B981]/40 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
              Total Orders
            </span>
            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
              <ShoppingBag size={20} />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-[#F3F4F6]">
            {loading ? <span className="animate-pulse text-gray-600">...</span> : (stats?.total_orders ?? 0)}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 font-light">
            Customer order transactions
          </p>
        </div>

        {/* Total Revenue Card */}
        <div className="bg-[#131915] border border-[#1E2922] p-6 hover:border-[#10B981]/40 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
              Verified Net Revenue
            </span>
            <div className="p-2.5 bg-emerald-500/10 text-[#10B981] rounded-full border border-[#10B981]/20">
              <IndianRupee size={20} />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-[#10B981]">
            {loading ? <span className="animate-pulse text-gray-600">...</span> : formatCurrency(stats?.total_revenue)}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 font-light">
            Excludes cancelled & returned orders
          </p>
        </div>

        {/* Pending Orders Card */}
        <Link to="/admin/orders?status=pending" className="block bg-[#131915] border border-[#1E2922] p-6 hover:border-[#10B981]/40 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 group-hover:text-amber-400 transition-colors">
              Pending Orders
            </span>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
              <Clock size={20} />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-amber-400">
            {loading ? <span className="animate-pulse text-gray-600">...</span> : (stats?.pending_orders ?? 0)}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 font-light">
            Awaiting fulfillment dispatch
          </p>
        </Link>

        {/* Active Coupons Card */}
        <Link to="/admin/coupons" className="block bg-[#131915] border border-[#1E2922] p-6 hover:border-[#10B981]/40 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 group-hover:text-[#10B981] transition-colors">
              Active Coupons
            </span>
            <div className="p-2.5 bg-[#10B981]/10 text-[#10B981] rounded-full border border-[#10B981]/20">
              <Ticket size={20} />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-[#10B981]">
            {loading ? <span className="animate-pulse text-gray-600">...</span> : (stats?.active_coupons ?? 0)}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 font-light">
            Redeemable discount codes
          </p>
        </Link>
      </div>

      {/* Two Column Grid for Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Registered Users */}
        <div className="bg-[#131915] border border-[#1E2922] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922] mb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
                  Recent Registered Users
                </h3>
                <p className="text-xs text-gray-400">Latest customer account signups</p>
              </div>
              <Link
                to="/admin/users"
                className="text-xs uppercase font-bold tracking-wider text-[#10B981] hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-gray-500 animate-pulse">
                Loading recent users...
              </div>
            ) : !stats?.recent_users || stats.recent_users.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
                No users found.
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recent_users.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 bg-[#161D19] border border-[#1E2922] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#10B981]/10 text-[#10B981] font-bold flex items-center justify-center font-serif shrink-0 border border-[#10B981]/20">
                        {u.first_name?.[0] || 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#F3F4F6] truncate">
                          {u.full_name || u.email}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 border ${
                        u.is_active
                          ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30'
                          : 'text-rose-400 bg-rose-950/50 border-rose-800/40'
                      }`}>
                        {u.is_active ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {u.is_active ? 'Active' : 'Blocked'}
                      </span>
                      <span className="text-[11px] text-gray-500 hidden sm:inline">
                        {formatDate(u.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-[#131915] border border-[#1E2922] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922] mb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
                  Recent Customer Orders
                </h3>
                <p className="text-xs text-gray-400">Latest store order transactions</p>
              </div>
              <Link
                to="/admin/orders"
                className="text-xs uppercase font-bold tracking-wider text-[#10B981] hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-gray-500 animate-pulse">
                Loading recent orders...
              </div>
            ) : !stats?.recent_orders || stats.recent_orders.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500 space-y-2">
                <ShoppingBag size={24} className="mx-auto text-gray-600" />
                <p className="font-medium text-gray-400">No customer orders placed yet.</p>
                <p className="text-[11px] text-gray-500">Orders placed by customers will appear here automatically.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recent_orders.map((o) => (
                  <div
                    key={o.id}
                    className="p-3 bg-[#161D19] border border-[#1E2922] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-[#10B981] truncate">
                        {o.order_number}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {o.customer_name} ({o.customer_email})
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-bold text-[#F3F4F6]">
                        {formatCurrency(o.total)}
                      </p>
                      <span className="inline-block text-[10px] uppercase font-bold text-gray-400 bg-[#10B981]/10 px-2 py-0.5 border border-[#10B981]/20 mt-0.5">
                        {o.status_display}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
