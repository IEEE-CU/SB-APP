import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { reportService } from '@/services/reports';
import { Button, LoadingSpinner } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { ArrowLeft } from 'lucide-react';
import type { Report } from '@/types/models';
import toast from 'react-hot-toast';

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    reportService.getReport(id).then((res) => setReport(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    try { await reportService.deleteReport(id); toast.success('Report deleted'); navigate('/reports'); } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <LoadingSpinner />;
  if (!report) return <div className="text-body-sm text-ink-muted">Report not found</div>;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink mb-4"><ArrowLeft size={16} /> Back</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">{report.title}</h1>
        <div className="flex gap-2">
          <PermissionGate module="reports" action="write"><Button variant="secondary" onClick={() => navigate(`/reports/${id}/edit`)}>Edit</Button></PermissionGate>
          <PermissionGate module="reports" action="delete"><Button variant="danger" onClick={handleDelete}>Delete</Button></PermissionGate>
        </div>
      </div>
      <div className="bg-surface rounded-lg border border-hairline p-6 max-w-2xl space-y-4">
        {report.type && <div><label className="text-eyebrow text-ink-muted uppercase">Type</label><p className="text-body-md text-ink mt-1 capitalize">{report.type}</p></div>}
        <div><label className="text-eyebrow text-ink-muted uppercase">Content</label><div className="text-body-md text-ink mt-1 prose max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(report.content || '') }} /></div>
      </div>
    </div>
  );
}
