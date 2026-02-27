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
      .catch(() => {});
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
    <div className="flex h-screen w-full bg-brand-bg text-white overflow-hidden font-sans">

      {/* 1. MINIMAL EXECUTIVE SIDEBAR */}
      <nav className="w-[72px] glass-panel border-r border-white/[0.05] flex flex-col items-center py-6 gap-8 z-20 shrink-0">
        {/* WEDDIT Brand Icon */}
        <motion.div
          whileHover={{ scale: 1.05, filter: 'brightness(1.15)' }}
          className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#9381ff] to-[#6a56cc] flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(147,129,255,0.35)] relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#e6c27a]/20 to-transparent pointer-events-none" />
          <span className="font-serif font-bold text-[17px] text-transparent bg-clip-text bg-gradient-to-b from-[#fffaeb] to-[#e0c890] relative z-10 tracking-tight">W</span>
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
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-accent/5 to-transparent pointer-events-none" />

        <div className="max-w-[1400px] mx-auto p-10 2xl:p-14 pb-20 pt-12 space-y-12 relative z-10">

          {/* Header Row */}
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex items-start justify-between"
          >
            <div>
              <h1 className="text-3xl font-serif tracking-wide mb-2 text-gradient">Welcome, Devon Curry</h1>
              <p className="text-brand-muted text-[15px] font-light">Let's curate the most emotional moments from your wedding films</p>
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
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white/60 transition-colors" />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      className="glass-panel rounded-md text-sm pl-9 pr-4 py-2 text-white/80 placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all w-64 border border-white/[0.05]"
                    />
                  </div>
                  {/* Sort buttons mock */}
                  <div className="flex glass-panel rounded-md border border-white/[0.05] p-0.5">
                    <button className="px-3 py-1.5 text-[13px] bg-[#9381ff]/15 text-[#b8b0ff] font-medium rounded">Date ↓</button>
                    <button className="px-3 py-1.5 text-[13px] text-white/50 hover:text-white/80 font-medium">Name ↑</button>
                  </div>
                  {/* New Project CTA */}
                  <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[#9381ff] hover:bg-[#b8b0ff] text-white px-5 py-2 rounded-md text-sm font-medium transition-all shadow-[0_4px_14px_0_rgba(147,129,255,0.2)]">
                    <Plus className="w-4 h-4" /> Create New Project
                  </button>
                </div>
              </div>

              {/* Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.length === 0 && (
                  <div className="col-span-2 glass-panel rounded-xl p-10 flex flex-col items-center justify-center text-center text-white/40 text-sm gap-3 border border-white/[0.05]">
                    <FolderOpen className="w-8 h-8 opacity-40" />
                    <p>No projects yet. Create your first project to get started.</p>
                  </div>
                )}
                {projects.map((project) => (
                  <Link href={`/workspace/${project.id}`} key={project.id}>
                    <motion.div
                      variants={itemVariants}
                      whileHover={{ scale: 1.01 }}
                      className="glass-card rounded-xl p-6 cursor-pointer relative group transition-all duration-300 overflow-hidden"
                    >
                      {/* Subtle hover gradient sweep */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#9381ff]/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none" />

                      <div className="flex items-start justify-between mb-8 relative z-10">
                        <div>
                          <h3 className="text-[17px] font-serif tracking-wide text-white/95 mb-1.5">{project.title}</h3>
                          <div className="flex items-center gap-2 text-[13px] text-brand-muted font-light">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(project.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Status Pill */}
                          <div className="flex items-center gap-1.5 bg-[#9381ff]/10 text-[#9381ff] px-2.5 py-1 rounded-full border border-[#9381ff]/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider">{statusLabel(project.status)}</span>
                          </div>
                          <button className="text-white/30 hover:text-white/80 transition-colors">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[13px] text-white/40 group-hover:text-white/70 transition-colors font-medium relative z-10 flex items-center gap-2">
                        View project details <ChevronRight className="w-3 h-3" />
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
              <div className="pt-2">
                <button className="bg-brand-surface hover:bg-white/10 text-white/80 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors border border-white/[0.05]">
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
                  Usage Summary <RefreshCw className="w-4 h-4 text-white/40 cursor-pointer hover:text-white/80" />
                </div>
                <span className="bg-[#9381ff]/10 text-[#9381ff] text-[11px] px-2 py-0.5 rounded uppercase tracking-wider font-semibold border border-[#9381ff]/20">
                  Starter Plan
                </span>
              </div>

              <div className="space-y-6 flex-1">
                {/* Transcription Progress */}
                <div>
                  <div className="flex justify-between text-[13px] mb-2">
                    <span className="text-white/80 font-medium flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-[#9381ff]" /> Transcription</span>
                    <span className="text-white/50">3.0 hours remaining</span>
                  </div>
                  <div className="h-[3px] w-full bg-[#1e222d] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: '25%' }} transition={{ duration: 1, delay: 0.4 }} className="h-full bg-[#23b27b] rounded-full" />
                  </div>
                </div>

                {/* Script Generation Progress */}
                <div>
                  <div className="flex justify-between text-[13px] mb-2">
                    <span className="text-white/80 font-medium flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-[#9381ff]" /> Script Generation</span>
                    <span className="text-white/50">5.0 hours remaining</span>
                  </div>
                  <div className="h-[3px] w-full bg-[#1e222d] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: '0%' }} transition={{ duration: 1, delay: 0.5 }} className="h-full bg-[#23b27b] rounded-full" />
                  </div>
                </div>

                <div className="pt-6 border-t border-white/[0.05]">
                  <h4 className="text-[13px] font-semibold text-white/80 mb-3">Your Plan Includes:</h4>
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

              <button className="w-full mt-8 bg-[#9381ff] hover:bg-[#b8b0ff] text-white py-3 rounded-md text-sm font-semibold transition-all shadow-[0_4px_14px_0_rgba(147,129,255,0.2)] flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" /> Upgrade Plan
              </button>
            </motion.div>
          </div>

          {/* Folders Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <h2 className="text-xl font-serif tracking-wide text-gradient mb-6">Folders</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel rounded-xl p-6 flex flex-col h-full">
                <div className="flex items-center gap-2 text-[15px] text-white/60 font-medium mb-6">
                  <span className="text-[#9381ff]">★</span> Favorite Folders
                </div>
                <div className="flex items-center justify-between text-sm text-white/80 bg-white/[0.02] p-3 rounded-lg border border-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors">
                  <div className="flex items-center gap-3"><FolderOpen className="w-4 h-4 text-white/40" /> All Projects</div>
                  <span className="text-white/40 font-mono">0</span>
                </div>
              </div>

              <div className="glass-panel rounded-xl p-6 flex flex-col h-full">
                <div className="flex items-center gap-2 text-[15px] text-white/60 font-medium mb-6">
                  <Clock className="w-4 h-4 text-[#9381ff]" /> Recent Folders
                </div>
                <div className="space-y-2 flex-1">
                  {FOLDERS.map(f => (
                    <div key={f.id} className="flex items-center justify-between text-sm text-white/80 p-3 rounded-lg border border-transparent hover:border-white/[0.05] hover:bg-white/[0.02] cursor-pointer transition-colors">
                      <div className="flex items-center gap-3"><FolderOpen className="w-4 h-4 text-white/40" /> {f.name}</div>
                      <span className="text-white/40 font-mono">{f.count}</span>
                    </div>
                  ))}
                </div>
                <button className="text-[#9381ff] text-sm font-medium mt-4 hover:text-[#b8b0ff] transition-colors self-center">
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
                <div key={i} className="bg-brand-bg border border-white/[0.05] rounded-xl p-6 hover:border-white/[0.1] transition-colors cursor-pointer group">
                  <div className="w-7 h-7 rounded-full bg-[#9381ff]/10 text-[#9381ff] flex items-center justify-center text-sm font-bold mb-5 border border-[#9381ff]/20 group-hover:bg-[#9381ff] group-hover:text-white transition-colors">
                    {step.num}
                  </div>
                  <h3 className="text-[15px] font-semibold text-white/90 mb-2">{step.title}</h3>
                  <p className="text-[#88888b] text-[13px] leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </main>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowCreate(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-xl p-8 w-full max-w-md mx-4 shadow-2xl"
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
                className="w-full glass-panel rounded-md px-4 py-3 text-white/90 placeholder:text-white/30 focus:outline-none border border-white/[0.08] focus:border-[#9381ff]/50 text-sm"
              />
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 rounded-md text-sm text-white/60 hover:text-white/90 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newTitle.trim()} className="px-5 py-2 bg-[#9381ff] hover:bg-[#b8b0ff] disabled:opacity-50 text-white rounded-md text-sm font-medium transition-all">
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Absolute floating 'Need help?' button */}
      <div className="absolute bottom-8 right-8 z-50">
        <button className="glass-panel hover:border-white/[0.2] text-white/80 hover:text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-sm font-medium transition-all hover:scale-105 border border-white/[0.05]">
          <PlayCircle className="w-4 h-4 text-[#9381ff]" /> Need help?
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
        ${active ? 'bg-[#9381ff]/10 text-[#9381ff]' : 'text-[#88888b] hover:bg-white/5 hover:text-white/90'}
      `}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
      </div>
      {active && (
        <motion.div layoutId="activeMainSideNav" className="absolute -left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#9381ff] rounded-r-full shadow-[0_0_10px_#9381ff]" />
      )}
      {/* Tooltip */}
      <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#171a23] border border-white/10 rounded-md text-[11px] font-medium text-white/90 opacity-0 group-hover/icon:opacity-100 translate-x-[-10px] group-hover/icon:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 shadow-xl">
        {tooltip}
      </div>
    </div>
  );
}
