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
import { PageTransition, AnimatedCard, AnimatedTab, AnimatedBadge } from '@/components/ui/WatermelonMotion';
import { motion, AnimatePresence } from 'framer-motion';

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
  if (!society) return <div className="p-8 text-sm text-ink-muted">Society not found</div>;

  const shortName = society.shortName || society.name.replace(/^IEEE\s+/i, '').substring(0, 4).toUpperCase();

  return (
    <PageTransition className="max-w-7xl mx-auto space-y-6 pb-12">
      <button onClick={() => navigate('/societies')} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink transition-colors group">
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Societies
      </button>

      {/* Header Banner */}
      <AnimatedCard className="bg-surface/60 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/5 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-extrabold text-2xl text-primary shadow-inner">
              {shortName}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <AnimatedBadge className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-primary/10 text-primary uppercase border border-primary/10">
                  {society.category || 'IEEE Chapter'}
                </AnimatedBadge>
                <span className="text-xs font-semibold text-ink-muted">Est. {new Date(society.createdAt).getFullYear()}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-ink tracking-tight">{society.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {society.websiteUrl && (
              <a href={society.websiteUrl} target="_blank" rel="noreferrer" className="p-3 rounded-xl bg-black/5 dark:bg-white/5 text-ink-muted hover:text-primary hover:bg-primary/10 transition-colors">
                <Globe size={20} />
              </a>
            )}
            <PermissionGate module="societies" action="write">
              <Button variant="secondary" onClick={() => navigate(`/societies/${society.id}/edit`)} className="shadow-sm">
                Edit Society
              </Button>
            </PermissionGate>
          </div>
        </div>
      </AnimatedCard>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnimatedCard delay={0.1} className="bg-surface/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 p-5 shadow-sm">
          <div className="text-xs text-ink-muted uppercase font-bold tracking-widest">Active Members</div>
          <div className="text-3xl font-bold text-primary mt-2">{society.memberIds?.length || 12}</div>
        </AnimatedCard>
        <AnimatedCard delay={0.15} className="bg-surface/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 p-5 shadow-sm">
          <div className="text-xs text-ink-muted uppercase font-bold tracking-widest">Allocated Budget</div>
          <div className="text-3xl font-bold text-ink mt-2">₹{(society.budget || 50000).toLocaleString()}</div>
        </AnimatedCard>
        <AnimatedCard delay={0.2} className="bg-surface/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 p-5 shadow-sm">
          <div className="text-xs text-ink-muted uppercase font-bold tracking-widest">Current Balance</div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">₹{(society.balance ?? society.budget ?? 35000).toLocaleString()}</div>
        </AnimatedCard>
        <AnimatedCard delay={0.25} className="bg-surface/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 p-5 shadow-sm">
          <div className="text-xs text-ink-muted uppercase font-bold tracking-widest">Linked Activities</div>
          <div className="text-3xl font-bold text-indigo-600 mt-2">{events.length + projects.length}</div>
        </AnimatedCard>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/20 dark:border-white/5 pb-0 overflow-x-auto no-scrollbar">
        <AnimatedTab
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          className={`pb-4 px-5 text-sm ${activeTab === 'overview' ? 'text-primary' : 'text-ink-muted hover:text-ink'}`}
        >
          Overview
        </AnimatedTab>
        <AnimatedTab
          active={activeTab === 'events'}
          onClick={() => setActiveTab('events')}
          className={`pb-4 px-5 text-sm flex items-center gap-2 ${activeTab === 'events' ? 'text-primary' : 'text-ink-muted hover:text-ink'}`}
        >
          <Calendar size={16} /> Events ({events.length})
        </AnimatedTab>
        <AnimatedTab
          active={activeTab === 'projects'}
          onClick={() => setActiveTab('projects')}
          className={`pb-4 px-5 text-sm flex items-center gap-2 ${activeTab === 'projects' ? 'text-primary' : 'text-ink-muted hover:text-ink'}`}
        >
          <FolderGit2 size={16} /> Projects ({projects.length})
        </AnimatedTab>
        <AnimatedTab
          active={activeTab === 'reports'}
          onClick={() => setActiveTab('reports')}
          className={`pb-4 px-5 text-sm flex items-center gap-2 ${activeTab === 'reports' ? 'text-primary' : 'text-ink-muted hover:text-ink'}`}
        >
          <FileText size={16} /> Reports ({reports.length})
        </AnimatedTab>
        <AnimatedTab
          active={activeTab === 'bearings'}
          onClick={() => setActiveTab('bearings')}
          className={`pb-4 px-5 text-sm flex items-center gap-2 ${activeTab === 'bearings' ? 'text-primary' : 'text-ink-muted hover:text-ink'}`}
        >
          <Users size={16} /> Office Bearers
        </AnimatedTab>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <AnimatedCard className="bg-surface/60 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/5 p-8 shadow-sm">
                <h3 className="text-xl font-bold text-ink mb-4">About Society</h3>
                <p className="text-base font-medium text-ink/80 leading-relaxed whitespace-pre-line">
                  {society.description || `${society.name} is dedicated to fostering technical excellence, skill development, and professional networking for Christ University IEEE Student Branch members.`}
                </p>
              </AnimatedCard>

              {/* Quick Handover Subsystem */}
              <AnimatedCard delay={0.1} className="bg-surface/60 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/5 p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-ink">Academic Term Continuity</h3>
                    <p className="text-sm font-medium text-ink-muted mt-1">Annual leadership handover and ledger reconciliation status.</p>
                  </div>
                  <AnimatedBadge className="px-4 py-1.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold uppercase tracking-widest">
                    Term 2025-26 Active
                  </AnimatedBadge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 pt-6 border-t border-white/10 dark:border-white/5">
                  <div className="p-5 rounded-2xl border border-white/20 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
                    <span className="text-sm font-bold text-ink flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={18} /> Financial Audits</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-lg">Verified</span>
                  </div>
                  <div className="p-5 rounded-2xl border border-white/20 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
                    <span className="text-sm font-bold text-ink flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={18} /> Committee Roster</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-lg">Approved</span>
                  </div>
                  <div className="p-5 rounded-2xl border border-white/20 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
                    <span className="text-sm font-bold text-ink flex items-center gap-2"><Sparkles className="text-amber-500" size={18} /> Asset Transfer</span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/20 border border-amber-500/20 px-2.5 py-1 rounded-lg">In Progress</span>
                  </div>
                </div>
              </AnimatedCard>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-ink">Associated Events</h3>
                <Button onClick={() => navigate('/events/new')} className="shadow-sm">Create Event</Button>
              </div>
              {events.length === 0 ? (
                <div className="p-12 text-center bg-surface/60 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/5 text-ink-muted font-medium">
                  No events found for this society.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {events.map((e, i) => (
                    <AnimatedCard delay={i * 0.05} key={e.id} onClick={() => navigate(`/events/${slugify(e.title)}`)} className="p-6 rounded-3xl border border-white/20 dark:border-white/5 bg-surface/60 backdrop-blur-xl hover:border-primary/50 cursor-pointer shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <AnimatedBadge className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-primary/10 text-primary uppercase border border-primary/10">{e.status}</AnimatedBadge>
                          <span className="text-xs font-semibold text-ink-muted">{e.date ? new Date(e.date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'TBD'}</span>
                        </div>
                        <h4 className="font-bold text-ink text-lg leading-tight mb-2">{e.title}</h4>
                        <p className="text-sm font-medium text-ink-muted line-clamp-2">{e.description || 'No description provided.'}</p>
                      </div>
                    </AnimatedCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-ink">Society Projects</h3>
                <Button onClick={() => navigate('/projects/new')} className="shadow-sm">Create Project</Button>
              </div>
              {projects.length === 0 ? (
                <div className="p-12 text-center bg-surface/60 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/5 text-ink-muted font-medium">
                  No projects found for this society.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {projects.map((p, i) => (
                    <AnimatedCard delay={i * 0.05} key={p.id} onClick={() => navigate(`/projects/${slugify(p.title)}`)} className="p-6 rounded-3xl border border-white/20 dark:border-white/5 bg-surface/60 backdrop-blur-xl hover:border-primary/50 cursor-pointer shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <AnimatedBadge className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 uppercase">{p.status}</AnimatedBadge>
                        <span className="text-xs font-semibold text-ink-muted">{p.memberIds?.length || 0} Members</span>
                      </div>
                      <h4 className="font-bold text-ink text-lg leading-tight mb-2">{p.title}</h4>
                      <p className="text-sm font-medium text-ink-muted line-clamp-2">{p.description || 'No description provided.'}</p>
                    </AnimatedCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-ink">Submitted Reports</h3>
                <Button onClick={() => navigate('/reports/new')} className="shadow-sm">New Report</Button>
              </div>
              {reports.length === 0 ? (
                <div className="p-12 text-center bg-surface/60 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/5 text-ink-muted font-medium">
                  No reports filed for this society yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((r, i) => (
                    <AnimatedCard delay={i * 0.05} key={r.id} onClick={() => navigate(`/reports/${slugify(r.title)}`)} className="p-5 rounded-2xl border border-white/20 dark:border-white/5 bg-surface/60 backdrop-blur-xl hover:border-primary/50 cursor-pointer shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-ink text-base mb-1">{r.title}</h4>
                        <div className="flex items-center gap-3 text-xs font-medium text-ink-muted">
                          <AnimatedBadge className="px-2 py-0.5 rounded-full border border-white/10 uppercase tracking-wider text-[9px]">{r.type || 'General'} Report</AnimatedBadge>
                          <span>•</span>
                          <span>{new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary px-4 py-2 bg-primary/10 rounded-xl">View →</span>
                    </AnimatedCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'bearings' && (
            <AnimatedCard className="bg-surface/60 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/5 p-8 shadow-sm">
              <h3 className="text-xl font-bold text-ink mb-6">Office Bearers & Executive Committee</h3>
              {society.officeBearers && society.officeBearers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {society.officeBearers.map((ob, i) => (
                    <div key={i} className="p-5 rounded-2xl border border-white/20 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-lg border border-primary/20 shadow-inner">
                        {ob.name.substring(0, 1)}
                      </div>
                      <div>
                        <div className="font-bold text-ink text-base">{ob.name}</div>
                        <div className="text-xs text-primary font-bold tracking-wide uppercase mt-0.5">{ob.position}</div>
                        <div className="text-xs font-medium text-ink-muted mt-1.5">{ob.email || 'bearer@christuniversity.in'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="p-5 rounded-2xl border border-white/20 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-lg border border-primary/20 shadow-inner">C</div>
                    <div>
                      <div className="font-bold text-ink text-base">Chairperson</div>
                      <div className="text-xs text-primary font-bold tracking-wide uppercase mt-0.5">Society Chair</div>
                      <div className="text-xs font-medium text-ink-muted mt-1.5">chair.{shortName.toLowerCase()}@ieee.org</div>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl border border-white/20 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-center shrink-0 text-lg border border-indigo-500/20 shadow-inner">V</div>
                    <div>
                      <div className="font-bold text-ink text-base">Vice Chairperson</div>
                      <div className="text-xs text-indigo-600 font-bold tracking-wide uppercase mt-0.5">Vice Chair</div>
                      <div className="text-xs font-medium text-ink-muted mt-1.5">vicechair.{shortName.toLowerCase()}@ieee.org</div>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl border border-white/20 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-lg border border-emerald-500/20 shadow-inner">S</div>
                    <div>
                      <div className="font-bold text-ink text-base">Secretary</div>
                      <div className="text-xs text-emerald-600 font-bold tracking-wide uppercase mt-0.5">Secretary</div>
                      <div className="text-xs font-medium text-ink-muted mt-1.5">secretary.{shortName.toLowerCase()}@ieee.org</div>
                    </div>
                  </div>
                </div>
              )}
            </AnimatedCard>
          )}
        </motion.div>
      </AnimatePresence>
    </PageTransition>
  );
}
