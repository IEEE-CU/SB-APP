import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';

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
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
    </div>
  );
}
