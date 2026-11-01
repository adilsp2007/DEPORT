import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import productService from '../services/productService';
import { formatINR } from '../utils/currencyUtils';
import PriceDisplay from './PriceDisplay';

export const SearchBar = ({ isOpen, onClose }) => {
  const [term, setTerm] = useState('');
  const [liveResults, setLiveResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  // Debounced search query for live preview
  useEffect(() => {
    if (!term.trim()) {
      setLiveResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(async () => {
      try {
        const data = await productService.getProducts({ search: term.trim(), page_size: 4 });
        setLiveResults(data.results || []);
      } catch (err) {
        setLiveResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [term]);

  if (!isOpen) return null;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (term.trim()) {
      navigate(`/shop?search=${encodeURIComponent(term.trim())}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col items-center pt-20 px-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0B0F0D] shadow-2xl border border-[#1E2922] overflow-hidden">
        <form onSubmit={handleSearchSubmit} className="flex items-center px-6 py-4 border-b border-[#1E2922] bg-[#131915]">
          <Search size={22} className="text-[#10B981] mr-3" />
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search luxury bags, totes, wallets..."
            autoFocus
            className="flex-1 bg-transparent text-lg text-[#F3F4F6] placeholder-gray-500 focus:outline-none font-serif"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm('')}
              className="text-gray-400 hover:text-white mr-3"
            >
              <X size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-widest font-semibold text-[#F3F4F6] hover:text-[#10B981] border-l border-[#1E2922] pl-4"
          >
            Cancel
          </button>
        </form>

        {/* Live Preview Results */}
        {term.trim() && (
          <div className="p-6 max-h-96 overflow-y-auto bg-[#0B0F0D]">
            <h4 className="text-xs uppercase font-bold tracking-widest text-gray-400 mb-4">
              {isSearching ? 'Searching...' : `Matching Bags (${liveResults.length})`}
            </h4>

            {!isSearching && liveResults.length > 0 && (
              <div className="space-y-3">
                {liveResults.map((product) => {
                  const img = product.primary_image || product.images?.[0]?.image;
                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        navigate(`/product/${product.slug}`);
                        onClose();
                      }}
                      className="flex items-center gap-4 p-2.5 bg-[#131915] hover:bg-[#161D19] cursor-pointer transition-colors border border-[#1E2922]"
                    >
                      {img ? (
                        <img src={img} alt={product.name} className="w-12 h-12 object-cover" />
                      ) : (
                        <div className="w-12 h-12 bg-[#161D19] flex items-center justify-center text-[9px] text-[#10B981] font-bold font-serif">
                          DEPORT
                        </div>
                      )}
                      <div className="flex-1">
                        <h5 className="font-serif text-sm font-semibold text-[#F3F4F6]">
                          {product.name}
                        </h5>
                        <span className="text-xs text-gray-400">
                          {product.category?.name || 'DEPORT'}
                        </span>
                      </div>
                      <PriceDisplay
                        price={product.price}
                        oldPrice={product.compare_at_price || product.original_price}
                        discountPercentage={product.discount_percentage}
                        size="xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {!isSearching && liveResults.length === 0 && (
              <p className="text-sm text-gray-400">No products found matching "{term}"</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
