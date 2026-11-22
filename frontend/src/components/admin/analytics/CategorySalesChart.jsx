import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';
import { Tags } from 'lucide-react';
import { formatINR } from '../../../utils/currencyUtils';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#131915] border border-[#1E2922] p-3 shadow-xl text-xs space-y-1">
        <p className="font-bold text-white border-b border-[#1E2922] pb-1">
          {data.category_name}
        </p>
        <p className="text-[#10B981] font-bold">
          Revenue: {formatINR(data.total_revenue)}
        </p>
        <p className="text-gray-300 text-[11px]">
          Units Sold: <strong className="text-white font-mono">{data.units_sold}</strong>
        </p>
        <p className="text-gray-400 text-[11px]">
          Share of Sales: <strong className="text-white">{data.percentage}%</strong>
        </p>
      </div>
    );
  }
  return null;
};

export const CategorySalesChart = ({ data = [] }) => {
  return (
    <div className="bg-[#131915] border border-[#1E2922] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1E2922]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/10 text-[#10B981] border border-[#10B981]/20">
              <Tags size={16} />
            </span>
            <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
              Category Performance
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Revenue and unit contribution by product category
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Horizontal Bar Chart */}
        <div className="lg:col-span-7 h-64">
          {!data || data.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-500">
              No category sales recorded for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2922" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#6B7280"
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <YAxis
                  type="category"
                  dataKey="category_name"
                  stroke="#6B7280"
                  tick={{ fill: '#F3F4F6', fontSize: 11 }}
                  width={90}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_revenue" radius={[0, 3, 3, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cat-cell-${index}`} fill={entry.color || '#10B981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Breakdown Summary Table */}
        <div className="lg:col-span-5 space-y-2 text-xs">
          {data.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-6">
              No category breakdown.
            </div>
          ) : (
            data.map((cat) => (
              <div
                key={cat.category_id || cat.category_name}
                className="p-2.5 bg-[#161D19] border border-[#1E2922] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate text-xs flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color || '#10B981' }}
                    />
                    <span>{cat.category_name}</span>
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {cat.units_sold} units sold • {cat.percentage}% share
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-[#10B981] font-mono text-xs">
                    {formatINR(cat.total_revenue)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CategorySalesChart;

