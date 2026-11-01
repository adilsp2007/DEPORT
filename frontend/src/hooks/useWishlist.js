import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import wishlistService from '../services/wishlistService';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';

export const useWishlist = () => {
  const { user } = useAuth();
  const { showToast } = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const isAuthenticated = Boolean(user);

  // Fetch wishlist query
  const wishlistQuery = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => wishlistService.getWishlist(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const wishlist = wishlistQuery.data || [];
  const wishlistCount = wishlist.length;

  // Set of wishlisted product IDs for fast O(1) checking
  const wishlistedProductIds = new Set(
    wishlist.map((item) => item.product?.id || item.product)
  );

  const isWishlisted = (productId) => wishlistedProductIds.has(productId);

  // Toggle mutation with optimistic update
  const toggleMutation = useMutation({
    mutationFn: (productId) => wishlistService.toggleWishlist(productId),
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: ['wishlist'] });
      const previousWishlist = queryClient.getQueryData(['wishlist']) || [];

      const exists = previousWishlist.some(
        (item) => (item.product?.id || item.product) === productId
      );

      let updatedWishlist;
      if (exists) {
        updatedWishlist = previousWishlist.filter(
          (item) => (item.product?.id || item.product) !== productId
        );
      } else {
        updatedWishlist = [
          ...previousWishlist,
          { id: `temp-${Date.now()}`, product: { id: productId }, created_at: new Date().toISOString() }
        ];
      }

      queryClient.setQueryData(['wishlist'], updatedWishlist);
      return { previousWishlist };
    },
    onSuccess: (data) => {
      showToast(data.message || (data.wishlisted ? 'Added to wishlist.' : 'Removed from wishlist.'));
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
    onError: (err, productId, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(['wishlist'], context.previousWishlist);
      }
      showToast(err.response?.data?.detail || 'Unable to update wishlist. Please try again.', 'error');
    },
  });

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: (productId) => wishlistService.removeFromWishlist(productId),
    onSuccess: () => {
      showToast('Removed from wishlist.', 'info');
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
    onError: () => {
      showToast('Unable to remove item from wishlist.', 'error');
    },
  });

  const handleToggle = (product) => {
    if (!isAuthenticated) {
      showToast('Please log in to save products to your wishlist.', 'info');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    const productId = typeof product === 'object' ? product.id : product;
    toggleMutation.mutate(productId);
  };

  const handleRemove = (product) => {
    if (!isAuthenticated) return;
    const productId = typeof product === 'object' ? product.id : product;
    removeMutation.mutate(productId);
  };

  return {
    wishlist,
    wishlistCount,
    isLoading: wishlistQuery.isLoading,
    isError: wishlistQuery.isError,
    refetchWishlist: wishlistQuery.refetch,
    isWishlisted,
    toggleWishlist: handleToggle,
    removeFromWishlist: handleRemove,
    isToggling: toggleMutation.isPending,
  };
};

export default useWishlist;
