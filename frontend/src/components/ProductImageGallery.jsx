import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2, X, ChevronLeft, ChevronRight } from 'lucide-react';

export const ProductImageGallery = ({ images = [], primaryImage = null, productName = 'DEPORT Product' }) => {
  // Normalize images array
  const formattedImages = images.map((imgItem) => {
    if (typeof imgItem === 'string') return imgItem;
    return imgItem.image || imgItem;
  });

  if (primaryImage && !formattedImages.includes(primaryImage)) {
    formattedImages.unshift(primaryImage);
  }

  const [selectedImage, setSelectedImage] = useState(formattedImages[0] || null);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  const imageContainerRef = useRef(null);

  useEffect(() => {
    if (formattedImages.length > 0) {
      setSelectedImage(formattedImages[0]);
    }
  }, [images, primaryImage]);

  const handleMouseMove = (e) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const handleNextLightbox = () => {
    const currentIndex = formattedImages.indexOf(selectedImage);
    const nextIndex = (currentIndex + 1) % formattedImages.length;
    setSelectedImage(formattedImages[nextIndex]);
    setLightboxZoom(1);
  };

  const handlePrevLightbox = () => {
    const currentIndex = formattedImages.indexOf(selectedImage);
    const prevIndex = (currentIndex - 1 + formattedImages.length) % formattedImages.length;
    setSelectedImage(formattedImages[prevIndex]);
    setLightboxZoom(1);
  };

  if (formattedImages.length === 0) {
    return (
      <div className="w-full aspect-4/5 bg-[#161D19] border border-[#1E2922] flex flex-col items-center justify-center text-center p-6">
        <span className="font-serif text-2xl tracking-widest text-[#10B981] font-bold">DEPORT</span>
        <span className="text-xs uppercase tracking-wider text-gray-400 mt-2">No Image Available</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image View with Zoom on Hover */}
      <div
        ref={imageContainerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setIsLightboxOpen(true)}
        className="relative aspect-4/5 w-full bg-[#161D19] border border-[#1E2922] overflow-hidden shadow-xs cursor-zoom-in group select-none"
      >
        <img
          src={selectedImage}
          alt={productName}
          style={{
            transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
            transform: isHovered ? 'scale(2.2)' : 'scale(1)',
          }}
          className="w-full h-full object-cover object-center transition-transform duration-200 pointer-events-none"
        />

        {/* Hover Hint & Fullscreen Icon */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(true);
            }}
            className="p-2 bg-black/60 hover:bg-[#10B981] text-white hover:text-black border border-white/20 transition-all rounded-xs backdrop-blur-xs cursor-pointer"
            title="Click for full-screen zoom"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 border border-white/10 text-[10px] uppercase font-bold tracking-wider text-gray-300 pointer-events-none backdrop-blur-xs">
          Hover to Inspect • Click to Enlarge
        </div>
      </div>

      {/* Thumbnails Row */}
      {formattedImages.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {formattedImages.map((imgUrl, index) => {
            const isSelected = selectedImage === imgUrl;
            return (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedImage(imgUrl)}
                className={`relative w-20 aspect-square flex-shrink-0 bg-[#161D19] border transition-all duration-200 overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'border-[#10B981] ring-2 ring-[#10B981]/40 shadow-sm'
                    : 'border-[#1E2922] hover:border-[#10B981]/50 opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`${productName} thumbnail ${index + 1}`}
                  className="w-full h-full object-cover object-center"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* High-Resolution Zoom Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          {/* Top Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
            <div>
              <p className="font-serif text-lg font-bold">{productName}</p>
              <p className="text-xs text-gray-400">
                Image {formattedImages.indexOf(selectedImage) + 1} of {formattedImages.length}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(1, z - 0.5))}
                className="p-2 bg-[#131915] border border-[#1E2922] hover:border-[#10B981] text-gray-200 hover:text-[#10B981] cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={18} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(3, z + 0.5))}
                className="p-2 bg-[#131915] border border-[#1E2922] hover:border-[#10B981] text-gray-200 hover:text-[#10B981] cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 bg-[#131915] border border-[#1E2922] hover:border-rose-500 text-gray-200 hover:text-rose-400 cursor-pointer ml-2"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Prev / Next Nav Buttons */}
          {formattedImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevLightbox}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-[#10B981] text-white hover:text-black border border-white/20 cursor-pointer transition-colors z-10"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={handleNextLightbox}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-[#10B981] text-white hover:text-black border border-white/20 cursor-pointer transition-colors z-10"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Enlarged Image Display */}
          <div className="max-w-4xl max-h-[80vh] overflow-auto flex items-center justify-center p-4">
            <img
              src={selectedImage}
              alt={productName}
              style={{ transform: `scale(${lightboxZoom})` }}
              className="max-h-[75vh] w-auto object-contain transition-transform duration-200 rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductImageGallery;
