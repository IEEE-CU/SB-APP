import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export default function SearchInput({
  onSearch,
  placeholder = 'Search...',
  debounceMs = 300,
}: SearchInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const debouncedSearch = useCallback(
    (query: string) => {
      const timer = setTimeout(() => onSearch(query), debounceMs);
      return () => clearTimeout(timer);
    },
    [onSearch, debounceMs],
  );

  useEffect(() => {
    const cleanup = debouncedSearch(value);
    return cleanup;
  }, [value, debouncedSearch]);

  return (
    <motion.div 
      initial={false}
      animate={{ 
        boxShadow: isFocused ? "0 0 0 3px rgba(37,99,235,0.2)" : "0 2px 5px rgba(0,0,0,0.02)",
        borderColor: isFocused ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.2)"
      }}
      className="relative flex items-center bg-surface/60 backdrop-blur-xl border dark:border-white/10 rounded-full overflow-hidden transition-colors"
    >
      <Search
        size={18}
        className={`absolute left-4 transition-colors ${isFocused ? 'text-primary' : 'text-ink-muted'}`}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="w-full pl-11 pr-4 py-2.5 bg-transparent text-sm font-medium text-ink placeholder:text-ink-muted focus:outline-none"
      />
    </motion.div>
  );
}
