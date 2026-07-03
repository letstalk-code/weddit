'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  HelpCircle,
  Home,
  FileText,
  Search,
  Plus,
  MoreVertical,
  CheckCircle2,
  FolderOpen,
  Clock,
  RefreshCw,
  LogOut,
  PlayCircle,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProjectMeta } from '@/lib/types';

const FOLDERS = [
  { id: 'f1', name: 'All Projects', count: 5 },
  { id: 'f2', name: 'Archive', count: 0 },
];

// Helper for staggered animation
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 350, damping: 25 } }
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function statusLabel(status: ProjectMeta['status']): string {
  if (status === 'ready') return 'Ready';
  if (status === 'processing') return 'Processing';
  if (status === 'error') return 'Error';
  return 'Created';
}

// Status chip tones: sage = done, amber = in flight, red = needs attention,
// muted = untouched.
function statusChipClass(status: ProjectMeta['status']): string {
  if (status === 'ready') return 'bg-[#86b48a]/10 text-[#86b48a] border-[#86b48a]/20';
  if (status === 'processing') return 'bg-[#c99d4a]/10 text-[#c99d4a] border-[#c99d4a]/20';
  if (status === 'error') return 'bg-[#e94a47]/10 text-[#e94a47] border-[#e94a47]/20';
  return 'bg-brand-text/5 text-brand-muted border-brand-text/10';
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/projects/list')
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => { });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const data: ProjectMeta = await res.json();
      router.push(`/workspace/${data.id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-screen w-full bg-brand-bg text-brand-text overflow-hidden font-sans">

      {/* 1. MINIMAL EXECUTIVE SIDEBAR */}
      <nav className="w-[72px] glass-panel border-r border-brand-text/[0.05] flex flex-col items-center py-6 gap-8 z-20 shrink-0">
        {/* WEDDIT Brand Icon */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="w-10 h-10 rounded-lg bg-[#e94a47] flex items-center justify-center cursor-pointer relative overflow-hidden"
        >
          <span className="font-serif text-[17px] text-[#f5f2ec] relative z-10 tracking-tight">W</span>
        </motion.div>

        <div className="flex flex-col gap-8 mt-4 w-full px-4">
          <SidebarIcon icon={<Home />} active tooltip="Dashboard" />
          <SidebarIcon icon={<FileText />} tooltip="Projects" />
          <SidebarIcon icon={<Settings />} tooltip="Settings" />
          <SidebarIcon icon={<HelpCircle />} tooltip="Help" />
        </div>

        <div className="mt-auto pb-4">
          <SidebarIcon icon={<LogOut />} tooltip="Logout" />
        </div>
      </nav>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">

        <div className="max-w-[1400px] mx-auto p-10 2xl:p-14 pb-20 pt-12 space-y-12 relative z-10">

          {/* Header Row */}
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex items-start justify-between"
          >
            <div>
              <h1 className="text-3xl font-serif tracking-wide mb-2 text-gradient">Welcome, Devon Curry</h1>
              <p className="text-brand-muted text-[15px] font-light">Let&apos;s curate the most emotional moments from your wedding films</p>
            </div>
          </motion.div>

          {/* Top Section Layout (Recent Projects + Usage Summary) */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">

            {/* Left Col: Projects */}
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-serif tracking-wide text-gradient">Recent Projects</h2>
                <div className="flex items-center gap-3">
                  {/* Search mock */}
                  <div className="relative group">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-text/30 group-focus-within:text-brand-text/60 transition-colors" />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      className="glass-panel rounded-md text-sm pl-9 pr-4 py-2 text-brand-text/80 placeholder:text-brand-text/30 focus:outline-none focus:border-brand-text/20 transition-all w-64 border border-brand-text/[0.05]"
                    />
                  </div>
                  {/* Sort buttons mock */}
                  <div className="flex glass-panel rounded-md border border-brand-text/[0.05] p-0.5">
                    <button className="px-3 py-1.5 text-[13px] bg-[#e94a47]/15 text-[#f2918f] font-medium rounded">Date ↓</button>
                    <button className="px-3 py-1.5 text-[13px] text-brand-text/50 hover:text-brand-text/80 font-medium">Name ↑</button>
                  </div>
                  {/* New Project CTA */}
                  <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[#e94a47] hover:bg-[#f0625f] text-brand-text px-5 py-2 rounded-md text-sm font-medium transition-all">
                    <Plus className="w-4 h-4" /> Create New Project
                  </button>
                </div>
              </div>

              {/* Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.length === 0 && (
                  <div className="col-span-2 glass-panel rounded-xl p-10 flex flex-col items-center justify-center text-center text-brand-text/40 text-sm gap-3 border border-brand-text/[0.05]">
                    <FolderOpen className="w-8 h-8 opacity-40" />
                    <p>No projects yet. Create your first project to get started.</p>
                  </div>
                )}
                {projects.map((project) => (
                  <Link href={`/workspace/${project.id}`} key={project.id}>
                    <motion.div
                      initial="hidden" animate="show" variants={itemVariants}
                      whileHover={{ scale: 1.01 }}
                      className="glass-card rounded-xl p-6 cursor-pointer relative group transition-all duration-300 overflow-hidden"
                    >

                      <div className="flex items-start justify-between mb-8 relative z-10">
                        <div>
                          <h3 className="text-[17px] font-serif tracking-wide text-brand-text/95 mb-1.5">{project.title}</h3>
                          <div className="flex items-center gap-2 text-[13px] text-brand-muted font-light">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(project.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Status Pill */}
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${statusChipClass(project.status)}`}>
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider">{statusLabel(project.status)}</span>
                          </div>
                          <button className="text-brand-text/30 hover:text-brand-text/80 transition-colors">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[13px] text-brand-text/40 group-hover:text-brand-text/70 transition-colors font-medium relative z-10 flex items-center gap-2">
                        View project details <ChevronRight className="w-3 h-3" />
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
              <div className="pt-2">
                <button className="bg-brand-surface hover:bg-brand-text/10 text-brand-text/80 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors border border-brand-text/[0.05]">
                  View All Projects (5)
                </button>
              </div>
            </motion.div>

            {/* Right Col: Usage Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="glass-card rounded-xl p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 font-serif text-gradient font-medium gap-2">
                  Usage Summary <RefreshCw className="w-4 h-4 text-brand-text/40 cursor-pointer hover:text-brand-text/80" />
                </div>
                <span className="bg-[#e94a47]/10 text-[#e94a47] text-[11px] px-2 py-0.5 rounded uppercase tracking-wider font-semibold border border-[#e94a47]/20">
                  Starter Plan
                </span>
              </div>

              <div className="space-y-6 flex-1">
                {/* Transcription Progress */}
                <div>
                  <div className="flex justify-between text-[13px] mb-2">
                    <span className="text-brand-text/80 font-medium flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-[#e94a47]" /> Transcription</span>
                    <span className="text-brand-text/50">3.0 hours remaining</span>
                  </div>
                  <div className="h-[3px] w-full bg-[#1a1a1d] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: '25%' }} transition={{ duration: 1, delay: 0.4 }} className="h-full bg-[#86b48a] rounded-full" />
                  </div>
                </div>

                {/* Script Generation Progress */}
                <div>
                  <div className="flex justify-between text-[13px] mb-2">
                    <span className="text-brand-text/80 font-medium flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-[#e94a47]" /> Script Generation</span>
                    <span className="text-brand-text/50">5.0 hours remaining</span>
                  </div>
                  <div className="h-[3px] w-full bg-[#1a1a1d] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: '0%' }} transition={{ duration: 1, delay: 0.5 }} className="h-full bg-[#86b48a] rounded-full" />
                  </div>
                </div>

                <div className="pt-6 border-t border-brand-text/[0.05]">
                  <h4 className="text-[13px] font-semibold text-brand-text/80 mb-3">Your Plan Includes:</h4>
                  <ul className="text-[13px] text-[#88888b] space-y-2.5">
                    <li className="flex items-start gap-2">• Up to 4.0 hours/month of AI transcription</li>
                    <li className="flex items-start gap-2">• 5.0 hours/month of story script generation</li>
                    <li className="flex items-start gap-2">• Speaker identification</li>
                    <li className="flex items-start gap-2">• Exclude speakers from script</li>
                    <li className="flex items-start gap-2">• Copy/paste timecodes from script</li>
                    <li className="flex items-start gap-2">• Plotline Markers (FCPX, Resolve, Premiere)</li>
                  </ul>
                </div>
              </div>

              <button className="w-full mt-8 bg-[#e94a47] hover:bg-[#f0625f] text-brand-text py-3 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" /> Upgrade Plan
              </button>
            </motion.div>
          </div>

          {/* Folders Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <h2 className="text-xl font-serif tracking-wide text-gradient mb-6">Folders</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel rounded-xl p-6 flex flex-col h-full">
                <div className="flex items-center gap-2 text-[15px] text-brand-text/60 font-medium mb-6">
                  <span className="text-[#e94a47]">★</span> Favorite Folders
                </div>
                <div className="flex items-center justify-between text-sm text-brand-text/80 glass-card p-3 rounded-lg hover:bg-brand-text/[0.08] cursor-pointer transition-colors">
                  <div className="flex items-center gap-3"><FolderOpen className="w-4 h-4 text-brand-text/40" /> All Projects</div>
                  <span className="text-brand-text/40 font-mono">0</span>
                </div>
              </div>

              <div className="glass-panel rounded-xl p-6 flex flex-col h-full">
                <div className="flex items-center gap-2 text-[15px] text-brand-text/60 font-medium mb-6">
                  <Clock className="w-4 h-4 text-[#e94a47]" /> Recent Folders
                </div>
                <div className="space-y-2 flex-1">
                  {FOLDERS.map(f => (
                    <div key={f.id} className="flex items-center justify-between text-sm text-brand-text/80 p-3 rounded-lg border border-transparent hover:glass-card cursor-pointer transition-all">
                      <div className="flex items-center gap-3"><FolderOpen className="w-4 h-4 text-brand-text/40" /> {f.name}</div>
                      <span className="text-brand-text/40 font-mono">{f.count}</span>
                    </div>
                  ))}
                </div>
                <button className="text-[#e94a47] text-sm font-medium mt-4 hover:text-[#f2918f] transition-colors self-center">
                  View All Folders
                </button>
              </div>
            </div>
          </motion.div>

          {/* Getting Started Row */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="glass-panel rounded-xl p-8">
            <h2 className="text-xl font-serif tracking-wide text-gradient mb-8">Getting Started with WEDDIT</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { num: '1', title: 'Create a Project', desc: 'Start by creating a new project for your wedding film.' },
                { num: '2', title: 'Upload Audio', desc: 'Upload your wedding day audio recordings. We support MP3 format.' },
                { num: '3', title: 'Generate & Export', desc: 'Generate a story script and export to your preferred editing software.' }
              ].map((step, i) => (
                <div key={i} className="glass-card rounded-xl p-6 transition-colors cursor-pointer group">
                  <div className="w-7 h-7 rounded-full bg-[#e94a47]/10 text-[#e94a47] flex items-center justify-center text-sm font-bold mb-5 border border-[#e94a47]/20 group-hover:bg-[#e94a47] group-hover:text-brand-text transition-colors">
                    {step.num}
                  </div>
                  <h3 className="text-[15px] font-semibold text-brand-text/90 mb-2">{step.title}</h3>
                  <p className="text-[#88888b] text-[13px] leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </main>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => setShowCreate(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-xl p-8 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-serif text-gradient mb-6">New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                autoFocus
                type="text"
                placeholder="Project title…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full glass-panel rounded-md px-4 py-3 text-brand-text/90 placeholder:text-brand-text/30 focus:outline-none border border-brand-text/[0.08] focus:border-[#e94a47]/50 text-sm"
              />
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 rounded-md text-sm text-brand-text/60 hover:text-brand-text/90 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newTitle.trim()} className="px-5 py-2 bg-[#e94a47] hover:bg-[#f0625f] disabled:opacity-50 text-brand-text rounded-md text-sm font-medium transition-all">
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Absolute floating 'Need help?' button */}
      <div className="absolute bottom-8 right-8 z-50">
        <button className="glass-panel hover:border-brand-text/[0.2] text-brand-text/80 hover:text-brand-text px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-medium transition-all hover:scale-105 border border-brand-text/[0.05]">
          <PlayCircle className="w-4 h-4 text-[#e94a47]" /> Need help?
        </button>
      </div>

    </div>
  );
}

// Micro Sidebar Component
function SidebarIcon({ icon, active, tooltip }: { icon: React.ReactNode, active?: boolean, tooltip: string }) {
  return (
    <div className="relative group/icon cursor-pointer flex justify-center w-full">
      <div className={`p-2.5 rounded-lg transition-all duration-300
        ${active ? 'bg-[#e94a47]/10 text-[#e94a47]' : 'text-[#88888b] hover:bg-brand-text/5 hover:text-brand-text/90'}
      `}>
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' })}
      </div>
      {active && (
        <motion.div layoutId="activeMainSideNav" className="absolute -left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#e94a47] rounded-r-full" />
      )}
      {/* Tooltip */}
      <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#131315] border border-brand-text/10 rounded-md text-[11px] font-medium text-brand-text/90 opacity-0 group-hover/icon:opacity-100 translate-x-[-10px] group-hover/icon:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50">
        {tooltip}
      </div>
    </div>
  );
}
