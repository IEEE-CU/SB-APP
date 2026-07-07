import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Calendar,
  FolderKanban,
  FileText,
  Megaphone,
  MessageCircle,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', module: null },
  {
    to: '/societies',
    icon: Building2,
    label: 'Societies',
    module: 'societies',
  },
  { to: '/events', icon: Calendar, label: 'Events', module: 'events' },
  {
    to: '/projects',
    icon: FolderKanban,
    label: 'Projects',
    module: 'projects',
  },
  { to: '/reports', icon: FileText, label: 'Reports', module: 'reports' },
  {
    to: '/announcements',
    icon: Megaphone,
    label: 'Announcements',
    module: 'announcements',
  },
  {
    to: '/community',
    icon: MessageCircle,
    label: 'Community Hub',
    module: 'community',
  },
];

const adminItems = [
  { to: '/admin/users', icon: Users, label: 'Users', module: 'users' },
];

const levels: Record<string, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
  superadmin: 4,
};

export default function Sidebar() {
  const { permissions } = useAuthStore();

  const canAccess = (module: string | null) => {
    if (!module) return true;
    const perm = permissions.find((p) => p.module === module);
    return (levels[perm?.accessLevel || 'none'] || 0) >= 1;
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-md text-body-sm transition-colors ${
      isActive
        ? 'bg-primary/10 text-primary font-medium'
        : 'text-ink-secondary hover:bg-canvas-soft hover:text-ink'
    }`;

  return (
    <aside className="w-56 bg-surface border-r border-hairline flex flex-col py-4">
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) =>
          canAccess(item.module) ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={linkClass}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ) : null,
        )}
      </nav>
      {adminItems.some((item) => canAccess(item.module)) && (
        <div className="mt-auto pt-4 border-t border-hairline px-3">
          <p className="text-eyebrow text-ink-faint uppercase px-4 mb-2">
            Admin
          </p>
          {adminItems.map((item) =>
            canAccess(item.module) ? (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ) : null,
          )}
        </div>
      )}
    </aside>
  );
}
