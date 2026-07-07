import { Building2, Calendar, FolderKanban, FileText } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import PermissionGate from '@/components/PermissionGate';

const stats = [
  { module: 'societies', label: 'Societies', icon: Building2, color: 'text-accent-teal' },
  { module: 'events', label: 'Events', icon: Calendar, color: 'text-accent-purple' },
  { module: 'projects', label: 'Projects', icon: FolderKanban, color: 'text-accent-orange' },
  { module: 'reports', label: 'Reports', icon: FileText, color: 'text-primary' },
];

export default function DashboardPage() {
  const { hasAccess } = usePermissions();

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-ink mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <PermissionGate key={stat.module} module={stat.module} action="read">
            <div className="bg-surface rounded-lg border border-hairline p-6 hover:shadow-soft-1 transition-shadow">
              <stat.icon size={24} className={`${stat.color} mb-3`} />
              <h3 className="text-title font-semibold text-ink">{stat.label}</h3>
              <p className="text-body-sm text-ink-muted mt-1">
                {hasAccess(stat.module, 'write') ? 'Full access' : 'Read only'}
              </p>
            </div>
          </PermissionGate>
        ))}
      </div>
      {!hasAccess('societies', 'read') &&
        !hasAccess('events', 'read') &&
        !hasAccess('projects', 'read') &&
        !hasAccess('reports', 'read') && (
          <div className="mt-8 bg-surface rounded-xl p-8 text-center border border-hairline">
            <p className="text-heading-3 font-bold text-ink mb-2">
              Welcome to IEEE Finance Pro
            </p>
            <p className="text-body-sm text-ink-muted">
              Contact your administrator to get access to modules.
            </p>
          </div>
        )}
    </div>
  );
}
