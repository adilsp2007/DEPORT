import React, { useState, useRef, useEffect } from 'react';
import Button from './Button';
import {
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  X,
  Maximize2,
  Sliders,
  Image as ImageIcon
} from 'lucide-react';

export const ImageCropperModal = ({
  isOpen,
  imageFile,
  onClose,
  onCropComplete,
  title = 'Crop & Resize Product Image'
}) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspectRatio, setAspectRatio] = useState('4:5'); // '4:5', '1:1', 'original'
  const [targetWidth, setTargetWidth] = useState(800);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) {
      setImageSrc(null);
      return;
    }

    if (typeof imageFile === 'string') {
      setImageSrc(imageFile);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target.result);
      };
      reader.readAsDataURL(imageFile);
    }

    // Reset controls
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, [imageFile]);

  // Handle drag to pan
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Redraw canvas preview
  useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      renderCanvas(img);
    };
  }, [imageSrc, zoom, rotation, pan, aspectRatio]);

  const getAspectDimensions = (baseWidth = 360) => {
    if (aspectRatio === '4:5') {
      return { width: baseWidth, height: Math.round(baseWidth * 1.25) };
    }
    if (aspectRatio === '1:1') {
      return { width: baseWidth, height: baseWidth };
    }
    if (aspectRatio === '3:4') {
      return { width: baseWidth, height: Math.round(baseWidth * 1.333) };
    }
    // original / natural
    if (imageRef.current) {
      const ratio = imageRef.current.height / imageRef.current.width;
      return { width: baseWidth, height: Math.round(baseWidth * ratio) };
    }
    return { width: baseWidth, height: Math.round(baseWidth * 1.25) };
  };

  const renderCanvas = (img) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;

    const previewDim = getAspectDimensions(320);
    canvas.width = previewDim.width;
    canvas.height = previewDim.height;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Center transformations
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Calculate draw scale to fit nicely
    const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;

    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  };

  const handleApplyCropAndResize = () => {
    const img = imageRef.current;
    if (!img) return;

    // Create high-resolution output canvas
    const outputCanvas = document.createElement('canvas');
    let outputWidth = targetWidth;
    let outputHeight;

    if (aspectRatio === '4:5') {
      outputHeight = Math.round(outputWidth * 1.25);
    } else if (aspectRatio === '1:1') {
      outputHeight = outputWidth;
    } else if (aspectRatio === '3:4') {
      outputHeight = Math.round(outputWidth * 1.333);
    } else {
      const ratio = img.height / img.width;
      outputHeight = Math.round(outputWidth * ratio);
    }

    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;

    const ctx = outputCanvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outputWidth, outputHeight);

    ctx.save();
    const scaleMultiplier = outputWidth / (canvasRef.current?.width || 320);
    ctx.translate(
      outputWidth / 2 + pan.x * scaleMultiplier,
      outputHeight / 2 + pan.y * scaleMultiplier
    );
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * scaleMultiplier, zoom * scaleMultiplier);

    const fitScale = Math.max(
      (canvasRef.current?.width || 320) / img.width,
      (canvasRef.current?.height || 400) / img.height
    );
    const drawW = img.width * fitScale;
    const drawH = img.height * fitScale;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Export as high quality JPEG/WebP File
    outputCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const originalName = imageFile?.name ? imageFile.name.replace(/\.[^.]+$/, '') : 'product-image';
        const croppedFile = new File([blob], `${originalName}-cropped.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });

        const previewUrl = URL.createObjectURL(blob);
        onCropComplete(croppedFile, previewUrl);
        onClose();
      },
      'image/jpeg',
      0.92
    );
  };

  if (!isOpen) return null;

  const currentDim = getAspectDimensions(targetWidth);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
          <div className="flex items-center gap-2.5">
            <Crop className="text-[#10B981]" size={20} />
            <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Cropping Canvas Viewport */}
        <div className="flex flex-col items-center">
          <div
            className="relative border-2 border-dashed border-[#10B981]/60 bg-[#161D19] rounded overflow-hidden shadow-inner cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ touchAction: 'none' }}
          >
            <canvas ref={canvasRef} className="block pointer-events-none" />
            <div className="absolute inset-0 pointer-events-none border border-white/20 grid grid-cols-3 grid-rows-3 opacity-40">
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />
              <div className="border-r border-white/30" />
              <div className="border-r border-white/30" />
              <div />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 font-light">
            Click and drag to pan • Target export resolution: <strong className="text-[#10B981]">{currentDim.width} × {currentDim.height} px</strong>
          </p>
        </div>

        {/* Aspect Ratio & Resolution Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#161D19] border border-[#1E2922]">
          <div>
            <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-2">
              Aspect Ratio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '4:5 (Portrait)', val: '4:5' },
                { label: '1:1 (Square)', val: '1:1' },
                { label: '3:4 (Standard)', val: '3:4' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setAspectRatio(item.val)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded border cursor-pointer transition-all ${
                    aspectRatio === item.val
                      ? 'bg-[#10B981] text-black border-[#10B981]'
                      : 'bg-[#131915] text-gray-300 border-[#1E2922] hover:border-[#10B981]/50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-2">
              Max Resolution Resize
            </label>
            <select
              value={targetWidth}
              onChange={(e) => setTargetWidth(Number(e.target.value))}
              className="w-full bg-[#131915] text-[#F3F4F6] text-xs px-3 py-2 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer"
            >
              <option value={800}>800px Width (Optimized HD)</option>
              <option value={1000}>1000px Width (Luxury Ultra HD)</option>
              <option value={1200}>1200px Width (Max Detail)</option>
            </select>
          </div>
        </div>

        {/* Zoom & Rotation Sliders */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider w-16">
              Zoom:
            </span>
            <ZoomOut size={16} className="text-gray-400 cursor-pointer" onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))} />
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[#10B981] cursor-pointer"
            />
            <ZoomIn size={16} className="text-gray-400 cursor-pointer" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} />
            <span className="text-xs font-mono text-[#10B981] w-12 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-xs text-gray-300 font-semibold cursor-pointer"
            >
              <RotateCw size={14} />
              <span>Rotate 90° ({rotation}°)</span>
            </button>

            <button
              type="button"
              onClick={() => { setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); }}
              className="text-xs text-gray-400 hover:text-white underline cursor-pointer"
            >
              Reset Adjustments
            </button>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="pt-4 border-t border-[#1E2922] flex justify-end gap-3">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Check}
            onClick={handleApplyCropAndResize}
          >
            Apply Crop & Resize
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;
