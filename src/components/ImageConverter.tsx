import React, { useRef, useState } from 'react';
import { UploadCloud, Link as LinkIcon, Trash2, Edit2, Download, CheckCircle, AlertTriangle, RefreshCw, FileImage, FolderArchive, Sparkles } from 'lucide-react';
import { formatBytes } from '../utils/imageProcessor';

// Define the shape of items in the image queue
export interface QueueItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  errorMsg?: string;
  options: {
    format: string;
    quality: number;
    resizeMode: 'original' | 'percentage' | 'custom';
    percentage?: number;
    width?: number;
    height?: number;
    crop?: { x: number; y: number; width: number; height: number } | null;
  };
  convertedBlob?: Blob;
  convertedSize?: number;
  convertedWidth?: number;
  convertedHeight?: number;
  previewUrl?: string;
}

interface ImageConverterProps {
  queue: QueueItem[];
  onAddFiles: (files: FileList | File[]) => void;
  onAddUrl: (url: string) => Promise<void>;
  onRemoveItem: (id: string) => void;
  onEditItem: (id: string) => void;
  onDownloadItem: (id: string) => void;
  onConvertAll: () => void;
  onClearQueue: () => void;
  onDownloadAllZip: () => void;
  isConvertingAll: boolean;
  onConvertItem: (id: string) => void;
  onRenameItem: (id: string, newName: string) => void;
}

export default function ImageConverter({
  queue,
  onAddFiles,
  onAddUrl,
  onRemoveItem,
  onEditItem,
  onDownloadItem,
  onConvertAll,
  onClearQueue,
  onDownloadAllZip,
  isConvertingAll,
  onConvertItem,
  onRenameItem
}: ImageConverterProps) {
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    const lastDot = currentName.lastIndexOf('.');
    const nameWithoutExt = lastDot !== -1 ? currentName.substring(0, lastDot) : currentName;
    setRenameValue(nameWithoutExt);
  };

  const saveRename = (id: string) => {
    if (renameValue.trim()) {
      onRenameItem(id, renameValue.trim());
    }
    setRenamingId(null);
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
  };

  // Link pasting load handler
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsFetchingUrl(true);
    setUrlError(null);
    try {
      await onAddUrl(urlInput.trim());
      setUrlInput('');
    } catch (err: any) {
      setUrlError(err.message || 'Không thể tải ảnh từ liên kết này.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const pendingCount = queue.filter(item => item.status === 'pending').length;
  const doneCount = queue.filter(item => item.status === 'done').length;

  // Calculate summary stats
  const totalOriginalSize = queue.reduce((acc, item) => acc + item.originalSize, 0);
  const totalConvertedSize = queue.reduce((acc, item) => acc + (item.status === 'done' && item.convertedSize ? item.convertedSize : item.originalSize), 0);
  const totalSavedSize = totalOriginalSize - totalConvertedSize;
  const totalSavingPercent = totalOriginalSize > 0 ? Math.round((totalSavedSize / totalOriginalSize) * 100) : 0;

  return (
    <div className="workspace-panel">
      {/* Drag & Drop File Zone */}
      <div
        className={`dropzone-container glass ${dragOver ? 'dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleZoneClick}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden-file-input"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <div className="dropzone-icon">
          <UploadCloud size={32} />
        </div>
        <div className="dropzone-text">
          <h3>Kéo & Thả ảnh tại đây</h3>
          <p>hoặc nhấn để chọn ảnh từ máy tính (PNG, JPG, WEBP, AVIF, GIF, etc.)</p>
        </div>
      </div>

      {/* URL Link Fetcher Panel */}
      <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
        <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <LinkIcon size={16} /> Hoặc nhập link ảnh trực tuyến:
        </h4>
        <form onSubmit={handleUrlSubmit} className="url-input-container">
          <input
            type="url"
            placeholder="Dán link ảnh (ví dụ: https://example.com/image.jpg)"
            className="url-input"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={isFetchingUrl}
          />
          <button type="submit" className="btn-url" disabled={isFetchingUrl || !urlInput.trim()}>
            {isFetchingUrl ? (
              <>
                <RefreshCw size={16} className="spin" /> Đang tải...
              </>
            ) : (
              'Tải Ảnh'
            )}
          </button>
        </form>
        {urlError && (
          <div style={{ color: 'var(--error)', fontSize: '0.8125rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={14} /> {urlError}
          </div>
        )}
      </div>

      {/* Queue Listing Header & Bulk Controls */}
      {queue.length > 0 && (
        <>
          {doneCount > 0 && (
            <div className="summary-banner glass">
              <div className="summary-icon">
                <Sparkles size={20} />
              </div>
              <div className="summary-details">
                <span className="summary-title">Kết quả tối ưu</span>
                <span className="summary-text">
                  Đã tối ưu <strong>{doneCount}/{queue.length}</strong> ảnh,{' '}
                  {totalSavedSize > 0 ? (
                    <>
                      giảm <strong>{totalSavingPercent}%</strong> dung lượng (Tiết kiệm <strong>{formatBytes(totalSavedSize)}</strong>)
                    </>
                  ) : (
                    <>
                      tăng <strong>{Math.abs(totalSavingPercent)}%</strong> dung lượng (Tăng <strong>{formatBytes(Math.abs(totalSavedSize))}</strong>)
                    </>
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="queue-header">
            <div className="queue-title">
              <h3>Danh Sách Hàng Đợi</h3>
              <span className="queue-count">{queue.length} ảnh</span>
            </div>
            <div className="bulk-actions">
              <button className="btn-secondary" onClick={onClearQueue} disabled={isConvertingAll}>
                <Trash2 size={16} /> Xóa Hết
              </button>
              {doneCount > 0 && (
                <button className="btn-secondary" style={{ borderColor: 'var(--primary-glow)', color: 'var(--text-primary)' }} onClick={onDownloadAllZip}>
                  <FolderArchive size={16} style={{ color: 'var(--primary)' }} /> Tải File ZIP
                </button>
              )}
              {pendingCount > 0 && (
                <button className="btn-primary" onClick={onConvertAll} disabled={isConvertingAll}>
                  <RefreshCw size={16} className={isConvertingAll ? 'spin' : ''} /> 
                  {isConvertingAll ? 'Đang chuyển đổi...' : 'Convert Tất Cả'}
                </button>
              )}
            </div>
          </div>

          {/* Queue Items Scroll Box */}
          <div className="queue-list">
            {queue.map((item) => {
              const fileExtension = item.name.split('.').pop()?.toUpperCase() || 'IMG';
              const targetFormatExt = item.options.format.split('/')[1].toUpperCase();
              
              // Calculate space savings
              const isDone = item.status === 'done';
              const sizeDiff = isDone && item.convertedSize ? item.originalSize - item.convertedSize : 0;
              const savingPercent = isDone && item.convertedSize ? Math.round((sizeDiff / item.originalSize) * 100) : 0;

              return (
                <div key={item.id} className={`queue-item glass ${item.status === 'processing' ? 'processing' : ''}`}>
                  {/* File preview */}
                  <div className={`item-preview-container ${item.status === 'processing' ? 'scanning-container' : ''}`}>
                    {item.previewUrl || item.status === 'done' ? (
                      <img
                        src={item.previewUrl || (item.convertedBlob ? URL.createObjectURL(item.convertedBlob) : '')}
                        alt="Preview"
                        className="item-preview"
                      />
                    ) : (
                      <FileImage size={32} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>

                  {/* Details metadata */}
                  <div className="item-info">
                    {renamingId === item.id ? (
                      <input
                        type="text"
                        className="item-name-edit-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => saveRename(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(item.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div 
                        className="item-name-wrapper"
                        onClick={() => startRename(item.id, item.name)}
                        title="Click để đổi tên nhanh"
                      >
                        <span className="item-name">{item.name}</span>
                        <Edit2 size={12} className="name-edit-icon" />
                      </div>
                    )}
                    <div className="item-meta">
                      {/* Format tag group */}
                      <div className="meta-group">
                        <span className="item-badge">{fileExtension}</span>
                        <span className="arrow-divider">→</span>
                        <span className="item-badge item-badge-success">{targetFormatExt}</span>
                      </div>
                      
                      <span>•</span>
                      
                      {/* Size details group */}
                      <div className="meta-group">
                        <span>{formatBytes(item.originalSize)}</span>
                        {isDone && item.convertedSize && (
                          <>
                            <span className="arrow-divider">→</span>
                            <span style={{ color: 'white', fontWeight: '500' }}>{formatBytes(item.convertedSize)}</span>
                          </>
                        )}
                      </div>

                      {isDone && item.convertedSize && (
                        <>
                          <span>•</span>
                          <span className={savingPercent > 0 ? 'ratio-saving' : 'ratio-negative'}>
                            {savingPercent > 0 ? `Giảm ${savingPercent}%` : `Tăng ${Math.abs(savingPercent)}%`}
                          </span>
                        </>
                      )}

                      <span>•</span>

                      {/* Dimension tags group */}
                      <div className="meta-group">
                        <span>{item.originalWidth}x{item.originalHeight} px</span>
                        {isDone && item.convertedWidth && item.convertedHeight && (
                          <>
                            <span className="arrow-divider">→</span>
                            <span style={{ color: 'white' }}>{item.convertedWidth}x{item.convertedHeight} px</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status & Actions panel */}
                  <div className="item-actions">
                    {/* Status notifications */}
                    {item.status === 'processing' && (
                      <div className="status-loading">
                        <RefreshCw size={16} className="spin" />
                        <span style={{ fontSize: '0.8125rem' }}>Đang xử lý...</span>
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div className="status-error" title={item.errorMsg}>
                        <AlertTriangle size={16} style={{ color: 'var(--error)' }} />
                        <span style={{ marginLeft: '0.25rem' }}>Lỗi</span>
                      </div>
                    )}
                    {item.status === 'done' && (
                      <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', marginRight: '0.5rem' }}>
                        <CheckCircle size={18} />
                      </div>
                    )}

                    {/* Actions buttons */}
                    {item.status !== 'processing' && (
                      <>
                        {item.status === 'pending' && (
                          <button
                            className="btn-icon btn-icon-success"
                            title="Convert riêng ảnh này"
                            onClick={() => onConvertItem(item.id)}
                            disabled={isConvertingAll}
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}

                        <button
                          className="btn-icon"
                          title="Tùy chỉnh thông số & Cắt ảnh"
                          onClick={() => onEditItem(item.id)}
                          disabled={isConvertingAll}
                        >
                          <Edit2 size={16} />
                        </button>
                        
                        {item.status === 'done' && (
                          <button
                            className="btn-icon btn-icon-success"
                            title="Tải ảnh này về"
                            onClick={() => onDownloadItem(item.id)}
                          >
                            <Download size={16} />
                          </button>
                        )}

                        <button
                          className="btn-icon btn-icon-danger"
                          title="Xóa khỏi hàng đợi"
                          onClick={() => onRemoveItem(item.id)}
                          disabled={isConvertingAll}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Empty State */}
      {queue.length === 0 && (
        <div className="empty-state glass">
          <UploadCloud className="empty-state-icon" size={48} />
          <div>
            <h3 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '0.25rem' }}>Chưa có ảnh nào</h3>
            <p style={{ fontSize: '0.875rem' }}>Hãy thả tập tin hoặc dán link ảnh vào để bắt đầu chuyển đổi nhanh chóng!</p>
          </div>
        </div>
      )}
    </div>
  );
}
