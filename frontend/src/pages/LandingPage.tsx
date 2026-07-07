import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  Building2,
  Calendar,
  FolderKanban,
  FileText,
  ArrowRight,
  Check,
  Menu,
  X,
  Landmark,
  Sparkles,
  LogIn,
  LayoutDashboard,
  Plus,
  Minus,
  Sun,
  Moon
} from 'lucide-react';
import Button from '@/components/ui/Button';

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'societies' | 'events' | 'projects' | 'reports'>('societies');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Dark Mode State with LocalStorage Persistence
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const mockLedger = [
    { id: 1, date: '2026-07-06', desc: 'Component procurement - Robocon', category: 'Project Fund', amount: -250.0, badgeColor: 'bg-accent-orange/10 dark:bg-accent-orange/20 text-accent-orange' },
    { id: 2, date: '2026-07-04', desc: 'Sponsorship - Tech Corp', category: 'Income', amount: 1500.0, badgeColor: 'bg-accent-green/10 dark:bg-accent-green/20 text-accent-green' },
    { id: 3, date: '2026-07-02', desc: 'Catering - Annual Gen Assembly', category: 'Event Expense', amount: -420.5, badgeColor: 'bg-accent-purple/10 dark:bg-accent-purple/20 text-accent-purple dark:text-accent-purple' },
    { id: 4, date: '2026-06-28', desc: 'Vanguard Project Grant', category: 'Project Fund', amount: -600.0, badgeColor: 'bg-accent-orange/10 dark:bg-accent-orange/20 text-accent-orange' },
  ];

  const faqs = [
    {
      q: "What is IEEE Finance Pro?",
      a: "IEEE Finance Pro is a specialized financial management and audit tool designed for IEEE Student Branches, Chapters, and affinity groups. It replaces complex, scattered spreadsheets with a simple, collaborative system built for tracking society budgets, projects, and events."
    },
    {
      q: "Who is this platform for?",
      a: "It is built for IEEE officers: Chairs, Treasurers, and Project/Event Leads. Treasurers can manage and approve expenses, Chairs get high-level oversight of all chapters, and leads can request funding and upload receipts for their respective projects and events."
    },
    {
      q: "How does the scope and RBAC system work?",
      a: "The platform implements strict Role-Based Access Control (RBAC). A Treasurer of the Computer Society can only view and manage funds for the Computer Society, while the Student Branch Treasurer has global oversight across all societies within the branch."
    },
    {
      q: "Can we generate IEEE-compliant financial reports?",
      a: "Yes! Our platform automates the generation of standard IEEE financial templates, expense ledgers, and annual budget reports. You can download them as spreadsheets or PDFs to simplify your annual reporting and audit processes."
    },
    {
      q: "Is there support for receipt uploads?",
      a: "Absolutely. When submitting an expense or claiming reimbursement, users can upload receipts. Officers can audit the expense inline, view the receipt, and mark it as Approved, Rejected, or Request Info."
    }
  ];

  return (
    <div className="min-h-screen bg-canvas-soft text-ink font-sans flex flex-col selection:bg-primary/20 transition-colors duration-200">
      
      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-hairline transition-all">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo representing Notion-style calm icon */}
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white font-bold text-title shadow-soft-1">
              F
            </div>
            <span className="text-title font-bold tracking-tight text-ink">
              IEEE Finance Pro
            </span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-body-sm text-ink-secondary hover:text-ink font-medium transition-colors">Features</a>
            <a href="#societies" className="text-body-sm text-ink-secondary hover:text-ink font-medium transition-colors">Societies</a>
            <a href="#pricing" className="text-body-sm text-ink-secondary hover:text-ink font-medium transition-colors">Packages</a>
            <a href="#faq" className="text-body-sm text-ink-secondary hover:text-ink font-medium transition-colors">FAQ</a>
          </nav>

          {/* Action buttons */}
          <div className="hidden md:flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-md hover:bg-canvas-soft text-ink-secondary transition-colors"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {isAuthenticated ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 group"
              >
                <LayoutDashboard size={16} />
                <span>Go to Dashboard</span>
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Button>
            ) : (
              <>
                <Link to="/login" className="flex items-center gap-1.5 text-body-sm text-ink-secondary hover:text-ink font-medium transition-colors py-1.5 px-3 rounded-md hover:bg-canvas-soft">
                  <LogIn size={16} />
                  <span>Log in</span>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="md">Get started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-md hover:bg-canvas-soft text-ink-secondary transition-colors"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-md hover:bg-canvas-soft text-ink-secondary"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-hairline bg-surface px-6 py-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200">
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-body-md text-ink-secondary py-2"
            >
              Features
            </a>
            <a 
              href="#societies" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-body-md text-ink-secondary py-2"
            >
              Societies
            </a>
            <a 
              href="#pricing" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-body-md text-ink-secondary py-2"
            >
              Packages
            </a>
            <a 
              href="#faq" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-body-md text-ink-secondary py-2"
            >
              FAQ
            </a>
            <hr className="border-hairline" />
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/dashboard');
                }}
                className="w-full flex items-center justify-center gap-2"
              >
                <LayoutDashboard size={16} />
                <span>Go to Dashboard</span>
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Link 
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-body-md font-medium text-ink-secondary border border-hairline rounded-full hover:bg-canvas-soft"
                >
                  Log in
                </Link>
                <Link 
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full"
                >
                  <Button variant="primary" size="md" className="w-full">Get started</Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="bg-canvas text-ink relative overflow-hidden py-20 lg:py-28 border-b border-hairline">
        {/* Minimal connecting constellation line art in black/white */}
        <div className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <circle cx="15%" cy="30%" r="2" fill="currentColor" />
            <circle cx="35%" cy="75%" r="1.5" fill="currentColor" />
            <circle cx="50%" cy="20%" r="2" fill="currentColor" />
            <circle cx="70%" cy="65%" r="1.5" fill="currentColor" />
            <circle cx="85%" cy="35%" r="2" fill="currentColor" />
            <path d="M 15% 30% L 50% 20% L 85% 35% M 35% 75% L 70% 65%" stroke="currentColor" strokeWidth="0.75" strokeDasharray="4,4" fill="none" />
          </svg>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto flex flex-col items-center">
            
            {/* Tagline badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-eyebrow font-medium mb-6 border border-primary/20 backdrop-blur-sm">
              <Sparkles size={12} className="text-accent-sky" />
              <span>Quiet Financial Control for Student Branches</span>
            </div>

            {/* Display-1 Confident Headline */}
            <h1 className="text-display-2 sm:text-display-1 font-bold leading-none tracking-tighter text-ink">
              Meet the night shift for IEEE financial tracking
            </h1>

            {/* Subhead */}
            <p className="text-body-md text-ink-secondary mt-6 max-w-xl leading-relaxed">
              A warm, paper-calm workspace built specifically for technical societies, affinity groups, and projects. No more scattered spreadsheet ledgers or messy audit trails.
            </p>

            {/* Action buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto shadow-elevated bg-primary text-white hover:bg-primary-active flex items-center justify-center gap-2 group"
                >
                  <span>Go to Workspace</span>
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Button>
              ) : (
                <>
                  <Link to="/register" className="w-full sm:w-auto">
                    <Button variant="primary" size="lg" className="w-full sm:w-auto shadow-elevated">
                      Get Started Free
                    </Button>
                  </Link>
                  <a href="#features" className="w-full sm:w-auto">
                    <button className="w-full sm:w-auto px-6 py-2.5 text-button font-medium rounded-full bg-surface text-ink hover:bg-canvas-soft border border-hairline shadow-soft-1 transition-colors flex items-center justify-center gap-1.5">
                      Explore Features
                    </button>
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Interactive UI Mockup (styled with shadow-elevated as per DESIGN.md) */}
          <div className="mt-16 w-full max-w-4xl mx-auto bg-surface rounded-xl shadow-elevated border border-hairline overflow-hidden text-ink animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Header Chrome */}
            <div className="bg-canvas-soft border-b border-hairline px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
                <span className="w-3 h-3 rounded-full bg-[#27c93f]"></span>
                <span className="text-caption text-ink-muted ml-3 font-mono select-none">finance.ieee-sb.org/dashboard</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-20 h-1.5 rounded-full bg-ink-faint/30"></div>
                <div className="w-10 h-1.5 rounded-full bg-ink-faint/20"></div>
              </div>
            </div>

            {/* Mock Dashboard Layout */}
            <div className="flex flex-col md:flex-row h-[360px] bg-surface">
              {/* Mock Sidebar */}
              <div className="w-full md:w-48 bg-canvas-soft border-r border-hairline p-4 hidden md:flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div className="w-5 h-5 rounded bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">SB</div>
                    <span className="text-body-sm font-semibold">IEEE Branch</span>
                  </div>
                  <nav className="space-y-1">
                    <span className="flex items-center gap-2 px-2 py-1.5 rounded bg-primary/10 text-primary text-body-sm font-medium">
                      <LayoutDashboard size={14} /> Ledger
                    </span>
                    <span className="flex items-center gap-2 px-2 py-1.5 text-ink-secondary text-body-sm hover:bg-surface rounded">
                      <Building2 size={14} /> Societies
                    </span>
                    <span className="flex items-center gap-2 px-2 py-1.5 text-ink-secondary text-body-sm hover:bg-surface rounded">
                      <Calendar size={14} /> Events
                    </span>
                    <span className="flex items-center gap-2 px-2 py-1.5 text-ink-secondary text-body-sm hover:bg-surface rounded">
                      <FolderKanban size={14} /> Projects
                    </span>
                    <span className="flex items-center gap-2 px-2 py-1.5 text-ink-secondary text-body-sm hover:bg-surface rounded">
                      <FileText size={14} /> Reports
                    </span>
                  </nav>
                </div>
                <div className="text-[10px] text-ink-faint px-2 font-mono">
                  SECURED · v1.2
                </div>
              </div>

              {/* Mock Ledger Container */}
              <div className="flex-1 p-6 flex flex-col justify-between overflow-hidden">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-title font-bold text-ink">Active Ledger</h3>
                      <p className="text-caption text-ink-muted">General accounts of Technical Chapters</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2.5 py-1 text-caption font-medium rounded-md bg-canvas-soft border border-hairline text-ink-secondary">
                        Filter
                      </span>
                      <span className="px-2.5 py-1 text-caption font-medium rounded-md bg-primary text-white">
                        Export
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="border border-hairline p-3 rounded-lg bg-surface">
                      <div className="text-[10px] text-ink-faint font-semibold uppercase">Total Balance</div>
                      <div className="text-heading-3 font-bold text-ink mt-0.5">$3,480.20</div>
                    </div>
                    <div className="border border-hairline p-3 rounded-lg bg-surface">
                      <div className="text-[10px] text-ink-faint font-semibold uppercase">Allocated</div>
                      <div className="text-heading-3 font-bold text-accent-teal mt-0.5">$1,850.00</div>
                    </div>
                    <div className="border border-hairline p-3 rounded-lg bg-surface">
                      <div className="text-[10px] text-ink-faint font-semibold uppercase">Pending</div>
                      <div className="text-heading-3 font-bold text-accent-purple-deep mt-0.5">$420.50</div>
                    </div>
                  </div>

                  {/* Ledger Rows */}
                  <div className="border border-hairline rounded-lg overflow-hidden bg-surface">
                    <div className="bg-canvas-soft border-b border-hairline px-3 py-1.5 grid grid-cols-12 text-[10px] font-semibold text-ink-muted uppercase">
                      <div className="col-span-3">Date</div>
                      <div className="col-span-6">Description</div>
                      <div className="col-span-3 text-right">Amount</div>
                    </div>
                    <div className="divide-y divide-hairline">
                      {mockLedger.slice(0, 3).map((row) => (
                        <div key={row.id} className="px-3 py-2 grid grid-cols-12 text-caption text-ink-secondary items-center hover:bg-canvas-soft/40 transition-colors">
                          <div className="col-span-3 font-mono text-[10px]">{row.date}</div>
                          <div className="col-span-6 truncate font-medium text-ink">{row.desc}</div>
                          <div className={`col-span-3 text-right font-mono font-semibold ${row.amount > 0 ? 'text-accent-green' : 'text-ink'}`}>
                            {row.amount > 0 ? `+$${row.amount.toFixed(2)}` : `-$${Math.abs(row.amount).toFixed(2)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-ink-faint pt-2 border-t border-hairline">
                  <span>Audit Trail Active</span>
                  <span className="font-semibold text-primary">Team 5 RBAC Isolated</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURE SYSTEM & STICKER DECALS ─── */}
      <section id="features" className="py-20 lg:py-28 border-b border-hairline">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-eyebrow font-bold uppercase text-primary tracking-wider font-semibold">Features System</span>
            <h2 className="text-display-2 font-bold text-ink mt-3">
              One platform. Full financial visibility.
            </h2>
            <p className="text-body-md text-ink-muted mt-4">
              Designed specifically to meet the structure of student organizations. Assign roles, submit budgets, and generate reports under a single secure umbrella.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature Card 1 (Teal Sticker Decal) */}
            <div className="bg-surface rounded-lg border border-hairline p-6 hover:shadow-soft-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                {/* Notion-style sticker: flat, non-structural, purely decorative */}
                <div className="w-12 h-12 rounded-lg bg-accent-teal/10 text-accent-teal flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                  <Landmark size={24} />
                </div>
                <h3 className="text-heading-3 font-bold text-ink mb-2">Society Ledger</h3>
                <p className="text-body-sm text-ink-muted">
                  Keep separate balances for technical societies, affinity groups (WIE, YP), and your core student branch. Track every penny.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-body-sm font-semibold text-accent-teal">
                <span>Branch accounting</span>
              </div>
            </div>

            {/* Feature Card 2 (Purple Sticker Decal) */}
            <div className="bg-surface rounded-lg border border-hairline p-6 hover:shadow-soft-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-lg bg-accent-purple/20 text-accent-purple-deep flex items-center justify-center mb-6 group-hover:-rotate-6 transition-transform">
                  <Calendar size={24} />
                </div>
                <h3 className="text-heading-3 font-bold text-ink mb-2">Event Budgets</h3>
                <p className="text-body-sm text-ink-muted">
                  Draft budgets for workshops, annual meetings, and hackathons. Lock down ticket projections and track actual catering or speaker expenses.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-body-sm font-semibold text-accent-purple-deep">
                <span>Plan vs. actual cost</span>
              </div>
            </div>

            {/* Feature Card 3 (Orange Sticker Decal) */}
            <div className="bg-surface rounded-lg border border-hairline p-6 hover:shadow-soft-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-lg bg-accent-orange/10 text-accent-orange flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                  <FolderKanban size={24} />
                </div>
                <h3 className="text-heading-3 font-bold text-ink mb-2">Project Grants</h3>
                <p className="text-body-sm text-ink-muted">
                  Fund student projects (Robotics, Solar, Aero). Monitor milestone spending, request component reimbursements, and archive invoices.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-body-sm font-semibold text-accent-orange">
                <span>Milestone tracking</span>
              </div>
            </div>

            {/* Feature Card 4 (Primary Blue Sticker Decal) */}
            <div className="bg-surface rounded-lg border border-hairline p-6 hover:shadow-soft-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:-rotate-6 transition-transform">
                  <FileText size={24} />
                </div>
                <h3 className="text-heading-3 font-bold text-ink mb-2">Compliance Reports</h3>
                <p className="text-body-sm text-ink-muted">
                  Instantly compile transaction reports that meet IEEE Section guidelines. Exports in Excel and CSV. Saves weeks of annual auditing work.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-body-sm font-semibold text-primary">
                <span>Audits made simple</span>
              </div>
            </div>
          </div>

          {/* Interactive Feature Demo Panel */}
          <div className="mt-16 bg-surface border border-hairline rounded-xl overflow-hidden p-6 lg:p-10 shadow-soft-1">
            <div className="flex flex-col lg:flex-row gap-10 items-center">
              <div className="flex-1 space-y-6">
                <div className="inline-block px-2.5 py-1 text-[11px] font-semibold tracking-wider text-primary bg-primary/10 rounded-full uppercase">
                  Interactive Showcase
                </div>
                <h3 className="text-heading-2 font-bold text-ink leading-tight">
                  Tailored scopes for every role
                </h3>
                <p className="text-body-md text-ink-muted">
                  Our role-based isolation matches the hierarchy of your Student Branch. See exactly what you're authorized to access, with no overlapping confusion.
                </p>
                
                {/* Navigation tabs */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button 
                    onClick={() => setActiveTab('societies')}
                    className={`px-3 py-1.5 text-caption font-semibold rounded-md transition-all ${activeTab === 'societies' ? 'bg-ink text-white' : 'bg-canvas-soft text-ink-secondary border border-hairline hover:bg-hairline'}`}
                  >
                    Societies View
                  </button>
                  <button 
                    onClick={() => setActiveTab('events')}
                    className={`px-3 py-1.5 text-caption font-semibold rounded-md transition-all ${activeTab === 'events' ? 'bg-ink text-white' : 'bg-canvas-soft text-ink-secondary border border-hairline hover:bg-hairline'}`}
                  >
                    Event Auditing
                  </button>
                  <button 
                    onClick={() => setActiveTab('projects')}
                    className={`px-3 py-1.5 text-caption font-semibold rounded-md transition-all ${activeTab === 'projects' ? 'bg-ink text-white' : 'bg-canvas-soft text-ink-secondary border border-hairline hover:bg-hairline'}`}
                  >
                    Project Funding
                  </button>
                  <button 
                    onClick={() => setActiveTab('reports')}
                    className={`px-3 py-1.5 text-caption font-semibold rounded-md transition-all ${activeTab === 'reports' ? 'bg-ink text-white' : 'bg-canvas-soft text-ink-secondary border border-hairline hover:bg-hairline'}`}
                  >
                    Report Generator
                  </button>
                </div>

                <ul className="space-y-3 pt-2">
                  <li className="flex items-start gap-2 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-accent-green mt-0.5 flex-shrink-0" />
                    <span><strong>Scoped data isolation:</strong> Treasurers view only their chapter's ledger logs.</span>
                  </li>
                  <li className="flex items-start gap-2 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-accent-green mt-0.5 flex-shrink-0" />
                    <span><strong>Full compliance audits:</strong> Enforce strict envelopes and Team 5 RBAC rules.</span>
                  </li>
                </ul>
              </div>

              {/* Showcase Frame Content */}
              <div className="flex-1 w-full bg-canvas-soft border border-hairline rounded-lg p-6 font-sans">
                {activeTab === 'societies' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-hairline">
                      <span className="text-body-sm font-bold text-ink">Societies Ledger</span>
                      <span className="text-caption text-ink-muted">4 Active Chapters</span>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-surface border border-hairline p-3 rounded flex items-center justify-between hover:shadow-soft-1 transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-accent-teal"></div>
                          <div>
                            <div className="text-caption font-bold text-ink">IEEE Computer Society</div>
                            <div className="text-[11px] text-ink-muted">34 Members · Scoped</div>
                          </div>
                        </div>
                        <div className="text-caption font-mono font-bold">$1,240.50</div>
                      </div>
                      <div className="bg-surface border border-hairline p-3 rounded flex items-center justify-between hover:shadow-soft-1 transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-accent-purple"></div>
                          <div>
                            <div className="text-caption font-bold text-ink">Robotics & Automation Society</div>
                            <div className="text-[11px] text-ink-muted">18 Members · Scoped</div>
                          </div>
                        </div>
                        <div className="text-caption font-mono font-bold">$840.00</div>
                      </div>
                      <div className="bg-surface border border-hairline p-3 rounded flex items-center justify-between hover:shadow-soft-1 transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-accent-pink"></div>
                          <div>
                            <div className="text-caption font-bold text-ink">Women in Engineering</div>
                            <div className="text-[11px] text-ink-muted">22 Members · Scoped</div>
                          </div>
                        </div>
                        <div className="text-caption font-mono font-bold">$600.00</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'events' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-hairline">
                      <span className="text-body-sm font-bold text-ink">Pending Event Expenses</span>
                      <span className="px-2 py-0.5 rounded-full bg-accent-orange/15 text-accent-orange text-[10px] font-bold">2 Awaiting Approval</span>
                    </div>
                    <div className="bg-surface border border-hairline p-4 rounded-lg space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-caption font-bold text-ink">IEEE Hackathon: Catering Lunch</div>
                          <div className="text-[11px] text-ink-faint font-mono">Submitted by Treasurer_CS on 2026-07-06</div>
                        </div>
                        <div className="text-caption font-mono font-semibold text-ink">$420.50</div>
                      </div>
                      <div className="bg-canvas-soft p-2.5 rounded text-[11px] text-ink-secondary border border-dashed border-hairline flex items-center justify-between">
                        <span className="flex items-center gap-1">📄 invoice_cater_co.pdf (1.2 MB)</span>
                        <span className="text-primary hover:underline cursor-pointer">Preview</span>
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
                        <button className="px-2.5 py-1 text-[11px] text-ink-muted hover:bg-canvas-soft border border-hairline rounded">Reject</button>
                        <button className="px-2.5 py-1 text-[11px] text-white bg-primary hover:bg-primary-active rounded">Approve Expense</button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'projects' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-hairline">
                      <span className="text-body-sm font-bold text-ink">Project Procurement Allocations</span>
                      <span className="text-caption text-ink-secondary font-semibold font-mono">Total Budget: $3,000</span>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-caption font-medium">
                          <span>Autonomous Drone Project</span>
                          <span className="font-mono">$850 / $1,200</span>
                        </div>
                        <div className="h-2 w-full bg-hairline rounded-full overflow-hidden">
                          <div className="h-full bg-accent-orange" style={{ width: '70.8%' }}></div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-caption font-medium">
                          <span>IEEE Website V2 Redevelopment</span>
                          <span className="font-mono">$250 / $500</span>
                        </div>
                        <div className="h-2 w-full bg-hairline rounded-full overflow-hidden">
                          <div className="h-full bg-accent-teal" style={{ width: '50%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'reports' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-hairline">
                      <span className="text-body-sm font-bold text-ink">IEEE Annual Report Generator</span>
                      <span className="text-caption text-accent-green font-semibold">IEEE Section v1.4</span>
                    </div>
                    <div className="bg-surface border border-hairline p-4 rounded-lg space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-caption text-ink-secondary">
                        <div>
                          <label className="block text-[11px] text-ink-faint font-semibold uppercase mb-1">Target Year</label>
                          <span className="block p-1.5 bg-canvas-soft rounded border border-hairline font-medium text-ink">FY 2026</span>
                        </div>
                        <div>
                          <label className="block text-[11px] text-ink-faint font-semibold uppercase mb-1">Scope</label>
                          <span className="block p-1.5 bg-canvas-soft rounded border border-hairline font-medium text-ink">All Chapters</span>
                        </div>
                      </div>
                      <button className="w-full py-2 bg-accent-teal text-white rounded text-caption font-semibold flex items-center justify-center gap-1.5">
                        <FileText size={14} /> Download IEEE Excel Ledger (XLSX)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SOCIETIES HUB SHOWCASE (Good daylight desk theme) ─── */}
      <section id="societies" className="py-20 lg:py-28 border-b border-hairline">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-eyebrow font-bold uppercase text-accent-purple-deep tracking-wider font-semibold">Student Chapters</span>
            <h2 className="text-display-2 font-bold text-ink mt-3">
              One dashboard for all technical societies
            </h2>
            <p className="text-body-md text-ink-muted mt-4">
              No overlapping bookkeeping. Separate allocated funds are locked by role, allowing societies to manage their own budgets safely while the student branch retains absolute auditing capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Society Card 1 - Computer Society (Teal) */}
            <div className="bg-surface rounded-lg border border-hairline overflow-hidden hover:shadow-soft-1 transition-all">
              <div className="h-2 bg-accent-teal"></div>
              <div className="p-6">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-accent-teal/10 text-accent-teal mb-3">
                  IEEE-CS
                </div>
                <h4 className="text-heading-3 font-bold text-ink">Computer Society</h4>
                <p className="text-body-sm text-ink-muted mt-2">
                  Funding hackathons, programming seminars, coding bootcamps, and developer licenses.
                </p>
              </div>
            </div>

            {/* Society Card 2 - Robotics (Purple) */}
            <div className="bg-surface rounded-lg border border-hairline overflow-hidden hover:shadow-soft-1 transition-all">
              <div className="h-2 bg-accent-purple"></div>
              <div className="p-6">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-accent-purple/20 text-accent-purple-deep mb-3">
                  IEEE-RAS
                </div>
                <h4 className="text-heading-3 font-bold text-ink">Robotics & Automation</h4>
                <p className="text-body-sm text-ink-muted mt-2">
                  Managing procurement grids, sensor arrays, Robocon workshop kits, and lab hardware.
                </p>
              </div>
            </div>

            {/* Society Card 3 - WIE (Pink) */}
            <div className="bg-surface rounded-lg border border-hairline overflow-hidden hover:shadow-soft-1 transition-all">
              <div className="h-2 bg-accent-pink"></div>
              <div className="p-6">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-accent-pink/15 text-accent-pink mb-3">
                  IEEE-WIE
                </div>
                <h4 className="text-heading-3 font-bold text-ink">Women in Engineering</h4>
                <p className="text-body-sm text-ink-muted mt-2">
                  Supporting panels, diversity mixers, leadership meetups, and international conferences.
                </p>
              </div>
            </div>

            {/* Society Card 4 - Energy (Orange) */}
            <div className="bg-surface rounded-lg border border-hairline overflow-hidden hover:shadow-soft-1 transition-all">
              <div className="h-2 bg-accent-orange"></div>
              <div className="p-6">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-accent-orange/10 text-accent-orange mb-3">
                  IEEE-PES
                </div>
                <h4 className="text-heading-3 font-bold text-ink">Power & Energy</h4>
                <p className="text-body-sm text-ink-muted mt-2">
                  Allocating grants for clean tech projects, grid simulations, solar cells, and site visits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PACKAGES & ACCESS (No Prices, Clear Hierarchy) ─── */}
      <section id="pricing" className="py-20 lg:py-28 border-b border-hairline">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-eyebrow font-bold uppercase text-primary tracking-wider font-semibold">Packages & Access</span>
            <p className="text-body-md text-ink-muted mt-4">
              Start free with your primary student branch ledger, then unlock advanced workflows, audit logs, and society scopes as you grow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-[1000px] mx-auto">
            {/* Package 1 - Lite */}
            <div className="bg-surface border border-hairline rounded-xl p-8 flex flex-col justify-between hover:shadow-soft-1 transition-all">
              <div>
                <span className="text-eyebrow font-bold uppercase text-ink-muted font-semibold">Student Branch Lite</span>
                <p className="text-body-sm text-ink-secondary mt-4">
                  Perfect for small student chapters running a single shared ledger.
                </p>
                <hr className="my-6 border-hairline" />
                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-accent-green mt-0.5 flex-shrink-0" />
                    <span>Single shared Society scope</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-accent-green mt-0.5 flex-shrink-0" />
                    <span>Track income & expenditures</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-accent-green mt-0.5 flex-shrink-0" />
                    <span>Basic Excel exports</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-accent-green mt-0.5 flex-shrink-0" />
                    <span>Up to 5 active officers</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link to="/register">
                  <Button variant="secondary" size="md" className="w-full">
                    Get Started Free
                  </Button>
                </Link>
              </div>
            </div>

            {/* Package 2 - Pro (Featured warm paper surface as per spec) */}
            <div className="bg-canvas-soft text-ink rounded-xl p-8 flex flex-col justify-between border-2 border-primary shadow-soft-1 relative overflow-hidden transform md:-translate-y-2">
              <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                Recommended
              </div>
              <div>
                <span className="text-eyebrow font-bold uppercase text-primary font-semibold">IEEE Society Pro</span>
                <p className="text-body-sm text-ink-secondary mt-4 font-semibold">
                  Complete branch workspace with segregated society ledgers & approvals.
                </p>
                <hr className="my-6 border-hairline" />
                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-primary mt-0.5 flex-shrink-0" />
                    <span><strong>Unlimited Society scopes</strong> (CS, RAS, WIE, etc.)</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-primary mt-0.5 flex-shrink-0" />
                    <span>Event budgeting & project milestones</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-primary mt-0.5 flex-shrink-0" />
                    <span>Team 5 RBAC isolation controls</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-primary mt-0.5 flex-shrink-0" />
                    <span>Receipt upload & inline audits</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-primary mt-0.5 flex-shrink-0" />
                    <span>Standard IEEE Section PDF reports</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link to="/register">
                  <Button variant="primary" size="md" className="w-full">
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            </div>

            {/* Package 3 - Enterprise */}
            <div className="bg-surface border border-hairline rounded-xl p-8 flex flex-col justify-between hover:shadow-soft-1 transition-all">
              <div>
                <span className="text-eyebrow font-bold uppercase text-ink-muted font-semibold">Section Enterprise</span>
                <p className="text-body-sm text-ink-secondary mt-4">
                  For entire IEEE Sections to roll-up & monitor all regional branches.
                </p>
                <hr className="my-6 border-hairline" />
                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-accent-green mt-0.5 flex-shrink-0" />
                    <span>Manage multiple Student Branches</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-accent-green mt-0.5" />
                    <span>Full-spectrum audit logs</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-accent-green mt-0.5" />
                    <span>API Access for banking webhooks</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check size={16} className="text-accent-green mt-0.5" />
                    <span>99.9% SLA & Dedicated Support</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <a href="mailto:support@ieee-finance.pro" className="w-full">
                  <Button variant="secondary" size="md" className="w-full">
                    Contact Section Sales
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ SECTION ─── */}
      <section id="faq" className="py-20 lg:py-28 border-b border-hairline">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-eyebrow font-bold uppercase text-primary tracking-wider font-semibold">Got Questions?</span>
            <h2 className="text-display-2 font-bold text-ink mt-3 font-semibold">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-surface border border-hairline rounded-lg overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left font-semibold text-title text-ink hover:bg-canvas-soft/40 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="text-ink-muted ml-4 flex-shrink-0">
                      {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                    </span>
                  </button>
                  
                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-body-md text-ink-secondary animate-in fade-in slide-in-from-top-2 duration-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center p-6 bg-canvas-soft rounded-lg border border-hairline">
            <p className="text-body-sm text-ink-muted">
              Have another question about integration or Team 5's RBAC specifications?
            </p>
            <a 
              href="mailto:support@ieee-finance-pro.org" 
              className="inline-block mt-3 text-body-sm font-semibold text-primary hover:underline"
            >
              Get in touch with the Development Team →
            </a>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-20 bg-canvas text-ink text-center relative overflow-hidden border-t border-hairline">
        {/* Constellation visual */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20%" cy="30%" r="1" fill="currentColor" />
            <circle cx="80%" cy="70%" r="1.5" fill="currentColor" />
            <line x1="20%" y1="30%" x2="80%" y2="70%" stroke="currentColor" strokeWidth="0.5" strokeDasharray="5,5" />
          </svg>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 relative z-10 space-y-6">
          <h2 className="text-display-2 font-bold leading-tight">
            Simplify your society's accounting today
          </h2>
          <p className="text-body-md text-ink-secondary max-w-lg mx-auto">
            Take the stress out of audits. Join IEEE Student Branches managing thousands of dollars with quiet, paper-soft confidence.
          </p>
          <div className="pt-4">
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/dashboard')}
                className="bg-primary text-white hover:bg-primary-active px-8 py-3 text-button font-medium shadow-elevated"
              >
                Go to your Workspace Dashboard
              </Button>
            ) : (
              <Link to="/register">
                <Button 
                  variant="primary" 
                  size="lg" 
                  className="bg-primary text-white hover:bg-primary-active px-8 py-3 text-button font-medium shadow-elevated"
                >
                  Start free branch ledger
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-canvas-soft border-t border-hairline py-16 text-ink-secondary text-caption">
        <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white font-bold text-caption">
                F
              </div>
              <span className="text-body-sm font-bold text-ink">IEEE Finance Pro</span>
            </div>
            <p className="text-ink-muted">
              Organized, collaborative bookkeeping built specifically for IEEE Student Branches, chapters, and sections.
            </p>
            <p className="text-ink-faint text-[12px]">
              © {new Date().getFullYear()} IEEE Finance Pro. All rights reserved.
            </p>
          </div>

          <div>
            <h5 className="font-semibold text-ink mb-4 text-body-sm">Modules</h5>
            <ul className="space-y-2.5">
              <li><a href="#features" className="hover:text-primary transition-colors">Society Ledger</a></li>
              <li><a href="#features" className="hover:text-primary transition-colors">Event Tracker</a></li>
              <li><a href="#features" className="hover:text-primary transition-colors">Project Procurement</a></li>
              <li><a href="#features" className="hover:text-primary transition-colors">Section Compliance</a></li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-ink mb-4 text-body-sm">Architecture</h5>
            <ul className="space-y-2.5">
              <li><span className="text-ink-muted">Team 5 RBAC Auth</span></li>
              <li><span className="text-ink-muted">React 19 & Tailwind</span></li>
              <li><span className="text-ink-muted">Express API Contract v1</span></li>
              <li><span className="text-ink-muted">Mongoose Data Scopes</span></li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-ink mb-4 text-body-sm">Support</h5>
            <ul className="space-y-2.5">
              <li><a href="mailto:support@ieee-finance.pro" className="hover:text-primary transition-colors">Contact Support</a></li>
              <li><span className="text-ink-muted">Documented in agent.md</span></li>
              <li><span className="text-ink-muted">IEEE Section Standards</span></li>
              <li><a href="#faq" className="hover:text-primary transition-colors">Frequently Asked Questions</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
