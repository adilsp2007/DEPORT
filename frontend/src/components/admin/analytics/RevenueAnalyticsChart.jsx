import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { IndianRupee, TrendingUp, Calendar } from 'lucide-react';
import { formatINR } from '../../../utils/currencyUtils';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#131915] border border-[#10B981]/50 p-3 shadow-xl text-xs space-y-1">
        <p className="text-gray-400 font-semibold flex items-center gap-1.5 border-b border-[#1E2922] pb-1">
          <Calendar size={12} className="text-[#10B981]" />
          <span>{data.label || label}</span>
        </p>
        <p className="text-[#F3F4F6] font-bold text-sm">
          Revenue: <span className="text-[#10B981]">{formatINR(data.revenue)}</span>
        </p>
        <p className="text-gray-400 text-[11px]">
          Qualifying Orders: <strong className="text-white">{data.orders_count ?? 0}</strong>
        </p>
      </div>
    );
  }
  return null;
};

export const RevenueAnalyticsChart = ({
  data = [],
  currentGrouping = 'day',
  onGroupingChange,
  period = 'this_month',
  totalRevenue = 0
}) => {
  const groupingOptions = [
    { id: 'hour', label: 'Hourly' },
    { id: 'day', label: 'Daily' },
    { id: 'week', label: 'Weekly' },
    { id: 'month', label: 'Monthly' },
    { id: 'year', label: 'Yearly' }
  ];

  return (
    <div className="bg-[#131915] border border-[#1E2922] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#1E2922]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
              <TrendingUp size={16} />
            </span>
            <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
              Revenue Over Time
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Realized store revenue from completed customer payments ({formatINR(totalRevenue)})
          </p>
        </div>

        {/* Grouping Granularity Selector */}
        <div className="flex items-center gap-1 bg-[#161D19] border border-[#1E2922] p-0.5 self-start sm:self-auto">
          {groupingOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onGroupingChange && onGroupingChange(opt.id)}
              className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                currentGrouping === opt.id
                  ? 'bg-[#10B981] text-black font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-72 sm:h-80 pt-2">
        {!data || data.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-500 space-y-2">
            <IndianRupee size={28} className="text-gray-600" />
            <p>No revenue recorded for the selected period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2922" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#6B7280"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1E2922' }}
              />
              <YAxis
                stroke="#6B7280"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#revenueGradient)"
                activeDot={{ r: 6, fill: '#10B981', stroke: '#F3F4F6', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default RevenueAnalyticsChart;

