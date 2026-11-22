import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { ShoppingBag, Calendar } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#131915] border border-[#1E2922] p-3 shadow-xl text-xs space-y-1.5 min-w-[160px]">
        <p className="text-gray-300 font-semibold border-b border-[#1E2922] pb-1 flex items-center gap-1.5">
          <Calendar size={12} className="text-[#10B981]" />
          <span>{data.label || label}</span>
        </p>
        <div className="space-y-1">
          <p className="flex justify-between items-center text-gray-300">
            <span>Total Orders:</span>
            <strong className="text-white font-mono">{data.total}</strong>
          </p>
          <p className="flex justify-between items-center text-emerald-400">
            <span>Delivered:</span>
            <strong className="font-mono">{data.delivered}</strong>
          </p>
          <p className="flex justify-between items-center text-amber-400">
            <span>Pending:</span>
            <strong className="font-mono">{data.pending}</strong>
          </p>
          <p className="flex justify-between items-center text-purple-400">
            <span>Processing:</span>
            <strong className="font-mono">{data.processing}</strong>
          </p>
          <p className="flex justify-between items-center text-rose-400">
            <span>Cancelled:</span>
            <strong className="font-mono">{data.cancelled}</strong>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const OrdersAnalyticsChart = ({ data = [], totalOrders = 0 }) => {
  return (
    <div className="bg-[#131915] border border-[#1E2922] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#1E2922]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ShoppingBag size={16} />
            </span>
            <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
              Orders Timeline
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Order volume and status progression over time (Total: {totalOrders})
          </p>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-72 sm:h-80 pt-2">
        {!data || data.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-500 space-y-2">
            <ShoppingBag size={28} className="text-gray-600" />
            <p>No orders recorded for the selected period.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                iconType="circle"
              />
              <Bar dataKey="delivered" name="Delivered" fill="#10B981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="processing" name="Processing" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="pending" name="Pending" fill="#F59E0B" radius={[2, 2, 0, 0]} />
              <Bar dataKey="cancelled" name="Cancelled" fill="#EF4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default OrdersAnalyticsChart;

