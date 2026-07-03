'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProjectMeta } from '@/lib/types';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 350, damping: 26 } },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// 03.02.26
function fmtDot(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}

// Feb 3
function fmtShort(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusWord(status: ProjectMeta['status']): string {
  if (status === 'ready') return 'Ready';
  if (status === 'processing') return 'Processing';
  if (status === 'error') return 'Error';
  return 'Draft';
}

function statusHex(status: ProjectMeta['status']): string {
  if (status === 'ready') return '#86b48a';
  if (status === 'processing') return '#c99d4a';
  if (status === 'error') return '#e94a47';
  return 'rgba(245,242,236,0.5)';
}

function durationLabel(meta: ProjectMeta): string | null {
  if (!meta.audioDurationSec) return null;
  const m = Math.round(meta.audioDurationSec / 60);
  return `${m} min`;
}

type Filter = 'all' | 'ready' | 'progress';

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

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

  const total = projects.length;
  const readyCount = projects.filter((p) => p.status === 'ready').length;
  const filtered =
    filter === 'all'
      ? projects
      : filter === 'ready'
        ? projects.filter((p) => p.status === 'ready')
        : projects.filter((p) => p.status !== 'ready');

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: total },
    { key: 'ready', label: 'Ready', count: readyCount },
    { key: 'progress', label: 'In Progress', count: total - readyCount },
  ];

  return (
    <div className="flex h-screen w-full bg-brand-bg text-brand-text overflow-hidden font-sans">

      {/* SIDEBAR — wide text nav */}
      <nav className="w-[240px] shrink-0 border-r border-brand-border flex flex-col py-7 px-5">
        <div className="px-2 mb-10">
          <span className="font-serif text-2xl tracking-tight text-brand-text">
            Weddit<span className="text-[#e94a47]">.</span>
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <SideLink label="Home" href="/" active />
          <SideLink label="Projects" href="/" />
        </div>

        <div className="mt-8 px-3 text-[10px] uppercase tracking-widest text-brand-muted/50 mb-2">Account</div>
        <div className="flex flex-col gap-0.5">
          <SideLink label="Settings" muted />
          <SideLink label="Help" muted />
        </div>

        <div className="mt-auto px-3">
          <div className="text-[10px] uppercase tracking-widest text-[#e94a47]/80 mb-1">Signed in</div>
          <div className="text-sm text-brand-text/80">Devon Curry</div>
        </div>
      </nav>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {/* Top bar */}
        <header className="h-[68px] flex items-center justify-end px-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-brand-text/80">Devon Curry</span>
            <span className="w-8 h-8 rounded-full bg-[#e94a47]/15 text-[#e94a47] flex items-center justify-center text-xs font-semibold">DE</span>
          </div>
        </header>

        <div className="max-w-[1180px] px-10 pb-24 pt-6">
          {/* Greeting */}
          <div className="flex items-center gap-3 mb-4">
            <span className="w-6 h-px bg-[#e94a47]" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#e94a47] font-medium">Welcome back</span>
          </div>
          <h1 className="font-serif text-[52px] leading-[1.05] tracking-tight text-brand-text mb-3">
            {greeting()}, Devon.
          </h1>
          <p className="font-serif italic text-lg text-brand-muted mb-14">
            {readyCount > 0
              ? `${readyCount} ${readyCount === 1 ? 'cut' : 'cuts'} ready for the timeline.`
              : 'Upload wedding audio to start your first cut.'}
          </p>

          {/* Projects header */}
          <div className="flex items-end justify-between mb-6">
            <div className="flex items-baseline gap-3">
              <h2 className="font-serif text-2xl tracking-wide text-brand-text">Projects</h2>
              <span className="text-sm text-brand-muted/60">{total} total</span>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#e94a47] hover:bg-[#f0625f] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 mb-8">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[13px] transition-colors ${
                  filter === f.key
                    ? 'bg-brand-surface text-brand-text'
                    : 'text-brand-muted hover:text-brand-text/80'
                }`}
              >
                {f.label}
                <span className="text-brand-muted/50 tabular-nums">{String(f.count).padStart(2, '0')}</span>
              </button>
            ))}
          </div>

          {/* Cards */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-brand-border p-16 flex flex-col items-center justify-center text-center gap-3">
              <p className="text-brand-muted text-sm">
                {total === 0 ? 'No projects yet.' : 'Nothing here in this filter.'}
              </p>
              {total === 0 && (
                <button onClick={() => setShowCreate(true)} className="text-[#e94a47] text-sm hover:text-[#f0625f] transition-colors">
                  Create your first project →
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((p) => {
                const dur = durationLabel(p);
                return (
                  <Link href={`/workspace/${p.id}`} key={p.id}>
                    <motion.div
                      initial="hidden"
                      animate="show"
                      variants={itemVariants}
                      className="group rounded-xl border border-brand-border bg-brand-surface p-6 flex flex-col min-h-[188px] hover:border-brand-text/20 transition-colors"
                    >
                      <div className="text-[12px] text-brand-muted/70 mb-3 font-mono tracking-wide">
                        {fmtDot(p.createdAt)} · wedding film
                      </div>
                      <h3 className="font-serif text-xl text-brand-text mb-2 leading-snug">{p.title}</h3>
                      <div className="text-[12px] flex items-center gap-2">
                        <span style={{ color: statusHex(p.status) }}>{statusWord(p.status)}</span>
                        {dur && (
                          <>
                            <span className="text-brand-muted/40">·</span>
                            <span className="text-brand-muted">{dur}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-auto pt-6">
                        <div className="h-px bg-brand-border mb-4" />
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-border text-[13px] text-brand-text/80 group-hover:border-[#e94a47]/40 group-hover:text-[#e94a47] transition-colors">
                            Open <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[11px] text-brand-muted/60 uppercase tracking-wider">{fmtShort(p.createdAt)}</span>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => setShowCreate(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-brand-border bg-brand-surface p-8 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-serif text-brand-text mb-6">New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                autoFocus
                type="text"
                placeholder="Project title…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-md px-4 py-3 bg-brand-deep text-brand-text/90 placeholder:text-brand-muted/50 focus:outline-none border border-brand-border focus:border-[#e94a47]/50 text-sm transition-colors"
              />
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 rounded-md text-sm text-brand-muted hover:text-brand-text transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newTitle.trim()} className="px-5 py-2 bg-[#e94a47] hover:bg-[#f0625f] disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors">
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SideLink({ label, href, active, muted }: { label: string; href?: string; active?: boolean; muted?: boolean }) {
  const cls = `px-3 py-2 rounded-md text-sm transition-colors ${
    active ? 'bg-brand-surface text-brand-text font-medium' : muted ? 'text-brand-muted/40 cursor-default' : 'text-brand-muted hover:text-brand-text hover:bg-brand-text/5'
  }`;
  if (muted || !href) return <span className={cls} title={muted ? 'Coming soon' : undefined}>{label}</span>;
  return <Link href={href} className={cls}>{label}</Link>;
}
