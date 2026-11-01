import React from 'react';
import { Home, Building, MapPin, CheckCircle2, Trash2, Edit3 } from 'lucide-react';

export const AddressCard = ({ address, onEdit, onDelete, onSetDefault }) => {
  const labelIcons = {
    Home: <Home size={18} className="text-[#10B981]" />,
    Office: <Building size={18} className="text-[#10B981]" />,
    Other: <MapPin size={18} className="text-[#10B981]" />
  };

  return (
    <div
      className={`bg-[#131915] border p-6 flex flex-col justify-between transition-all duration-300 ${
        address.is_default
          ? 'border-[#10B981] ring-1 ring-[#10B981] shadow-md'
          : 'border-[#1E2922] hover:border-[#10B981]/50 shadow-xs'
      }`}
    >
      <div>
        {/* Header: Label & Default Badge */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1E2922]">
          <div className="flex items-center gap-2">
            {labelIcons[address.label] || labelIcons.Other}
            <h3 className="font-serif text-lg font-semibold text-[#F3F4F6]">{address.label}</h3>
          </div>

          {address.is_default && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 border border-[#10B981]/30">
              <CheckCircle2 size={12} /> DEFAULT
            </span>
          )}
        </div>

        {/* Address Body */}
        <div className="text-sm text-gray-400 space-y-1 mb-6 font-light">
          <p className="font-semibold text-[#F3F4F6] text-base">{address.full_name}</p>
          <p className="text-xs text-gray-300 font-medium">Phone: {address.phone}</p>
          <p className="pt-2">{address.address_line_1}</p>
          {address.address_line_2 && <p>{address.address_line_2}</p>}
          <p>
            {address.city}, {address.state} {address.postal_code}
          </p>
          <p className="font-medium text-[#F3F4F6]">{address.country}</p>
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div className="pt-4 border-t border-[#1E2922] flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
        <div>
          {!address.is_default && (
            <button
              type="button"
              onClick={() => onSetDefault(address.id)}
              className="text-[#10B981] hover:text-[#059669] transition-colors"
            >
              Set as Default
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onEdit(address)}
            className="text-gray-300 hover:text-[#10B981] p-1 flex items-center gap-1 transition-colors"
            title="Edit address"
          >
            <Edit3 size={15} /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(address.id)}
            className="text-rose-500 hover:text-rose-400 p-1 flex items-center gap-1 transition-colors"
            title="Delete address"
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressCard;
