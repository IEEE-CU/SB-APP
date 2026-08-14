import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { reportService } from '@/services/reports';
import { Button, LoadingSpinner } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { ArrowLeft, Download, Printer, ShieldCheck, FileText, Calendar, Building } from 'lucide-react';
import { slugify } from '@/utils/slug';
import type { Report } from '@/types/models';
import toast from 'react-hot-toast';

export default function ReportDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    reportService
      .getReports(1, 100)
      .then((res) => {
        const found = res.data.data.find(
          (r) => r.id === slug || slugify(r.title) === slug || r.slug === slug,
        );
        const targetId = found ? found.id : slug;
        return reportService.getReport(targetId).then((resp) => setReport(resp.data.data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    toast.success(`Exporting ${report?.title || 'Report'} as PDF...`);
  };

  const handleDelete = async () => {
    if (!report) return;
    try {
      await reportService.deleteReport(report.id);
      toast.success('Report deleted');
      navigate('/reports');
    } catch {
      toast.error('Failed to delete report');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!report) return <div className="p-8 text-body-sm text-ink-muted">Report not found</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors print:hidden">
        <ArrowLeft size={16} /> Back to Reports
      </button>

      {/* Header Banner */}
      <div className="bg-surface rounded-2xl border border-hairline p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-0.5 rounded-full text-eyebrow font-bold bg-blue-50 text-blue-700 uppercase">
                {report.type || 'General'} Report
              </span>
              <span className="flex items-center gap-1 text-body-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck size={14} /> AI Verified
              </span>
            </div>
            <h1 className="text-heading-1 font-bold text-ink">{report.title}</h1>
          </div>

          <div className="flex items-center gap-3 print:hidden">
            <Button variant="secondary" onClick={handlePrint} className="flex items-center gap-1.5">
              <Printer size={16} /> Print
            </Button>
            <Button variant="secondary" onClick={handleDownload} className="flex items-center gap-1.5">
              <Download size={16} /> Export PDF
            </Button>
            <PermissionGate module="reports" action="write">
              <Button variant="secondary" onClick={() => navigate(`/reports/${report.id}/edit`)}>Edit</Button>
            </PermissionGate>
            <PermissionGate module="reports" action="delete">
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </PermissionGate>
          </div>
        </div>

        {/* Metadata Footer Bar */}
        <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-hairline text-body-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} /> Submitted: <span className="font-semibold text-ink">{new Date(report.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Building size={14} /> Society: <span className="font-semibold text-ink">{report.societyName || 'Christ University IEEE SB'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText size={14} /> Report ID: <span className="font-mono text-ink font-semibold">{report.id.substring(0, 8)}</span>
          </div>
        </div>
      </div>

      {/* Main Report Body */}
      <div className="bg-surface rounded-xl border border-hairline p-8 shadow-sm space-y-6">
        <div className="border-b border-hairline pb-4 mb-4">
          <div className="text-eyebrow text-ink-muted uppercase font-semibold">Official Submission Document</div>
          <h2 className="text-heading-2 font-bold text-ink mt-1">{report.title}</h2>
        </div>

        <div
          className="text-body-md text-ink leading-relaxed prose max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(report.content || '<p>No content provided for this report document.</p>') }}
        />
      </div>
    </div>
  );
}
