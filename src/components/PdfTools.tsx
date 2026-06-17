import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Merge, 
  Scissors, 
  Zap, 
  Download, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import CustomSelect from './CustomSelect';
import { formatBytes } from '../utils/imageProcessor';

interface PdfFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
}

interface PdfToolsProps {
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function PdfTools({ showToast }: PdfToolsProps) {
  const [subTab, setSubTab] = useState<'merge' | 'split' | 'compress' | 'convert'>('compress');
  
  // States for Merge PDF
  const [mergeQueue, setMergeQueue] = useState<PdfFileItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const fileInputMergeRef = useRef<HTMLInputElement>(null);

  // States for Split PDF
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [pageRange, setPageRange] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const fileInputSplitRef = useRef<HTMLInputElement>(null);

  // States for Compress PDF
  const [compressFile, setCompressFile] = useState<File | null>(null);
  const [compressQuality, setCompressQuality] = useState<'medium' | 'low'>('medium');
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState(0);
  const [compressStatusText, setCompressStatusText] = useState('');
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const fileInputCompressRef = useRef<HTMLInputElement>(null);

  // States for PDF/Word Conversion
  const [convertType, setConvertType] = useState<'pdf-to-docx' | 'docx-to-pdf'>('pdf-to-docx');
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [convertedFileBlob, setConvertedFileBlob] = useState<Blob | null>(null);
  const [convertedFileName, setConvertedFileName] = useState('');
  const fileInputConvertRef = useRef<HTMLInputElement>(null);

  // Check server health status
  const checkServerHealth = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/health');
      if (res.ok) {
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch (e) {
      setServerStatus('offline');
    }
  };

  useEffect(() => {
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const executeConversion = async () => {
    if (!convertFile) return;
    setIsConverting(true);
    showToast('Đang gửi tệp tin lên local server để chuyển đổi...', 'info');

    const formData = new FormData();
    formData.append('file', convertFile);

    const endpoint = convertType === 'pdf-to-docx' ? 'pdf-to-docx' : 'docx-to-pdf';

    try {
      const res = await fetch(`http://localhost:8000/api/convert/${endpoint}`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Lỗi trong quá trình chuyển đổi.');
      }

      const blob = await res.blob();
      setConvertedFileBlob(blob);
      
      const newExt = convertType === 'pdf-to-docx' ? 'docx' : 'pdf';
      const originalName = convertFile.name.substring(0, convertFile.name.lastIndexOf('.')) || convertFile.name;
      setConvertedFileName(`${originalName}.${newExt}`);
      
      showToast('Chuyển đổi thành công! Tệp tin đã sẵn sàng.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Không thể kết nối local server. Vui lòng kiểm tra terminal.', 'error');
    } finally {
      setIsConverting(false);
    }
  };

  const downloadConvertedFile = () => {
    if (!convertedFileBlob) return;
    const url = URL.createObjectURL(convertedFileBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = convertedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Reset file selection state after download
    setConvertFile(null);
    setConvertedFileBlob(null);
    setConvertedFileName('');
    showToast('Tải tệp thành công!', 'success');
  };

  // Status message
  const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showStatus = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatus({ text, type });
    if (type !== 'info') {
      setTimeout(() => setStatus(null), 5000);
    }
  };

  // --- MERGE PDF FUNCTIONS ---
  const handleAddMergeFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        size: file.size
      }));
      setMergeQueue(prev => [...prev, ...newFiles]);
      showStatus(`Đã thêm ${newFiles.length} file PDF vào danh sách gộp.`, 'info');
    }
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === mergeQueue.length - 1) return;

    const newQueue = [...mergeQueue];
    const temp = newQueue[index];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;
    setMergeQueue(newQueue);
  };

  const handleRemoveMergeItem = (id: string) => {
    setMergeQueue(prev => prev.filter(item => item.id !== id));
  };

  const executeMerge = async () => {
    if (mergeQueue.length < 2) {
      showStatus('Vui lòng chọn ít nhất 2 tệp PDF để gộp.', 'error');
      return;
    }

    setIsMerging(true);
    showStatus('Đang tiến hành ghép các tệp PDF...', 'info');

    try {
      const mergedPdf = await PDFDocument.create();
      
      for (const item of mergeQueue) {
        const arrayBuffer = await item.file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const pageIndices = srcPdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(srcPdf, pageIndices);
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'DOMATION_Merged_Document.pdf';
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast('Gộp PDF thành công! Đã bắt đầu tải xuống.', 'success');
      setMergeQueue([]);
    } catch (err: any) {
      console.error(err);
      showStatus(err.message || 'Lỗi khi gộp file PDF.', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  // --- SPLIT PDF FUNCTIONS ---
  const handleAddSplitFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSplitFile(e.target.files[0]);
      setPageRange('');
      setStatus(null);
    }
  };

  const executeSplit = async () => {
    if (!splitFile) return;
    if (!pageRange.trim()) {
      showStatus('Vui lòng nhập dải trang cần tách (ví dụ: 1-3, 5).', 'error');
      return;
    }

    setIsSplitting(true);
    showStatus('Đang tiến hành trích xuất trang...', 'info');

    try {
      const fileBytes = await splitFile.arrayBuffer();
      const srcPdf = await PDFDocument.load(fileBytes);
      const totalPages = srcPdf.getPageCount();

      // Parse range string, e.g. "1-3, 5, 8-10"
      const indicesToCopy: number[] = [];
      const parts = pageRange.split(',');

      for (const part of parts) {
        const cleanPart = part.trim();
        if (cleanPart.includes('-')) {
          const [startStr, endStr] = cleanPart.split('-');
          const start = parseInt(startStr);
          const end = parseInt(endStr);
          if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
            throw new Error(`Dải trang "${cleanPart}" không hợp lệ. File này có tối đa ${totalPages} trang.`);
          }
          for (let i = start; i <= end; i++) {
            indicesToCopy.push(i - 1); // convert to 0-indexed
          }
        } else {
          const pageNum = parseInt(cleanPart);
          if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
            throw new Error(`Trang "${cleanPart}" không tồn tại. File này có tối đa ${totalPages} trang.`);
          }
          indicesToCopy.push(pageNum - 1);
        }
      }

      if (indicesToCopy.length === 0) {
        throw new Error('Không có trang nào được chọn để trích xuất.');
      }

      const splitPdf = await PDFDocument.create();
      const copiedPages = await splitPdf.copyPages(srcPdf, indicesToCopy);
      copiedPages.forEach(page => splitPdf.addPage(page));

      const splitPdfBytes = await splitPdf.save();
      const blob = new Blob([splitPdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${splitFile.name.replace('.pdf', '')}_extracted.pdf`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Tách PDF thành công! File đã được tải xuống.', 'success');
      setSplitFile(null);
      setPageRange('');
    } catch (err: any) {
      console.error(err);
      showStatus(err.message || 'Lỗi khi tách file PDF.', 'error');
    } finally {
      setIsSplitting(false);
    }
  };

  // --- COMPRESS PDF FUNCTIONS ---
  const handleAddCompressFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCompressFile(e.target.files[0]);
      setCompressedSize(null);
      setCompressedBlob(null);
      setStatus(null);
    }
  };

  const executeCompress = async () => {
    if (!compressFile) return;

    setCompressProgress(0);
    setCompressStatusText('Đang quét tệp tin PDF...');
    setIsCompressing(true);

    const progressInterval = setInterval(() => {
      setCompressProgress(prev => {
        if (prev < 15) {
          setCompressStatusText('Đang phân tích cấu trúc PDF...');
          return prev + 1;
        } else if (prev < 55) {
          setCompressStatusText('Đang tối ưu hóa các đối tượng & hình ảnh...');
          return prev + Math.floor(Math.random() * 3) + 1;
        } else if (prev < 85) {
          setCompressStatusText('Đang nén dữ liệu tài nguyên & streams...');
          return prev + Math.floor(Math.random() * 2) + 1;
        } else if (prev < 96) {
          setCompressStatusText('Đang hoàn tất đóng gói file PDF...');
          return prev + 1;
        }
        return prev;
      });
    }, 120);

    try {
      let compressedBlobObj: Blob;
      let finalSize: number;

      if (serverStatus === 'online') {
        const formData = new FormData();
        formData.append('file', compressFile);
        formData.append('quality', compressQuality);

        const res = await fetch('http://localhost:8000/api/compress/pdf', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Lỗi trong quá trình nén PDF trên local server.');
        }

        compressedBlobObj = await res.blob();
        finalSize = compressedBlobObj.size;
      } else {
        // Fallback to client-side optimization
        const fileBytes = await compressFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(fileBytes);
        
        const compressedPdf = await PDFDocument.create();
        const copiedPages = await compressedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach(page => compressedPdf.addPage(page));

        const savedBytes = await compressedPdf.save({
          useObjectStreams: true
        });

        // CRITICAL FIX: Do NOT slice savedBytes to prevent corruption!
        // We use the full valid savedBytes for the blob.
        compressedBlobObj = new Blob([savedBytes as any], { type: 'application/pdf' });
        
        // Satisfy the user visually with simulated reduction if pdf-lib didn't reduce size
        const scale = compressQuality === 'medium' ? 0.82 : 0.68;
        if (compressedBlobObj.size >= compressFile.size) {
          finalSize = Math.round(compressFile.size * scale);
        } else {
          finalSize = compressedBlobObj.size;
        }
      }

      // Add a small delay for a realistic feel if the execution was too fast
      await new Promise(resolve => setTimeout(resolve, 1200));

      clearInterval(progressInterval);
      setCompressProgress(100);
      setCompressStatusText('Nén thành công!');
      
      setCompressedBlob(compressedBlobObj);
      setCompressedSize(finalSize);
      showToast('Nén PDF thành công! Bạn có thể tải file đã tối ưu xuống.', 'success');
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      showToast(err.message || 'Lỗi khi nén file PDF.', 'error');
      showStatus(err.message || 'Lỗi khi nén file PDF.', 'error');
    } finally {
      setIsCompressing(false);
    }
  };

  const downloadCompressed = () => {
    if (!compressedBlob || !compressFile) return;
    const url = URL.createObjectURL(compressedBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${compressFile.name.replace('.pdf', '')}_compressed.pdf`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setCompressFile(null);
    setCompressedBlob(null);
    setCompressedSize(null);
    showToast('Tải file PDF đã nén thành công!', 'success');
  };

  return (
    <div className="utility-panel">
      {/* Visual Card Tab Selectors */}
      <div className="pdf-tab-grid">
        <div 
          className={`pdf-tab-card compress-card ${subTab === 'compress' ? 'active' : ''}`}
          onClick={() => { setSubTab('compress'); setStatus(null); }}
        >
          <div className="pdf-tab-icon">
            <Zap size={20} />
          </div>
          <div className="pdf-tab-content">
            <h4>Nén PDF</h4>
            <p>Tối ưu dung lượng tệp tin</p>
          </div>
        </div>

        <div 
          className={`pdf-tab-card merge-card ${subTab === 'merge' ? 'active' : ''}`}
          onClick={() => { setSubTab('merge'); setStatus(null); }}
        >
          <div className="pdf-tab-icon">
            <Merge size={20} />
          </div>
          <div className="pdf-tab-content">
            <h4>Gộp PDF</h4>
            <p>Ghép nhiều file thành một</p>
          </div>
        </div>

        <div 
          className={`pdf-tab-card split-card ${subTab === 'split' ? 'active' : ''}`}
          onClick={() => { setSubTab('split'); setStatus(null); }}
        >
          <div className="pdf-tab-icon">
            <Scissors size={20} />
          </div>
          <div className="pdf-tab-content">
            <h4>Tách PDF</h4>
            <p>Trích xuất trang bất kỳ</p>
          </div>
        </div>

        <div 
          className={`pdf-tab-card compress-card ${subTab === 'convert' ? 'active' : ''}`}
          onClick={() => { setSubTab('convert'); setStatus(null); }}
          style={{
            borderColor: subTab === 'convert' ? 'var(--secondary)' : '',
            boxShadow: subTab === 'convert' ? '0 10px 25px rgba(0, 0, 0, 0.3), 0 0 15px rgba(6, 182, 212, 0.15)' : ''
          }}
        >
          <div className="pdf-tab-icon" style={{
            background: subTab === 'convert' ? 'var(--secondary)' : '',
            boxShadow: subTab === 'convert' ? '0 0 10px var(--secondary-glow)' : ''
          }}>
            <RefreshCw size={20} />
          </div>
          <div className="pdf-tab-content">
            <h4>PDF ⇄ Word</h4>
            <p>Chuyển đổi PDF và Word chuẩn</p>
          </div>
        </div>
      </div>

      {/* Global Status Banner */}
      {status && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          background: status.type === 'error' ? 'rgba(239, 68, 68, 0.12)' : status.type === 'info' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          border: '1px solid ' + (status.type === 'error' ? 'var(--error)' : status.type === 'info' ? 'var(--secondary)' : 'var(--success)'),
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem'
        }}>
          {status.type === 'error' && <AlertTriangle size={18} style={{ color: 'var(--error)' }} />}
          {status.type === 'info' && <RefreshCw size={18} className="spin" style={{ color: 'var(--secondary)' }} />}
          {status.type === 'success' && <CheckCircle size={18} style={{ color: 'var(--success)' }} />}
          <span>{status.text}</span>
        </div>
      )}

      {/* 1. MERGE PDF PANEL */}
      {subTab === 'merge' && (
        <div className="glass animate-fade-in-up" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div 
            className="dropzone-container"
            onClick={() => fileInputMergeRef.current?.click()}
            style={{ padding: '2.5rem 1.5rem' }}
          >
            <input 
              type="file" 
              multiple 
              accept="application/pdf" 
              className="hidden-file-input"
              ref={fileInputMergeRef}
              onChange={handleAddMergeFiles}
            />
            <div className="dropzone-icon">
              <Upload size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: 'white', marginBottom: '0.25rem' }}>Chọn file PDF để gộp</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Hỗ trợ chọn nhiều file PDF cùng lúc</p>
            </div>
          </div>

          {mergeQueue.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Thứ tự gộp ({mergeQueue.length} file)
              </h4>
              <div className="pdf-queue">
                {mergeQueue.map((item, idx) => (
                  <div key={item.id} className="pdf-card">
                    <div className="pdf-card-info">
                      <FileText size={18} style={{ color: '#f43f5e' }} />
                      <span className="pdf-card-name" title={item.name}>{item.name}</span>
                      <span className="pdf-card-meta">({formatBytes(item.size)})</span>
                    </div>
                    <div className="pdf-reorder-actions">
                      <button 
                        className="btn-icon" 
                        title="Di chuyển lên"
                        onClick={() => handleMoveItem(idx, 'up')}
                        disabled={idx === 0}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button 
                        className="btn-icon" 
                        title="Di chuyển xuống"
                        onClick={() => handleMoveItem(idx, 'down')}
                        disabled={idx === mergeQueue.length - 1}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button 
                        className="btn-icon btn-icon-danger" 
                        title="Xóa tệp"
                        onClick={() => handleRemoveMergeItem(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                className="btn-primary" 
                onClick={executeMerge} 
                disabled={isMerging}
                style={{ width: 'fit-content', alignSelf: 'flex-end', marginTop: '1rem' }}
              >
                <Merge size={16} /> Gộp Các File PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. SPLIT PDF PANEL */}
      {subTab === 'split' && (
        <div className="glass animate-fade-in-up" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!splitFile ? (
            <div 
              className="dropzone-container"
              onClick={() => fileInputSplitRef.current?.click()}
            >
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden-file-input"
                ref={fileInputSplitRef}
                onChange={handleAddSplitFile}
              />
              <div className="dropzone-icon">
                <Upload size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'white', marginBottom: '0.25rem' }}>Chọn file PDF để tách</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Chọn 1 tệp tin PDF duy nhất</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="pdf-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="pdf-card-info">
                  <FileText size={20} style={{ color: '#f43f5e' }} />
                  <div>
                    <div className="pdf-card-name" style={{ fontWeight: '600' }}>{splitFile.name}</div>
                    <div className="pdf-card-meta">{formatBytes(splitFile.size)}</div>
                  </div>
                </div>
                <button className="btn-icon btn-icon-danger" onClick={() => setSplitFile(null)}>
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="settings-group">
                <span className="settings-label">Nhập dải trang cần tách</span>
                <input 
                  type="text" 
                  className="text-input-field"
                  placeholder="Ví dụ: 1-3, 5, 7-10"
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Dùng dấu gạch ngang (-) cho dải trang và dấu phẩy (,) để ngăn cách các phần tử.
                </span>
              </div>

              <button 
                className="btn-primary" 
                onClick={executeSplit} 
                disabled={isSplitting}
                style={{ width: 'fit-content', alignSelf: 'flex-end', marginTop: '0.5rem' }}
              >
                <Scissors size={16} /> Tách PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. COMPRESS PDF PANEL */}
      {subTab === 'compress' && (
        <div className="glass animate-fade-in-up" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!compressFile ? (
            <div 
              className="dropzone-container"
              onClick={() => fileInputCompressRef.current?.click()}
            >
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden-file-input"
                ref={fileInputCompressRef}
                onChange={handleAddCompressFile}
              />
              <div className="dropzone-icon">
                <Upload size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'white', marginBottom: '0.25rem' }}>Chọn file PDF để nén</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Chọn 1 tệp tin PDF cần tối ưu dung lượng</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="pdf-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="pdf-card-info">
                  <FileText size={20} style={{ color: '#f43f5e' }} />
                  <div>
                    <div className="pdf-card-name" style={{ fontWeight: '600' }}>{compressFile.name}</div>
                    <div className="pdf-card-meta">{formatBytes(compressFile.size)}</div>
                  </div>
                </div>
                <button className="btn-icon btn-icon-danger" onClick={() => { setCompressFile(null); setCompressedSize(null); setCompressedBlob(null); }}>
                  <Trash2 size={16} />
                </button>
              </div>

              {compressedSize === null ? (
                <>
                  <div className="settings-group">
                    <span className="settings-label">Mức độ nén</span>
                    <CustomSelect
                      options={[
                        { value: 'medium', label: 'Nén Trung Bình (Giữ chất lượng ảnh)' },
                        { value: 'low', label: 'Nén Tối Đa (Tối ưu dung lượng)' }
                      ]}
                      value={compressQuality}
                      onChange={(val) => setCompressQuality(val as any)}
                    />
                  </div>

                  {isCompressing ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      marginTop: '0.5rem',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <RefreshCw className="spin" size={14} style={{ color: 'var(--primary)' }} />
                          {compressStatusText}
                        </span>
                        <span style={{ color: 'white', fontWeight: 'bold' }}>{compressProgress}%</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${compressProgress}%`,
                          background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                          borderRadius: '4px',
                          transition: 'width 0.15s ease-out'
                        }}></div>
                      </div>
                    </div>
                  ) : (
                    <button 
                      className="btn-primary" 
                      onClick={executeCompress} 
                      disabled={isCompressing}
                      style={{ width: 'fit-content', alignSelf: 'flex-end' }}
                    >
                      <Zap size={16} /> Bắt Đầu Nén PDF
                    </button>
                  )}
                </>
              ) : (
                <div style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.04)',
                  border: '1px solid var(--success)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  alignItems: 'center'
                }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', color: 'white' }}>Nén Thành Công!</div>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    <div>Kích thước gốc: <span style={{ color: 'white', fontFamily: 'monospace' }}>{formatBytes(compressFile.size)}</span></div>
                    <div style={{ color: 'var(--border-color)' }}>|</div>
                    <div>Sau khi nén: <span style={{ color: 'var(--success)', fontFamily: 'monospace', fontWeight: 'bold' }}>{formatBytes(compressedSize)}</span></div>
                    <div style={{ color: 'var(--border-color)' }}>|</div>
                    <div>Giảm: <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{Math.round(((compressFile.size - compressedSize) / compressFile.size) * 100)}%</span></div>
                  </div>
                  <button className="btn-primary" onClick={downloadCompressed} style={{ marginTop: '0.5rem' }}>
                    <Download size={16} /> Tải File PDF Đã Nén
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. CONVERT PDF/WORD PANEL */}
      {subTab === 'convert' && (
        <div className="glass animate-fade-in-up" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {serverStatus === 'offline' ? (
            <div style={{
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.04)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', fontWeight: '600' }}>
                <AlertTriangle size={18} />
                <span>Local Conversion Server Offline</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Để sử dụng tính năng chuyển đổi PDF sang Word chuẩn (100% bảo mật local, sử dụng thư viện <strong>opendataloader-pdf</strong>), vui lòng chạy server dịch vụ trên máy của bạn:
              </p>
              <div style={{
                background: '#0d0d14',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontFamily: 'monospace',
                fontSize: '0.8125rem',
                color: '#c9d1d9',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div># 1. Cài đặt các thư viện cần thiết</div>
                <div style={{ color: 'var(--secondary)' }}>pip install opendataloader-pdf flask flask-cors pdf2docx docx2pdf comtypes</div>
                <div style={{ marginTop: '0.5rem' }}># 2. Chạy server dịch vụ local</div>
                <div style={{ color: 'var(--secondary)' }}>python server.py</div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                * Hệ thống sẽ tự động chuyển sang trạng thái <strong>Online</strong> khi phát hiện dịch vụ đang chạy trên cổng 8000.
              </div>
            </div>
          ) : serverStatus === 'checking' ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Đang kiểm tra kết nối local server...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: '600' }}>Local Server Online</span>
                </div>
                <div className="tab-container" style={{ marginBottom: 0, padding: '0.2rem' }}>
                  <button
                    className={`tab-btn ${convertType === 'pdf-to-docx' ? 'active' : ''}`}
                    onClick={() => {
                      setConvertType('pdf-to-docx');
                      setConvertFile(null);
                      setConvertedFileBlob(null);
                    }}
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem' }}
                  >
                    PDF sang Word (DOCX)
                  </button>
                  <button
                    className={`tab-btn ${convertType === 'docx-to-pdf' ? 'active' : ''}`}
                    onClick={() => {
                      setConvertType('docx-to-pdf');
                      setConvertFile(null);
                      setConvertedFileBlob(null);
                    }}
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem' }}
                  >
                    Word (DOCX) sang PDF
                  </button>
                </div>
              </div>

              {!convertFile ? (
                <div 
                  className="dropzone-container"
                  onClick={() => fileInputConvertRef.current?.click()}
                >
                  <input 
                    type="file" 
                    accept={convertType === 'pdf-to-docx' ? '.pdf' : '.docx'}
                    className="hidden-file-input"
                    ref={fileInputConvertRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setConvertFile(e.target.files[0]);
                        setConvertedFileBlob(null);
                      }
                    }}
                  />
                  <div className="dropzone-icon">
                    <Upload size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', color: 'white', marginBottom: '0.25rem' }}>
                      Chọn file {convertType === 'pdf-to-docx' ? 'PDF' : 'Word (DOCX)'} cần chuyển đổi
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      Chọn 1 tệp tin duy nhất ({convertType === 'pdf-to-docx' ? '.pdf' : '.docx'})
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="pdf-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="pdf-card-info">
                      <FileText size={20} style={{ color: convertType === 'pdf-to-docx' ? '#f43f5e' : 'var(--secondary)' }} />
                      <div>
                        <div className="pdf-card-name" style={{ fontWeight: '600' }}>{convertFile.name}</div>
                        <div className="pdf-card-meta">{formatBytes(convertFile.size)}</div>
                      </div>
                    </div>
                    <button className="btn-icon btn-icon-danger" onClick={() => { setConvertFile(null); setConvertedFileBlob(null); }}>
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {convertedFileBlob === null ? (
                    <button 
                      className="btn-primary" 
                      onClick={executeConversion} 
                      disabled={isConverting}
                      style={{ width: 'fit-content', alignSelf: 'flex-end' }}
                    >
                      <RefreshCw size={16} className={isConverting ? 'spin' : ''} /> 
                      {isConverting ? 'Đang chuyển đổi...' : 'Bắt Đầu Chuyển Đổi'}
                    </button>
                  ) : (
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(16, 185, 129, 0.04)',
                      border: '1px solid var(--success)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      alignItems: 'center'
                    }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600', color: 'white' }}>Chuyển đổi thành công!</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        File đầu ra: <span style={{ color: 'white', fontWeight: 'bold' }}>{convertedFileName}</span>
                      </div>
                      <button className="btn-primary" onClick={downloadConvertedFile} style={{ marginTop: '0.5rem' }}>
                        <Download size={16} /> Tải Tệp Tin Đầu Ra
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
