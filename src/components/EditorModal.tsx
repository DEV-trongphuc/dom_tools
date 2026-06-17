import React, { useState, useRef, useEffect } from 'react';
import { X, Crop, Check, RefreshCw } from 'lucide-react';
import CustomSelect from './CustomSelect';
import { formatBytes, processImage } from '../utils/imageProcessor';
import type { ImageOptions } from '../utils/imageProcessor';

interface CropBox {
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  width: number; // percentage (0 - 100)
  height: number; // percentage (0 - 100)
}

interface EditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File;
  initialOptions: ImageOptions;
  onSave: (options: ImageOptions, compressedSize: number, compressedPreviewUrl: string) => void;
}

export default function EditorModal({ isOpen, onClose, file, initialOptions, onSave }: EditorModalProps) {
  const [options, setOptions] = useState<ImageOptions>({ ...initialOptions });
  const [cropBox, setCropBox] = useState<CropBox>({ x: 10, y: 10, width: 80, height: 80 });
  const [aspectRatio, setAspectRatio] = useState<string>('free'); // 'free', '1:1', '16:9', '4:3'
  const [naturalWidth, setNaturalWidth] = useState<number>(0);
  const [naturalHeight, setNaturalHeight] = useState<number>(0);
  const [previewSize, setPreviewSize] = useState<number>(file.size);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessingPreview, setIsProcessingPreview] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragInfo = useRef<{
    activeHandle: string | null;
    startX: number;
    startY: number;
    startCrop: CropBox;
  }>({ activeHandle: null, startX: 0, startY: 0, startCrop: { x: 0, y: 0, width: 0, height: 0 } });

  useEffect(() => {
    if (isOpen) {
      setOptions({ ...initialOptions });
      if (initialOptions.crop) {
        // Map pixel crop to percentages
        const img = new Image();
        img.onload = () => {
          setNaturalWidth(img.naturalWidth);
          setNaturalHeight(img.naturalHeight);
          const c = initialOptions.crop!;
          setCropBox({
            x: (c.x / img.naturalWidth) * 100,
            y: (c.y / img.naturalHeight) * 100,
            width: (c.width / img.naturalWidth) * 100,
            height: (c.height / img.naturalHeight) * 100,
          });
        };
        img.src = URL.createObjectURL(file);
      } else {
        setCropBox({ x: 0, y: 0, width: 100, height: 100 });
      }
    }
  }, [isOpen, file, initialOptions]);

  // Compute live preview size and preview URL whenever options or crop changes
  useEffect(() => {
    let active = true;
    if (!isOpen) return;

    const generateLivePreview = async () => {
      setIsProcessingPreview(true);
      try {
        // Convert crop percentages back to pixels
        const cropPixels = {
          x: Math.round((cropBox.x / 100) * naturalWidth),
          y: Math.round((cropBox.y / 100) * naturalHeight),
          width: Math.round((cropBox.width / 100) * naturalWidth),
          height: Math.round((cropBox.height / 100) * naturalHeight),
        };

        const hasCrop = cropBox.width < 100 || cropBox.height < 100 || cropBox.x > 0 || cropBox.y > 0;

        const processOpts: ImageOptions = {
          ...options,
          crop: hasCrop ? cropPixels : null,
        };

        const result = await processImage(file, processOpts);
        if (active) {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewSize(result.blob.size);
          setPreviewUrl(URL.createObjectURL(result.blob));
        }
      } catch (err) {
        console.error('Failed to generate preview', err);
      } finally {
        if (active) setIsProcessingPreview(false);
      }
    };

    if (naturalWidth > 0 && naturalHeight > 0) {
      const timer = setTimeout(() => {
        generateLivePreview();
      }, 200); // Debounce to keep performance smooth
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [options, cropBox, naturalWidth, naturalHeight, file, isOpen]);

  // Clean up preview url on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalWidth(img.naturalWidth);
    setNaturalHeight(img.naturalHeight);
    
    // Set custom initial values for input fields based on natural size if empty
    if (options.resizeMode === 'custom' && (!options.width || !options.height)) {
      setOptions(prev => ({
        ...prev,
        width: img.naturalWidth,
        height: img.naturalHeight
      }));
    }
  };

  // Drag and Resize handlers for Crop window
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragInfo.current = {
      activeHandle: handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...cropBox },
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragInfo.current.activeHandle || !imgRef.current) return;
    const { activeHandle, startX, startY, startCrop } = dragInfo.current;
    
    const rect = imgRef.current.getBoundingClientRect();
    
    // Calculate deltas in percentage
    const deltaX = ((e.clientX - startX) / rect.width) * 100;
    const deltaY = ((e.clientY - startY) / rect.height) * 100;

    let newCrop = { ...startCrop };

    if (activeHandle === 'move') {
      newCrop.x = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + deltaX));
      newCrop.y = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + deltaY));
    } else {
      // Handle corner resizing
      if (activeHandle.includes('e')) { // East
        newCrop.width = Math.max(5, Math.min(100 - startCrop.x, startCrop.width + deltaX));
      }
      if (activeHandle.includes('w')) { // West
        const potentialX = startCrop.x + deltaX;
        if (potentialX >= 0 && startCrop.width - deltaX >= 5) {
          newCrop.x = potentialX;
          newCrop.width = startCrop.width - deltaX;
        }
      }
      if (activeHandle.includes('s')) { // South
        newCrop.height = Math.max(5, Math.min(100 - startCrop.y, startCrop.height + deltaY));
      }
      if (activeHandle.includes('n')) { // North
        const potentialY = startCrop.y + deltaY;
        if (potentialY >= 0 && startCrop.height - deltaY >= 5) {
          newCrop.y = potentialY;
          newCrop.height = startCrop.height - deltaY;
        }
      }

      // Constrain aspect ratio if active
      if (aspectRatio !== 'free') {
        const ratioValues = aspectRatio.split(':').map(Number);
        const targetRatio = (ratioValues[0] / ratioValues[1]) * (naturalHeight / naturalWidth); // adjust for image natural aspect ratio display in client

        // When locking, adjust height based on width
        if (activeHandle.includes('e') || activeHandle.includes('w')) {
          newCrop.height = newCrop.width / targetRatio;
          // Clamp to image bounds
          if (newCrop.y + newCrop.height > 100) {
            newCrop.height = 100 - newCrop.y;
            newCrop.width = newCrop.height * targetRatio;
          }
        } else {
          newCrop.width = newCrop.height * targetRatio;
          if (newCrop.x + newCrop.width > 100) {
            newCrop.width = 100 - newCrop.x;
            newCrop.height = newCrop.width / targetRatio;
          }
        }
      }
    }

    setCropBox(newCrop);
  };

  const handleMouseUp = () => {
    dragInfo.current.activeHandle = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Change Aspect Ratio
  const handleAspectRatioChange = (ratio: string) => {
    setAspectRatio(ratio);
    if (ratio === 'free') return;

    const ratioValues = ratio.split(':').map(Number);
    const targetRatio = ratioValues[0] / ratioValues[1]; // target (w / h)

    const imgRatio = naturalWidth / naturalHeight;

    let targetCropW = 80;
    let targetCropH = 80;

    if (targetRatio > imgRatio) {
      // Wider aspect ratio: constrain by width
      targetCropW = 90;
      targetCropH = (targetCropW / targetRatio) * imgRatio;
    } else {
      // Taller aspect ratio: constrain by height
      targetCropH = 90;
      targetCropW = (targetCropH * targetRatio) / imgRatio;
    }

    setCropBox({
      x: (100 - targetCropW) / 2,
      y: (100 - targetCropH) / 2,
      width: targetCropW,
      height: targetCropH,
    });
  };

  const resetCrop = () => {
    setAspectRatio('free');
    setCropBox({ x: 0, y: 0, width: 100, height: 100 });
  };

  // Save changes
  const handleSave = () => {
    const cropPixels = {
      x: Math.round((cropBox.x / 100) * naturalWidth),
      y: Math.round((cropBox.y / 100) * naturalHeight),
      width: Math.round((cropBox.width / 100) * naturalWidth),
      height: Math.round((cropBox.height / 100) * naturalHeight),
    };

    const hasCrop = cropBox.width < 100 || cropBox.height < 100 || cropBox.x > 0 || cropBox.y > 0;

    const finalOptions = {
      ...options,
      crop: hasCrop ? cropPixels : null,
    };
    onSave(finalOptions, previewSize, previewUrl);
  };

  const displayedCropW = Math.round((cropBox.width / 100) * naturalWidth);
  const displayedCropH = Math.round((cropBox.height / 100) * naturalHeight);

  return (
    <div className="modal-overlay">
      <div className="modal-content glass">
        <div className="modal-header">
          <div className="modal-title">
            <Crop className="logo-icon" size={20} style={{ width: '32px', height: '32px' }} />
            <h3>Tùy Chỉnh Ảnh & Cắt</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Main Visual Editor Workspace */}
          <div className="crop-workspace" ref={containerRef}>
            <div className="crop-canvas-wrapper">
              <img
                ref={imgRef}
                src={URL.createObjectURL(file)}
                alt="Original"
                className="crop-image-underlay"
                onLoad={handleImageLoad}
              />
              {/* Crop selection overlay box */}
              <div
                className="crop-selection-box"
                style={{
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.width}%`,
                  height: `${cropBox.height}%`,
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
              >
                {/* Crop Handles */}
                <div className="crop-handle handle-nw" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
                <div className="crop-handle handle-ne" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
                <div className="crop-handle handle-sw" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
                <div className="crop-handle handle-se" onMouseDown={(e) => handleMouseDown(e, 'se')} />
              </div>
            </div>
          </div>

          {/* Right Editing Parameters Sidebar */}
          <div className="modal-sidebar">
            <div className="settings-group">
              <span className="settings-label">Tỷ Lệ Cắt</span>
              <div className="size-presets-grid">
                <button
                  className={`btn-preset ${aspectRatio === 'free' ? 'active' : ''}`}
                  onClick={() => handleAspectRatioChange('free')}
                >
                  Tự do
                </button>
                <button
                  className={`btn-preset ${aspectRatio === '1:1' ? 'active' : ''}`}
                  onClick={() => handleAspectRatioChange('1:1')}
                >
                  1:1 Vuông
                </button>
                <button
                  className={`btn-preset ${aspectRatio === '16:9' ? 'active' : ''}`}
                  onClick={() => handleAspectRatioChange('16:9')}
                >
                  16:9 HD
                </button>
                <button
                  className={`btn-preset ${aspectRatio === '4:3' ? 'active' : ''}`}
                  onClick={() => handleAspectRatioChange('4:3')}
                >
                  4:3 Cũ
                </button>
                <button className="btn-preset" style={{ gridColumn: 'span 2' }} onClick={resetCrop}>
                  Reset Vùng Chọn
                </button>
              </div>
            </div>

            <div className="settings-group">
              <span className="settings-label">Kích thước vùng cắt</span>
              <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <div>Rộng: <span style={{ color: 'white', fontFamily: 'monospace' }}>{displayedCropW}px</span></div>
                <div>•</div>
                <div>Cao: <span style={{ color: 'white', fontFamily: 'monospace' }}>{displayedCropH}px</span></div>
              </div>
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

            {/* Resize Option */}
            <div className="settings-group">
              <span className="settings-label">Chế Độ Resize</span>
              <CustomSelect
                options={[
                  { value: 'original', label: 'Kích Thước Gốc' },
                  { value: 'percentage', label: 'Giảm theo Tỷ lệ (%)' },
                  { value: 'custom', label: 'Kích thước Custom (px)' }
                ]}
                value={options.resizeMode}
                onChange={(val) => setOptions({ ...options, resizeMode: val as any })}
              />
            </div>

            {options.resizeMode === 'percentage' && (
              <div className="settings-group">
                <span className="settings-label">
                  Tỷ lệ phần trăm 
                  <span className="settings-value">{options.percentage || 100}%</span>
                </span>
                <input
                  type="range"
                  min="5"
                  max="100"
                  className="range-slider"
                  value={options.percentage || 100}
                  onChange={(e) => setOptions({ ...options, percentage: parseInt(e.target.value) })}
                />
              </div>
            )}

            {options.resizeMode === 'custom' && (
              <div className="settings-group">
                <span className="settings-label">Kích thước xuất ra</span>
                <div className="dimensions-row">
                  <div className="dim-input-wrapper">
                    <input
                      type="number"
                      className="dim-input"
                      value={options.width || ''}
                      onChange={(e) => setOptions({ ...options, width: parseInt(e.target.value) })}
                    />
                    <span className="dim-unit">W</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>x</span>
                  <div className="dim-input-wrapper">
                    <input
                      type="number"
                      className="dim-input"
                      value={options.height || ''}
                      onChange={(e) => setOptions({ ...options, height: parseInt(e.target.value) })}
                    />
                    <span className="dim-unit">H</span>
                  </div>
                </div>
              </div>
            )}

            <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

            {/* Target format */}
            <div className="settings-group">
              <span className="settings-label">Định dạng đích</span>
              <CustomSelect
                options={[
                  { value: 'image/webp', label: 'WEBP (Tối ưu nhất)' },
                  { value: 'image/png', label: 'PNG (Không nén/Trong suốt)' },
                  { value: 'image/jpeg', label: 'JPEG (Phổ biến)' }
                ]}
                value={options.format}
                onChange={(val) => setOptions({ ...options, format: val })}
              />
            </div>

            {/* Quality (only for compression formats) */}
            {options.format !== 'image/png' && (
              <div className="settings-group">
                <span className="settings-label">
                  Chất lượng nén
                  <span className="settings-value">{Math.round(options.quality * 100)}%</span>
                </span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  className="range-slider"
                  value={options.quality * 100}
                  onChange={(e) => setOptions({ ...options, quality: parseInt(e.target.value) / 100 })}
                />
              </div>
            )}

            {/* Real-time size statistics */}
            <div className="settings-group" style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Dung lượng gốc:</span>
                <span style={{ fontFamily: 'monospace' }}>{formatBytes(file.size)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Sau khi nén:</span>
                {isProcessingPreview ? (
                  <span style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <RefreshCw size={12} className="spin" /> Đang tính...
                  </span>
                ) : (
                  <span style={{ fontFamily: 'monospace', color: previewSize < file.size ? 'var(--success)' : 'white', fontWeight: 'bold' }}>
                    {formatBytes(previewSize)}
                    {previewSize < file.size && ` (-${Math.round(((file.size - previewSize) / file.size) * 100)}%)`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={isProcessingPreview}>
            <Check size={16} /> Lưu & Áp Dụng
          </button>
        </div>
      </div>
    </div>
  );
}
