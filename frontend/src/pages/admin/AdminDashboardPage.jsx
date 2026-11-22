import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import adminService from '../../services/adminService';
import {
  Mail,
  Clock,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { DateFilterBar } from '../../components/admin/analytics/DateFilterBar';
import { DashboardOverviewCards } from '../../components/admin/analytics/DashboardOverviewCards';
import { SalesPerformanceCard } from '../../components/admin/analytics/SalesPerformanceCard';
import { RevenueAnalyticsChart } from '../../components/admin/analytics/RevenueAnalyticsChart';
import { OrdersAnalyticsChart } from '../../components/admin/analytics/OrdersAnalyticsChart';
import { OrderStatusDistributionChart } from '../../components/admin/analytics/OrderStatusDistributionChart';
import { CategorySalesChart } from '../../components/admin/analytics/CategorySalesChart';
import { TopSellingProductsTable } from '../../components/admin/analytics/TopSellingProductsTable';
import { RecentOrdersAnalyticsTable } from '../../components/admin/analytics/RecentOrdersAnalyticsTable';

export const AdminDashboardPage = () => {
  const { user } = useAuth();

  // Filters & State
  const [period, setPeriod] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [grouping, setGrouping] = useState('');
  const [topProductsSort, setTopProductsSort] = useState('units_sold_desc');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('');

  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async (overrides = {}) => {
    setLoading(true);
    setError(null);

    const queryParams = {
      period: overrides.period ?? period,
      startDate: overrides.startDate ?? customStartDate,
      endDate: overrides.endDate ?? customEndDate,
      grouping: overrides.grouping ?? grouping,
      topProductsSort: overrides.topProductsSort ?? topProductsSort,
      orderSearch: overrides.orderSearch ?? orderSearch,
      orderStatus: overrides.orderStatus ?? orderStatus
    };

    try {
      const data = await adminService.getDashboardAnalytics(queryParams);
      setAnalyticsData(data);
      if (data.grouping && (!grouping || overrides.grouping)) {
        setGrouping(data.grouping);
      }
    } catch (err) {
      if (err.response && err.response.data) {
        const d = err.response.data;
        const msg = d.detail || d.end_date || d.start_date || d.period || 'Failed to load dashboard analytics.';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      } else {
        setError('Failed to connect to analytics service. Please verify network and server.');
      }
    } finally {
      setLoading(false);
    }
  }, [period, customStartDate, customEndDate, grouping, topProductsSort, orderSearch, orderStatus]);

  useEffect(() => {
    fetchAnalytics();
  }, [period, customStartDate, customEndDate, topProductsSort, orderStatus]);

  // Debounced search for recent orders
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnalytics();
    }, 400);
    return () => clearTimeout(timer);
  }, [orderSearch]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const handleApplyCustomRange = (start, end) => {
    setPeriod('custom');
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  const handleResetFilters = () => {
    setPeriod('this_month');
    setCustomStartDate('');
    setCustomEndDate('');
    setGrouping('');
    setTopProductsSort('units_sold_desc');
    setOrderSearch('');
    setOrderStatus('');
  };

  const handleGroupingChange = (newGrouping) => {
    setGrouping(newGrouping);
    fetchAnalytics({ grouping: newGrouping });
  };

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
    <div className="space-y-8 pb-12">
      {/* 1. Welcome & Session Banner */}
      <div className="bg-[#131915] border border-[#1E2922] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            STORE ANALYTICS & OPERATIONS
          </span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#F3F4F6]">
            Welcome back, {user?.first_name || 'Administrator'}
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Here is your live, database-backed business intelligence, revenue metrics, and order fulfillment breakdown.
          </p>

          {/* Admin Credentials & Session Pill */}
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

            {analyticsData?.start_date && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#161D19] border border-[#1E2922] text-gray-400 text-[11px]">
                <Calendar size={12} className="text-[#10B981]" />
                <span>
                  Window: <strong className="text-white">{formatDate(analyticsData.start_date)}</strong> – <strong className="text-white">{formatDate(analyticsData.end_date)}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchAnalytics()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-xs font-semibold uppercase tracking-wider text-gray-300 hover:text-[#10B981] transition-all disabled:opacity-50 shrink-0 cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#10B981]' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* 2. Date Filter System */}
      <DateFilterBar
        selectedPeriod={period}
        onSelectPeriod={handlePeriodChange}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onApplyCustomRange={handleApplyCustomRange}
        onReset={handleResetFilters}
        isLoading={loading}
      />

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 bg-rose-950/60 border-l-4 border-rose-600 text-rose-300 text-xs font-medium flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchAnalytics()}
            className="px-3 py-1 bg-rose-900/80 hover:bg-rose-800 text-white text-xs uppercase font-bold tracking-wider cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Dashboard Overview Cards (12 Cards) */}
      <DashboardOverviewCards
        cards={analyticsData?.cards || {}}
        isLoading={loading}
      />

      {/* 4. Business Performance Comparison Cards */}
      <SalesPerformanceCard
        performance={analyticsData?.sales_performance || {}}
      />

      {/* 5. Revenue & Orders Time-Series Charts (Two Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RevenueAnalyticsChart
          data={analyticsData?.revenue_chart || []}
          currentGrouping={grouping || analyticsData?.grouping || 'day'}
          onGroupingChange={handleGroupingChange}
          period={period}
          totalRevenue={analyticsData?.cards?.total_revenue?.value || 0}
        />

        <OrdersAnalyticsChart
          data={analyticsData?.orders_chart || []}
          totalOrders={analyticsData?.cards?.total_orders?.value || 0}
        />
      </div>

      {/* 6. Order Status Distribution & Category Performance (Two Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <OrderStatusDistributionChart
          data={analyticsData?.order_status_distribution || []}
          totalOrders={analyticsData?.cards?.total_orders?.value || 0}
        />

        <CategorySalesChart
          data={analyticsData?.category_sales || []}
        />
      </div>

      {/* 7. Top-Selling Products */}
      <TopSellingProductsTable
        products={analyticsData?.top_selling_products || []}
        sortOption={topProductsSort}
        onSortChange={setTopProductsSort}
        isLoading={loading}
      />

      {/* 8. Recent Orders Breakdown Table */}
      <RecentOrdersAnalyticsTable
        orders={analyticsData?.recent_orders || []}
        searchTerm={orderSearch}
        onSearchChange={setOrderSearch}
        statusFilter={orderStatus}
        onStatusChange={setOrderStatus}
        isLoading={loading}
      />
    </div>
  );
};

export default AdminDashboardPage;
