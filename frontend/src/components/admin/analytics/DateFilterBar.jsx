import React, { useState } from 'react';
import { Calendar, Filter, RotateCcw, AlertCircle, ChevronDown } from 'lucide-react';

const PRESET_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_year', label: 'This Year' },
  { id: 'last_year', label: 'Last Year' },
  { id: 'custom', label: 'Custom Range' },
];

export const DateFilterBar = ({
  selectedPeriod = 'this_month',
  onSelectPeriod,
  customStartDate = '',
  customEndDate = '',
  onApplyCustomRange,
  onReset,
  isLoading = false
}) => {
  const [showCustomInputs, setShowCustomInputs] = useState(selectedPeriod === 'custom');
  const [startDate, setStartDate] = useState(customStartDate || '');
  const [endDate, setEndDate] = useState(customEndDate || '');
  const [dateError, setDateError] = useState('');

  const handlePresetClick = (presetId) => {
    setDateError('');
    if (presetId === 'custom') {
      setShowCustomInputs(true);
    } else {
      setShowCustomInputs(false);
      onSelectPeriod(presetId);
    }
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    setDateError('');

    if (!startDate || !endDate) {
      setDateError('Please select both start and end dates.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setDateError('End date cannot be earlier than start date.');
      return;
    }

    onApplyCustomRange(startDate, endDate);
  };

  const handleResetClick = () => {
    setDateError('');
    setStartDate('');
    setEndDate('');
    setShowCustomInputs(false);
    onReset();
  };

  return (
    <div className="bg-[#131915] border border-[#1E2922] p-4 sm:p-5 shadow-sm space-y-4">
      {/* Top Header & Presets Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-gray-300">
          <Filter size={14} className="text-[#10B981]" />
          <span>Analytics Time Period</span>
        </div>

        {/* Preset Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {PRESET_OPTIONS.map((opt) => {
            const isActive = selectedPeriod === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handlePresetClick(opt.id)}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[#10B981] text-black border-[#10B981] shadow-xs'
                    : 'bg-[#161D19] text-gray-300 border-[#1E2922] hover:border-[#10B981]/50 hover:text-white'
                } disabled:opacity-50`}
              >
                {opt.label}
              </button>
            );
          })}

          {(selectedPeriod !== 'this_month' || showCustomInputs) && (
            <button
              type="button"
              onClick={handleResetClick}
              disabled={isLoading}
              title="Reset to default This Month filter"
              className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-rose-400 bg-[#161D19] border border-[#1E2922] hover:border-rose-900 transition-colors flex items-center gap-1"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom Date Range Panel */}
      {showCustomInputs && (
        <form
          onSubmit={handleApplyCustom}
          className="pt-4 border-t border-[#1E2922] flex flex-col sm:flex-row sm:items-end gap-3 text-xs"
        >
          <div className="flex-1 space-y-1">
            <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
              Start Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateError('');
                }}
                className="w-full bg-[#161D19] border border-[#1E2922] text-white px-3 py-2 text-xs focus:outline-none focus:border-[#10B981] transition-colors"
                required
              />
            </div>
          </div>

          <div className="flex-1 space-y-1">
            <label className="block text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
              End Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateError('');
                }}
                className="w-full bg-[#161D19] border border-[#1E2922] text-white px-3 py-2 text-xs focus:outline-none focus:border-[#10B981] transition-colors"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <button
              type="submit"
              disabled={isLoading || !startDate || !endDate}
              className="px-5 py-2 bg-[#10B981] hover:bg-[#059669] text-black font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
            >
              Apply Range
            </button>
            <button
              type="button"
              onClick={handleResetClick}
              disabled={isLoading}
              className="px-3 py-2 bg-[#161D19] hover:bg-[#1E2922] text-gray-300 border border-[#1E2922] text-xs uppercase font-semibold transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Date Validation Error Alert */}
      {dateError && (
        <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0 text-rose-400" />
          <span>{dateError}</span>
        </div>
      )}
    </div>
  );
};

export default DateFilterBar;

