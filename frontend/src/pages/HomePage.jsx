import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import HeroSection from '../components/HeroSection';
import CategoryCard from '../components/CategoryCard';
import ProductGrid from '../components/ProductGrid';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import Button from '../components/Button';
import { useCategories, useProducts, useBanners } from '../hooks/useProducts';
import { useShop } from '../context/ShopContext';
import { ArrowRight, ShieldCheck, Award } from 'lucide-react';

export const HomePage = () => {
  const { showToast } = useShop();
  const [newsletterEmail, setNewsletterEmail] = useState('');

  // Dynamic API queries
  const { data: categoriesData, isLoading: isCategoriesLoading } = useCategories();
  const { data: featuredData, isLoading: isFeaturedLoading } = useProducts({ is_featured: 'true', page_size: 4 });
  const { data: newData, isLoading: isNewLoading } = useProducts({ is_new: 'true', sort: 'newest', page_size: 4 });
  const { data: bestSellerData, isLoading: isBestSellerLoading } = useProducts({ is_best_seller: 'true', page_size: 4 });
  const { data: promoData } = useBanners('promotional');

  const categories = categoriesData?.results || categoriesData || [];
  const featuredProducts = featuredData?.results || [];
  const newArrivals = newData?.results || [];
  const bestSellers = bestSellerData?.results || [];

  const promoBanners = promoData?.results || (Array.isArray(promoData) ? promoData : []);
  const promoBanner = promoBanners.length > 0 ? promoBanners[0] : null;

  const promoTagline = promoBanner?.tagline || 'LIMITED EDITION CRAFTSMANSHIP';
  const promoTitle = promoBanner?.title || 'The Aurelia Italian Calfskin Series';
  const promoSubtitle = promoBanner?.subtitle || 'Handcrafted in Florence using vegetable-tanned leathers and finished with solid emerald-accented brass hardware.';
  const promoImage = promoBanner?.image || promoBanner?.image_url || 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1600&q=80';
  const promoButtonText = promoBanner?.button_text || 'Discover Aurelia Series';
  const promoButtonLink = promoBanner?.button_link || '/product/aurelia-italian-calfskin-handbag';

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (newsletterEmail) {
      showToast('Thank you for subscribing to DEPORT Atelier updates!');
      setNewsletterEmail('');
    }
  };

  return (
    <div className="flex flex-col gap-16 md:gap-24 pb-16 bg-[#0B0F0D] text-[#F3F4F6]">
      {/* Hero Section */}
      <HeroSection />

      {/* Shop By Category Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-4 border-b border-[#10B981]/20">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#10B981] font-bold">
              CURATED COLLECTIONS
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-white font-normal mt-1">
              Shop By Category
            </h2>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#10B981] hover:text-white transition-colors mt-4 md:mt-0"
          >
            View All Categories <ArrowRight size={14} />
          </Link>
        </div>

        {isCategoriesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="aspect-4/3 bg-[#131915] border border-[#10B981]/20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.slice(0, 8).map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        )}
      </section>

      {/* Featured Products Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-4 border-b border-[#10B981]/20">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#10B981] font-bold">
              HANDPICKED LUXURY
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-white font-normal mt-1">
              Featured Products
            </h2>
          </div>
          <Link
            to="/shop?is_featured=true"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#10B981] hover:text-white transition-colors mt-4 md:mt-0"
          >
            Shop Full Catalog <ArrowRight size={14} />
          </Link>
        </div>

        {isFeaturedLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <ProductCardSkeleton key={n} />
            ))}
          </div>
        ) : (
          <ProductGrid products={featuredProducts} columns={4} />
        )}
      </section>

      {/* Promotional Banner Section */}
      <section className="relative overflow-hidden bg-[#070A08] text-[#F3F4F6] py-20 my-4 border-y border-[#10B981]/30">
        <div className="absolute inset-0 opacity-20">
          <img
            src={promoImage}
            alt={promoTitle}
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1600&q=80';
            }}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 text-center z-10">
          <span className="text-xs uppercase tracking-[0.3em] text-[#10B981] font-bold mb-4 block">
            {promoTagline}
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal text-white mb-6 leading-tight">
            {promoTitle}
          </h2>
          <p className="text-[#9CA3AF] text-base sm:text-lg max-w-2xl mx-auto font-light leading-relaxed mb-8">
            {promoSubtitle}
          </p>
          <div className="flex justify-center gap-4">
            <Link to={promoButtonLink}>
              <Button variant="primary" size="lg" icon={ArrowRight}>
                {promoButtonText}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* New Arrivals Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-4 border-b border-[#10B981]/20">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#10B981] font-bold">
              JUST LANDED
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-white font-normal mt-1">
              New Arrivals
            </h2>
          </div>
          <Link
            to="/shop?is_new=true"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#10B981] hover:text-white transition-colors mt-4 md:mt-0"
          >
            Explore New Releases <ArrowRight size={14} />
          </Link>
        </div>

        {isNewLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <ProductCardSkeleton key={n} />
            ))}
          </div>
        ) : (
          <ProductGrid products={newArrivals} columns={4} />
        )}
      </section>

      {/* Best Sellers Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-4 border-b border-[#10B981]/20">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#10B981] font-bold">
              MOST LOVED
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-white font-normal mt-1">
              Best Sellers
            </h2>
          </div>
          <Link
            to="/shop?is_best_seller=true"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#10B981] hover:text-white transition-colors mt-4 md:mt-0"
          >
            View All Best Sellers <ArrowRight size={14} />
          </Link>
        </div>

        {isBestSellerLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <ProductCardSkeleton key={n} />
            ))}
          </div>
        ) : (
          <ProductGrid products={bestSellers} columns={4} />
        )}
      </section>

      {/* Brand Story Section */}
      <section className="bg-[#131915] py-20 border-y border-[#10B981]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="aspect-4/3 overflow-hidden shadow-2xl bg-[#0B0F0D] border border-[#10B981]/30">
              <img
                src="https://images.unsplash.com/photo-1566150476483-623049099965?auto=format&fit=crop&w=1000&q=80"
                alt="DEPORT Craftsmanship Atelier"
                className="w-full h-full object-cover opacity-90"
              />
            </div>

            <div className="flex flex-col items-start pr-0 lg:pr-8">
              <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold mb-3">
                OUR HERITAGE
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl text-white font-normal mb-6">
                Crafted for Generations, Designed for Today
              </h2>
              <p className="text-[#9CA3AF] text-base leading-relaxed mb-6 font-light">
                At DEPORT, every bag begins with hand-selected full-grain hides from certified European tanneries. Our master artisans blend old-world leathercraft with minimalist modern engineering.
              </p>
              <p className="text-[#9CA3AF] text-base leading-relaxed mb-8 font-light">
                We believe true luxury is understated, enduring, and functional. Carrying your style is an expression of individuality and timeless taste.
              </p>
              
              <div className="grid grid-cols-2 gap-6 w-full pt-6 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <Award size={24} className="text-[#10B981]" />
                  <span className="text-xs uppercase font-semibold text-white tracking-wider">Master Artisan Crafted</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={24} className="text-[#10B981]" />
                  <span className="text-xs uppercase font-semibold text-white tracking-wider">Sustainable Leather Sourcing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center py-12">
        <div className="bg-[#131915] border border-[#10B981]/30 p-8 sm:p-12 shadow-2xl">
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold mb-2 block">
            DEPORT INSIDER
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-white mb-4">
            Stay Connected
          </h2>
          <p className="text-[#9CA3AF] text-sm max-w-md mx-auto mb-8 font-light leading-relaxed">
            Be the first to receive updates on new arrivals, secret seasonal sales, and private atelier workshops.
          </p>

          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              className="flex-1 bg-[#0B0F0D] text-white text-sm px-4 py-3 border border-[#10B981]/30 focus:border-[#10B981] focus:outline-none"
            />
            <Button type="submit" variant="primary">
              Subscribe
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
