import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function CustomSelect({ options, value, onChange, placeholder = 'Chọn tùy chọn...' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const activeOption = options.find(opt => opt.value === value);

  const handleSelectOption = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div className="custom-select-container" ref={containerRef}>
      {/* Trigger Button */}
      <div 
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{activeOption ? activeOption.label : placeholder}</span>
        <ChevronDown size={16} className={`custom-select-chevron ${isOpen ? 'open' : ''}`} />
      </div>

      {/* Options List Dropdown */}
      <div className={`custom-select-options ${isOpen ? 'show' : ''}`}>
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <div
              key={opt.value}
              className={`custom-select-option ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelectOption(opt.value)}
            >
              <span>{opt.label}</span>
              {isSelected && <Check size={14} style={{ color: 'var(--primary)' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
