import { ReactNode, useEffect, useRef } from "react";
import Portal from "./Portal";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "@/lib/motion";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={overlayRef}
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md"
            onClick={(e: React.MouseEvent) => {
              if (e.target === overlayRef.current) onClose();
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="bg-canvas-soft border border-hairline rounded-3xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] w-full max-w-md mx-4 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                {title && (
                  <h3 className="text-xl font-semibold tracking-tight text-ink">
                    {title}
                  </h3>
                )}
                <button
                  onClick={onClose}
                  className="text-ink-muted hover:text-ink p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
