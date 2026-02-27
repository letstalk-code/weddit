'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Settings,
  Search,
  CheckCircle2,
  ListVideo,
  FileText,
  Sparkles,
  Command,
  ChevronRight,
  GripVertical,
  Loader2,
} from 'lucide-react'
import type { Segment, Story, StoryBeat, Transcript, TranscriptWord } from '@/lib/types'

// ── Animation variants ────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function msToTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface TranscriptBlock {
  id: string
  speaker: string
  text: string
  start_ms: number
}

function groupWordsBySpeaker(words: TranscriptWord[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = []
  let current: TranscriptBlock | null = null
  for (const w of words) {
    if (!current || current.speaker !== w.speaker) {
      if (current) blocks.push(current)
      current = { id: `${w.start_ms}`, speaker: w.speaker, text: w.word, start_ms: w.start_ms }
    } else {
      current.text += ' ' + w.word
    }
  }
  if (current) blocks.push(current)
  return blocks
}

const SPEAKER_COLORS = ['text-[#e6c27a]', 'text-[#9381ff]', 'text-[#6fdfb8]', 'text-[#f08080]']

function speakerColor(speaker: string, allSpeakers: string[]): string {
  const idx = allSpeakers.indexOf(speaker)
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length] ?? 'text-brand-muted'
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const params = useParams()
  const id = params.id as string

  const [projectTitle, setProjectTitle] = useState('Loading…')
  const [status, setStatus] = useState<string>('created')
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [story, setStory] = useState<Story | null>(null)
  const [activeSegment, setActiveSegment] = useState<string | null>(null)
  const [hoveredBeat, setHoveredBeat] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [arcDropdown, setArcDropdown] = useState<string | null>(null) // segment id whose dropdown is open

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch helpers ────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/status`)
    if (!res.ok) return
    const data = await res.json()
    setStatus(data.status)
    return data.status as string
  }, [id])

  const fetchSegments = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/segments`)
    if (!res.ok) return
    const data: Segment[] = await res.json()
    setSegments(data.sort((a, b) => b.story_score - a.story_score))
    if (data.length > 0) setActiveSegment(data[0].id)
  }, [id])

  const fetchTranscript = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/transcript`)
    if (!res.ok) return
    const data: Transcript = await res.json()
    setTranscript(data)
  }, [id])

  const fetchStory = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/story`)
    if (!res.ok) return
    const data: Story = await res.json()
    setStory(data)
  }, [id])

  const fetchMeta = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/status`)
    if (!res.ok) return
    const data = await res.json()
    setStatus(data.status)
    // title comes from meta; re-fetch meta separately
  }, [id])

  // ── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Fetch meta for title
    fetch(`/api/projects/${id}/status`)
      .then((r) => r.json())
      .then((d) => setStatus(d.status))

    // Try to get project title from list
    fetch('/api/projects/list')
      .then((r) => r.json())
      .then((d) => {
        const found = d.projects?.find((p: { id: string; title: string }) => p.id === id)
        if (found) setProjectTitle(found.title)
      })

    Promise.all([fetchSegments(), fetchTranscript(), fetchStory()])
  }, [id, fetchSegments, fetchTranscript, fetchStory])

  // ── Polling ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === 'processing' || status === 'created') {
      pollRef.current = setInterval(async () => {
        const newStatus = await fetchStatus()
        if (newStatus === 'ready' || newStatus === 'error') {
          if (pollRef.current) clearInterval(pollRef.current)
          if (newStatus === 'ready') {
            fetchSegments()
            fetchTranscript()
            fetchStory()
          }
        }
      }, 3000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status, fetchStatus, fetchSegments, fetchTranscript, fetchStory])

  // ── Generate story ───────────────────────────────────────────────────────────

  async function handleGenerateStory() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/projects/${id}/story`, { method: 'POST' })
      if (res.ok) {
        const data: Story = await res.json()
        setStory(data)
      }
    } finally {
      setGenerating(false)
    }
  }

  // ── Add segment to beat (local state) ────────────────────────────────────────

  function handleAddToArc(segId: string, beatName: StoryBeat['name']) {
    setStory((prev) => {
      if (!prev) {
        // Create a skeleton story with empty beats
        const beats: StoryBeat[] = (['Hook', 'Build', 'Peak', 'Resolve'] as const).map((n) => ({
          name: n,
          segment_ids: n === beatName ? [segId] : [],
        }))
        return { beats }
      }
      return {
        beats: prev.beats.map((b) =>
          b.name === beatName
            ? { ...b, segment_ids: b.segment_ids.includes(segId) ? b.segment_ids : [...b.segment_ids, segId] }
            : b,
        ),
      }
    })
    setArcDropdown(null)
  }

  // ── Derived data ──────────────────────────────────────────────────────────────

  const transcriptBlocks = transcript ? groupWordsBySpeaker(transcript.words) : []
  const allSpeakers = [...new Set(transcriptBlocks.map((b) => b.speaker))]

  const segmentMap = new Map(segments.map((s) => [s.id, s]))

  const isProcessing = status === 'processing' || status === 'created'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-full bg-brand-bg text-brand-text overflow-hidden font-sans selection:bg-[#9381ff]/40 selection:text-white relative">

      {/* Background ambient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#9381ff]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#e6c27a]/5 rounded-full blur-[120px]" />
      </div>

      {/* SIDEBAR */}
      <nav className="w-[68px] glass-panel border-r-0 border-brand-border/50 flex flex-col items-center py-6 gap-8 z-20 shrink-0 shadow-2xl relative">
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-brand-border to-transparent opacity-50" />
        <motion.div
          whileHover={{ scale: 1.05, filter: 'brightness(1.15)' }}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9381ff] to-[#6a56cc] flex items-center justify-center shadow-[0_0_20px_rgba(147,129,255,0.3)] cursor-pointer relative group overflow-hidden"
        >
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#e6c27a]/20 to-transparent pointer-events-none" />
          <div className="absolute inset-0 rounded-xl ring-1 ring-white/20 group-hover:ring-white/40 transition-all pointer-events-none" />
          <span className="font-serif font-bold text-[17px] text-transparent bg-clip-text bg-gradient-to-b from-[#fffaeb] to-[#e0c890] relative z-10 tracking-tight">W</span>
        </motion.div>
        <div className="flex flex-col gap-8 mt-6">
          <SidebarIcon icon={<FileText />} tooltip="Transcript" />
          <SidebarIcon icon={<ListVideo />} active tooltip="Story" />
          <SidebarIcon icon={<Search />} tooltip="Search" />
        </div>
        <div className="mt-auto pb-4">
          <SidebarIcon icon={<Settings />} tooltip="Settings" />
        </div>
      </nav>

      <div className="flex flex-col flex-1 relative z-10 overflow-hidden">

        {/* HEADER */}
        <header className="h-[72px] glass-panel flex items-center justify-between px-8 z-20 shrink-0 shadow-lg relative border-b-0 border-brand-border/40">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-border to-transparent opacity-50" />
          <div className="flex items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-[10px] font-bold tracking-[0.2em] uppercase text-brand-muted/80">WEDDIT</h1>
                <ChevronRight className="w-3 h-3 text-brand-muted/50" />
                <span className="text-[10px] font-medium tracking-widest uppercase text-[#9381ff]/90 flex items-center gap-1.5 bg-[#9381ff]/10 px-2 py-0.5 rounded-full border border-[#9381ff]/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  {isProcessing ? 'Processing…' : status === 'ready' ? 'Analyzed' : status === 'error' ? 'Error' : 'Ready'}
                </span>
              </div>
              <h2 className="text-xl font-serif tracking-wide text-gradient">{projectTitle}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Generate Story button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerateStory}
              disabled={generating || segments.length === 0}
              className="group relative flex items-center gap-2 bg-[#9381ff]/20 hover:bg-[#9381ff]/30 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all border border-[#9381ff]/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating
                ? <Loader2 className="w-4 h-4 animate-spin text-[#9381ff]" />
                : <Sparkles className="w-4 h-4 text-[#9381ff]" />
              }
              Generate Story
            </motion.button>

            {/* Export button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { window.location.href = `/api/projects/${id}/export` }}
              className="group relative flex items-center gap-2.5 bg-[#171a23] hover:bg-[#1d212c] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-[0_4px_14px_0_rgba(0,0,0,0.4)] border border-brand-border-highlight overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#e6c27a]/0 via-[#e6c27a]/10 to-[#e6c27a]/0 opacity-0 group-hover:opacity-100 translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-1000 ease-in-out pointer-events-none" />
              <Download className="w-4 h-4 text-[#e6c27a] group-hover:text-white transition-colors z-10 relative" />
              <span className="relative z-10 flex items-center gap-2">
                Export to FCP <span className="text-brand-muted text-xs border border-brand-border px-1.5 py-0.5 rounded bg-black/40"><Command className="w-3 h-3 inline pb-0.5" /> E</span>
              </span>
            </motion.button>
          </div>
        </header>

        {/* THREE-PANEL WORKSPACE */}
        <main className="flex flex-1 overflow-hidden relative">

          {/* PANEL A: TRANSCRIPT */}
          <section className="w-[30%] border-r border-brand-border/40 bg-[#0a0a0c]/80 flex flex-col relative z-10 backdrop-blur-3xl">
            <div className="p-6 pb-4 border-b border-brand-border/40 glass-panel sticky top-0 z-20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-xl tracking-wide text-white/90">Source Script</h3>
                <span className="text-[10px] font-mono tracking-widest text-brand-muted uppercase">
                  {transcriptBlocks.length > 0 ? `${transcriptBlocks.length} blocks` : 'No audio'}
                </span>
              </div>
              {/* Waveform */}
              <div className="h-10 w-full flex items-end gap-[2px] opacity-60">
                {Array.from({ length: 48 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: '10%' }}
                    animate={{ height: `${Math.max(10, Math.sin(i * 0.4) * 40 + (isProcessing ? 30 : 55))}%` }}
                    transition={{ repeat: Infinity, repeatType: 'mirror', duration: 1.5 + (i % 3) * 0.3, ease: 'easeInOut' }}
                    className={`flex-1 rounded-t-sm ${isProcessing ? 'bg-[#9381ff]/30' : 'bg-brand-muted/40'}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-10">
              {isProcessing && (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-brand-muted">
                  <Loader2 className="w-6 h-6 animate-spin text-[#9381ff]" />
                  <span className="text-xs tracking-wider uppercase">Processing audio…</span>
                </div>
              )}
              {!isProcessing && transcriptBlocks.length === 0 && (
                <p className="text-brand-muted text-sm text-center mt-12">No transcript available.</p>
              )}
              {transcriptBlocks.map((block) => (
                <div key={block.id} className="group relative pr-4">
                  <div className="flex items-center gap-3 mb-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <span className="font-mono text-[10px] text-brand-muted/70 tracking-wider pt-0.5">{msToTimecode(block.start_ms)}</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-brand-border to-transparent" />
                    <span className={`text-[11px] font-medium tracking-wide uppercase ${speakerColor(block.speaker, allSpeakers)}`}>
                      {block.speaker}
                    </span>
                  </div>
                  <p className="text-[15px] leading-[1.8] font-sans font-light text-brand-muted group-hover:text-white/70 transition-all duration-300">
                    &ldquo;{block.text}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* PANEL B: SEGMENTS */}
          <section className="w-[35%] border-r border-brand-border/40 bg-[#0c0c0f]/60 flex flex-col relative z-0 backdrop-blur-xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(147,129,255,0.02),transparent_50%)] pointer-events-none" />

            <div className="p-6 pb-4 flex items-center justify-between z-10 sticky top-0 border-b border-white/[0.02]">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-xl tracking-wide text-white/90">Moments</h3>
                <span className="bg-brand-surface border border-brand-border px-2 py-0.5 rounded-full text-[10px] text-brand-muted">
                  {segments.length} Found
                </span>
              </div>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {isProcessing && (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-brand-muted">
                  <Loader2 className="w-6 h-6 animate-spin text-[#9381ff]" />
                  <span className="text-xs tracking-wider uppercase">Analyzing moments…</span>
                </div>
              )}
              {!isProcessing && segments.length === 0 && (
                <p className="text-brand-muted text-sm text-center mt-12">No segments yet. Upload audio to begin.</p>
              )}
              {segments.map((seg) => {
                const score = Math.round(seg.story_score * 100)
                const isActive = activeSegment === seg.id
                const isPeak = score >= 90
                return (
                  <motion.div
                    key={seg.id}
                    variants={itemVariants}
                    onClick={() => setActiveSegment(seg.id)}
                    className={`glass-card p-5 rounded-xl cursor-pointer relative overflow-hidden group transition-all duration-500
                      ${isActive
                        ? 'border-[#9381ff]/40 shadow-[0_8px_30px_rgba(147,129,255,0.08)] bg-[#9381ff]/[0.02]'
                        : 'hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeSegmentHighlight"
                        className="absolute inset-0 bg-gradient-to-br from-[#9381ff]/10 to-transparent pointer-events-none"
                      />
                    )}

                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <h4 className={`text-sm tracking-wide font-medium flex items-center gap-2 ${isPeak ? 'text-gradient-gold' : 'text-white/90'}`}>
                          {seg.text.slice(0, 30)}{seg.text.length > 30 ? '…' : ''}
                          {isPeak && <Sparkles className="w-3 h-3 text-[#e6c27a]" />}
                        </h4>
                        <p className="text-[11px] font-mono text-brand-muted/70 mt-1 uppercase tracking-wider">{seg.speaker}</p>
                      </div>

                      {/* Score ring */}
                      <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="16" className="fill-none stroke-brand-border stroke-2" />
                          <circle
                            cx="18" cy="18" r="16"
                            className={`fill-none stroke-2 stroke-linecap-round ${isPeak ? 'stroke-[#e6c27a]' : 'stroke-[#9381ff]'}`}
                            style={{ strokeDasharray: 100, strokeDashoffset: 100 - score }}
                          />
                        </svg>
                        <span className="text-[10px] font-bold text-white/80">{score}</span>
                      </div>
                    </div>

                    <p className="font-serif text-[15.5px] leading-relaxed text-[#dcdcdc] mb-5 italic relative z-10 opacity-90 group-hover:opacity-100 transition-opacity">
                      &ldquo;{seg.text}&rdquo;
                    </p>

                    <div className="flex items-center justify-between mt-auto relative z-10">
                      <div className="flex gap-2">
                        <Badge text={`${Math.round((seg.end_ms - seg.start_ms) / 1000)}s`} />
                        <Badge text={msToTimecode(seg.start_ms)} />
                      </div>

                      {/* Add to Arc button + dropdown */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setArcDropdown(arcDropdown === seg.id ? null : seg.id)
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-border/60 bg-black/20 text-[#a0a0a0] hover:text-white hover:border-[#9381ff]/40 hover:bg-[#9381ff]/10 transition-all text-xs font-medium group/btn"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 group-hover/btn:text-[#9381ff] transition-colors" />
                          Add to Arc
                        </button>

                        <AnimatePresence>
                          {arcDropdown === seg.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="absolute bottom-full right-0 mb-1 bg-[#13141a] border border-brand-border rounded-lg overflow-hidden shadow-xl z-30 min-w-[130px]"
                            >
                              {(['Hook', 'Build', 'Peak', 'Resolve'] as const).map((beatName) => (
                                <button
                                  key={beatName}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAddToArc(seg.id, beatName)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-brand-muted hover:text-white hover:bg-[#9381ff]/10 transition-colors"
                                >
                                  {beatName}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </section>

          {/* PANEL C: NARRATIVE ARC */}
          <section className="w-[35%] bg-brand-bg flex flex-col relative shadow-[inset_20px_0_40px_rgba(0,0,0,0.6)]">
            <div className="absolute top-0 right-0 w-[60%] h-[30%] bg-[#e6c27a]/[0.02] rounded-full blur-[100px] pointer-events-none" />

            <div className="p-6 pb-4 border-b border-brand-border/40 sticky top-0 bg-[#060608]/80 backdrop-blur-md z-20">
              <h3 className="font-serif text-xl tracking-wide text-white/90">Narrative Arc</h3>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-10">
              <div className="space-y-14 relative">
                <div className="absolute left-[15px] top-6 bottom-0 w-px bg-gradient-to-b from-brand-border via-brand-border to-transparent" />

                {(['Hook', 'Build', 'Peak', 'Resolve'] as const).map((beatName) => {
                  const beat = story?.beats.find((b) => b.name === beatName)
                  const assignedSegments = (beat?.segment_ids ?? []).map((sid) => segmentMap.get(sid)).filter(Boolean) as Segment[]
                  const isPeak = beatName === 'Peak'
                  const beatDesc: Record<string, string> = {
                    Hook: 'Draw them in immediately.',
                    Build: 'Establish the characters and setting.',
                    Peak: 'The emotional climax.',
                    Resolve: 'The ending thought.',
                  }

                  return (
                    <div
                      key={beatName}
                      className="relative"
                      onMouseEnter={() => setHoveredBeat(beatName)}
                      onMouseLeave={() => setHoveredBeat(null)}
                    >
                      <div className="flex items-start gap-6 relative z-10">
                        {/* Timeline node */}
                        <div className="relative mt-1 group shrink-0">
                          <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center border border-white/10 bg-[#0a0a0c] transition-transform duration-500 shadow-xl ${hoveredBeat === beatName ? 'scale-110' : ''}`}>
                            <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentcolor] transition-colors duration-500 ${isPeak ? 'bg-[#e6c27a] text-[#e6c27a]' : 'bg-[#9381ff]/60 text-[#9381ff] group-hover:bg-[#9381ff]'}`} />
                          </div>
                        </div>

                        <div className="flex-1 pt-0.5">
                          <h4 className={`text-lg font-serif tracking-wide mb-1.5 transition-colors ${isPeak ? 'text-gradient-gold' : 'text-white/80'} ${hoveredBeat === beatName && !isPeak ? '!text-white' : ''}`}>
                            {beatName}
                          </h4>
                          <p className="text-[13px] text-brand-muted/70 mb-5 font-light">{beatDesc[beatName]}</p>

                          {/* Assigned segments or drop zone */}
                          {assignedSegments.length > 0 ? (
                            <div className="space-y-3">
                              {assignedSegments.map((seg) => (
                                <div
                                  key={seg.id}
                                  className={`glass-card rounded-xl p-5 relative overflow-hidden ${isPeak ? 'border-[#e6c27a]/20' : ''}`}
                                >
                                  {isPeak && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-[#e6c27a] to-transparent opacity-50" />
                                  )}
                                  <div className="flex items-center gap-2 mb-2 text-brand-muted">
                                    <GripVertical className="w-3.5 h-3.5" />
                                    <span className={`text-[10px] uppercase tracking-wider font-mono ${isPeak ? 'text-[#e6c27a]/60' : ''}`}>
                                      {seg.speaker}
                                    </span>
                                  </div>
                                  <p className={`text-[15px] font-serif italic leading-relaxed ${isPeak ? 'text-[#f8e5b9] drop-shadow-[0_0_15px_rgba(230,194,122,0.2)]' : 'text-white/90'}`}>
                                    &ldquo;{seg.text}&rdquo;
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="min-h-[80px] rounded-xl p-5 border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] hover:border-[#9381ff]/30 transition-all duration-300 flex flex-col items-center justify-center gap-2 opacity-30 hover:opacity-60 cursor-pointer">
                              <div className="w-8 h-8 rounded-full border border-dashed border-white/40 flex items-center justify-center">
                                <span className="text-white pb-0.5 text-lg">+</span>
                              </div>
                              <span className="text-[11px] uppercase tracking-widest font-mono">Drag Fragment Here</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}

// ── Micro components ──────────────────────────────────────────────────────────

function SidebarIcon({ icon, active, tooltip }: { icon: React.ReactNode; active?: boolean; tooltip: string }) {
  return (
    <div className="relative group/icon cursor-pointer flex justify-center w-full">
      <div className={`p-2.5 rounded-lg transition-all duration-300 ${active ? 'bg-[#9381ff]/15 text-[#b8b0ff] shadow-[inset_0_0_10px_rgba(147,129,255,0.1)]' : 'text-brand-muted/70 hover:bg-white/5 hover:text-white'}`}>
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' })}
      </div>
      {active && (
        <motion.div layoutId="activeNav" className="absolute -left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#9381ff] rounded-r-full shadow-[0_0_10px_#9381ff]" />
      )}
      <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#171a23] border border-white/10 rounded-md text-[11px] font-medium text-white/90 opacity-0 group-hover/icon:opacity-100 translate-x-[-10px] group-hover/icon:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 shadow-xl">
        {tooltip}
      </div>
    </div>
  )
}

function Badge({ text, isPeak }: { text: string; isPeak?: boolean }) {
  return (
    <span className={`px-2 py-1 rounded text-[10px] font-mono tracking-widest uppercase flex items-center border ${isPeak ? 'bg-[#e6c27a]/10 text-[#e6c27a] border-[#e6c27a]/20 shadow-[0_0_10px_rgba(230,194,122,0.1)]' : 'bg-black/40 text-brand-muted/80 border-white/5'}`}>
      {text}
    </span>
  )
}
