import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-14 bg-surface border-b border-hairline flex items-center justify-between px-6">
      <h1 className="text-title font-semibold text-ink">IEEE Finance Pro</h1>
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-body-sm text-ink-secondary hover:text-ink transition-colors"
        >
          <User size={16} />
          <span>{user?.name || 'Profile'}</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
