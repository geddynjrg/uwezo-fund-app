import type { ReactNode } from 'react';

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
};

export function SearchBar({ value, onChange, placeholder = 'Search…', children }: SearchBarProps) {
  return (
    <div className="lms-tools">
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Search"
      />
      {children}
    </div>
  );
}
