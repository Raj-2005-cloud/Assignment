import { LogOut, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useCallback } from 'react';

interface HeaderProps {
  onSearch?: (query: string) => void;
}

export default function Header({ onSearch }: HeaderProps) {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearch?.(searchQuery);
    },
    [searchQuery, onSearch]
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-dark-200 bg-white/80 px-6 backdrop-blur-md">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
        <input
          type="text"
          placeholder="Search emails by subject, recipient..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            // Debounced search
            if (onSearch) {
              const timeout = setTimeout(() => onSearch(e.target.value), 500);
              return () => clearTimeout(timeout);
            }
          }}
          className="w-full rounded-lg border border-dark-200 bg-dark-50 py-2 pl-9 pr-4 text-sm text-dark-800 placeholder:text-dark-400 transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </form>

      {/* User Info */}
      <div className="flex items-center gap-4 ml-6">
        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-8 w-8 rounded-full ring-2 ring-dark-100"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-dark-800">{user?.name}</p>
            <p className="text-xs text-dark-400">{user?.email}</p>
          </div>
        </div>

        <div className="h-6 w-px bg-dark-200" />

        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-dark-500 transition-colors hover:bg-dark-100 hover:text-dark-700"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
