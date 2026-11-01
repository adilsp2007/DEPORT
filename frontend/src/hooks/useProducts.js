import { useQuery } from '@tanstack/react-query';
import productService from '../services/productService';

export const useProducts = (params = {}) => {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => productService.getProducts(params),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
};

export const useProduct = (slug) => {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => productService.getProduct(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => productService.getCategories(),
    staleTime: 1000 * 60 * 15, // 15 minutes cache
  });
};

export const useCategory = (slug) => {
  return useQuery({
    queryKey: ['category', slug],
    queryFn: () => productService.getCategory(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 15,
  });
};

export const useBanners = (placement = '') => {
  return useQuery({
    queryKey: ['banners', placement],
    queryFn: () => productService.getBanners(placement ? { placement } : {}),
    staleTime: 1000 * 60 * 10,
  });
};

