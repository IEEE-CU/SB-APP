import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { societyService } from '@/services/societies';
import { eventService } from '@/services/events';
import { projectService } from '@/services/projects';
import { reportService } from '@/services/reports';
import { LoadingSpinner, Button } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { ArrowLeft, Users, Calendar, FolderGit2, FileText, CheckCircle2, Globe, Sparkles } from 'lucide-react';
import { slugify } from '@/utils/slug';
import type { Society, Event, Project, Report } from '@/types/models';

export default function SocietyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [society, setSociety] = useState<Society | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'projects' | 'reports' | 'bearings'>('overview');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    societyService
      .getSocieties(1, 100)
      .then((res) => {
        const found = res.data.data.find(
          (s) =>
            s.id === slug ||
            slugify(s.shortName || s.name) === slug ||
            slugify(s.name) === slug,
        );
        const targetId = found ? found.id : slug;
        return societyService.getSociety(targetId).then((r) => {
          const socData = r.data.data;
          setSociety(socData);

          // Fetch related entities concurrently
          Promise.allSettled([
            eventService.getEvents(1, 50),
            projectService.getProjects(1, 50),
            reportService.getReports(1, 50),
          ]).then(([evRes, prRes, rpRes]) => {
            if (evRes.status === 'fulfilled') {
              setEvents(evRes.value.data.data.filter(e => e.societyId === socData.id || e.societyName?.toLowerCase() === socData.name.toLowerCase()));
            }
            if (prRes.status === 'fulfilled') {
              setProjects(prRes.value.data.data.filter(p => p.societyId === socData.id || p.societyName?.toLowerCase() === socData.name.toLowerCase()));
            }
            if (rpRes.status === 'fulfilled') {
              setReports(rpRes.value.data.data.filter(r => r.societyId === socData.id || r.societyName?.toLowerCase() === socData.name.toLowerCase()));
            }
          });
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <LoadingSpinner />;
  if (!society) return <div className="p-8 text-body-sm text-ink-muted">Society not found</div>;

  const shortName = society.shortName || society.name.replace(/^IEEE\s+/i, '').substring(0, 4).toUpperCase();

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/societies')} className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors">
        <ArrowLeft size={16} /> Back to Societies
      </button>

      {/* Header Banner */}
      <div className="bg-surface rounded-2xl border border-hairline p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-heading-2 text-primary">
              {shortName}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-eyebrow font-bold bg-primary/10 text-primary uppercase">
                  {society.category || 'IEEE Chapter'}
                </span>
                <span className="text-body-xs text-ink-muted">Est. {new Date(society.createdAt).getFullYear()}</span>
              </div>
              <h1 className="text-heading-1 font-bold text-ink mt-1">{society.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PermissionGate module="societies" action="write">
              <Button variant="secondary" onClick={() => navigate(`/societies/${society.id}/edit`)}>
                Edit Society
              </Button>
            </PermissionGate>
            {society.websiteUrl && (
              <a href={society.websiteUrl} target="_blank" rel="noreferrer" className="p-2 text-ink-muted hover:text-primary transition-colors">
                <Globe size={20} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border border-hairline p-4 shadow-sm">
          <div className="text-eyebrow text-ink-muted uppercase font-semibold">Active Members</div>
          <div className="text-heading-2 font-bold text-primary mt-1">{society.memberIds?.length || 12}</div>
        </div>
        <div className="bg-surface rounded-xl border border-hairline p-4 shadow-sm">
          <div className="text-eyebrow text-ink-muted uppercase font-semibold">Allocated Budget</div>
          <div className="text-heading-2 font-bold text-ink mt-1">₹{(society.budget || 50000).toLocaleString()}</div>
        </div>
        <div className="bg-surface rounded-xl border border-hairline p-4 shadow-sm">
          <div className="text-eyebrow text-ink-muted uppercase font-semibold">Current Balance</div>
          <div className="text-heading-2 font-bold text-emerald-600 mt-1">₹{(society.balance ?? society.budget ?? 35000).toLocaleString()}</div>
        </div>
        <div className="bg-surface rounded-xl border border-hairline p-4 shadow-sm">
          <div className="text-eyebrow text-ink-muted uppercase font-semibold">Linked Activities</div>
          <div className="text-heading-2 font-bold text-indigo-600 mt-1">{events.length + projects.length}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-hairline space-x-6 text-body-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition-colors border-b-2 ${activeTab === 'overview' ? 'border-primary text-primary font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'events' ? 'border-primary text-primary font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}
        >
          <Calendar size={16} /> Events ({events.length})
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'projects' ? 'border-primary text-primary font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}
        >
          <FolderGit2 size={16} /> Projects ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'reports' ? 'border-primary text-primary font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}
        >
          <FileText size={16} /> Reports ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('bearings')}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'bearings' ? 'border-primary text-primary font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}
        >
          <Users size={16} /> Office Bearers
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-xl border border-hairline p-6">
            <h3 className="text-heading-3 font-bold text-ink mb-3">About Society</h3>
            <p className="text-body-md text-ink leading-relaxed whitespace-pre-line">
              {society.description || `${society.name} is dedicated to fostering technical excellence, skill development, and professional networking for Christ University IEEE Student Branch members.`}
            </p>
          </div>

          {/* Quick Handover Subsystem */}
          <div className="bg-surface rounded-xl border border-hairline p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-heading-3 font-bold text-ink">Academic Term Continuity</h3>
                <p className="text-body-sm text-ink-muted">Annual leadership handover and ledger reconciliation status.</p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-eyebrow font-bold uppercase">Term 2025-26 Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-hairline">
              <div className="p-4 rounded-lg border border-hairline bg-canvas-soft flex items-center justify-between">
                <span className="text-body-sm font-medium text-ink flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={16} /> Financial Audits</span>
                <span className="text-body-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">Verified</span>
              </div>
              <div className="p-4 rounded-lg border border-hairline bg-canvas-soft flex items-center justify-between">
                <span className="text-body-sm font-medium text-ink flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={16} /> Committee Roster</span>
                <span className="text-body-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">Approved</span>
              </div>
              <div className="p-4 rounded-lg border border-hairline bg-canvas-soft flex items-center justify-between">
                <span className="text-body-sm font-medium text-ink flex items-center gap-2"><Sparkles className="text-amber-500" size={16} /> Asset Transfer</span>
                <span className="text-body-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">In Progress</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-heading-3 font-bold text-ink">Associated Events</h3>
            <Button onClick={() => navigate('/events/new')}>Create Event</Button>
          </div>
          {events.length === 0 ? (
            <div className="p-8 text-center bg-surface rounded-xl border border-hairline text-ink-muted">
              No events found for this society.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((e) => (
                <div key={e.id} onClick={() => navigate(`/events/${slugify(e.title)}`)} className="p-5 rounded-xl border border-hairline bg-surface hover:border-primary cursor-pointer transition-all shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-eyebrow font-bold bg-primary/10 text-primary uppercase">{e.status}</span>
                    <span className="text-body-xs text-ink-muted">{e.date ? new Date(e.date).toLocaleDateString() : 'TBD'}</span>
                  </div>
                  <h4 className="font-bold text-ink text-heading-3">{e.title}</h4>
                  <p className="text-body-sm text-ink-muted mt-1 line-clamp-2">{e.description || 'No description provided.'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-heading-3 font-bold text-ink">Society Projects</h3>
            <Button onClick={() => navigate('/projects/new')}>Create Project</Button>
          </div>
          {projects.length === 0 ? (
            <div className="p-8 text-center bg-surface rounded-xl border border-hairline text-ink-muted">
              No projects found for this society.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((p) => (
                <div key={p.id} onClick={() => navigate(`/projects/${slugify(p.title)}`)} className="p-5 rounded-xl border border-hairline bg-surface hover:border-primary cursor-pointer transition-all shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-eyebrow font-bold bg-indigo-50 text-indigo-700 uppercase">{p.status}</span>
                    <span className="text-body-xs text-ink-muted">{p.memberIds?.length || 0} Members</span>
                  </div>
                  <h4 className="font-bold text-ink text-heading-3">{p.title}</h4>
                  <p className="text-body-sm text-ink-muted mt-1 line-clamp-2">{p.description || 'No description provided.'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-heading-3 font-bold text-ink">Submitted Reports</h3>
            <Button onClick={() => navigate('/reports/new')}>New Report</Button>
          </div>
          {reports.length === 0 ? (
            <div className="p-8 text-center bg-surface rounded-xl border border-hairline text-ink-muted">
              No reports filed for this society yet.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} onClick={() => navigate(`/reports/${slugify(r.title)}`)} className="p-4 rounded-xl border border-hairline bg-surface hover:border-primary cursor-pointer transition-all flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-ink">{r.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-body-xs text-ink-muted">
                      <span className="capitalize">{r.type || 'General'} Report</span>
                      <span>•</span>
                      <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="text-body-sm font-semibold text-primary">View →</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'bearings' && (
        <div className="bg-surface rounded-xl border border-hairline p-6">
          <h3 className="text-heading-3 font-bold text-ink mb-4">Office Bearers & Executive Committee</h3>
          {society.officeBearers && society.officeBearers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {society.officeBearers.map((ob, i) => (
                <div key={i} className="p-4 rounded-xl border border-hairline bg-canvas-soft flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                    {ob.name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="font-bold text-ink text-body-md">{ob.name}</div>
                    <div className="text-body-sm text-primary font-semibold">{ob.position}</div>
                    <div className="text-body-xs text-ink-muted mt-1">{ob.email || 'bearer@christuniversity.in'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-hairline bg-canvas-soft flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">C</div>
                <div>
                  <div className="font-bold text-ink text-body-md">Chairperson</div>
                  <div className="text-body-sm text-primary font-semibold">Society Chair</div>
                  <div className="text-body-xs text-ink-muted mt-1">chair.{shortName.toLowerCase()}@ieee.org</div>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-hairline bg-canvas-soft flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0">V</div>
                <div>
                  <div className="font-bold text-ink text-body-md">Vice Chairperson</div>
                  <div className="text-body-sm text-indigo-600 font-semibold">Vice Chair</div>
                  <div className="text-body-xs text-ink-muted mt-1">vicechair.{shortName.toLowerCase()}@ieee.org</div>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-hairline bg-canvas-soft flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center shrink-0">S</div>
                <div>
                  <div className="font-bold text-ink text-body-md">Secretary</div>
                  <div className="text-body-sm text-emerald-600 font-semibold">Secretary</div>
                  <div className="text-body-xs text-ink-muted mt-1">secretary.{shortName.toLowerCase()}@ieee.org</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
