import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import Button from '../../components/Button';
import AdminPagination from '../../components/admin/AdminPagination';
import {
  Boxes,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Save,
  Check,
  TrendingDown,
  Layers,
  ArrowUpDown,
  Edit3
} from 'lucide-react';

export const AdminInventoryPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState(''); // '', 'in_stock', 'low_stock', 'out_of_stock'
  const [sort, setSort] = useState('stock_low'); // default low stock first

  // Inline editing state: { [productId]: quantityString }
  const [editingStock, setEditingStock] = useState({});
  const [savingProductId, setSavingProductId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Restock modal state
  const [restockModalProduct, setRestockModalProduct] = useState(null);
  const [restockAddAmount, setRestockAddAmount] = useState(10);
  const [submittingRestock, setSubmittingRestock] = useState(false);

  // Stock KPI counts (derived or fetched)
  const [kpiCounts, setKpiCounts] = useState({
    total: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch Inventory items
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getInventory({
        page,
        pageSize,
        search: debouncedSearch,
        stock_status: stockStatusFilter,
        sort
      });

      const list = data.results || [];
      setProducts(list);
      setTotalCount(data.count || 0);
      setTotalPages(data.total_pages || Math.ceil((data.count || 0) / pageSize) || 1);

      // Initialize editingStock buffer
      const stockMap = {};
      list.forEach((p) => {
        stockMap[p.id] = String(p.stock_quantity ?? 0);
      });
      setEditingStock(stockMap);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, stockStatusFilter, sort]);

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  // Also fetch summary KPI counts once or on refresh
  const fetchKpis = useCallback(async () => {
    try {
      const [allData, lowData, outData] = await Promise.all([
        adminService.getInventory({ page: 1, sort: 'newest' }),
        adminService.getInventory({ page: 1, stock_status: 'low_stock' }),
        adminService.getInventory({ page: 1, stock_status: 'out_of_stock' })
      ]);
      const total = allData.count || 0;
      const lowStock = lowData.count || 0;
      const outOfStock = outData.count || 0;
      const inStock = Math.max(0, total - lowStock - outOfStock);

      setKpiCounts({
        total,
        inStock,
        lowStock,
        outOfStock
      });
    } catch (err) {
      console.warn('Could not fetch inventory KPIs', err);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  // Quick incremental stock update (+/- 1, +/- 5)
  const handleQuickAdjust = async (productId, delta) => {
    setSavingProductId(productId);
    try {
      const res = await adminService.updateProductStock(productId, { adjustment: delta });
      const updatedProduct = res.product || res;
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock_quantity: updatedProduct.stock_quantity } : p))
      );
      setEditingStock((prev) => ({
        ...prev,
        [productId]: String(updatedProduct.stock_quantity)
      }));
      setToastMessage({
        type: 'success',
        text: `Stock updated for ${updatedProduct.name}: ${updatedProduct.stock_quantity} units`
      });
      fetchKpis();
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to adjust stock quantity.'
      });
    } finally {
      setSavingProductId(null);
    }
  };

  // Direct stock quantity save from inline input
  const handleDirectSave = async (productId) => {
    const rawVal = editingStock[productId];
    const newQty = parseInt(rawVal, 10);
    if (isNaN(newQty) || newQty < 0) {
      setToastMessage({ type: 'error', text: 'Please enter a valid non-negative number.' });
      return;
    }

    setSavingProductId(productId);
    try {
      const res = await adminService.updateProductStock(productId, { stock_quantity: newQty });
      const updatedProduct = res.product || res;
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock_quantity: updatedProduct.stock_quantity } : p))
      );
      setEditingStock((prev) => ({
        ...prev,
        [productId]: String(updatedProduct.stock_quantity)
      }));
      setToastMessage({
        type: 'success',
        text: `Stock saved for ${updatedProduct.name}: ${updatedProduct.stock_quantity} units`
      });
      fetchKpis();
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update stock.'
      });
    } finally {
      setSavingProductId(null);
    }
  };

  // Restock batch modal submit
  const handleBatchRestock = async () => {
    if (!restockModalProduct) return;
    const addQty = parseInt(restockAddAmount, 10);
    if (isNaN(addQty) || addQty <= 0) {
      setToastMessage({ type: 'error', text: 'Please enter a positive restock amount.' });
      return;
    }

    setSubmittingRestock(true);
    try {
      const res = await adminService.updateProductStock(restockModalProduct.id, { adjustment: addQty });
      const updated = res.product || res;
      setProducts((prev) =>
        prev.map((p) => (p.id === restockModalProduct.id ? { ...p, stock_quantity: updated.stock_quantity } : p))
      );
      setEditingStock((prev) => ({
        ...prev,
        [restockModalProduct.id]: String(updated.stock_quantity)
      }));
      setToastMessage({
        type: 'success',
        text: `Restocked ${restockModalProduct.name} by +${addQty} units (Total: ${updated.stock_quantity})`
      });
      setRestockModalProduct(null);
      fetchKpis();
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to complete restock.'
      });
    } finally {
      setSubmittingRestock(false);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStockStatusFilter('');
    setSort('stock_low');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || stockStatusFilter || sort !== 'stock_low');

  // Stock badge helper
  const renderStockBadge = (quantity) => {
    if (quantity === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <XCircle size={12} />
          Out of Stock
        </span>
      );
    }
    if (quantity <= 5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertTriangle size={12} />
          Low Stock ({quantity} left)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30">
        <CheckCircle2 size={12} />
        In Stock ({quantity})
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2922]">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#F3F4F6] flex items-center gap-3">
            <Boxes className="text-[#10B981]" size={28} />
            Inventory & Stock Management
          </h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
            Monitor real-time warehouse inventory, trigger instant restocks, and avoid stock-outs.
          </p>
        </div>

        <button
          onClick={() => {
            fetchInventory();
            fetchKpis();
          }}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider bg-[#161D19] hover:bg-[#1E2922] text-gray-300 hover:text-[#10B981] border border-[#1E2922] transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Sync Stock</span>
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`flex items-center justify-between gap-3 p-4 border text-xs font-medium animate-fadeIn ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/40 border-rose-800 text-rose-300'
              : 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <div
          onClick={() => {
            setStockStatusFilter('');
            setPage(1);
          }}
          className={`p-4 bg-[#131915] border cursor-pointer transition-all ${
            stockStatusFilter === ''
              ? 'border-[#10B981] shadow-xs shadow-[#10B981]/10'
              : 'border-[#1E2922] hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] uppercase tracking-widest font-bold">Total Catalog</span>
            <Layers size={16} className="text-gray-400" />
          </div>
          <p className="font-serif text-2xl font-bold text-[#F3F4F6]">{kpiCounts.total}</p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">All tracked items</p>
        </div>

        {/* In Stock */}
        <div
          onClick={() => {
            setStockStatusFilter('in_stock');
            setPage(1);
          }}
          className={`p-4 bg-[#131915] border cursor-pointer transition-all ${
            stockStatusFilter === 'in_stock'
              ? 'border-[#10B981] shadow-xs shadow-[#10B981]/10'
              : 'border-[#1E2922] hover:border-[#10B981]/50'
          }`}
        >
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#10B981]">Healthy Stock</span>
            <CheckCircle2 size={16} className="text-[#10B981]" />
          </div>
          <p className="font-serif text-2xl font-bold text-[#10B981]">{kpiCounts.inStock}</p>
          <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">&gt; 5 units available</p>
        </div>

        {/* Low Stock */}
        <div
          onClick={() => {
            setStockStatusFilter('low_stock');
            setPage(1);
          }}
          className={`p-4 bg-[#131915] border cursor-pointer transition-all ${
            stockStatusFilter === 'low_stock'
              ? 'border-amber-500 shadow-xs shadow-amber-500/10'
              : 'border-[#1E2922] hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400">Low Stock Alert</span>
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <p className="font-serif text-2xl font-bold text-amber-400">{kpiCounts.lowStock}</p>
          <p className="text-[10px] text-amber-400/80 mt-1 uppercase tracking-wider">1 to 5 units remaining</p>
        </div>

        {/* Out of Stock */}
        <div
          onClick={() => {
            setStockStatusFilter('out_of_stock');
            setPage(1);
          }}
          className={`p-4 bg-[#131915] border cursor-pointer transition-all ${
            stockStatusFilter === 'out_of_stock'
              ? 'border-rose-500 shadow-xs shadow-rose-500/10'
              : 'border-[#1E2922] hover:border-rose-500/50'
          }`}
        >
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-rose-400">Depleted / OOS</span>
            <XCircle size={16} className="text-rose-400" />
          </div>
          <p className="font-serif text-2xl font-bold text-rose-400">{kpiCounts.outOfStock}</p>
          <p className="text-[10px] text-rose-400/80 mt-1 uppercase tracking-wider">0 units available</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-[#131915] border border-[#1E2922] flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by product name, SKU, or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-[#0B0F0D] border border-[#1E2922] focus:border-[#10B981] text-xs text-[#F3F4F6] placeholder-gray-500 outline-hidden transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#F3F4F6]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Stock Status Filter */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={stockStatusFilter}
              onChange={(e) => {
                setStockStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#0B0F0D] border border-[#1E2922] px-3 py-2 text-xs text-[#F3F4F6] focus:border-[#10B981] outline-hidden uppercase tracking-wider"
            >
              <option value="">All Stock Statuses</option>
              <option value="in_stock">In Stock (&gt; 5)</option>
              <option value="low_stock">Low Stock (1 - 5)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown size={14} className="text-gray-400" />
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="bg-[#0B0F0D] border border-[#1E2922] px-3 py-2 text-xs text-[#F3F4F6] focus:border-[#10B981] outline-hidden uppercase tracking-wider"
            >
              <option value="stock_low">Stock: Lowest First</option>
              <option value="stock_high">Stock: Highest First</option>
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
              <option value="newest">Newest Added</option>
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 border border-rose-900/40 uppercase tracking-wider font-semibold transition-colors"
            >
              <X size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-[#131915] border border-[#1E2922] overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <RefreshCw size={28} className="animate-spin text-[#10B981]" />
            <p className="text-xs uppercase tracking-widest font-semibold text-gray-400">
              Loading Warehouse Inventory...
            </p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-400 space-y-3">
            <AlertTriangle size={32} className="mx-auto" />
            <p className="text-sm font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchInventory}>
              Retry
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Boxes size={40} className="mx-auto text-gray-600" />
            <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">No Products Found</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'No items matched your search and filter criteria. Try clearing filters.'
                : 'Your product catalog has no items yet.'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1E2922] bg-[#0E1310] text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Product Details</th>
                  <th className="py-3.5 px-4">Category / SKU</th>
                  <th className="py-3.5 px-4 text-right">Price</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Quick Adjust</th>
                  <th className="py-3.5 px-4 text-right">Set Exact Stock</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2922]">
                {products.map((item) => {
                  const currentQty = item.stock_quantity ?? 0;
                  const primaryImg =
                    item.primary_image?.image ||
                    item.images?.[0]?.image ||
                    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&q=80';
                  const isSaving = savingProductId === item.id;
                  const bufferVal = editingStock[item.id] ?? String(currentQty);
                  const isDirty = bufferVal !== String(currentQty);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#161D19] transition-colors ${
                        currentQty === 0
                          ? 'bg-rose-950/5'
                          : currentQty <= 5
                          ? 'bg-amber-950/5'
                          : ''
                      }`}
                    >
                      {/* Product details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={primaryImg}
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded-xs border border-[#1E2922] bg-[#0B0F0D] shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-serif font-bold text-sm text-[#F3F4F6] block truncate max-w-xs hover:text-[#10B981] transition-colors">
                              {item.name}
                            </span>
                            <span className="text-[11px] text-gray-400 block mt-0.5">
                              {item.brand || 'Luxury Bag'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category & SKU */}
                      <td className="py-3.5 px-4 text-gray-300">
                        <div className="space-y-0.5">
                          <span className="inline-block px-2 py-0.5 bg-[#1E2922] text-[10px] uppercase tracking-wider text-gray-300">
                            {item.category?.name || 'Uncategorized'}
                          </span>
                          <span className="block font-mono text-[11px] text-gray-400">
                            SKU: {item.sku || 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono text-xs font-semibold text-[#F3F4F6]">
                          ₹{Number(item.price).toLocaleString()}
                        </div>
                        {item.sale_price && Number(item.sale_price) < Number(item.price) && (
                          <span className="text-[10px] text-gray-500 line-through font-mono block">
                            ₹{Number(item.sale_price).toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Stock status badge */}
                      <td className="py-3.5 px-4 text-center">
                        {renderStockBadge(currentQty)}
                      </td>

                      {/* Quick Adjust Buttons (-5, -1, +1, +5) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1 bg-[#0B0F0D] border border-[#1E2922] p-1">
                          <button
                            type="button"
                            disabled={isSaving || currentQty <= 0}
                            onClick={() => handleQuickAdjust(item.id, -5)}
                            className="px-1.5 py-1 text-[10px] font-mono text-gray-400 hover:text-rose-400 hover:bg-rose-950/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Decrease by 5 units"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            disabled={isSaving || currentQty <= 0}
                            onClick={() => handleQuickAdjust(item.id, -1)}
                            className="p-1 text-gray-400 hover:text-rose-400 hover:bg-rose-950/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Decrease by 1 unit"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-10 text-center font-mono font-bold text-xs text-[#F3F4F6]">
                            {currentQty}
                          </span>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleQuickAdjust(item.id, 1)}
                            className="p-1 text-gray-400 hover:text-[#10B981] hover:bg-[#10B981]/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Increase by 1 unit"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleQuickAdjust(item.id, 5)}
                            className="px-1.5 py-1 text-[10px] font-mono text-gray-400 hover:text-[#10B981] hover:bg-[#10B981]/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Increase by 5 units"
                          >
                            +5
                          </button>
                        </div>
                      </td>

                      {/* Set Exact Stock */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={bufferVal}
                            onChange={(e) =>
                              setEditingStock((prev) => ({
                                ...prev,
                                [item.id]: e.target.value
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleDirectSave(item.id);
                              }
                            }}
                            className={`w-18 px-2 py-1.5 text-center font-mono text-xs bg-[#0B0F0D] border outline-hidden transition-colors ${
                              isDirty
                                ? 'border-[#10B981] text-[#10B981] font-bold'
                                : 'border-[#1E2922] text-[#F3F4F6]'
                            }`}
                          />
                          <button
                            type="button"
                            disabled={isSaving || !isDirty}
                            onClick={() => handleDirectSave(item.id)}
                            className={`p-1.5 text-xs transition-colors border ${
                              isDirty
                                ? 'bg-[#10B981] text-black border-[#10B981] hover:bg-[#10B981]/90'
                                : 'text-gray-600 border-transparent cursor-not-allowed opacity-40'
                            }`}
                            title="Save updated quantity"
                          >
                            {isSaving ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <Check size={13} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Actions: Batch Restock Modal */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setRestockModalProduct(item);
                            setRestockAddAmount(10);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-300 hover:text-[#10B981] bg-[#161D19] hover:bg-[#1E2922] border border-[#1E2922] transition-colors"
                        >
                          <Plus size={12} />
                          <span>Restock</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer / Pagination */}
        <AdminPagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          itemName="inventory items"
          loading={loading}
        />
      </div>

      {/* Restock Batch Modal */}
      {restockModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#131915] border border-[#1E2922] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1E2922] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">Batch Restock Units</h3>
                  <p className="text-[11px] text-gray-400">Add inventory arrival directly into catalog</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestockModalProduct(null)}
                className="text-gray-400 hover:text-[#F3F4F6] p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-[#0B0F0D] border border-[#1E2922] flex items-center gap-3">
                <img
                  src={
                    restockModalProduct.primary_image?.image ||
                    restockModalProduct.images?.[0]?.image ||
                    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&q=80'
                  }
                  alt={restockModalProduct.name}
                  className="w-12 h-12 object-cover rounded-xs border border-[#1E2922]"
                />
                <div className="min-w-0">
                  <h4 className="font-serif font-bold text-sm text-[#F3F4F6] truncate">
                    {restockModalProduct.name}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="text-gray-400 font-mono">
                      Current: <strong className="text-[#F3F4F6]">{restockModalProduct.stock_quantity ?? 0}</strong>
                    </span>
                    <span className="text-gray-400 font-mono">
                      SKU: <strong className="text-gray-300">{restockModalProduct.sku || 'N/A'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-300 mb-2">
                  Units to Add to Stock
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={restockAddAmount}
                    onChange={(e) => setRestockAddAmount(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-[#0B0F0D] border border-[#1E2922] focus:border-[#10B981] text-sm text-[#F3F4F6] font-mono outline-hidden"
                  />
                  <div className="flex items-center gap-1">
                    {[10, 25, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRestockAddAmount(preset)}
                        className={`px-2.5 py-2 text-xs font-mono border transition-colors ${
                          Number(restockAddAmount) === preset
                            ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]'
                            : 'bg-[#161D19] text-gray-400 border-[#1E2922] hover:text-[#F3F4F6]'
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#10B981]/5 border border-[#10B981]/20 text-xs text-gray-300">
                <span className="text-[#10B981] font-semibold">New Expected Stock: </span>
                <span className="font-mono font-bold text-[#F3F4F6]">
                  {(restockModalProduct.stock_quantity ?? 0) + (parseInt(restockAddAmount, 10) || 0)} units
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1E2922] bg-[#0E1310] flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestockModalProduct(null)}
                disabled={submittingRestock}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleBatchRestock}
                loading={submittingRestock}
              >
                Confirm Restock
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInventoryPage;
