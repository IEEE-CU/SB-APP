import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { userService } from '@/services/users';
import { Button, Interactive3DCard } from '@/components/ui';
import toast from 'react-hot-toast';

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
    <div>
      <h1 className="text-heading-1 font-bold text-ink mb-6">Profile</h1>
      <Interactive3DCard className="p-6 max-w-lg space-y-5" maxRotation={5}>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Name</label>
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          ) : (
            <p className="text-body-md text-ink mt-1">{user?.name || '—'}</p>
          )}
        </div>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Email</label>
          <p className="text-body-md text-ink mt-1">{user?.email || '—'}</p>
        </div>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Status</label>
          <p className="text-body-md text-ink mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-eyebrow bg-accent-green/10 text-accent-green">
              Active
            </span>
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          {editing ? (
            <>
              <Button onClick={handleSave} loading={saving}>Save</Button>
              <Button variant="secondary" onClick={() => { setEditing(false); setName(user?.name || ''); }}>Cancel</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>Edit Profile</Button>
              <Button variant="ghost" onClick={() => navigate('/change-password')}>Change Password</Button>
            </>
          )}
        </div>
      </Interactive3DCard>
    </div>
  );
}
