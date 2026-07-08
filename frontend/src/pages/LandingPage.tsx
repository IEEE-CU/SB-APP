import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import {
  Building2,
  Calendar,
  FolderKanban,
  FileText,
  ArrowRight,
  Check,
  Menu,
  X,
  MessageSquare,
  Sparkles,
  LogIn,
  LayoutDashboard,
  Plus,
  Minus,
  Sun,
  Moon,
  Landmark,
  Users,
  Bell,
} from "lucide-react";
import Button from "@/components/ui/Button";

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "finance" | "events" | "community" | "reports"
  >("finance");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Dark Mode State with LocalStorage Persistence
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const mockLedger = [
    {
      id: 1,
      date: "2026-07-06",
      desc: "Component procurement — Robotics Project",
      category: "Project Fund",
      amount: -250.0,
      badgeColor:
        "bg-accent-orange/10 dark:bg-accent-orange/20 text-accent-orange",
    },
    {
      id: 2,
      date: "2026-07-04",
      desc: "Sponsorship — Annual Tech Summit",
      category: "Income",
      amount: 1500.0,
      badgeColor:
        "bg-accent-green/10 dark:bg-accent-green/20 text-accent-green",
    },
    {
      id: 3,
      date: "2026-07-02",
      desc: "Catering — General Assembly 2026",
      category: "Event Expense",
      amount: -420.5,
      badgeColor:
        "bg-accent-purple/10 dark:bg-accent-purple/20 text-accent-purple dark:text-accent-purple",
    },
    {
      id: 4,
      date: "2026-06-28",
      desc: "Vanguard Grant — Aero Design Project",
      category: "Project Fund",
      amount: -600.0,
      badgeColor:
        "bg-accent-orange/10 dark:bg-accent-orange/20 text-accent-orange",
    },
  ];

  const faqs = [
    {
      q: "What is IEEE Finance Pro?",
      a: "IEEE Finance Pro is a unified web platform built for IEEE Student Branch, Christ University Kengeri Campus. It replaces scattered spreadsheets, WhatsApp groups, and Discord servers with a single system for finance, events, projects, reports, communities, and member management — all scoped to the real IEEE organizational hierarchy.",
    },
    {
      q: "Who can use this platform?",
      a: "Every member of the IEEE Student Branch — from general IEEE Members to the SB Faculty Advisor. Your role in the real IEEE hierarchy (Chair, Treasurer, Secretary, Faculty Advisor, etc.) directly determines what you can see and do. No manual permission configuration needed.",
    },
    {
      q: "How does the role-based access system work?",
      a: "The platform implements strict Role-Based Access Control (RBAC) mirroring the real IEEE hierarchy. A Society Treasurer can only manage their society's finances. An SB Chair gets cross-society oversight. The SB Faculty Advisor has full platform access. Every action — Create, Review, Approve — is enforced by role.",
    },
    {
      q: "What happens to our Discord server?",
      a: "The Community Hub replaces Discord entirely. Every society gets its own space with channels (#announcements, #general, #events, #resources), threaded discussions, file sharing, polls, and reactions — all inside the platform and tied to real IEEE roles, not separate Discord accounts.",
    },
    {
      q: "How does the report clearance workflow work?",
      a: "Reports follow a defined clearance path: Submit → Review → Approve/Reject → Visible to authorized roles. Event reports go to Society Faculty Advisors; finance reports can require SB Faculty Advisor sign-off. The full audit trail is always visible, with no informal paper chase.",
    },
  ];

  return (
    <div className="min-h-screen bg-canvas-soft text-ink font-sans flex flex-col selection:bg-primary/20 transition-colors duration-200">
      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-hairline transition-all">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* IEEE SB Brand Mark */}
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white font-bold text-title shadow-soft-1">
              F
            </div>
            <span className="text-title font-bold tracking-tight text-ink">
              IEEE Finance Pro
            </span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-body-sm text-ink-secondary hover:text-ink font-medium transition-colors"
            >
              Features
            </a>
            <a
              href="#societies"
              className="text-body-sm text-ink-secondary hover:text-ink font-medium transition-colors"
            >
              Societies
            </a>
            <a
              href="#roles"
              className="text-body-sm text-ink-secondary hover:text-ink font-medium transition-colors"
            >
              Roles
            </a>
            <a
              href="#faq"
              className="text-body-sm text-ink-secondary hover:text-ink font-medium transition-colors"
            >
              FAQ
            </a>
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
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 group"
              >
                <LayoutDashboard size={16} />
                <span>Go to Dashboard</span>
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 text-body-sm text-ink-secondary hover:text-ink font-medium transition-colors py-1.5 px-3 rounded-md hover:bg-canvas-soft"
                >
                  <LogIn size={16} />
                  <span>Log in</span>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="md">
                    Get started
                  </Button>
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
              href="#roles"
              onClick={() => setMobileMenuOpen(false)}
              className="text-body-md text-ink-secondary py-2"
            >
              Roles
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
                  navigate("/dashboard");
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
                  <Button variant="primary" size="md" className="w-full">
                    Get started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="bg-canvas text-ink relative overflow-hidden py-20 lg:py-28 border-b border-hairline">
        {/* Minimal connecting constellation line art */}
        <div className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <circle cx="15%" cy="30%" r="2" fill="currentColor" />
            <circle cx="35%" cy="75%" r="1.5" fill="currentColor" />
            <circle cx="50%" cy="20%" r="2" fill="currentColor" />
            <circle cx="70%" cy="65%" r="1.5" fill="currentColor" />
            <circle cx="85%" cy="35%" r="2" fill="currentColor" />
            <path
              d="M 15% 30% L 50% 20% L 85% 35% M 35% 75% L 70% 65%"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeDasharray="4,4"
              fill="none"
            />
          </svg>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto flex flex-col items-center">
            {/* Tagline badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-eyebrow font-medium mb-6 border border-primary/20 backdrop-blur-sm">
              <Sparkles size={12} className="text-accent-sky" />
              <span>
                IEEE Student Branch · Christ University Kengeri Campus
              </span>
            </div>

            {/* Display-1 Confident Headline */}
            <h1 className="text-display-2 sm:text-display-1 font-bold leading-none tracking-tighter text-ink">
              One platform for every society, every report, every conversation
            </h1>

            {/* Subhead */}
            <p className="text-body-md text-ink-secondary mt-6 max-w-xl leading-relaxed">
              IEEE Finance Pro replaces scattered spreadsheets, WhatsApp
              threads, and Discord servers with a single, role-aware workspace
              built for the real IEEE hierarchy — from general members to the SB
              Faculty Advisor.
            </p>

            {/* Action buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate("/dashboard")}
                  className="w-full sm:w-auto shadow-elevated bg-primary text-white hover:bg-primary-active flex items-center justify-center gap-2 group"
                >
                  <span>Go to Workspace</span>
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Button>
              ) : (
                <>
                  <Link to="/register" className="w-full sm:w-auto">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full sm:w-auto shadow-elevated"
                    >
                      Get Started
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

          {/* Interactive UI Mockup */}
          <div className="mt-16 w-full max-w-4xl mx-auto bg-surface rounded-xl shadow-elevated border border-hairline overflow-hidden text-ink animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Header Chrome */}
            <div className="bg-canvas-soft border-b border-hairline px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
                <span className="w-3 h-3 rounded-full bg-[#27c93f]"></span>
                <span className="text-caption text-ink-muted ml-3 font-mono select-none">
                  ieee-sb-kengeri.org/dashboard
                </span>
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
                    <div className="w-5 h-5 rounded bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                      SB
                    </div>
                    <span className="text-body-sm font-semibold">
                      IEEE SB Kengeri
                    </span>
                  </div>
                  <nav className="space-y-1">
                    <span className="flex items-center gap-2 px-2 py-1.5 rounded bg-primary/10 text-primary text-body-sm font-medium">
                      <LayoutDashboard size={14} /> Dashboard
                    </span>
                    <span className="flex items-center gap-2 px-2 py-1.5 text-ink-secondary text-body-sm hover:bg-surface rounded">
                      <Landmark size={14} /> Finance
                    </span>
                    <span className="flex items-center gap-2 px-2 py-1.5 text-ink-secondary text-body-sm hover:bg-surface rounded">
                      <Calendar size={14} /> Events
                    </span>
                    <span className="flex items-center gap-2 px-2 py-1.5 text-ink-secondary text-body-sm hover:bg-surface rounded">
                      <FolderKanban size={14} /> Projects
                    </span>
                    <span className="flex items-center gap-2 px-2 py-1.5 text-ink-secondary text-body-sm hover:bg-surface rounded">
                      <MessageSquare size={14} /> Community
                    </span>
                    <span className="flex items-center gap-2 px-2 py-1.5 text-ink-secondary text-body-sm hover:bg-surface rounded">
                      <FileText size={14} /> Reports
                    </span>
                  </nav>
                </div>
                <div className="text-[10px] text-ink-faint px-2 font-mono">
                  RBAC SECURED · v1.0
                </div>
              </div>

              {/* Mock Ledger Container */}
              <div className="flex-1 p-6 flex flex-col justify-between overflow-hidden">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-title font-bold text-ink">
                        Society Finance Ledger
                      </h3>
                      <p className="text-caption text-ink-muted">
                        IEEE Student Branch · All Societies
                      </p>
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
                      <div className="text-[10px] text-ink-faint font-semibold uppercase">
                        Total Balance
                      </div>
                      <div className="text-heading-3 font-bold text-ink mt-0.5">
                        ₹3,48,020
                      </div>
                    </div>
                    <div className="border border-hairline p-3 rounded-lg bg-surface">
                      <div className="text-[10px] text-ink-faint font-semibold uppercase">
                        Allocated
                      </div>
                      <div className="text-heading-3 font-bold text-accent-teal mt-0.5">
                        ₹1,85,000
                      </div>
                    </div>
                    <div className="border border-hairline p-3 rounded-lg bg-surface">
                      <div className="text-[10px] text-ink-faint font-semibold uppercase">
                        Pending
                      </div>
                      <div className="text-heading-3 font-bold text-accent-purple-deep mt-0.5">
                        ₹42,050
                      </div>
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
                        <div
                          key={row.id}
                          className="px-3 py-2 grid grid-cols-12 text-caption text-ink-secondary items-center hover:bg-canvas-soft/40 transition-colors"
                        >
                          <div className="col-span-3 font-mono text-[10px]">
                            {row.date}
                          </div>
                          <div className="col-span-6 truncate font-medium text-ink">
                            {row.desc}
                          </div>
                          <div
                            className={`col-span-3 text-right font-mono font-semibold ${row.amount > 0 ? "text-accent-green" : "text-ink"}`}
                          >
                            {row.amount > 0
                              ? `+₹${row.amount.toFixed(0)}`
                              : `-₹${Math.abs(row.amount).toFixed(0)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-ink-faint pt-2 border-t border-hairline">
                  <span>Audit Trail Active</span>
                  <span className="font-semibold text-primary">
                    Role-Scoped · RBAC Enforced
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURE SYSTEM ─── */}
      <section
        id="features"
        className="py-20 lg:py-28 border-b border-hairline"
      >
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-eyebrow font-bold uppercase text-primary tracking-wider font-semibold">
              Platform Modules
            </span>
            <h2 className="text-display-2 font-bold text-ink mt-3">
              Everything your Student Branch needs, in one place.
            </h2>
            <p className="text-body-md text-ink-muted mt-4">
              Built for the real structure of IEEE Student Branches —
              society-wise management, built-in community hub, financial
              analytics, event and project workflows, and a smart report
              clearance system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature Card 1 — Finance */}
            <div className="bg-surface rounded-lg border border-hairline p-6 hover:shadow-soft-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-lg bg-accent-teal/10 text-accent-teal flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                  <Landmark size={24} />
                </div>
                <h3 className="text-heading-3 font-bold text-ink mb-2">
                  Finance Management
                </h3>
                <p className="text-body-sm text-ink-muted">
                  Income and expense tracking, budgeting, approval workflows,
                  real-time analytics, and PDF report exports — scoped per
                  society.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-body-sm font-semibold text-accent-teal">
                <span>Society-scoped ledgers</span>
              </div>
            </div>

            {/* Feature Card 2 — Events */}
            <div className="bg-surface rounded-lg border border-hairline p-6 hover:shadow-soft-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-lg bg-accent-purple/20 text-accent-purple-deep flex items-center justify-center mb-6 group-hover:-rotate-6 transition-transform">
                  <Calendar size={24} />
                </div>
                <h3 className="text-heading-3 font-bold text-ink mb-2">
                  Event Management
                </h3>
                <p className="text-body-sm text-ink-muted">
                  Create and schedule events, track speakers and attendees,
                  manage budget vs. actuals, generate certificates, and view a
                  calendar.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-body-sm font-semibold text-accent-purple-deep">
                <span>Budget vs. actuals tracking</span>
              </div>
            </div>

            {/* Feature Card 3 — Projects */}
            <div className="bg-surface rounded-lg border border-hairline p-6 hover:shadow-soft-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-lg bg-accent-orange/10 text-accent-orange flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                  <FolderKanban size={24} />
                </div>
                <h3 className="text-heading-3 font-bold text-ink mb-2">
                  Project Management
                </h3>
                <p className="text-body-sm text-ink-muted">
                  Register projects, track grants and scholarships, manage
                  milestones and deliverables, and attach supporting documents.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-body-sm font-semibold text-accent-orange">
                <span>Milestone & grant tracking</span>
              </div>
            </div>

            {/* Feature Card 4 — Community Hub */}
            <div className="bg-surface rounded-lg border border-hairline p-6 hover:shadow-soft-1 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:-rotate-6 transition-transform">
                  <MessageSquare size={24} />
                </div>
                <h3 className="text-heading-3 font-bold text-ink mb-2">
                  Community Hub
                </h3>
                <p className="text-body-sm text-ink-muted">
                  Our in-house replacement for Discord. Society-wise channels,
                  threaded discussions, announcements, file sharing, polls, and
                  reactions.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-body-sm font-semibold text-primary">
                <span>No Discord needed</span>
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
                  Role-aware access across every module
                </h3>
                <p className="text-body-md text-ink-muted">
                  Each user sees exactly what their IEEE role permits — nothing
                  more, nothing less. The UI adapts automatically to role and
                  society scope without any manual configuration.
                </p>

                {/* Navigation tabs */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => setActiveTab("finance")}
                    className={`px-3 py-1.5 text-caption font-semibold rounded-md transition-all ${activeTab === "finance" ? "bg-ink text-white" : "bg-canvas-soft text-ink-secondary border border-hairline hover:bg-hairline"}`}
                  >
                    Finance View
                  </button>
                  <button
                    onClick={() => setActiveTab("events")}
                    className={`px-3 py-1.5 text-caption font-semibold rounded-md transition-all ${activeTab === "events" ? "bg-ink text-white" : "bg-canvas-soft text-ink-secondary border border-hairline hover:bg-hairline"}`}
                  >
                    Report Clearance
                  </button>
                  <button
                    onClick={() => setActiveTab("community")}
                    className={`px-3 py-1.5 text-caption font-semibold rounded-md transition-all ${activeTab === "community" ? "bg-ink text-white" : "bg-canvas-soft text-ink-secondary border border-hairline hover:bg-hairline"}`}
                  >
                    Community Hub
                  </button>
                  <button
                    onClick={() => setActiveTab("reports")}
                    className={`px-3 py-1.5 text-caption font-semibold rounded-md transition-all ${activeTab === "reports" ? "bg-ink text-white" : "bg-canvas-soft text-ink-secondary border border-hairline hover:bg-hairline"}`}
                  >
                    Analytics
                  </button>
                </div>

                <ul className="space-y-3 pt-2">
                  <li className="flex items-start gap-2 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-accent-green mt-0.5 flex-shrink-0"
                    />
                    <span>
                      <strong>Society-scoped isolation:</strong> Treasurers
                      access only their society's data.
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-accent-green mt-0.5 flex-shrink-0"
                    />
                    <span>
                      <strong>Clearance workflows:</strong> Every report moves
                      through a defined approval chain.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Showcase Frame Content */}
              <div className="flex-1 w-full bg-canvas-soft border border-hairline rounded-lg p-6 font-sans">
                {activeTab === "finance" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-hairline">
                      <span className="text-body-sm font-bold text-ink">
                        Society Finance Overview
                      </span>
                      <span className="text-caption text-ink-muted">
                        4 Active Societies
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-surface border border-hairline p-3 rounded flex items-center justify-between hover:shadow-soft-1 transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-accent-teal"></div>
                          <div>
                            <div className="text-caption font-bold text-ink">
                              IEEE Computer Society
                            </div>
                            <div className="text-[11px] text-ink-muted">
                              34 Members · Scoped
                            </div>
                          </div>
                        </div>
                        <div className="text-caption font-mono font-bold">
                          ₹1,24,050
                        </div>
                      </div>
                      <div className="bg-surface border border-hairline p-3 rounded flex items-center justify-between hover:shadow-soft-1 transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-accent-purple"></div>
                          <div>
                            <div className="text-caption font-bold text-ink">
                              Robotics & Automation Society
                            </div>
                            <div className="text-[11px] text-ink-muted">
                              18 Members · Scoped
                            </div>
                          </div>
                        </div>
                        <div className="text-caption font-mono font-bold">
                          ₹84,000
                        </div>
                      </div>
                      <div className="bg-surface border border-hairline p-3 rounded flex items-center justify-between hover:shadow-soft-1 transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-accent-pink"></div>
                          <div>
                            <div className="text-caption font-bold text-ink">
                              Women in Engineering (WIE)
                            </div>
                            <div className="text-[11px] text-ink-muted">
                              22 Members · Scoped
                            </div>
                          </div>
                        </div>
                        <div className="text-caption font-mono font-bold">
                          ₹60,000
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "events" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-hairline">
                      <span className="text-body-sm font-bold text-ink">
                        Report Clearance Queue
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-accent-orange/15 text-accent-orange text-[10px] font-bold">
                        2 Pending Review
                      </span>
                    </div>
                    <div className="bg-surface border border-hairline p-4 rounded-lg space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-caption font-bold text-ink">
                            Annual Tech Summit — Event Report
                          </div>
                          <div className="text-[11px] text-ink-faint font-mono">
                            Submitted by Secretary · 2026-07-06
                          </div>
                        </div>
                        <div className="text-caption font-mono font-semibold text-ink">
                          ₹42,050
                        </div>
                      </div>
                      <div className="bg-canvas-soft p-2.5 rounded text-[11px] text-ink-secondary border border-dashed border-hairline flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          📄 event_report_techsummit.pdf (1.8 MB)
                        </span>
                        <span className="text-primary hover:underline cursor-pointer">
                          Preview
                        </span>
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
                        <button className="px-2.5 py-1 text-[11px] text-ink-muted hover:bg-canvas-soft border border-hairline rounded">
                          Request Changes
                        </button>
                        <button className="px-2.5 py-1 text-[11px] text-white bg-primary hover:bg-primary-active rounded">
                          Approve Report
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "community" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-hairline">
                      <span className="text-body-sm font-bold text-ink">
                        # announcements — IEEE CS
                      </span>
                      <span className="text-caption text-ink-secondary font-semibold">
                        12 Online
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-ink">
                          Chair — Today at 10:30 AM
                        </div>
                        <div className="bg-surface border border-hairline p-2.5 rounded text-caption text-ink-secondary">
                          📢 Registration open for IEEE Xtreme 20.0! Team up
                          with 2–3 members and submit by July 15. More details
                          in #events 🎯
                        </div>
                        <div className="flex gap-1 text-[10px] text-ink-muted">
                          <span>👍 8</span>
                          <span>🔥 5</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-ink">
                          Secretary — Today at 11:15 AM
                        </div>
                        <div className="bg-surface border border-hairline p-2.5 rounded text-caption text-ink-secondary">
                          MoM from yesterday's OB meeting is attached. Please
                          review before the Faculty Advisor sync tomorrow.
                        </div>
                        <div className="bg-canvas-soft p-1.5 rounded text-[10px] text-ink-secondary border border-dashed border-hairline">
                          📄 MoM_July8_OBMeeting.pdf · 340 KB
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "reports" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-hairline">
                      <span className="text-body-sm font-bold text-ink">
                        SB Analytics Dashboard
                      </span>
                      <span className="text-caption text-accent-green font-semibold">
                        AI Insights Active
                      </span>
                    </div>
                    <div className="bg-surface border border-hairline p-4 rounded-lg space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-caption text-ink-secondary">
                        <div>
                          <label className="block text-[11px] text-ink-faint font-semibold uppercase mb-1">
                            Fiscal Year
                          </label>
                          <span className="block p-1.5 bg-canvas-soft rounded border border-hairline font-medium text-ink">
                            FY 2026
                          </span>
                        </div>
                        <div>
                          <label className="block text-[11px] text-ink-faint font-semibold uppercase mb-1">
                            Scope
                          </label>
                          <span className="block p-1.5 bg-canvas-soft rounded border border-hairline font-medium text-ink">
                            All Societies
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-caption font-medium">
                          <span>Events this year</span>
                          <span className="font-mono">24 completed</span>
                        </div>
                        <div className="h-2 w-full bg-hairline rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-teal"
                            style={{ width: "80%" }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-caption font-medium">
                          <span>Reports cleared</span>
                          <span className="font-mono">18 / 22</span>
                        </div>
                        <div className="h-2 w-full bg-hairline rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-orange"
                            style={{ width: "82%" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SOCIETIES HUB SHOWCASE ─── */}
      <section
        id="societies"
        className="py-20 lg:py-28 border-b border-hairline"
      >
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-eyebrow font-bold uppercase text-accent-purple-deep tracking-wider font-semibold">
              IEEE Societies
            </span>
            <h2 className="text-display-2 font-bold text-ink mt-3">
              Every society gets its own space
            </h2>
            <p className="text-body-md text-ink-muted mt-4">
              Each society manages its own finances, events, projects, and
              community channels — scoped and isolated by role. The SB retains
              full oversight and audit capabilities across all societies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Society Card 1 - Computer Society */}
            <div className="bg-surface rounded-lg border border-hairline overflow-hidden hover:shadow-soft-1 transition-all">
              <div className="h-2 bg-accent-teal"></div>
              <div className="p-6">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-accent-teal/10 text-accent-teal mb-3">
                  IEEE-CS
                </div>
                <h4 className="text-heading-3 font-bold text-ink">
                  Computer Society
                </h4>
                <p className="text-body-sm text-ink-muted mt-2">
                  Hackathons, programming bootcamps, developer workshops, and
                  technical certification drives.
                </p>
              </div>
            </div>

            {/* Society Card 2 - Robotics */}
            <div className="bg-surface rounded-lg border border-hairline overflow-hidden hover:shadow-soft-1 transition-all">
              <div className="h-2 bg-accent-purple"></div>
              <div className="p-6">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-accent-purple/20 text-accent-purple-deep mb-3">
                  IEEE-RAS
                </div>
                <h4 className="text-heading-3 font-bold text-ink">
                  Robotics & Automation
                </h4>
                <p className="text-body-sm text-ink-muted mt-2">
                  Robocon teams, sensor arrays, drone projects, lab procurement,
                  and automation research.
                </p>
              </div>
            </div>

            {/* Society Card 3 - WIE */}
            <div className="bg-surface rounded-lg border border-hairline overflow-hidden hover:shadow-soft-1 transition-all">
              <div className="h-2 bg-accent-pink"></div>
              <div className="p-6">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-accent-pink/15 text-accent-pink mb-3">
                  IEEE-WIE
                </div>
                <h4 className="text-heading-3 font-bold text-ink">
                  Women in Engineering
                </h4>
                <p className="text-body-sm text-ink-muted mt-2">
                  Leadership panels, diversity mixers, mentorship programs, and
                  international conference participation.
                </p>
              </div>
            </div>

            {/* Society Card 4 - Power & Energy */}
            <div className="bg-surface rounded-lg border border-hairline overflow-hidden hover:shadow-soft-1 transition-all">
              <div className="h-2 bg-accent-orange"></div>
              <div className="p-6">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-accent-orange/10 text-accent-orange mb-3">
                  IEEE-PES
                </div>
                <h4 className="text-heading-3 font-bold text-ink">
                  Power & Energy Society
                </h4>
                <p className="text-body-sm text-ink-muted mt-2">
                  Clean energy projects, grid simulations, solar cell research,
                  and industry site visits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ROLE HIERARCHY SECTION (replaces Pricing) ─── */}
      <section id="roles" className="py-20 lg:py-28 border-b border-hairline">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-eyebrow font-bold uppercase text-primary tracking-wider font-semibold">
              Role Hierarchy
            </span>
            <h2 className="text-display-2 font-bold text-ink mt-3">
              Your IEEE role is your access key
            </h2>
            <p className="text-body-md text-ink-muted mt-4">
              The platform mirrors the real IEEE organizational structure. Every
              user's access is derived from their actual IEEE role — no manual
              configuration, no guesswork.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-[1000px] mx-auto">
            {/* Role Tier 1 - Faculty Advisors */}
            <div className="bg-surface border border-hairline rounded-xl p-8 flex flex-col justify-between hover:shadow-soft-1 transition-all">
              <div>
                <span className="text-eyebrow font-bold uppercase text-ink-muted font-semibold">
                  Faculty Advisors
                </span>
                <p className="text-body-sm text-ink-secondary mt-4">
                  SB Faculty Advisor and Society Faculty Advisors with full or
                  society-scoped administrative access.
                </p>
                <hr className="my-6 border-hairline" />
                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-accent-green mt-0.5 flex-shrink-0"
                    />
                    <span>
                      Full platform access (SB FA) or society-scoped admin
                      (Society FA)
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-accent-green mt-0.5 flex-shrink-0"
                    />
                    <span>Approve reports & finances</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-accent-green mt-0.5 flex-shrink-0"
                    />
                    <span>Send global announcements</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-accent-green mt-0.5 flex-shrink-0"
                    />
                    <span>AI-powered analytics dashboard</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link to="/register">
                  <Button variant="secondary" size="md" className="w-full">
                    Register as Faculty Advisor
                  </Button>
                </Link>
              </div>
            </div>

            {/* Role Tier 2 - Office Bearers (Featured) */}
            <div className="bg-canvas-soft text-ink rounded-xl p-8 flex flex-col justify-between border-2 border-primary shadow-soft-1 relative overflow-hidden transform md:-translate-y-2">
              <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                Primary Users
              </div>
              <div>
                <span className="text-eyebrow font-bold uppercase text-primary font-semibold">
                  Office Bearers
                </span>
                <p className="text-body-sm text-ink-secondary mt-4 font-semibold">
                  Society OBs (Chair, Vice Chair, Secretary, Treasurer,
                  Webmaster) and SB OBs — the core operators of the platform.
                </p>
                <hr className="my-6 border-hairline" />
                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-primary mt-0.5 flex-shrink-0"
                    />
                    <span>
                      <strong>Role-specific access</strong> — Chair, Treasurer,
                      Secretary all see different scopes
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-primary mt-0.5 flex-shrink-0"
                    />
                    <span>Manage events, projects, and reports</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-primary mt-0.5 flex-shrink-0"
                    />
                    <span>Submit reports for clearance workflow</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-primary mt-0.5 flex-shrink-0"
                    />
                    <span>Full Community Hub access</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-primary mt-0.5 flex-shrink-0"
                    />
                    <span>Real-time notifications & announcements</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link to="/register">
                  <Button variant="primary" size="md" className="w-full">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>

            {/* Role Tier 3 - Members */}
            <div className="bg-surface border border-hairline rounded-xl p-8 flex flex-col justify-between hover:shadow-soft-1 transition-all">
              <div>
                <span className="text-eyebrow font-bold uppercase text-ink-muted font-semibold">
                  IEEE Members
                </span>
                <p className="text-body-sm text-ink-secondary mt-4">
                  General IEEE members and society members with access to their
                  society's community and relevant announcements.
                </p>
                <hr className="my-6 border-hairline" />
                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-accent-green mt-0.5 flex-shrink-0"
                    />
                    <span>Access society community channels</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-accent-green mt-0.5 flex-shrink-0"
                    />
                    <span>View events and project updates</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-accent-green mt-0.5 flex-shrink-0"
                    />
                    <span>Receive announcements & notifications</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <Check
                      size={16}
                      className="text-accent-green mt-0.5 flex-shrink-0"
                    />
                    <span>Participate in polls and discussions</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link to="/register">
                  <Button variant="secondary" size="md" className="w-full">
                    Join as IEEE Member
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ SECTION ─── */}
      <section id="faq" className="py-20 lg:py-28 border-b border-hairline">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-eyebrow font-bold uppercase text-primary tracking-wider font-semibold">
              Got Questions?
            </span>
            <h2 className="text-display-2 font-bold text-ink mt-3 font-semibold">
              Frequently Asked Questions
            </h2>
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
              Have questions about setting up your society or configuring roles?
            </p>
            <a
              href="mailto:ieee@christkengeri.edu.in"
              className="inline-block mt-3 text-body-sm font-semibold text-primary hover:underline"
            >
              Contact the IEEE SB Team →
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
            <line
              x1="20%"
              y1="30%"
              x2="80%"
              y2="70%"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="5,5"
            />
          </svg>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 relative z-10 space-y-6">
          <h2 className="text-display-2 font-bold leading-tight">
            Run your Student Branch the right way
          </h2>
          <p className="text-body-md text-ink-secondary max-w-lg mx-auto">
            No more scattered spreadsheets or informal WhatsApp approvals. IEEE
            Finance Pro gives every society, every OB, and every member exactly
            the workspace they need.
          </p>
          <div className="pt-4">
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate("/dashboard")}
                className="bg-primary text-white hover:bg-primary-active px-8 py-3 text-button font-medium shadow-elevated"
              >
                Go to your Dashboard
              </Button>
            ) : (
              <Link to="/register">
                <Button
                  variant="primary"
                  size="lg"
                  className="bg-primary text-white hover:bg-primary-active px-8 py-3 text-button font-medium shadow-elevated"
                >
                  Get started with IEEE Finance Pro
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
              <span className="text-body-sm font-bold text-ink">
                IEEE Finance Pro
              </span>
            </div>
            <p className="text-ink-muted">
              The unified platform for IEEE Student Branch, Christ University
              Kengeri Campus — finance, events, projects, reports, and community
              in one place.
            </p>
            <p className="text-ink-faint text-[12px]">
              © {new Date().getFullYear()} IEEE SB, Christ University Kengeri.
              All rights reserved.
            </p>
          </div>

          <div>
            <h5 className="font-semibold text-ink mb-4 text-body-sm">
              Modules
            </h5>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="#features"
                  className="hover:text-primary transition-colors"
                >
                  Finance Management
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-primary transition-colors"
                >
                  Event Management
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-primary transition-colors"
                >
                  Project Management
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-primary transition-colors"
                >
                  Community Hub
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-primary transition-colors"
                >
                  Reports & Clearance
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-primary transition-colors"
                >
                  Member Management
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-ink mb-4 text-body-sm">
              IEEE Societies
            </h5>
            <ul className="space-y-2.5">
              <li>
                <span className="text-ink-muted">Computer Society (CS)</span>
              </li>
              <li>
                <span className="text-ink-muted">
                  Robotics & Automation (RAS)
                </span>
              </li>
              <li>
                <span className="text-ink-muted">
                  Women in Engineering (WIE)
                </span>
              </li>
              <li>
                <span className="text-ink-muted">Power & Energy (PES)</span>
              </li>
              <li>
                <span className="text-ink-muted">+ More societies</span>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-ink mb-4 text-body-sm">
              Quick Links
            </h5>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/login"
                  className="hover:text-primary transition-colors"
                >
                  Log In
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="hover:text-primary transition-colors"
                >
                  Register
                </Link>
              </li>
              <li>
                <a
                  href="#roles"
                  className="hover:text-primary transition-colors"
                >
                  Role Hierarchy
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-primary transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="mailto:ieee@christkengeri.edu.in"
                  className="hover:text-primary transition-colors"
                >
                  Contact SB Team
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
