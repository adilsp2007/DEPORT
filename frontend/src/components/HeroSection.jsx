import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import Button from './Button';
import { useBanners } from '../hooks/useProducts';

export const HeroSection = () => {
  const { data: bannersData } = useBanners('hero');
  const banners = bannersData?.results || (Array.isArray(bannersData) ? bannersData : []);
  const banner = banners.length > 0 ? banners[0] : null;

  const title = banner?.title || 'Carry Your Style';
  const subtitle = banner?.subtitle || 'Discover timeless leather bags and modern luxury carryalls meticulously engineered for your everyday elegance.';
  const tagline = banner?.tagline || 'NEW COLLECTION 2026';
  const bannerImage = banner?.image || banner?.image_url || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80';
  const buttonText = banner?.button_text || 'Shop Collection';
  const buttonLink = banner?.button_link || '/shop';
  const secondaryButtonText = banner?.secondary_button_text || 'Explore Handbags';
  const secondaryButtonLink = banner?.secondary_button_link || '/shop?category=handbags';

  return (
    <section className="relative overflow-hidden bg-[#0B0F0D] border-b border-[#10B981]/20 py-12 md:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Text Content */}
          <div className="lg:col-span-6 flex flex-col items-start z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#10B981]/15 text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-6 border border-[#10B981]/30">
              <Sparkles size={13} />
              <span>{tagline}</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.1] text-white font-normal mb-6 tracking-tight">
              {title.includes('Style') ? (
                <>
                  {title.split('Style')[0]}
                  <span className="italic font-normal text-[#10B981]">Style</span>
                  {title.split('Style')[1]}
                </>
              ) : (
                title
              )}
            </h1>

            <p className="text-[#9CA3AF] text-base sm:text-lg max-w-lg mb-8 font-light leading-relaxed">
              {subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
              <Link to={buttonLink}>
                <Button variant="primary" size="lg" icon={ArrowRight}>
                  {buttonText}
                </Button>
              </Link>
              {secondaryButtonText && secondaryButtonLink && (
                <Link to={secondaryButtonLink}>
                  <Button variant="outline" size="lg">
                    {secondaryButtonText}
                  </Button>
                </Link>
              )}
            </div>

            {/* Quick stats or features banner */}
            <div className="grid grid-cols-3 gap-6 pt-10 mt-10 border-t border-[#10B981]/20 w-full">
              <div>
                <span className="font-serif text-2xl font-semibold text-white">100%</span>
                <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mt-1">Italian Leather</p>
              </div>
              <div>
                <span className="font-serif text-2xl font-semibold text-white">Lifetime</span>
                <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mt-1">Guarantee</p>
              </div>
              <div>
                <span className="font-serif text-2xl font-semibold text-white">Free</span>
                <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mt-1">Global Shipping</p>
              </div>
            </div>
          </div>

          {/* Large Premium Bag Image Visual */}
          <div className="lg:col-span-6 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Decorative accent frame */}
              <div className="absolute -top-4 -left-4 w-full h-full border-2 border-[#10B981]/40 z-0 hidden sm:block" />
              
              <div className="relative z-10 aspect-4/5 overflow-hidden shadow-2xl bg-[#131915] border border-[#10B981]/30">
                <img
                  src={bannerImage}
                  alt={title}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80';
                  }}
                  className="w-full h-full object-cover object-center transition-transform duration-1000 hover:scale-105 opacity-90"
                />
              </div>

              {/* Floating feature card */}
              <div className="absolute -bottom-6 -left-6 z-20 bg-[#131915]/95 backdrop-blur-md p-4 shadow-2xl border border-[#10B981]/30 max-w-xs hidden sm:block">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#0B0F0D] flex items-center justify-center text-[#10B981] border border-[#10B981]/30">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="font-serif text-sm font-semibold text-white">The Aurelia Handbag</h4>
                    <p className="text-xs text-[#9CA3AF]">Vegetable-tanned calfskin</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
