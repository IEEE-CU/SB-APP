import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-surface rounded-xl shadow-elevated w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3 className="text-heading-3 font-bold text-ink">{title}</h3>
          )}
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink p-1 rounded-md hover:bg-canvas-soft"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
