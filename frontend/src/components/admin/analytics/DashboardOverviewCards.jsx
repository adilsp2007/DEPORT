import React from 'react';
import {
  IndianRupee,
  ShoppingBag,
  Package,
  Tags,
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Ticket,
  Sparkles,
  Layers,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { formatINR } from '../../../utils/currencyUtils';

export const DashboardOverviewCards = ({ cards = {}, isLoading = false }) => {
  const cardConfigs = [
    {
      key: 'total_revenue',
      title: 'Total Revenue',
      icon: IndianRupee,
      format: (val) => formatINR(val),
      iconColor: 'text-[#10B981]',
      iconBg: 'bg-[#10B981]/10',
      iconBorder: 'border-[#10B981]/30',
      description: 'Realized net revenue'
    },
    {
      key: 'total_orders',
      title: 'Total Orders',
      icon: ShoppingBag,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/10',
      iconBorder: 'border-blue-500/30',
      description: 'Customer transactions'
    },
    {
      key: 'total_products',
      title: 'Total Products',
      icon: Package,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      iconBorder: 'border-amber-500/30',
      description: 'Active catalog items'
    },
    {
      key: 'total_categories',
      title: 'Total Categories',
      icon: Tags,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-500/10',
      iconBorder: 'border-purple-500/30',
      description: 'Product classifications'
    },
    {
      key: 'total_users',
      title: 'Total Users',
      icon: Users,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/10',
      iconBorder: 'border-cyan-500/30',
      description: 'Registered accounts'
    },
    {
      key: 'total_customers',
      title: 'Total Customers',
      icon: UserCheck,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      iconBorder: 'border-emerald-500/30',
      description: 'Verified buyer accounts'
    },
    {
      key: 'total_delivered_orders',
      title: 'Delivered Orders',
      icon: CheckCircle2,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      iconBorder: 'border-emerald-500/30',
      description: 'Fulfilled orders'
    },
    {
      key: 'pending_orders',
      title: 'Pending Orders',
      icon: Clock,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      iconBorder: 'border-amber-500/30',
      description: 'Awaiting fulfillment'
    },
    {
      key: 'cancelled_orders',
      title: 'Cancelled Orders',
      icon: XCircle,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-rose-400',
      iconBg: 'bg-rose-500/10',
      iconBorder: 'border-rose-500/30',
      description: 'Cancelled transactions'
    },
    {
      key: 'total_coupons',
      title: 'Total Coupons',
      icon: Ticket,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-indigo-400',
      iconBg: 'bg-indigo-500/10',
      iconBorder: 'border-indigo-500/30',
      description: 'Promo campaigns'
    },
    {
      key: 'active_coupons',
      title: 'Active Coupons',
      icon: Sparkles,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-teal-400',
      iconBg: 'bg-teal-500/10',
      iconBorder: 'border-teal-500/30',
      description: 'Redeemable discounts'
    },
    {
      key: 'total_sales',
      title: 'Total Sales (Units)',
      icon: Layers,
      format: (val) => Number(val || 0).toLocaleString(),
      iconColor: 'text-emerald-300',
      iconBg: 'bg-emerald-600/10',
      iconBorder: 'border-emerald-600/30',
      description: 'Items sold in completed orders'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {cardConfigs.map((cfg) => {
        const Icon = cfg.icon;
        const cardData = cards[cfg.key] || { value: 0, previous: 0, change_pct: 0 };
        const change = cardData.change_pct ?? 0;
        const isPositive = change >= 0;

        return (
          <div
            key={cfg.key}
            className="bg-[#131915] border border-[#1E2922] p-5 hover:border-[#10B981]/40 transition-colors shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">
                {cfg.title}
              </span>
              <div className={`p-2 rounded-full border ${cfg.iconBg} ${cfg.iconColor} ${cfg.iconBorder}`}>
                <Icon size={16} />
              </div>
            </div>

            <div className="mb-2">
              <div className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {isLoading ? (
                  <span className="animate-pulse text-gray-500 text-xl font-sans">...</span>
                ) : (
                  cfg.format(cardData.value)
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1E2922]/60 text-xs">
              <span className="text-[11px] text-gray-400 truncate max-w-[130px]">
                {cfg.description}
              </span>

              {!isLoading && (
                <div
                  className={`flex items-center gap-0.5 text-[11px] font-bold ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                  title={`${change}% compared to previous equivalent period`}
                >
                  {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  <span>{isPositive ? `+${change}%` : `${change}%`}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardOverviewCards;

