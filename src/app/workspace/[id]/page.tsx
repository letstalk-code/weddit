'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
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
  Upload,
  Play,
  Pause,
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

const PROCESSING_STAGES: { key: string; label: string }[] = [
  { key: 'transcribing', label: 'Transcribing & detecting speakers' },
  { key: 'analyzing', label: 'Finding best moments' },
]

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function ProcessingProgress({
  stage,
  elapsedSec,
  audioDurationSec,
}: {
  stage: string | null
  elapsedSec: number | null
  audioDurationSec: number | null
}) {
  const elapsedLabel = elapsedSec != null ? `${formatClock(elapsedSec)} elapsed` : null
  const audioLabel =
    audioDurationSec != null ? `${formatClock(audioDurationSec)} of audio` : null

  const foundIdx = PROCESSING_STAGES.findIndex((s) => s.key === stage)
  // No stage reported yet (job just started, or started before stage tracking) —
  // show an indeterminate spinner rather than a misleading step.
  if (foundIdx === -1) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3 text-brand-muted">
        <Loader2 className="w-6 h-6 animate-spin text-[#e94a47]" />
        <span className="text-xs tracking-wider uppercase">Processing audio…</span>
        {elapsedLabel && <span className="text-[11px] text-brand-muted/70 font-mono">{elapsedLabel}</span>}
      </div>
    )
  }
  const idx = foundIdx
  const current = PROCESSING_STAGES[idx]
  const pct = Math.round(((idx + 1) / PROCESSING_STAGES.length) * 100)
  return (
    <div className="flex flex-col gap-5 py-4">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#e94a47] shrink-0" />
        <div className="flex flex-col">
          <span className="text-sm text-brand-text/85">{current.label}…</span>
          <span className="text-[11px] text-brand-muted">
            Step {idx + 1} of {PROCESSING_STAGES.length}
          </span>
        </div>
      </div>

      {/* Elapsed time + audio length */}
      <div className="flex items-center gap-2 text-[11px] font-mono text-brand-muted/80">
        {elapsedLabel && <span className="text-brand-text/60">{elapsedLabel}</span>}
        {elapsedLabel && audioLabel && <span className="text-brand-muted/40">·</span>}
        {audioLabel && <span>{audioLabel}</span>}
      </div>
      <div className="w-full bg-brand-text/5 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="bg-[#e94a47] h-1.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <ol className="flex flex-col gap-2.5">
        {PROCESSING_STAGES.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2.5 text-[12px]">
            {i < idx ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#86b48a] shrink-0" />
            ) : i === idx ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#e94a47] shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-brand-text/15 shrink-0" />
            )}
            <span className={i <= idx ? 'text-brand-text/70' : 'text-brand-muted/50'}>{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const SPEAKER_COLORS = ['text-[#c99d4a]', 'text-[#e94a47]', 'text-[#86b48a]', 'text-[#f08080]']

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
  const [stage, setStage] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState<number>(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [story, setStory] = useState<Story | null>(null)
  const [activeSegment, setActiveSegment] = useState<string | null>(null)
  const [hoveredBeat, setHoveredBeat] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [targetMinutes, setTargetMinutes] = useState(5)
  const [storyStyle, setStoryStyle] = useState<'video' | 'balanced' | 'story'>('balanced')
  const [arcDropdown, setArcDropdown] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playingSegId, setPlayingSegId] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const playbackRef = useRef<{ queue: Segment[]; index: number } | null>(null)

  // ── Fetch helpers ────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/status`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Status check failed (${res.status})`)
      }
      const data = await res.json()
      setStatus(data.status)
      setStage(data.stage ?? null)
      setStartedAt(data.startedAt ?? null)
      setAudioDuration(data.audioDurationSec ?? null)
      return data.status as string
    } catch (err) {
      console.error('Fetch status error:', err)
      setError((err as Error).message)
    }
  }, [id])

  const fetchSegments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/segments`)
      if (!res.ok) return
      const data: Segment[] = await res.json()
      setSegments(data.sort((a, b) => b.story_score - a.story_score))
      if (data.length > 0) setActiveSegment(data[0].id)
    } catch (err) {
      console.error('Fetch segments error:', err)
    }
  }, [id])

  const fetchTranscript = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/transcript`)
      if (!res.ok) return
      const data: Transcript = await res.json()
      setTranscript(data)
    } catch (err) {
      console.error('Fetch transcript error:', err)
    }
  }, [id])

  const fetchStory = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/story`)
      if (!res.ok) return
      const data: Story = await res.json()
      setStory(data)
    } catch (err) {
      console.error('Fetch story error:', err)
    }
  }, [id])

  // ── Initial load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setError(null)

    // Fetch meta for status and title
    fetch(`/api/projects/${id}/status`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data.error || 'Server connection error')
        }
        return r.json()
      })
      .then((d) => {
        setStatus(d.status)
        setStage(d.stage ?? null)
        setStartedAt(d.startedAt ?? null)
        setAudioDuration(d.audioDurationSec ?? null)
      })
      .catch((err) => {
        setError(err.message)
        if (err.message.includes('R2')) {
          setError('Cloudflare R2 not configured. Please add your R2 keys to Vercel Environment Variables.')
        }
      })

    // Try to get project title from list
    fetch('/api/projects/list')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return
        const found = d.projects?.find((p: { id: string; title: string }) => p.id === id)
        if (found) {
          setProjectTitle(found.title)
        } else {
          setProjectTitle(`Project ${id.slice(0, 8)}`)
        }
      })
      .catch(() => {
        setProjectTitle(`Project ${id.slice(0, 8)}`)
      })

    Promise.all([fetchSegments(), fetchTranscript(), fetchStory()])
  }, [id, fetchSegments, fetchTranscript, fetchStory])

  // ── Polling ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === 'processing') {
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

  // ── Elapsed timer tick (only while processing) ────────────────────────────────

  useEffect(() => {
    if (status !== 'processing') return
    setNowTick(Date.now())
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [status])

  // ── Fetch a streaming URL for the audio once results exist ────────────────────

  useEffect(() => {
    if (status !== 'ready' && segments.length === 0) return
    if (audioUrl) return
    let cancelled = false
    fetch(`/api/projects/${id}/audio`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.url) setAudioUrl(d.url) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id, status, segments.length, audioUrl])

  // Presigned R2 URLs expire after an hour — if playback fails mid-session,
  // fetch a fresh one instead of leaving the preview/play buttons dead.
  const audioRetriedRef = useRef(false)
  function handleAudioError() {
    if (audioRetriedRef.current) return
    audioRetriedRef.current = true
    fetch(`/api/projects/${id}/audio`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.url) setAudioUrl(d.url) })
      .catch(() => {})
      .finally(() => { audioRetriedRef.current = false })
  }

  // ── Generate story ───────────────────────────────────────────────────────────

  async function handleGenerateStory() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${id}/story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMinutes, style: storyStyle }),
      })
      if (res.ok) {
        const data: Story = await res.json()
        setStory(data)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Failed to generate story (${res.status})`)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Upload audio ─────────────────────────────────────────────────────────────

  async function handleUpload(file: File) {
    console.log('Starting upload for file:', file.name, file.type, file.size)
    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'mp3'
    const allowed = ['mp3', 'mp4', 'wav', 'm4a', 'mov']
    if (!allowed.includes(extension)) {
      setError(`Format .${extension} not supported. Please use mp3, mp4, wav, or m4a.`)
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      console.log('Fetching presigned URL...')
      const presignRes = await fetch(`/api/projects/${id}/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileType: 'audio',
          contentType: file.type || 'audio/mpeg',
          extension
        }),
      })

      if (!presignRes.ok) {
        const errData = await presignRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to get upload URL')
      }

      const { url } = await presignRes.json()
      console.log('Got presigned URL, starting XHR put...')

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100)
            setUploadProgress(percent)
          }
        }
        xhr.onload = () => {
          console.log('XHR load status:', xhr.status)
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}. This might be a CORS issue on the R2 bucket.`))
          }
        }
        xhr.onerror = () => {
          console.error('XHR error during upload')
          reject(new Error('Network error during upload. Please check your connection and R2 CORS settings.'))
        }
        xhr.open('PUT', url)
        xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg')
        xhr.send(file)
      })

      console.log('Upload successful, triggering processing...')
      const processRes = await fetch(`/api/projects/${id}/process`, { method: 'POST' })
      if (!processRes.ok) {
        throw new Error('Upload succeeded but failed to start processing.')
      }

      setStatus('processing')
      setStage('transcribing')
      setStartedAt(Date.now())
      setAudioDuration(null)
      console.log('Status set to processing')
    } catch (err) {
      console.error('Upload error details:', err)
      setError(`Upload failed: ${(err as Error).message}`)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  // ── Add segment to beat (persisted to R2 so Export sees the same arc) ────────

  function handleAddToArc(segId: string, beatName: StoryBeat['name']) {
    const base: Story = story ?? {
      beats: (['Hook', 'Build', 'Peak', 'Resolve'] as const).map((n) => ({ name: n, segment_ids: [] })),
    }
    const next: Story = {
      beats: base.beats.map((b) =>
        b.name === beatName
          ? { ...b, segment_ids: b.segment_ids.includes(segId) ? b.segment_ids : [...b.segment_ids, segId] }
          : b,
      ),
    }
    setStory(next)
    setArcDropdown(null)
    fetch(`/api/projects/${id}/story`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch((err) => {
      console.error('Failed to save arc edit:', err)
      setError('Failed to save your arc edit — it may not be reflected in the export.')
    })
  }

  // ── Derived data ──────────────────────────────────────────────────────────────

  const transcriptBlocks = transcript ? groupWordsBySpeaker(transcript.words) : []
  const allSpeakers = [...new Set(transcriptBlocks.map((b) => b.speaker))]

  const segmentMap = new Map(segments.map((s) => [s.id, s]))

  const assignedSegs = (story
    ? story.beats.flatMap((b) => b.segment_ids).map((sid) => segmentMap.get(sid)).filter(Boolean)
    : []) as Segment[]
  const assembledSec = assignedSegs.reduce((a, s) => a + (s.end_ms - s.start_ms) / 1000, 0)

  const isProcessing = status === 'processing'
  const hasTranscript = transcriptBlocks.length > 0
  const isReadyToUpload = !isProcessing && !hasTranscript

  // ── Audio playback ────────────────────────────────────────────────────────────

  const isPlaying = playingSegId !== null
  const storyHasSegments = !!story?.beats.some((b) => b.segment_ids.length > 0)

  function stopPlayback() {
    playbackRef.current = null
    setPlayingSegId(null)
    audioRef.current?.pause()
  }
  function startCurrentSegment() {
    const a = audioRef.current
    const pb = playbackRef.current
    if (!a || !pb) return
    if (pb.index >= pb.queue.length) { stopPlayback(); return }
    const seg = pb.queue[pb.index]
    try { a.currentTime = seg.start_ms / 1000 } catch { /* not seekable yet */ }
    setPlayingSegId(seg.id)
    void a.play().catch(() => {})
  }
  function playSegments(segs: Segment[]) {
    if (!audioUrl || segs.length === 0) return
    playbackRef.current = { queue: segs, index: 0 }
    startCurrentSegment()
  }
  function toggleSegment(seg: Segment) {
    if (playingSegId === seg.id) stopPlayback()
    else playSegments([seg])
  }
  function handleTimeUpdate() {
    const a = audioRef.current
    const pb = playbackRef.current
    if (!a || !pb) return
    const seg = pb.queue[pb.index]
    if (!seg) return
    // Stop at the end of the current moment, then advance to the next (if any).
    if (a.currentTime * 1000 >= seg.end_ms) {
      pb.index += 1
      if (pb.index >= pb.queue.length) stopPlayback()
      else startCurrentSegment()
    }
  }
  function playStory() {
    const order: Segment[] = []
    for (const beatName of ['Hook', 'Build', 'Peak', 'Resolve'] as const) {
      const beat = story?.beats.find((b) => b.name === beatName)
      for (const sid of beat?.segment_ids ?? []) {
        const s = segmentMap.get(sid)
        if (s) order.push(s)
      }
    }
    playSegments(order)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-full bg-brand-bg text-brand-text overflow-hidden font-sans selection:bg-[#e94a47]/40 selection:text-brand-text relative">

      {/* Background ambient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
      </div>

      {/* Hidden audio element used for moment previews + Play Story */}
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={stopPlayback}
        onError={handleAudioError}
        preload="none"
      />

      {/* SIDEBAR */}
      <nav className="w-[68px] glass-panel border-r-0 border-brand-border/50 flex flex-col items-center py-6 gap-8 z-20 shrink-0 relative">
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-brand-border to-transparent opacity-50" />
        <Link href="/" aria-label="Back to dashboard" title="Back to dashboard">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="w-10 h-10 rounded-xl bg-[#e94a47] flex items-center justify-center cursor-pointer relative group overflow-hidden"
          >
            <div className="absolute inset-0 rounded-xl ring-1 ring-brand-text/20 group-hover:ring-brand-text/40 transition-all pointer-events-none" />
            <span className="font-serif text-[17px] text-[#f5f2ec] relative z-10 tracking-tight">W</span>
          </motion.div>
        </Link>
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
        <header className="h-[72px] glass-panel flex items-center justify-between px-8 z-20 shrink-0 relative border-b-0 border-brand-border/40">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-border to-transparent opacity-50" />
          <div className="flex items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-[10px] font-bold tracking-[0.2em] uppercase text-brand-muted/80">WEDDIT</h1>
                <ChevronRight className="w-3 h-3 text-brand-muted/50" />
                <span className="text-[10px] font-medium tracking-widest uppercase text-[#e94a47]/90 flex items-center gap-1.5 bg-[#e94a47]/10 px-2 py-0.5 rounded-full border border-[#e94a47]/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  {isProcessing ? 'Processing…' : status === 'ready' ? 'Analyzed' : status === 'error' ? 'Error' : 'Ready'}
                </span>
              </div>
              <h2 className="text-xl font-serif tracking-wide text-gradient">{projectTitle}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Highlight style */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-brand-border/40 mr-1">
              <span className="text-[10px] uppercase tracking-wider text-brand-muted/80">Style</span>
              <div className="flex rounded-md overflow-hidden border border-brand-border/60">
                {([['video', 'Video'], ['balanced', 'Balanced'], ['story', 'Story']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStoryStyle(key)}
                    disabled={generating}
                    title={
                      key === 'video' ? 'Fewer, punchiest emotional moments — leave room for visuals'
                        : key === 'story' ? 'More spoken moments — let the words carry the story'
                          : 'A balanced mix'
                    }
                    className={`px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${storyStyle === key ? 'bg-[#e94a47]/10 text-[#e94a47]' : 'text-brand-muted hover:text-brand-text/80 hover:bg-brand-text/5'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Highlight length slider */}
            <div className="flex items-center gap-2 pr-2 border-r border-brand-border/40 mr-1">
              <span className="text-[10px] uppercase tracking-wider text-brand-muted/80">Length</span>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Number(e.target.value))}
                disabled={generating}
                title={`Target highlight length: ${targetMinutes} min`}
                className="w-24 accent-[#e94a47] cursor-pointer disabled:opacity-40"
              />
              <span className="text-xs font-mono text-brand-text/70 w-12 tabular-nums">{targetMinutes} min</span>
            </div>

            {/* Generate Story button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerateStory}
              disabled={generating || segments.length === 0}
              className="group relative flex items-center gap-2 bg-[#e94a47] hover:bg-[#f0625f] text-white px-5 py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Sparkles className="w-4 h-4" />
              }
              Generate Story
            </motion.button>

            {/* Export button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { window.location.href = `/api/projects/${id}/export` }}
              className="group relative flex items-center gap-2.5 bg-[#131315] hover:bg-[#1a1a1d] text-brand-text px-6 py-2.5 rounded-lg text-sm font-medium transition-all border border-brand-border-highlight overflow-hidden"
            >
              <Download className="w-4 h-4 text-[#c99d4a] group-hover:text-brand-text transition-colors z-10 relative" />
              <span className="relative z-10 flex items-center gap-2">
                Export to FCP <span className="text-brand-muted text-xs border border-brand-border px-1.5 py-0.5 rounded bg-black/40"><Command className="w-3 h-3 inline pb-0.5" /> E</span>
              </span>
            </motion.button>
          </div>
        </header>

        {/* THREE-PANEL WORKSPACE */}
        <main className="flex flex-1 overflow-hidden relative">

          {/* PANEL A: TRANSCRIPT */}
          <section className="w-[30%] border-r border-brand-border/40 bg-[#131315] flex flex-col relative z-10">
            <div className="p-6 pb-4 border-b border-brand-border/40 glass-panel sticky top-0 z-20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-xl tracking-wide text-brand-text/90">Source Script</h3>
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
                    className={`flex-1 rounded-t-sm ${isProcessing ? 'bg-[#e94a47]/30' : 'bg-brand-muted/40'}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-10">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex flex-col gap-2">
                  <p className="font-semibold uppercase tracking-wider text-[10px]">Error</p>
                  <p>{error}</p>
                </div>
              )}

              {/* Upload zone — shown when no transcript is present and not processing */}
              {isReadyToUpload && (
                <div className="mt-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.mp4,.wav,.m4a,.mov,audio/*,video/mp4"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
                  />
                  <motion.div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !uploading) handleUpload(f) }}
                    whileHover={{ borderColor: 'rgba(233,74,71,0.5)', backgroundColor: 'rgba(233,74,71,0.05)' }}
                    className="border-2 border-dashed border-brand-text/10 rounded-xl p-8 flex flex-col items-center gap-4 cursor-pointer transition-all bg-brand-text/[0.02]"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-8 h-8 animate-spin text-[#e94a47]" />
                        <span className="text-sm text-brand-muted tracking-wide">Uploading… {uploadProgress}%</span>
                        <div className="w-full bg-brand-text/5 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className="bg-[#e94a47] h-1.5 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-full bg-[#e94a47]/10 border border-[#e94a47]/20 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-[#e94a47]" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-brand-text/80 mb-1">Select Wedding Audio</p>
                          <p className="text-xs text-brand-muted">Drag & drop or click to browse</p>
                          <p className="text-[10px] text-brand-muted/50 mt-2 uppercase tracking-widest">mp3 • wav • m4a • mp4</p>
                        </div>
                      </>
                    )}
                  </motion.div>
                </div>
              )}
              {isProcessing && (
                <ProcessingProgress
                  stage={stage}
                  elapsedSec={startedAt ? Math.max(0, Math.floor((nowTick - startedAt) / 1000)) : null}
                  audioDurationSec={audioDuration}
                />
              )}
              {!isProcessing && status !== 'created' && transcriptBlocks.length === 0 && (
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
                  <p className="text-[15px] leading-[1.8] font-sans font-light text-brand-muted group-hover:text-brand-text/70 transition-all duration-300">
                    &ldquo;{block.text}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* PANEL B: SEGMENTS */}
          <section className="w-[35%] border-r border-brand-border/40 bg-[#101012] flex flex-col relative z-0">

            <div className="p-6 pb-4 flex items-center justify-between z-10 sticky top-0 border-b border-brand-text/[0.02]">
              <div className="flex items-center gap-3">
                <h3 className="font-serif text-xl tracking-wide text-brand-text/90">Moments</h3>
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
                  <Loader2 className="w-6 h-6 animate-spin text-[#e94a47]" />
                  <span className="text-xs tracking-wider uppercase">Analyzing moments…</span>
                </div>
              )}
              {!isProcessing && status !== 'created' && segments.length === 0 && (
                <p className="text-brand-muted text-sm text-center mt-12">No segments yet.</p>
              )}
              {status === 'created' && (
                <p className="text-brand-muted text-sm text-center mt-12">Upload audio to begin.</p>
              )}
              {segments.map((seg) => {
                const score = Math.round(seg.story_score)
                const isActive = activeSegment === seg.id
                const isPeak = score >= 90
                return (
                  <motion.div
                    key={seg.id}
                    initial="hidden" animate="show" variants={itemVariants}
                    onClick={() => setActiveSegment(seg.id)}
                    className={`glass-card p-5 rounded-xl cursor-pointer relative overflow-hidden group transition-all duration-500
                      ${isActive
                        ? 'border-[#e94a47]/40 bg-[#e94a47]/[0.02]'
                        : 'hover:border-brand-text/20 '
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeSegmentHighlight"
                        className="absolute inset-0 bg-[#e94a47]/[0.04] pointer-events-none"
                      />
                    )}

                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <h4 className={`text-sm tracking-wide font-medium flex items-center gap-2 ${isPeak ? 'text-gradient-gold' : 'text-brand-text/90'}`}>
                          {seg.text.slice(0, 30)}{seg.text.length > 30 ? '…' : ''}
                          {isPeak && <Sparkles className="w-3 h-3 text-[#c99d4a]" />}
                        </h4>
                        <p className="text-[11px] font-mono text-brand-muted/70 mt-1 uppercase tracking-wider">{seg.speaker}</p>
                      </div>

                      {/* Score ring */}
                      <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="16" className="fill-none stroke-brand-border stroke-2" />
                          <circle
                            cx="18" cy="18" r="16"
                            className={`fill-none stroke-2 stroke-linecap-round ${isPeak ? 'stroke-[#c99d4a]' : 'stroke-[#e94a47]'}`}
                            style={{ strokeDasharray: 100, strokeDashoffset: 100 - score }}
                          />
                        </svg>
                        <span className="text-[10px] font-bold text-brand-text/80">{score}</span>
                      </div>
                    </div>

                    <p className="font-serif text-[15.5px] leading-relaxed text-[#ddd8ce] mb-5 italic relative z-10 opacity-90 group-hover:opacity-100 transition-opacity">
                      &ldquo;{seg.text}&rdquo;
                    </p>

                    <div className="flex items-center justify-between mt-auto relative z-10">
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSegment(seg) }}
                          disabled={!audioUrl}
                          title={audioUrl ? 'Preview this moment' : 'Audio unavailable'}
                          className="w-7 h-7 rounded-full flex items-center justify-center border border-[#e94a47]/30 bg-[#e94a47]/10 text-[#e94a47] hover:bg-[#e94a47]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                        >
                          {playingSegId === seg.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                        </button>
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
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-border/60 bg-black/20 text-[#a3a099] hover:text-brand-text hover:border-[#e94a47]/40 hover:bg-[#e94a47]/10 transition-all text-xs font-medium group/btn"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 group-hover/btn:text-[#e94a47] transition-colors" />
                          Add to Arc
                        </button>

                        <AnimatePresence>
                          {arcDropdown === seg.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="absolute bottom-full right-0 mb-1 bg-[#131315] border border-brand-border rounded-lg overflow-hidden z-30 min-w-[130px]"
                            >
                              {(['Hook', 'Build', 'Peak', 'Resolve'] as const).map((beatName) => (
                                <button
                                  key={beatName}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAddToArc(seg.id, beatName)
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-brand-muted hover:text-brand-text hover:bg-[#e94a47]/10 transition-colors"
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
          <section className="w-[35%] bg-brand-bg flex flex-col relative">

            <div className="p-6 pb-4 border-b border-brand-border/40 sticky top-0 bg-[#0b0b0c] z-20 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl tracking-wide text-brand-text/90">Narrative Arc</h3>
                {assignedSegs.length > 0 && (
                  <span className="text-[11px] text-brand-muted font-mono">
                    ~{(assembledSec / 60).toFixed(1)} min · {assignedSegs.length} moments
                  </span>
                )}
              </div>
              <button
                onClick={() => (isPlaying ? stopPlayback() : playStory())}
                disabled={!audioUrl || !storyHasSegments}
                title={!storyHasSegments ? 'Generate a story first' : !audioUrl ? 'Audio unavailable' : 'Play the arranged story'}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all border border-[#e94a47]/30 bg-[#e94a47]/10 text-[#f2918f] hover:bg-[#e94a47]/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'Stop' : 'Play Story'}
              </button>
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
                          <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center border border-brand-text/10 bg-[#0a0a0c] transition-transform duration-500 ${hoveredBeat === beatName ? 'scale-110' : ''}`}>
                            <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${isPeak ? 'bg-[#c99d4a] text-[#c99d4a]' : 'bg-[#e94a47]/60 text-[#e94a47] group-hover:bg-[#e94a47]'}`} />
                          </div>
                        </div>

                        <div className="flex-1 pt-0.5">
                          <h4 className={`text-lg font-serif tracking-wide mb-1.5 transition-colors ${isPeak ? 'text-gradient-gold' : 'text-brand-text/80'} ${hoveredBeat === beatName && !isPeak ? '!text-brand-text' : ''}`}>
                            {beatName}
                          </h4>
                          <p className="text-[13px] text-brand-muted/70 mb-5 font-light">{beatDesc[beatName]}</p>

                          {/* Assigned segments or drop zone */}
                          {assignedSegments.length > 0 ? (
                            <div className="space-y-3">
                              {assignedSegments.map((seg) => (
                                <div
                                  key={seg.id}
                                  className={`glass-card rounded-xl p-5 relative overflow-hidden ${isPeak ? 'border-[#c99d4a]/20' : ''}`}
                                >
                                  {isPeak && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-[#c99d4a] to-transparent opacity-50" />
                                  )}
                                  <div className="flex items-center gap-2 mb-2 text-brand-muted">
                                    <GripVertical className="w-3.5 h-3.5" />
                                    <span className={`text-[10px] uppercase tracking-wider font-mono ${isPeak ? 'text-[#c99d4a]/60' : ''}`}>
                                      {seg.speaker}
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleSegment(seg) }}
                                      disabled={!audioUrl}
                                      title={audioUrl ? 'Preview this moment' : 'Audio unavailable'}
                                      className={`ml-auto w-6 h-6 rounded-full flex items-center justify-center border transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 ${isPeak ? 'border-[#c99d4a]/40 bg-[#c99d4a]/10 text-[#c99d4a] hover:bg-[#c99d4a]/20' : 'border-[#e94a47]/30 bg-[#e94a47]/10 text-[#e94a47] hover:bg-[#e94a47]/20'}`}
                                    >
                                      {playingSegId === seg.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                                    </button>
                                  </div>
                                  <p className={`text-[15px] font-serif italic leading-relaxed ${isPeak ? 'text-[#e8d5ac]' : 'text-brand-text/90'}`}>
                                    &ldquo;{seg.text}&rdquo;
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="min-h-[80px] rounded-xl p-5 border border-dashed border-brand-text/10 bg-brand-text/[0.01] hover:bg-brand-text/[0.03] hover:border-[#e94a47]/30 transition-all duration-300 flex flex-col items-center justify-center gap-2 opacity-30 hover:opacity-60 cursor-pointer">
                              <div className="w-8 h-8 rounded-full border border-dashed border-brand-text/40 flex items-center justify-center">
                                <span className="text-brand-text pb-0.5 text-lg">+</span>
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
      <div className={`p-2.5 rounded-lg transition-all duration-300 ${active ? 'bg-[#e94a47]/15 text-[#f2918f]' : 'text-brand-muted/70 hover:bg-brand-text/5 hover:text-brand-text'}`}>
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' })}
      </div>
      {active && (
        <motion.div layoutId="activeNav" className="absolute -left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#e94a47] rounded-r-full" />
      )}
      <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#131315] border border-brand-text/10 rounded-md text-[11px] font-medium text-brand-text/90 opacity-0 group-hover/icon:opacity-100 translate-x-[-10px] group-hover/icon:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50">
        {tooltip}
      </div>
    </div>
  )
}

function Badge({ text, isPeak }: { text: string; isPeak?: boolean }) {
  return (
    <span className={`px-2 py-1 rounded text-[10px] font-mono tracking-widest uppercase flex items-center border ${isPeak ? 'bg-[#c99d4a]/10 text-[#c99d4a] border-[#c99d4a]/20' : 'bg-black/40 text-brand-muted/80 border-brand-text/5'}`}>
      {text}
    </span>
  )
}
