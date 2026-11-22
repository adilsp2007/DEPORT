import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  IndianRupee,
  ShoppingBag,
  Package,
  Layers
} from 'lucide-react';
import { formatINR } from '../../../utils/currencyUtils';

export const SalesPerformanceCard = ({ performance = {} }) => {
  const {
    revenue = { current: 0, previous: 0, change_pct: 0 },
    total_sales = { current: 0, previous: 0, change_pct: 0 },
    orders_count = { current: 0, previous: 0, change_pct: 0 },
    average_order_value = { current: 0, previous: 0, change_pct: 0 }
  } = performance;

  const metrics = [
    {
      id: 'revenue',
      label: 'Realized Revenue',
      currentFormatted: formatINR(revenue.current),
      previousFormatted: formatINR(revenue.previous),
      change: revenue.change_pct,
      icon: IndianRupee,
      iconColor: 'text-[#10B981]',
      iconBg: 'bg-[#10B981]/10',
      borderColor: 'border-[#10B981]/30'
    },
    {
      id: 'orders',
      label: 'Order Volume',
      currentFormatted: orders_count.current.toLocaleString(),
      previousFormatted: orders_count.previous.toLocaleString(),
      change: orders_count.change_pct,
      icon: ShoppingBag,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30'
    },
    {
      id: 'aov',
      label: 'Average Order Value (AOV)',
      currentFormatted: formatINR(average_order_value.current),
      previousFormatted: formatINR(average_order_value.previous),
      change: average_order_value.change_pct,
      icon: Layers,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30'
    },
    {
      id: 'sales_units',
      label: 'Total Units Sold',
      currentFormatted: total_sales.current.toLocaleString(),
      previousFormatted: total_sales.previous.toLocaleString(),
      change: total_sales.change_pct,
      icon: Package,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30'
    }
  ];

  return (
    <div className="bg-[#131915] border border-[#1E2922] p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1E2922]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
            <Activity size={16} />
          </span>
          <div>
            <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
              Business Performance Comparison
            </h3>
            <p className="text-xs text-gray-400">
              Key operational metrics vs preceding equivalent timeframe
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          const isPositive = m.change >= 0;
          return (
            <div
              key={m.id}
              className="p-4 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/30 transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                  {m.label}
                </span>
                <span className={`p-1.5 rounded-full border ${m.iconBg} ${m.iconColor} ${m.borderColor}`}>
                  <Icon size={14} />
                </span>
              </div>

              <div>
                <div className="font-serif text-2xl font-bold text-white mb-1">
                  {m.currentFormatted}
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#1E2922]/70">
                  <span className="text-gray-400 text-[11px]">
                    Prev: {m.previousFormatted}
                  </span>
                  <div
                    className={`flex items-center gap-0.5 font-bold text-[11px] ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    <span>{isPositive ? `+${m.change}%` : `${m.change}%`}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SalesPerformanceCard;

