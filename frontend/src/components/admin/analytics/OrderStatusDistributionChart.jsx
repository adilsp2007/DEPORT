import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#131915] border border-[#1E2922] p-2.5 shadow-xl text-xs space-y-1">
        <p className="font-bold flex items-center gap-1.5" style={{ color: data.color }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: data.color }} />
          <span>{data.label}</span>
        </p>
        <p className="text-[#F3F4F6] text-[11px]">
          Orders: <strong className="font-mono">{data.count}</strong> ({data.percentage}%)
        </p>
      </div>
    );
  }
  return null;
};

export const OrderStatusDistributionChart = ({ data = [], totalOrders = 0 }) => {
  const activeEntries = data.filter((item) => item.count > 0);

  return (
    <div className="bg-[#131915] border border-[#1E2922] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1E2922]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <PieIcon size={16} />
            </span>
            <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
              Order Status Distribution
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Fulfillment breakdown for {totalOrders} total orders
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* Doughnut Canvas */}
        <div className="w-full lg:w-1/2 h-56 sm:h-64 flex items-center justify-center relative">
          {activeEntries.length === 0 ? (
            <div className="text-xs text-gray-500 text-center">
              No order status data available.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie
                    data={activeEntries}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {activeEntries.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#131915" strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center Stat */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-serif text-2xl font-bold text-white">{totalOrders}</span>
                <span className="text-[10px] uppercase tracking-wider text-gray-400">Total</span>
              </div>
            </>
          )}
        </div>

        {/* Legend List */}
        <div className="w-full lg:w-1/2 grid grid-cols-2 gap-2 text-xs">
          {data.map((item) => (
            <div
              key={item.status}
              className="p-2 bg-[#161D19] border border-[#1E2922] flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-300 truncate text-[11px] font-medium">{item.label}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-white text-xs">{item.count}</span>
                <span className="text-[10px] text-gray-400 ml-1">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrderStatusDistributionChart;

