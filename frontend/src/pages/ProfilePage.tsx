import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { userService } from '@/services/users';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';
import { PageTransition, AnimatedCard, AnimatedBadge } from '@/components/ui/WatermelonMotion';

export default function ProfilePage() {
  const { user, updateUserProfile } = useAuthStore();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user?.id || !name.trim()) return;
    setSaving(true);
    try {
      const res = await userService.updateUser(user.id, { name: name.trim() });
      updateUserProfile(res.data.data);
      toast.success('Profile updated');
      setEditing(false);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <h1 className="text-3xl font-extrabold text-ink tracking-tight mb-8">My Profile</h1>
      <AnimatedCard className="bg-surface/60 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/5 p-8 max-w-lg shadow-sm space-y-6">
        <div>
          <label className="text-xs text-ink-muted uppercase font-bold tracking-widest block mb-2">Name</label>
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          ) : (
            <p className="text-lg font-bold text-ink">{user?.name || '—'}</p>
          )}
        </div>
        <div>
          <label className="text-xs text-ink-muted uppercase font-bold tracking-widest block mb-2">Email</label>
          <p className="text-base font-medium text-ink">{user?.email || '—'}</p>
        </div>
        <div>
          <label className="text-xs text-ink-muted uppercase font-bold tracking-widest block mb-2">Status</label>
          <AnimatedBadge className="inline-flex px-3 py-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold uppercase tracking-widest">
            Active
          </AnimatedBadge>
        </div>
        <div className="flex gap-3 pt-4 border-t border-white/10 dark:border-white/5">
          {editing ? (
            <>
              <Button onClick={handleSave} loading={saving}>Save Changes</Button>
              <Button variant="ghost" onClick={() => { setEditing(false); setName(user?.name || ''); }}>Cancel</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>Edit Profile</Button>
              <Button variant="ghost" onClick={() => navigate('/change-password')}>Change Password</Button>
            </>
          )}
        </div>
      </AnimatedCard>
    </PageTransition>
  );
}
