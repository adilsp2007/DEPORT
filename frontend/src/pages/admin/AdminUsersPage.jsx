import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import adminService from '../../services/adminService';
import Button from '../../components/Button';
import Input from '../../components/Input';
import AdminPagination from '../../components/admin/AdminPagination';
import {
  Users,
  Search,
  Filter,
  Eye,
  Ban,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  User as UserIcon,
  Phone,
  Mail,
  Calendar,
  Lock,
  RefreshCw,
  Clock,
  Trash2,
  AlertTriangle
} from 'lucide-react';

export const AdminUsersPage = () => {
  const { user: currentUser } = useAuth();

  // State for user list & pagination
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals state
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [userToToggleBlock, setUserToToggleBlock] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Action feedback states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Debounce search query input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users whenever page, debouncedSearch, statusFilter, or pageSize changes
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getUsers({
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter
      });
      setUsers(data.results || []);
      setTotalUsers(data.count || 0);
      setTotalPages(data.total_pages || Math.ceil((data.count || 0) / pageSize) || 1);
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to load user records. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, debouncedSearch, statusFilter]);

  // Handle Toggle Block Action
  const handleConfirmToggleBlock = async () => {
    if (!userToToggleBlock) return;

    setActionLoading(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await adminService.toggleBlockUser(userToToggleBlock.id);
      setActionMessage(response.message || 'User status updated successfully.');
      setIsConfirmModalOpen(false);
      setUserToToggleBlock(null);

      // Refresh detail modal if open
      if (selectedUser && selectedUser.id === response.user.id) {
        setSelectedUser(response.user);
      }

      fetchUsers();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setActionError(err.response.data.detail);
      } else {
        setActionError('Failed to update account status.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Permanent Delete Action
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await adminService.deleteUser(userToDelete.id);
      setActionMessage(response.message || `User ${userToDelete.email} has been permanently deleted.`);
      setIsDeleteModalOpen(false);

      if (selectedUser && selectedUser.id === userToDelete.id) {
        setIsDetailModalOpen(false);
        setSelectedUser(null);
      }

      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setActionError(err.response.data.detail);
      } else {
        setActionError('Failed to delete user account.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenDetailModal = async (userObj) => {
    setSelectedUser(userObj);
    setIsDetailModalOpen(true);
    // Optionally fetch latest detail
    try {
      const freshDetail = await adminService.getUserDetail(userObj.id);
      setSelectedUser(freshDetail);
    } catch (e) {
      // Use existing userObj if fresh fetch fails
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadge = (userObj) => {
    if (userObj.is_superuser) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-purple-400 bg-purple-950/60 px-2 py-0.5 border border-purple-800/50">
          Superadmin
        </span>
      );
    }
    if (userObj.is_staff) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 border border-[#10B981]/30">
          Staff Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-gray-400 bg-gray-900/60 px-2 py-0.5 border border-gray-800">
        Customer
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#131915] border border-[#1E2922] p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            USER MANAGEMENT
          </span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#F3F4F6]">
            User Accounts ({totalUsers})
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Search, inspect user profiles, and manage account access permissions.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-xs font-semibold uppercase tracking-wider text-gray-300 hover:text-[#10B981] transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#10B981]' : ''} />
          <span>Refresh Users</span>
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="p-4 bg-[#10B981]/10 border-l-4 border-[#10B981] text-[#10B981] text-xs font-medium flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-950/70 border-l-4 border-rose-500 text-rose-300 text-xs font-medium flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="bg-[#131915] border border-[#1E2922] p-4 md:p-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search by name, email, or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 pl-11 border border-[#1E2922] focus:border-[#10B981] focus:outline-none placeholder-[#9CA3AF]/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <Filter size={14} className="text-[#10B981]" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="blocked">Blocked Only</option>
          </select>
        </div>
      </div>

      {/* User Table Container */}
      <div className="bg-[#131915] border border-[#1E2922] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#161D19] border-b border-[#1E2922] text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="py-4 px-6">ID</th>
                <th className="py-4 px-6">User Details</th>
                <th className="py-4 px-6">Role / Auth</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Registered Date</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2922] text-xs">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6 bg-[#161D19]/40 text-gray-600">#---</td>
                    <td className="py-4 px-6">
                      <div className="h-4 bg-[#161D19] w-32 mb-1" />
                      <div className="h-3 bg-[#161D19] w-44" />
                    </td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-20" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-16" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-24" /></td>
                    <td className="py-4 px-6 text-right"><div className="h-8 bg-[#161D19] w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 space-y-2">
                    <Users size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="font-serif text-lg text-[#F3F4F6]">No user accounts found.</p>
                    <p className="text-xs text-gray-500">
                      Try clearing your search terms or adjusting the status filter.
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((userObj) => {
                  const isSelf = currentUser?.id === userObj.id;

                  return (
                    <tr key={userObj.id} className="hover:bg-[#161D19]/50 transition-colors">
                      <td className="py-4 px-6 font-mono text-gray-400 font-bold">
                        #{userObj.id}
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {userObj.profile_image ? (
                            <img
                              src={userObj.profile_image}
                              alt="Avatar"
                              className="w-9 h-9 rounded-full object-cover border border-[#10B981]"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[#10B981]/10 text-[#10B981] font-bold flex items-center justify-center font-serif border border-[#10B981]/30">
                              {userObj.first_name?.[0] || 'U'}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-[#F3F4F6]">
                              {userObj.full_name || 'No Name'}
                              {isSelf && (
                                <span className="ml-2 text-[10px] text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 border border-[#10B981]/30 uppercase font-bold">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-gray-400 font-light">{userObj.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          {getRoleBadge(userObj)}
                          <p className="text-[10px] uppercase text-gray-500 tracking-wider">
                            Via {userObj.auth_provider || 'Email'}
                          </p>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-bold px-2.5 py-1 border ${
                          userObj.is_active
                            ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30'
                            : 'text-rose-400 bg-rose-950/60 border-rose-800/50'
                        }`}>
                          {userObj.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {userObj.is_active ? 'Active' : 'Blocked'}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-gray-400 text-[11px]">
                        <div>
                          <p className="text-[#F3F4F6] font-medium">{formatDate(userObj.created_at)}</p>
                          <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                            <Clock size={11} className="text-[#10B981] shrink-0" />
                            <span>Login: <strong className="text-gray-300 font-normal">{userObj.last_login ? formatDate(userObj.last_login) : 'Never'}</strong></span>
                          </p>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(userObj)}
                          className="px-3 py-1.5 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-gray-300 hover:text-[#10B981] text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                          title="View Details"
                        >
                          <Eye size={14} />
                          <span>Details</span>
                        </button>

                        {!isSelf && (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setUserToToggleBlock(userObj);
                                setIsConfirmModalOpen(true);
                              }}
                              className={`px-3 py-1.5 border text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 ${
                                userObj.is_active
                                  ? 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-800/50 text-amber-300'
                                  : 'bg-[#10B981]/10 hover:bg-[#10B981]/20 border-[#10B981]/30 text-[#10B981]'
                              }`}
                              title={userObj.is_active ? 'Block Account' : 'Unblock Account'}
                            >
                              {userObj.is_active ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                              <span>{userObj.is_active ? 'Block' : 'Unblock'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setUserToDelete(userObj);
                                setIsDeleteModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-400 hover:text-rose-200 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                              title="Delete Account"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <AdminPagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalUsers}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          itemName="users"
          loading={loading}
        />
      </div>

      {/* User Details Modal */}
      {isDetailModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#10B981]/10 text-[#10B981] rounded-full border border-[#10B981]/30">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">
                    User Account Details
                  </h3>
                  <p className="text-xs text-gray-400">ID: #{selectedUser.id}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Profile Avatar Header */}
            <div className="flex items-center gap-4 p-4 bg-[#161D19] border border-[#1E2922]">
              {selectedUser.profile_image ? (
                <img
                  src={selectedUser.profile_image}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#10B981]"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#10B981]/10 text-[#10B981] font-serif font-bold text-2xl flex items-center justify-center border-2 border-[#10B981]/30">
                  {selectedUser.first_name?.[0] || 'U'}
                </div>
              )}
              <div>
                <h4 className="font-serif text-lg font-bold text-[#F3F4F6]">
                  {selectedUser.full_name || 'No Name Provided'}
                </h4>
                <p className="text-xs text-gray-400">{selectedUser.email}</p>
                <div className="mt-2 flex items-center gap-2">
                  {getRoleBadge(selectedUser)}
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 border ${
                    selectedUser.is_active
                      ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30'
                      : 'text-rose-400 bg-rose-950/60 border-rose-800/50'
                  }`}>
                    {selectedUser.is_active ? 'Active' : 'Blocked'}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Information Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-[#161D19] border border-[#1E2922] space-y-1">
                <span className="text-gray-500 uppercase tracking-wider text-[10px] font-bold block flex items-center gap-1">
                  <Mail size={12} className="text-[#10B981]" /> Email Address
                </span>
                <p className="font-semibold text-[#F3F4F6] break-all">{selectedUser.email}</p>
              </div>

              <div className="p-3 bg-[#161D19] border border-[#1E2922] space-y-1">
                <span className="text-gray-500 uppercase tracking-wider text-[10px] font-bold block flex items-center gap-1">
                  <Phone size={12} className="text-[#10B981]" /> Phone Number
                </span>
                <p className="font-semibold text-[#F3F4F6]">
                  {selectedUser.phone || 'Not provided'}
                </p>
              </div>

              <div className="p-3 bg-[#161D19] border border-[#1E2922] space-y-1">
                <span className="text-gray-500 uppercase tracking-wider text-[10px] font-bold block flex items-center gap-1">
                  <ShieldCheck size={12} className="text-[#10B981]" /> Email Verification Status
                </span>
                <p className="font-semibold text-[#F3F4F6]">
                  {selectedUser.is_email_verified ? 'Verified Account' : 'Unverified'}
                </p>
              </div>

              <div className="p-3 bg-[#161D19] border border-[#1E2922] space-y-1">
                <span className="text-gray-500 uppercase tracking-wider text-[10px] font-bold block flex items-center gap-1">
                  <Lock size={12} className="text-[#10B981]" /> Authentication Method
                </span>
                <p className="font-semibold text-[#F3F4F6] uppercase">
                  {selectedUser.auth_provider || 'Email'}
                </p>
              </div>

              <div className="p-3 bg-[#161D19] border border-[#1E2922] space-y-1">
                <span className="text-gray-500 uppercase tracking-wider text-[10px] font-bold block flex items-center gap-1">
                  <Calendar size={12} className="text-[#10B981]" /> Registration Date
                </span>
                <p className="font-semibold text-[#F3F4F6]">
                  {formatDate(selectedUser.created_at)}
                </p>
              </div>

              <div className="p-3 bg-[#161D19] border border-[#1E2922] space-y-1">
                <span className="text-gray-500 uppercase tracking-wider text-[10px] font-bold block flex items-center gap-1">
                  <Clock size={12} className="text-[#10B981]" /> Last Login Time
                </span>
                <p className="font-semibold text-[#F3F4F6]">
                  {selectedUser.last_login ? formatDate(selectedUser.last_login) : 'Never logged in'}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#1E2922] flex flex-wrap items-center justify-between gap-4">
              {currentUser?.id !== selectedUser.id ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant={selectedUser.is_active ? 'ghost' : 'secondary'}
                    size="md"
                    onClick={() => {
                      setUserToToggleBlock(selectedUser);
                      setIsConfirmModalOpen(true);
                    }}
                    className={selectedUser.is_active ? 'text-rose-400 hover:text-rose-300' : ''}
                  >
                    {selectedUser.is_active ? 'Block User Account' : 'Unblock Account'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setUserToDelete(selectedUser);
                      setIsDeleteModalOpen(true);
                    }}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-900/40"
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    Delete User
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-gray-500 italic">
                  (You are viewing your active administrator profile)
                </span>
              )}

              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Block/Unblock Confirmation Dialog */}
      {isConfirmModalOpen && userToToggleBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-2xl space-y-6 relative text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${
              userToToggleBlock.is_active
                ? 'bg-rose-950/60 text-rose-400 border-rose-800/50'
                : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30'
            }`}>
              {userToToggleBlock.is_active ? <Ban size={28} /> : <CheckCircle2 size={28} />}
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">
                {userToToggleBlock.is_active ? 'Block User Account?' : 'Unblock User Account?'}
              </h3>
              <p className="text-xs text-gray-400 mt-2 font-light leading-relaxed">
                {userToToggleBlock.is_active ? (
                  <>
                    Are you sure you want to block{' '}
                    <strong className="text-[#F3F4F6] font-semibold">
                      {userToToggleBlock.full_name || userToToggleBlock.email}
                    </strong>
                    ? This user will be immediately logged out and blocked from logging in or using store features.
                  </>
                ) : (
                  <>
                    Are you sure you want to unblock{' '}
                    <strong className="text-[#F3F4F6] font-semibold">
                      {userToToggleBlock.full_name || userToToggleBlock.email}
                    </strong>
                    ? This user will regain full access to their account.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4 border-t border-[#1E2922]">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setUserToToggleBlock(null);
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant={userToToggleBlock.is_active ? 'primary' : 'secondary'}
                size="md"
                loading={actionLoading}
                disabled={actionLoading}
                onClick={handleConfirmToggleBlock}
                className={userToToggleBlock.is_active ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}
              >
                {actionLoading
                  ? 'Updating...'
                  : userToToggleBlock.is_active
                  ? 'Confirm Block'
                  : 'Confirm Unblock'
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#131915] border border-rose-900/40 p-6 sm:p-8 shadow-2xl space-y-6 relative text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto border bg-rose-950/60 text-rose-500 border-rose-800/50">
              <AlertTriangle size={28} />
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">
                Delete User Account?
              </h3>
              <p className="text-xs text-gray-400 mt-2 font-light leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-[#F3F4F6] font-semibold">
                  {userToDelete.full_name || userToDelete.email}
                </strong>
                ? This will permanently delete their account credentials, profile, addresses, and wishlist. Past orders will be preserved for store accounting. This action <span className="text-rose-400 font-medium">cannot be undone</span>.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4 border-t border-[#1E2922]">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                disabled={deleteLoading}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                loading={deleteLoading}
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white border-0 shadow-lg shadow-rose-950/40"
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Permanent Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
