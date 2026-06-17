import React, { useState, useEffect, useRef } from 'react';
import { 
  Braces, 
  Binary, 
  QrCode, 
  Copy, 
  Download, 
  Upload,
  Check, 
  AlertCircle,
  Trash2
} from 'lucide-react';
import QRCode from 'qrcode';
import CustomSelect from './CustomSelect';
import { formatBytes } from '../utils/imageProcessor';

interface DevToolsProps {
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function DevTools({ showToast }: DevToolsProps) {
  const [subTab, setSubTab] = useState<'json' | 'base64' | 'qrcode'>('json');

  // Common copy action state
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const triggerCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
    showToast("Đã sao chép vào bộ nhớ tạm!", "success");
  };

  // --- 1. JSON FORMATTER STATES ---
  const [jsonInput, setJsonInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [indentSize, setIndentSize] = useState<string>('2'); // '2', '4', 'minify'

  const formatJson = (mode = indentSize) => {
    setJsonError(null);
    if (!jsonInput.trim()) {
      setJsonOutput('');
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput);
      if (mode === 'minify') {
        setJsonOutput(JSON.stringify(parsed));
      } else {
        const indent = mode === 'tab' ? '\t' : parseInt(mode) || 2;
        setJsonOutput(JSON.stringify(parsed, null, indent));
      }
    } catch (err: any) {
      setJsonError(err.message || 'JSON không hợp lệ.');
      setJsonOutput('');
    }
  };

  // Trigger JSON format when input or indent changes
  useEffect(() => {
    formatJson();
  }, [jsonInput, indentSize]);


  // --- 2. BASE64 CONVERTER STATES ---
  const [b64Mode, setB64Mode] = useState<'text' | 'file'>('text');
  
  // Text Mode states
  const [b64TextInput, setB64TextInput] = useState('');
  const [b64TextOutput, setB64TextOutput] = useState('');
  const [b64Error, setB64Error] = useState<string | null>(null);

  // File Mode states
  const [b64FileString, setB64FileString] = useState('');
  const [b64FileName, setB64FileName] = useState('');
  const fileInputB64Ref = useRef<HTMLInputElement>(null);

  const handleB64EncodeText = () => {
    setB64Error(null);
    try {
      // Use standard btoa with utf-8 encoding compatibility
      const bytes = new TextEncoder().encode(b64TextInput);
      const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
      setB64TextOutput(btoa(binString));
    } catch (err: any) {
      setB64Error('Không thể mã hóa chuỗi văn bản này sang Base64.');
    }
  };

  const handleB64DecodeText = () => {
    setB64Error(null);
    try {
      const binString = atob(b64TextInput.trim());
      const bytes = Uint8Array.from(binString, (char) => char.charCodeAt(0));
      setB64TextOutput(new TextDecoder().decode(bytes));
    } catch (err: any) {
      setB64Error('Chuỗi đầu vào không phải là định dạng Base64 hợp lệ.');
      setB64TextOutput('');
    }
  };

  const handleB64FileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setB64FileName(file.name);
      
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setB64FileString(reader.result);
          showToast(`Đã chuyển đổi thành công tệp ${file.name} sang Base64!`, 'success');
        }
      };
      reader.onerror = () => {
        setB64Error('Lỗi khi đọc tệp tin.');
        showToast('Lỗi khi đọc tệp tin.', 'error');
      };
      reader.readAsDataURL(file);
    }
  };

  const resetB64File = () => {
    setB64FileName('');
    setB64FileString('');
    setB64Error(null);
  };


  // --- 3. QR CODE STATES ---
  const [qrText, setQrText] = useState('https://domation.vn');
  const [qrColorDark, setQrColorDark] = useState('#000000');
  const [qrColorLight, setQrColorLight] = useState('#ffffff');
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (qrText.trim()) {
      QRCode.toDataURL(
        qrText,
        {
          width: 300,
          margin: 2,
          color: {
            dark: qrColorDark,
            light: qrColorLight
          }
        },
        (err, url) => {
          if (err) console.error(err);
          else setQrDataUrl(url);
        }
      );
    }
  }, [qrText, qrColorDark, qrColorLight]);

  const downloadQrCode = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'DOMATION_QR_Code.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Đã tải xuống mã QR Code thành công!", "success");
  };

  return (
    <div className="utility-panel">
      {/* Sub tabs for Dev Tools */}
      <div className="tab-container">
        <button 
          className={`tab-btn ${subTab === 'json' ? 'active' : ''}`}
          onClick={() => setSubTab('json')}
        >
          <Braces size={16} /> JSON Formatter
        </button>
        <button 
          className={`tab-btn ${subTab === 'base64' ? 'active' : ''}`}
          onClick={() => setSubTab('base64')}
        >
          <Binary size={16} /> Base64 Converter
        </button>
        <button 
          className={`tab-btn ${subTab === 'qrcode' ? 'active' : ''}`}
          onClick={() => setSubTab('qrcode')}
        >
          <QrCode size={16} /> QR Code Generator
        </button>
      </div>

      {/* 1. JSON FORMATTER PANEL */}
      {subTab === 'json' && (
        <div className="dev-tool-grid">
          {/* Input Panel */}
          <div className="glass dev-editor-card">
            <div className="dev-editor-header">
              <span>Đầu vào (JSON thô)</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Định dạng:</span>
                <div style={{ width: '150px' }}>
                  <CustomSelect
                    options={[
                      { value: '2', label: '2 Khoảng trắng' },
                      { value: '4', label: '4 Khoảng trắng' },
                      { value: 'minify', label: 'Minify (Thu gọn)' }
                    ]}
                    value={indentSize}
                    onChange={(val) => setIndentSize(val)}
                  />
                </div>
              </div>
            </div>
            <textarea
              className="code-textarea"
              placeholder='Dán JSON vào đây. Ví dụ: {"name":"DOMATION","type":"tools","active":true}'
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
          </div>

          {/* Output Panel */}
          <div className="glass dev-editor-card">
            <div className="dev-editor-header">
              <span>Kết quả</span>
              {jsonOutput && (
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => triggerCopy(jsonOutput, 'json')}
                >
                  {copyStatus === 'json' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                  {copyStatus === 'json' ? 'Đã sao chép' : 'Sao chép'}
                </button>
              )}
            </div>
            {jsonError ? (
              <div className="code-textarea code-output error">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <AlertCircle size={16} style={{ marginTop: '0.1rem' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Lỗi JSON Syntax:</strong>
                    <span>{jsonError}</span>
                  </div>
                </div>
              </div>
            ) : (
              <textarea
                className="code-textarea code-output"
                readOnly
                placeholder="Kết quả JSON được định dạng đẹp mắt sẽ hiển thị ở đây..."
                value={jsonOutput}
              />
            )}
          </div>
        </div>
      )}

      {/* 2. BASE64 CONVERTER PANEL */}
      {subTab === 'base64' && (
        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Sub menu for Text vs File Mode */}
          <div className="tab-container" style={{ marginBottom: '0px' }}>
            <button 
              className={`tab-btn ${b64Mode === 'text' ? 'active' : ''}`}
              onClick={() => { setB64Mode('text'); setB64Error(null); }}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
            >
              Văn Bản
            </button>
            <button 
              className={`tab-btn ${b64Mode === 'file' ? 'active' : ''}`}
              onClick={() => { setB64Mode('file'); setB64Error(null); }}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
            >
              Tập Tin
            </button>
          </div>

          {b64Error && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid var(--error)',
              color: 'var(--error)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              <span>{b64Error}</span>
            </div>
          )}

          {/* BASE64 TEXT CONVERTER */}
          {b64Mode === 'text' && (
            <div className="dev-tool-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span className="settings-label">Đầu vào</span>
                <textarea
                  className="code-textarea"
                  style={{ minHeight: '220px' }}
                  placeholder="Nhập chuỗi văn bản cần mã hóa HOẶC dán chuỗi Base64 cần giải mã..."
                  value={b64TextInput}
                  onChange={(e) => setB64TextInput(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn-primary" onClick={handleB64EncodeText} style={{ flex: 1, justifyContent: 'center' }}>
                    Mã Hóa (Encode)
                  </button>
                  <button className="btn-secondary" onClick={handleB64DecodeText} style={{ flex: 1, justifyContent: 'center' }}>
                    Giải Mã (Decode)
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="dev-editor-header">
                  <span>Kết quả</span>
                  {b64TextOutput && (
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => triggerCopy(b64TextOutput, 'b64text')}
                    >
                      {copyStatus === 'b64text' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                      {copyStatus === 'b64text' ? 'Đã sao chép' : 'Sao chép'}
                    </button>
                  )}
                </div>
                <textarea
                  className="code-textarea code-output"
                  style={{ minHeight: '270px' }}
                  readOnly
                  placeholder="Văn bản đã mã hóa hoặc giải mã hiển thị ở đây..."
                  value={b64TextOutput}
                />
              </div>
            </div>
          )}

          {/* BASE64 FILE CONVERTER */}
          {b64Mode === 'file' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {!b64FileString ? (
                <div 
                  className="base64-drop"
                  onClick={() => fileInputB64Ref.current?.click()}
                >
                  <input 
                    type="file" 
                    className="hidden-file-input"
                    ref={fileInputB64Ref}
                    onChange={handleB64FileChange}
                  />
                  <Upload size={24} style={{ color: 'var(--secondary)' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem', color: 'white', marginBottom: '0.25rem' }}>Chọn file chuyển đổi</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nhấp để tải lên tệp tin bất kỳ (ảnh, pdf, v.v...) để convert sang Base64</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="pdf-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="pdf-card-info">
                      <Binary size={20} style={{ color: 'var(--secondary)' }} />
                      <div>
                        <div className="pdf-card-name" style={{ fontWeight: '600' }}>{b64FileName}</div>
                        <div className="pdf-card-meta">Đã tạo chuỗi Base64 Data URL ({formatBytes(b64FileString.length)})</div>
                      </div>
                    </div>
                    <button className="btn-icon btn-icon-danger" onClick={resetB64File}>
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="dev-editor-header">
                      <span>Chuỗi Base64 DataURL</span>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                        onClick={() => triggerCopy(b64FileString, 'b64file')}
                      >
                        {copyStatus === 'b64file' ? <Check size={14} /> : <Copy size={14} />}
                        {copyStatus === 'b64file' ? ' Đã sao chép' : ' Sao chép Data URL'}
                      </button>
                    </div>
                    <textarea
                      className="code-textarea code-output"
                      style={{ minHeight: '180px', fontSize: '0.75rem' }}
                      readOnly
                      value={b64FileString}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. QR CODE GENERATOR PANEL */}
      {subTab === 'qrcode' && (
        <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="dev-tool-grid" style={{ minHeight: '320px' }}>
            {/* Input Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="settings-group">
                <span className="settings-label">Văn bản hoặc Liên kết (URL)</span>
                <input 
                  type="text" 
                  className="text-input-field"
                  placeholder="Nhập đường dẫn tạo QR Code..."
                  value={qrText}
                  onChange={(e) => setQrText(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="settings-group" style={{ flex: 1 }}>
                  <span className="settings-label">Màu điểm mã (Foreground)</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="color" 
                      value={qrColorDark}
                      onChange={(e) => setQrColorDark(e.target.value)}
                      style={{ width: '36px', height: '36px', border: 'none', background: 'none', cursor: 'pointer' }}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{qrColorDark}</span>
                  </div>
                </div>
                
                <div className="settings-group" style={{ flex: 1 }}>
                  <span className="settings-label">Màu nền (Background)</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="color" 
                      value={qrColorLight}
                      onChange={(e) => setQrColorLight(e.target.value)}
                      style={{ width: '36px', height: '36px', border: 'none', background: 'none', cursor: 'pointer' }}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{qrColorLight}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Render Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
              {qrDataUrl ? (
                <>
                  <div className="qr-preview-box">
                    <img src={qrDataUrl} alt="QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
                  </div>
                  <button className="btn-primary" onClick={downloadQrCode} style={{ marginTop: '0.5rem' }}>
                    <Download size={16} /> Tải Ảnh QR Code (PNG)
                  </button>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nhập nội dung để tạo QR Code</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
