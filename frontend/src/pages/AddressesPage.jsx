import React, { useState } from 'react';
import useAddresses from '../hooks/useAddresses';
import AccountSidebar from '../components/AccountSidebar';
import AddressCard from '../components/AddressCard';
import AddressFormModal from '../components/AddressFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';
import { Plus, MapPin, AlertCircle, RefreshCw } from 'lucide-react';

export const AddressesPage = () => {
  const {
    addresses,
    loading,
    error,
    fetchAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAddresses();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (address) => {
    setEditingAddress(address);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAddress(null);
  };

  const handleSaveAddress = async (formData) => {
    setIsSubmitting(true);
    try {
      if (editingAddress) {
        await updateAddress(editingAddress.id, formData);
      } else {
        await createAddress(formData);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingId) {
      await deleteAddress(deletingId);
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-[#F3F4F6]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#1E2922] mb-10 gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            MY ACCOUNT
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F3F4F6]">
            My Addresses
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Manage your delivery addresses.
          </p>
        </div>

        <Button
          variant="primary"
          icon={Plus}
          onClick={handleOpenAddModal}
        >
          Add New Address
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Account Navigation Sidebar */}
        <div className="lg:col-span-3">
          <AccountSidebar />
        </div>

        {/* Main Address Content Area */}
        <div className="lg:col-span-9">
          {/* Loading State Skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((n) => (
                <div key={n} className="bg-[#131915] border border-[#1E2922] p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <Skeleton className="w-24 h-6" />
                    <Skeleton className="w-16 h-5" />
                  </div>
                  <Skeleton className="w-3/4 h-5" />
                  <Skeleton className="w-1/2 h-4" />
                  <Skeleton className="w-full h-12" />
                  <div className="pt-4 border-t border-[#1E2922] flex justify-between">
                    <Skeleton className="w-20 h-4" />
                    <Skeleton className="w-16 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="bg-[#131915] border border-rose-900/50 p-8 text-center my-4 space-y-4">
              <AlertCircle size={36} className="text-rose-500 mx-auto" />
              <h3 className="font-serif text-xl text-[#F3F4F6]">Unable to load your addresses.</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">{error}</p>
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={fetchAddresses}
                className="mx-auto"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && addresses.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="No Saved Addresses"
              description="Add an address to make checkout faster and easier."
              actionLabel="Add New Address"
              actionIcon={Plus}
              onAction={handleOpenAddModal}
            />
          )}

          {/* Address Cards Grid */}
          {!loading && !error && addresses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  address={address}
                  onEdit={handleOpenEditModal}
                  onDelete={(id) => setDeletingId(id)}
                  onSetDefault={setDefaultAddress}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Address Form Modal */}
      <AddressFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        initialValues={editingAddress}
        onSave={handleSaveAddress}
        isSubmitting={isSubmitting}
      />

      {/* Delete Address Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Address?"
        message="This address will be permanently removed."
        confirmText="Delete Address"
        cancelText="Cancel"
        isDanger
      />
    </div>
  );
};

export default AddressesPage;
