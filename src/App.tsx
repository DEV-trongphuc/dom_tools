import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  Settings, 
  Lock, 
  Unlock, 
  Info,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Image as ImageIcon,
  FileText as FileTextIcon,
  Code as CodeIcon,
  LayoutGrid as LayoutGridIcon,
  Sun,
  Moon
} from 'lucide-react';

import ImageConverter from './components/ImageConverter';
import type { QueueItem } from './components/ImageConverter';
import EditorModal from './components/EditorModal';
import CustomSelect from './components/CustomSelect';
import PdfTools from './components/PdfTools';
// import DevTools from './components/DevTools';
import { processImage, fetchImageFromUrl } from './utils/imageProcessor';
import type { ImageOptions } from './utils/imageProcessor';

// Domation SVG Logo matching robot aesthetic
const DomationLogo = () => (
  <img 
    src="https://crm-domation.vercel.app/LOGO.jpg" 
    alt="DOMATION Logo" 
    style={{ 
      width: '34px', 
      height: '34px', 
      borderRadius: '50%', 
      objectFit: 'cover', 
      border: '1.5px solid var(--primary-glow)',
      boxShadow: '0 0 10px rgba(139, 92, 246, 0.4)'
    }} 
  />
);

interface ToolSlide {
  id: 'image' | 'pdf' | 'dev';
  name: string;
  tagline: string;
  desc: string;
  features: string[];
  icon: string;
  gradient: string;
  glow: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'library' | 'image' | 'pdf' | 'dev'>('library');

  // --- THEME TOGGLE STATE ---
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- RENAME HANDLER ---
  const handleRenameItem = (id: string, newName: string) => {
    if (!newName.trim()) return;
    setQueue(prev => prev.map(item => {
      if (item.id === id) {
        const originalExt = item.name.split('.').pop() || '';
        let finalName = newName;
        if (originalExt && !newName.toLowerCase().endsWith('.' + originalExt.toLowerCase())) {
          finalName = `${newName}.${originalExt}`;
        }
        return { ...item, name: finalName };
      }
      return item;
    }));
    showToast('Đổi tên tệp thành công!', 'success');
  };

  // --- CAROUSEL SLIDER STATE ---
  const [carouselIndex, setCarouselIndex] = useState(0);
  const toolSlides: ToolSlide[] = [
    {
      id: 'image',
      name: 'ImgFlex Desktop',
      tagline: 'Tối Ưu & Convert Ảnh',
      desc: 'Nén dung lượng, thay đổi kích thước và chuyển đổi định dạng ảnh hàng loạt sang WebP, JPG, PNG siêu tốc.',
      features: [
        'Nén dung lượng ảnh hàng loạt siêu tốc',
        'Thay đổi kích thước (Resize) thông minh',
        'Chuyển đổi định dạng WebP, JPG, PNG',
        'Cắt ảnh (Crop) & xoay ảnh trực quan'
      ],
      icon: 'image',
      gradient: 'linear-gradient(135deg, #a78bfa, #3b82f6)',
      glow: 'rgba(139, 92, 246, 0.3)'
    },
    {
      id: 'pdf',
      name: 'PDF Toolbox',
      tagline: 'Xử lý file tài liệu PDF',
      desc: 'Gộp nhiều tệp PDF làm một, trích xuất tách dải trang tùy chọn hoặc nén giảm dung lượng stream tài liệu cực nhanh.',
      features: [
        'Gộp nhiều file PDF thành một tệp duy nhất',
        'Trích xuất & tách dải trang tùy chỉnh',
        'Nén giảm dung lượng tệp PDF cực nhanh',
        'Chuyển đổi PDF ⇄ Word local bảo mật'
      ],
      icon: 'pdf',
      gradient: 'linear-gradient(135deg, #f43f5e, #ec4899)',
      glow: 'rgba(244, 63, 94, 0.3)'
    }
  ];

  const handleNextSlide = () => {
    setCarouselIndex((prev) => (prev === toolSlides.length - 1 ? 0 : prev + 1));
  };

  const handlePrevSlide = () => {
    setCarouselIndex((prev) => (prev === 0 ? toolSlides.length - 1 : prev - 1));
  };

  // --- IMAGE OPTIMIZER STATES ---
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalOptions, setGlobalOptions] = useState<ImageOptions>({
    format: 'image/webp',
    quality: 0.8,
    resizeMode: 'original',
    percentage: 100,
    width: 800,
    height: 600,
    crop: null
  });
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [aspectRatioValue, setAspectRatioValue] = useState<number>(4 / 3);

  const [isConvertingAll, setIsConvertingAll] = useState<boolean>(false);
  const [activeEditingId, setActiveEditingId] = useState<string | null>(null);
  
  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Auto-hide toast notifications
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // Helper to read file dimensions and append to queue
  const addFilesToQueue = (files: FileList | File[]) => {
    const newItems: Promise<QueueItem>[] = Array.from(files).map((file) => {
      return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({
            id: Math.random().toString(36).substring(2, 9),
            file,
            name: file.name,
            originalSize: file.size,
            originalWidth: img.naturalWidth,
            originalHeight: img.naturalHeight,
            status: 'pending',
            options: {
              ...globalOptions,
              width: globalOptions.resizeMode === 'custom' ? globalOptions.width : img.naturalWidth,
              height: globalOptions.resizeMode === 'custom' ? globalOptions.height : img.naturalHeight
            }
          });
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({
            id: Math.random().toString(36).substring(2, 9),
            file,
            name: file.name,
            originalSize: file.size,
            originalWidth: 0,
            originalHeight: 0,
            status: 'error',
            errorMsg: 'Không thể đọc thông tin ảnh. File có thể bị lỗi.',
            options: { ...globalOptions }
          });
        };
        
        img.src = objectUrl;
      });
    });

    Promise.all(newItems).then((resolvedItems) => {
      setQueue((prev) => [...prev, ...resolvedItems]);
      showToast(`Đã thêm ${resolvedItems.length} ảnh vào hàng đợi.`);
    });
  };

  // Helper to download remote URL and append to queue
  const addUrlToQueue = async (url: string) => {
    try {
      const blob = await fetchImageFromUrl(url);
      
      let filename = 'downloaded-image.png';
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
        if (lastSegment && lastSegment.includes('.')) {
          filename = lastSegment;
        }
      } catch (e) {
        // Ignore parsing errors
      }

      const file = new File([blob], filename, { type: blob.type });
      addFilesToQueue([file]);
    } catch (error: any) {
      throw new Error(error.message || 'Lỗi kết nối hoặc CORS chặn tải hình ảnh.');
    }
  };

  // Remove a single item from the queue
  const handleRemoveItem = (id: string) => {
    setQueue((prev) => {
      const item = prev.find(i => i.id === id);
      if (item && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  // Clear all items in queue
  const handleClearQueue = () => {
    queue.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setQueue([]);
    showToast('Đã xóa sạch hàng đợi.', 'info');
  };

  // Apply current global options to all PENDING items in the queue
  const applyGlobalSettingsToPending = () => {
    setQueue(prev => prev.map(item => {
      if (item.status === 'pending') {
        return {
          ...item,
          options: {
            ...globalOptions,
            width: globalOptions.resizeMode === 'custom' ? globalOptions.width : item.originalWidth,
            height: globalOptions.resizeMode === 'custom' ? globalOptions.height : item.originalHeight
          }
        };
      }
      return item;
    }));
    showToast('Đã áp dụng cài đặt chung cho các ảnh chờ xử lý.', 'info');
  };

  // Convert a single queue item
  const convertSingleItem = async (id: string, customOptions?: ImageOptions): Promise<QueueItem> => {
    let currentItem = queue.find(i => i.id === id);
    if (!currentItem) throw new Error('Không tìm thấy ảnh.');

    const activeOptions = customOptions || currentItem.options;

    setQueue(prev => prev.map(item => item.id === id ? { ...item, status: 'processing' } : item));

    try {
      const result = await processImage(currentItem.file, activeOptions);
      const previewUrl = URL.createObjectURL(result.blob);

      const updatedItem: QueueItem = {
        ...currentItem,
        status: 'done',
        options: activeOptions,
        convertedBlob: result.blob,
        convertedSize: result.blob.size,
        convertedWidth: result.width,
        convertedHeight: result.height,
        previewUrl
      };

      setQueue(prev => prev.map(item => item.id === id ? updatedItem : item));
      return updatedItem;
    } catch (err: any) {
      const errorMsg = err.message || 'Lỗi trong quá trình render canvas.';
      setQueue(prev => prev.map(item => item.id === id ? { ...item, status: 'error', errorMsg } : item));
      throw new Error(errorMsg);
    }
  };

  // Convert a single item via user trigger and show toast
  const handleConvertSingle = async (id: string) => {
    const item = queue.find(i => i.id === id);
    if (!item) return;
    try {
      await convertSingleItem(id);
      showToast(`Đã chuyển đổi thành công ảnh: ${item.name}`, 'success');
    } catch (err: any) {
      showToast(`Không thể chuyển đổi: ${err.message || 'Lỗi canvas'}`, 'error');
    }
  };

  // Convert all pending files in the queue sequentially
  const handleConvertAll = async () => {
    const pending = queue.filter(item => item.status === 'pending');
    if (pending.length === 0) return;

    setIsConvertingAll(true);
    let successCount = 0;
    
    for (const item of pending) {
      try {
        await convertSingleItem(item.id);
        successCount++;
      } catch (err) {
        console.error(`Failed to convert: ${item.name}`, err);
      }
    }
    
    setIsConvertingAll(false);
    showToast(`Đã chuyển đổi thành công ${successCount}/${pending.length} ảnh!`, 'success');
  };

  // Download a single converted image file
  const handleDownloadItem = (id: string) => {
    const item = queue.find(i => i.id === id);
    if (!item || !item.convertedBlob || !item.previewUrl) return;

    let extension = item.options.format.split('/')[1];
    if (extension === 'jpeg') extension = 'jpg';
    const lastDot = item.name.lastIndexOf('.');
    const originalBase = lastDot !== -1 ? item.name.substring(0, lastDot) : item.name;
    const finalFilename = `${originalBase}.${extension}`;

    const link = document.createElement('a');
    link.href = item.previewUrl;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Package all successfully converted images as a ZIP file
  const handleDownloadAllZip = async () => {
    const finishedItems = queue.filter(item => item.status === 'done' && item.convertedBlob);
    if (finishedItems.length === 0) return;

    showToast('Đang chuẩn bị nén tệp ZIP...', 'info');

    const zip = new JSZip();
    const usedNames = new Set<string>();
    
    finishedItems.forEach((item) => {
      let extension = item.options.format.split('/')[1];
      if (extension === 'jpeg') extension = 'jpg';
      const lastDot = item.name.lastIndexOf('.');
      const originalBase = lastDot !== -1 ? item.name.substring(0, lastDot) : item.name;
      
      const baseFilename = `${originalBase}.${extension}`;
      let finalFilename = baseFilename;
      let counter = 1;
      
      while (usedNames.has(finalFilename)) {
        finalFilename = `${originalBase} (${counter}).${extension}`;
        counter++;
      }
      usedNames.add(finalFilename);
      
      zip.file(finalFilename, item.convertedBlob!);
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(content);
      
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `ImgFlex_Converted_Images.zip`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(zipUrl);
      showToast('Tải tệp ZIP thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Không thể tạo tệp ZIP.', 'error');
    }
  };

  // Single item custom modal save handler
  const handleModalSave = (updatedOptions: ImageOptions, compressedSize: number, compressedPreviewUrl: string) => {
    if (!activeEditingId) return;

    setQueue(prev => prev.map(item => {
      if (item.id === activeEditingId) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        
        return {
          ...item,
          status: 'done',
          options: updatedOptions,
          convertedSize: compressedSize,
          previewUrl: compressedPreviewUrl,
          convertedWidth: updatedOptions.resizeMode === 'custom' ? updatedOptions.width : item.originalWidth,
          convertedHeight: updatedOptions.resizeMode === 'custom' ? updatedOptions.height : item.originalHeight,
        };
      }
      return item;
    }));

    setActiveEditingId(null);
    showToast('Đã lưu các tùy chỉnh chỉnh sửa.');
  };

  // Custom dimension synchronization logic for global input panels
  const handleGlobalWidthChange = (val: number) => {
    setGlobalOptions(prev => {
      const newOpts = { ...prev, width: val };
      if (lockAspect && prev.width) {
        newOpts.height = Math.round(val / aspectRatioValue);
      }
      return newOpts;
    });
  };

  const handleGlobalHeightChange = (val: number) => {
    setGlobalOptions(prev => {
      const newOpts = { ...prev, height: val };
      if (lockAspect && prev.height) {
        newOpts.width = Math.round(val * aspectRatioValue);
      }
      return newOpts;
    });
  };

  // Handle locking/unlocking aspect ratio logic
  const toggleLockAspect = () => {
    setLockAspect(prev => {
      const next = !prev;
      if (next && globalOptions.width && globalOptions.height) {
        setAspectRatioValue(globalOptions.width / globalOptions.height);
      }
      return next;
    });
  };

  // Active editing item configuration
  const activeEditingItem = queue.find(i => i.id === activeEditingId);

  return (
    <div className="app-wrapper">
      {/* Toast notifications */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'success' && <CheckCircle size={18} style={{ color: 'var(--success)' }} />}
          {toast.type === 'info' && <Info size={18} style={{ color: 'var(--secondary)' }} />}
          {toast.type === 'error' && <AlertTriangle size={18} style={{ color: 'var(--error)' }} />}
          <span style={{ fontSize: '0.875rem' }}>{toast.message}</span>
        </div>
      )}

      {/* 1. SIDEBAR PANEL */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <DomationLogo />
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">DOMATION</span>
            <span className="sidebar-logo-sub">/ TOOLS</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <LayoutGridIcon size={18} />
            <span>Kho Công Cụ</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'image' ? 'active' : ''}`}
            onClick={() => setActiveTab('image')}
          >
            <ImageIcon size={18} />
            <span>Tối Ưu Ảnh</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'pdf' ? 'active' : ''}`}
            onClick={() => setActiveTab('pdf')}
          >
            <FileTextIcon size={18} />
            <span>Xử Lý PDF</span>
          </div>
        </nav>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            className="theme-toggle-btn" 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            style={{ display: 'none' }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Giao diện Sáng' : 'Giao diện Tối'}</span>
          </button>
          <span>DOMATION Suite v1.1.0</span>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <main className="main-content">
        
        {/* TAB A: SLIDE CARD CAROUSEL LIBRARY */}
        {activeTab === 'library' && (
          <div className="carousel-wrapper animate-fade-in-up">
            <div className="home-header" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              textAlign: 'center', 
              marginBottom: '1.5rem',
              gap: '0.5rem'
            }}>
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                background: 'rgba(139, 92, 246, 0.15)', 
                padding: '0.35rem 0.85rem', 
                borderRadius: '50px', 
                border: '1px solid var(--primary-glow)', 
                color: '#c084fc', 
                fontSize: '0.75rem', 
                fontWeight: '600', 
                marginBottom: '0.5rem', 
                letterSpacing: '0.05em' 
              }}>
                <Sparkles size={12} /> HỆ THỐNG TIỆN ÍCH MIỄN PHÍ
              </div>
              <h2 style={{ 
                fontSize: '2.5rem', 
                fontWeight: '800', 
                background: 'linear-gradient(135deg, #e9d5ff 10%, #a78bfa 60%, #8b5cf6 100%)', 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent',
                display: 'block',
                margin: '0 auto'
              }}>DOMATION Tools</h2>
              <p style={{ marginTop: '0.5rem', fontSize: '1rem', maxWidth: '600px', margin: '0.5rem auto 0' }}>
                Trải nghiệm kho công cụ chuyển đổi tập tin trực tuyến, xử lý PDF bảo mật và các tiện ích hỗ trợ lập trình viên 100% tại Client-side.
              </p>
            </div>

            {/* Slider track viewport */}
            <div className="carousel-viewport">
              <div 
                className="carousel-track"
                style={{ 
                  transform: `translateX(calc(-${carouselIndex * (100 / toolSlides.length)}%))` 
                }}
              >
                {toolSlides.map((slide, idx) => {
                  const isFocused = idx === carouselIndex;
                  return (
                    <div 
                      key={slide.id} 
                      className={`carousel-card glass ${isFocused ? 'focused' : ''}`}
                      onClick={() => setActiveTab(slide.id)}
                      style={{
                        '--card-glow': slide.glow,
                        '--card-gradient': slide.gradient,
                        '--card-accent': slide.id === 'image' ? '#a78bfa' : '#f43f5e'
                      } as React.CSSProperties}
                    >
                      <div className="carousel-card-icon">
                        {slide.icon === 'image' && <ImageIcon size={30} />}
                        {slide.icon === 'pdf' && <FileTextIcon size={30} />}
                        {slide.icon === 'dev' && <CodeIcon size={30} />}
                      </div>
                      <div>
                        <div className="carousel-card-tagline">
                          {slide.tagline}
                        </div>
                        <h3 className="carousel-card-title">{slide.name}</h3>
                      </div>
                      <p className="carousel-card-desc">{slide.desc}</p>
                      
                      <ul className="carousel-card-features">
                        {slide.features.map((feature, fIdx) => (
                          <li key={fIdx} className="feature-item">
                            <CheckCircle size={14} className="feature-check-icon" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <button 
                        className="btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab(slide.id);
                        }}
                        style={{ 
                          width: '100%', 
                          justifyContent: 'center', 
                          background: slide.gradient, 
                          boxShadow: `0 4px 15px ${slide.glow}`,
                          padding: '0.75rem' 
                        }}
                      >
                        <span>Khám phá ngay</span>
                        <span className="arrow-icon">→</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controls left / right / dots */}
            <div className="carousel-controls">
              <button className="btn-secondary" onClick={handlePrevSlide} style={{ borderRadius: '50%', padding: '0.6rem' }}>
                <ArrowLeft size={16} />
              </button>
              <div className="carousel-indicator">
                {toolSlides.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`indicator-dot ${idx === carouselIndex ? 'active' : ''}`}
                    onClick={() => setCarouselIndex(idx)}
                  />
                ))}
              </div>
              <button className="btn-secondary" onClick={handleNextSlide} style={{ borderRadius: '50%', padding: '0.6rem' }}>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* TAB B: IMGFLEX WORKSPACE */}
        {activeTab === 'image' && (
          <div className="animate-fade-in-up">
            <div className="content-header">
              <div>
                <h2>ImgFlex Desktop</h2>
                <p>Nén dung lượng, resize kích thước và convert định dạng ảnh</p>
              </div>
              <button className="btn-secondary" onClick={() => setActiveTab('library')}>
                <ArrowLeft size={16} /> Quay lại thư viện
              </button>
            </div>
            
            <div className="dashboard-grid">
              <ImageConverter
                queue={queue}
                onAddFiles={addFilesToQueue}
                onAddUrl={addUrlToQueue}
                onRemoveItem={handleRemoveItem}
                onEditItem={setActiveEditingId}
                onDownloadItem={handleDownloadItem}
                onConvertAll={handleConvertAll}
                onClearQueue={handleClearQueue}
                onDownloadAllZip={handleDownloadAllZip}
                isConvertingAll={isConvertingAll}
                onRenameItem={handleRenameItem}
                onConvertItem={handleConvertSingle}
              />

              <aside className="control-sidebar glass">
                <h3 className="sidebar-title">
                  <Settings size={18} style={{ color: 'var(--primary)' }} />
                  Cấu Hình Mặc Định
                </h3>

                <div className="settings-group">
                  <span className="settings-label">Định dạng đích</span>
                  <CustomSelect
                    options={[
                      { value: 'image/webp', label: 'WEBP (Khuyên dùng)' },
                      { value: 'image/png', label: 'PNG (Không nén/Trong suốt)' },
                      { value: 'image/jpeg', label: 'JPEG (Chất lượng cao)' }
                    ]}
                    value={globalOptions.format}
                    onChange={(val) => setGlobalOptions({ ...globalOptions, format: val })}
                  />
                </div>

                {globalOptions.format !== 'image/png' && (
                  <div className="settings-group">
                    <span className="settings-label">
                      Chất lượng nén
                      <span className="settings-value">{Math.round(globalOptions.quality * 100)}%</span>
                    </span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      className="range-slider"
                      value={globalOptions.quality * 100}
                      onChange={(e) => setGlobalOptions({ ...globalOptions, quality: parseInt(e.target.value) / 100 })}
                    />
                  </div>
                )}

                <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

                <div className="settings-group">
                  <span className="settings-label">Resize Ảnh</span>
                  <CustomSelect
                    options={[
                      { value: 'original', label: 'Kích Thước Gốc' },
                      { value: 'percentage', label: 'Giảm theo Tỷ lệ (%)' },
                      { value: 'custom', label: 'Kích thước Custom (px)' }
                    ]}
                    value={globalOptions.resizeMode}
                    onChange={(val) => setGlobalOptions({ ...globalOptions, resizeMode: val as any })}
                  />
                </div>

                {globalOptions.resizeMode === 'percentage' && (
                  <div className="settings-group">
                    <span className="settings-label">
                      Tỷ lệ phần trăm
                      <span className="settings-value">{globalOptions.percentage}%</span>
                    </span>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      className="range-slider"
                      value={globalOptions.percentage}
                      onChange={(e) => setGlobalOptions({ ...globalOptions, percentage: parseInt(e.target.value) })}
                    />
                  </div>
                )}

                {globalOptions.resizeMode === 'custom' && (
                  <div className="settings-group">
                    <div className="settings-label">
                      <span>Kích thước xuất</span>
                      <button 
                        className={`lock-aspect-btn ${lockAspect ? 'active' : ''}`}
                        onClick={toggleLockAspect}
                        title={lockAspect ? 'Khóa tỷ lệ khung hình' : 'Mở khóa tỷ lệ khung hình'}
                      >
                        {lockAspect ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                    </div>
                    <div className="dimensions-row">
                      <div className="dim-input-wrapper">
                        <input
                          type="number"
                          className="dim-input"
                          value={globalOptions.width || ''}
                          onChange={(e) => handleGlobalWidthChange(parseInt(e.target.value) || 0)}
                        />
                        <span className="dim-unit">W</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)' }}>x</span>
                      <div className="dim-input-wrapper">
                        <input
                          type="number"
                          className="dim-input"
                          value={globalOptions.height || ''}
                          onChange={(e) => handleGlobalHeightChange(parseInt(e.target.value) || 0)}
                        />
                        <span className="dim-unit">H</span>
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  className="btn-secondary" 
                  style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
                  onClick={applyGlobalSettingsToPending}
                  disabled={queue.filter(i => i.status === 'pending').length === 0}
                >
                  Áp Dụng Cho Hàng Chờ
                </button>
              </aside>
            </div>

            {activeEditingItem && (
              <EditorModal
                isOpen={!!activeEditingId}
                onClose={() => setActiveEditingId(null)}
                file={activeEditingItem.file}
                initialOptions={activeEditingItem.options}
                onSave={handleModalSave}
              />
            )}
          </div>
        )}

        {/* TAB C: PDF TOOLS WORKSPACE */}
        {activeTab === 'pdf' && (
          <div className="animate-fade-in-up">
            <div className="content-header">
              <div>
                <h2>PDF Toolbox</h2>
                <p>Gộp nhiều file PDF, tách dải trang cụ thể hoặc nén giảm dung lượng</p>
              </div>
              <button className="btn-secondary" onClick={() => setActiveTab('library')}>
                <ArrowLeft size={16} /> Quay lại thư viện
              </button>
            </div>
            
            <PdfTools showToast={showToast} />
          </div>
        )}



      </main>
    </div>
  );
}
