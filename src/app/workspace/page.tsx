'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    GripVertical
} from 'lucide-react';

const TRANSCRIPT = [
    { id: 1, speaker: 'James', text: "When I first saw her walking down the aisle, everything just stopped. The music, the people, it was just her.", time: "00:02:14", color: "text-[#e6c27a]", resonant: true },
    { id: 2, speaker: 'Father', text: "He's always been the anchor for our family. And now, seeing him with Sarah...", time: "00:04:30", color: "text-[#9381ff]", resonant: false },
    { id: 3, speaker: 'James', text: "I promise to never stop laughing with you, even when things get hard.", time: "00:15:22", color: "text-[#e6c27a]", resonant: true },
    { id: 4, speaker: 'Officiant', text: "Today we celebrate the beginning of a new chapter.", time: "00:18:10", color: "text-brand-muted", resonant: false },
];

const SEGMENTS = [
    { id: 's1', title: 'The Aisle Moment', speaker: 'Groom', score: 92, value: 'Peak', time: '14s', text: "When I first saw her walking down the aisle, everything just stopped..." },
    { id: 's2', title: 'Father’s Toast', speaker: 'Father', score: 88, value: 'Build', time: '22s', text: "He's always been the anchor for our family..." },
    { id: 's3', title: 'The Vows', speaker: 'Groom', score: 96, value: 'Peak', time: '18s', text: "I promise to never stop laughing with you..." },
    { id: 's4', title: 'First Look', speaker: 'Bride', score: 82, value: 'Hook', time: '10s', text: "I couldn't breathe until I turned around..." },
];

const STORY_BEATS = [
    { id: 'b1', title: 'Hook', desc: 'Draw them in immediately.' },
    { id: 'b2', title: 'Build', desc: 'Establish the characters and setting.' },
    { id: 'b3', title: 'Peak', desc: 'The emotional climax.', isPeak: true },
    { id: 'b4', title: 'Resolve', desc: 'The ending thought.' },
];

// Helper for UI staggering
const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

export default function AppWorkspace() {
    const [activeSegment, setActiveSegment] = useState<string>('s1');
    const [hoveredBeat, setHoveredBeat] = useState<string | null>(null);

    return (
        <div className="flex h-screen w-full bg-brand-bg text-brand-text overflow-hidden font-sans selection:bg-[#9381ff]/40 selection:text-white relative">

            {/* Background ambient light effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#9381ff]/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#e6c27a]/5 rounded-full blur-[120px]" />
            </div>

            {/* 1. SLENDER EXECUTIVE SIDEBAR */}
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

                {/* 2. PREMIUM CINEMATIC HEADER */}
                <header className="h-[72px] glass-panel flex items-center justify-between px-8 z-20 shrink-0 shadow-lg relative border-b-0 border-brand-border/40">
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-border to-transparent opacity-50" />

                    <div className="flex items-center gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-[10px] font-bold tracking-[0.2em] uppercase text-brand-muted/80">WEDDIT</h1>
                                <ChevronRight className="w-3 h-3 text-brand-muted/50" />
                                <span className="text-[10px] font-medium tracking-widest uppercase text-[#9381ff]/90 flex items-center gap-1.5 bg-[#9381ff]/10 px-2 py-0.5 rounded-full border border-[#9381ff]/20">
                                    <Sparkles className="w-2.5 h-2.5" /> Analyzed
                                </span>
                            </div>
                            <h2 className="text-xl font-serif tracking-wide text-gradient">The Highlights: Sarah & James</h2>
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative flex items-center gap-2.5 bg-[#171a23] hover:bg-[#1d212c] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-[0_4px_14px_0_rgba(0,0,0,0.4)] border border-brand-border-highlight overflow-hidden"
                    >
                        {/* Button inner glow on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#e6c27a]/0 via-[#e6c27a]/10 to-[#e6c27a]/0 opacity-0 group-hover:opacity-100 translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-1000 ease-in-out pointer-events-none" />
                        <Download className="w-4 h-4 text-[#e6c27a] group-hover:text-white transition-colors z-10 relative" />
                        <span className="relative z-10 flex items-center gap-2">
                            Export to FCP <span className="text-brand-muted text-xs border border-brand-border px-1.5 py-0.5 rounded bg-black/40"><Command className="w-3 h-3 inline pb-0.5" /> E</span>
                        </span>
                    </motion.button>
                </header>

                {/* 3. THREE-PANEL CREATIVE WORKSPACE */}
                <main className="flex flex-1 overflow-hidden relative">

                    {/* PANEL A: TRANSCRIPT */}
                    <section className="w-[30%] border-r border-brand-border/40 bg-[#0a0a0c]/80 flex flex-col relative z-10 backdrop-blur-3xl">
                        <div className="p-6 pb-4 border-b border-brand-border/40 glass-panel sticky top-0 z-20">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-serif text-xl tracking-wide text-white/90">Source Script</h3>
                                <span className="text-[10px] font-mono tracking-widest text-brand-muted uppercase">04:22:10 Audio</span>
                            </div>

                            {/* Elegant Waveform Visualization */}
                            <div className="h-10 w-full flex items-end gap-[2px] opacity-60">
                                {Array.from({ length: 48 }).map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ height: '10%' }}
                                        animate={{ height: `${Math.max(10, Math.sin(i * 0.4) * 40 + Math.random() * 60)}%` }}
                                        transition={{ repeat: Infinity, repeatType: "mirror", duration: 1.5 + Math.random(), ease: "easeInOut" }}
                                        className="flex-1 bg-brand-muted/40 rounded-t-sm"
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-10">
                            {TRANSCRIPT.map((block) => (
                                <div key={block.id} className="group relative pr-4">
                                    {/* Active highlight line */}
                                    <div className={`absolute -left-6 top-0 bottom-0 w-[2px] ${block.id === 1 || block.id === 3 ? 'bg-[#e6c27a] opacity-40 shadow-[0_0_10px_#e6c27a]' : 'bg-transparent'} transition-opacity`} />

                                    <div className="flex items-center gap-3 mb-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                        <span className="font-mono text-[10px] text-brand-muted/70 tracking-wider pt-0.5">{block.time}</span>
                                        <div className="flex-1 h-px bg-gradient-to-r from-brand-border to-transparent" />
                                        <span className={`text-[11px] font-medium tracking-wide uppercase ${block.color}`}>
                                            {block.speaker}
                                        </span>
                                    </div>
                                    <p className={`text-[15px] leading-[1.8] font-sans transition-all duration-300 font-light
                    ${block.resonant ? 'text-white/95 drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)]' : 'text-brand-muted group-hover:text-white/70'}
                  `}>
                                        "{block.text}"
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* PANEL B: SEGMENTS (The Raw Material) */}
                    <section className="w-[35%] border-r border-brand-border/40 bg-[#0c0c0f]/60 flex flex-col relative z-0 backdrop-blur-xl">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(147,129,255,0.02),transparent_50%)] pointer-events-none" />

                        <div className="p-6 pb-4 flex items-center justify-between z-10 sticky top-0 border-b border-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <h3 className="font-serif text-xl tracking-wide text-white/90">Moments</h3>
                                <span className="bg-brand-surface border border-brand-border px-2 py-0.5 rounded-full text-[10px] text-brand-muted">14 Found</span>
                            </div>
                        </div>

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="flex-1 overflow-y-auto p-6 space-y-5"
                        >
                            {SEGMENTS.map((seg) => (
                                <motion.div
                                    key={seg.id}
                                    variants={itemVariants}
                                    onClick={() => setActiveSegment(seg.id)}
                                    className={`glass-card p-5 rounded-xl cursor-pointer relative overflow-hidden group transition-all duration-500
                    ${activeSegment === seg.id
                                            ? 'border-[#9381ff]/40 shadow-[0_8px_30px_rgba(147,129,255,0.08)] bg-[#9381ff]/[0.02]'
                                            : 'hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
                                        }
                  `}
                                >
                                    {/* Subtle sweep on active */}
                                    {activeSegment === seg.id && (
                                        <motion.div
                                            layoutId="activeSegmentHighlight"
                                            className="absolute inset-0 bg-gradient-to-br from-[#9381ff]/10 to-transparent pointer-events-none"
                                        />
                                    )}

                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div>
                                            <h4 className={`text-sm tracking-wide font-medium flex items-center gap-2 ${seg.value === 'Peak' ? 'text-gradient-gold' : 'text-white/90'}`}>
                                                {seg.title}
                                                {seg.value === 'Peak' && <Sparkles className="w-3 h-3 text-[#e6c27a]" />}
                                            </h4>
                                            <p className="text-[11px] font-mono text-brand-muted/70 mt-1 uppercase tracking-wider">{seg.speaker}</p>
                                        </div>

                                        {/* Exquisite Data Ring */}
                                        <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
                                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                                <circle cx="18" cy="18" r="16" className="fill-none stroke-brand-border stroke-2" />
                                                <circle
                                                    cx="18" cy="18" r="16"
                                                    className={`fill-none stroke-2 stroke-linecap-round ${seg.value === 'Peak' ? 'stroke-[#e6c27a]' : 'stroke-[#9381ff]'}`}
                                                    style={{ strokeDasharray: 100, strokeDashoffset: 100 - seg.score }}
                                                />
                                            </svg>
                                            <span className="text-[10px] font-bold text-white/80">{seg.score}</span>
                                        </div>
                                    </div>

                                    <p className="font-serif text-[15.5px] leading-relaxed text-[#dcdcdc] mb-5 italic relative z-10 opacity-90 group-hover:opacity-100 transition-opacity">
                                        "{seg.text}"
                                    </p>

                                    <div className="flex items-center justify-between mt-auto relative z-10">
                                        <div className="flex gap-2">
                                            <Badge text={seg.time} />
                                            <Badge text={seg.value} isPeak={seg.value === 'Peak'} />
                                        </div>

                                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-border/60 bg-black/20 text-[#a0a0a0] hover:text-white hover:border-[#9381ff]/40 hover:bg-[#9381ff]/10 transition-all text-xs font-medium group/btn">
                                            <CheckCircle2 className="w-3.5 h-3.5 group-hover/btn:text-[#9381ff] transition-colors" />
                                            Add to Arc
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </section>

                    {/* PANEL C: STORY ARC (The Masterpiece) */}
                    <section className="w-[35%] bg-brand-bg flex flex-col relative shadow-[inset_20px_0_40px_rgba(0,0,0,0.6)]">
                        <div className="absolute top-0 right-0 w-[60%] h-[30%] bg-[#e6c27a]/[0.02] rounded-full blur-[100px] pointer-events-none" />

                        <div className="p-6 pb-4 border-b border-brand-border/40 sticky top-0 bg-[#060608]/80 backdrop-blur-md z-20">
                            <h3 className="font-serif text-xl tracking-wide text-white/90">Narrative Arc</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto px-8 py-10">
                            <div className="space-y-14 relative">
                                {/* Glowing Timeline Spine */}
                                <div className="absolute left-[15px] top-6 bottom-0 w-px bg-gradient-to-b from-brand-border via-brand-border to-transparent" />

                                {STORY_BEATS.map((beat) => (
                                    <div
                                        key={beat.id}
                                        className="relative"
                                        onMouseEnter={() => setHoveredBeat(beat.id)}
                                        onMouseLeave={() => setHoveredBeat(null)}
                                    >
                                        <div className="flex items-start gap-6 relative z-10">
                                            {/* Timeline Node */}
                                            <div className="relative mt-1 group shrink-0">
                                                <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center border border-white/10 bg-[#0a0a0c] transition-transform duration-500 shadow-xl
                          ${hoveredBeat === beat.id ? 'scale-110' : ''}
                        `}>
                                                    <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentcolor] transition-colors duration-500
                            ${beat.isPeak ? 'bg-[#e6c27a] text-[#e6c27a]' : 'bg-[#9381ff]/60 text-[#9381ff] group-hover:bg-[#9381ff]'}
                          `} />
                                                </div>
                                            </div>

                                            <div className="flex-1 pt-0.5">
                                                <h4 className={`text-lg font-serif tracking-wide mb-1.5 transition-colors
                          ${beat.isPeak ? 'text-gradient-gold' : 'text-white/80'}
                          ${hoveredBeat === beat.id && !beat.isPeak ? '!text-white' : ''}
                        `}>
                                                    {beat.title}
                                                </h4>
                                                <p className="text-[13px] text-brand-muted/70 mb-5 font-light">{beat.desc}</p>

                                                {/* Immersive Drop Zone / Assigned Content */}
                                                <div className={`
                          min-h-[80px] rounded-xl p-5 flex flex-col gap-3 transition-all duration-300 relative overflow-hidden group/zone cursor-pointer
                          ${(beat.title === 'Hook' || beat.title === 'Peak') ? 'glass-card border-white/10' : 'border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] hover:border-[#9381ff]/30'}
                        `}>
                                                    {beat.title === 'Hook' ? (
                                                        <div className="relative z-10">
                                                            <div className="flex items-center gap-2 mb-2 text-brand-muted group-hover/zone:text-white/60 transition-colors">
                                                                <GripVertical className="w-3.5 h-3.5" />
                                                                <span className="text-[10px] uppercase tracking-wider font-mono">Bride</span>
                                                            </div>
                                                            <p className="text-[15px] font-serif italic text-white/90 leading-relaxed shadow-sm">
                                                                "I couldn't breathe until I turned around and saw him..."
                                                            </p>
                                                        </div>
                                                    ) : beat.title === 'Peak' ? (
                                                        <div className="relative z-10">
                                                            <div className="absolute left-[-20px] top-[-20px] bottom-[-20px] w-1 bg-gradient-to-b from-transparent via-[#e6c27a] to-transparent opacity-50" />
                                                            <div className="flex items-center gap-2 mb-2 text-[#e6c27a]/60 group-hover/zone:text-[#e6c27a]/80 transition-colors">
                                                                <GripVertical className="w-3.5 h-3.5" />
                                                                <span className="text-[10px] uppercase tracking-wider font-mono">Groom • Peak Moment</span>
                                                            </div>
                                                            <p className="text-[15px] font-serif italic text-[#f8e5b9] leading-relaxed shadow-sm drop-shadow-[0_0_15px_rgba(230,194,122,0.2)]">
                                                                "I promise to never stop laughing with you, even when things get hard."
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-full text-center gap-2 opacity-30 group-hover/zone:opacity-60 transition-opacity pb-2 pt-2">
                                                            <div className="w-8 h-8 rounded-full border border-dashed border-white/40 flex items-center justify-center">
                                                                <span className="text-white pb-0.5 text-lg">+</span>
                                                            </div>
                                                            <span className="text-[11px] uppercase tracking-widest font-mono">Drag Fragment Here</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                </main>
            </div>
        </div>
    );
}

// Micro Components
function SidebarIcon({ icon, active, tooltip }: { icon: React.ReactNode, active?: boolean, tooltip: string }) {
    return (
        <div className="relative group/icon cursor-pointer flex justify-center w-full">
            <div className={`p-2.5 rounded-lg transition-all duration-300
        ${active ? 'bg-[#9381ff]/15 text-[#b8b0ff] shadow-[inset_0_0_10px_rgba(147,129,255,0.1)]' : 'text-brand-muted/70 hover:bg-white/5 hover:text-white'}
      `}>
                {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
            </div>
            {active && (
                <motion.div layoutId="activeNav" className="absolute -left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#9381ff] rounded-r-full shadow-[0_0_10px_#9381ff]" />
            )}
            {/* Tooltip */}
            <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#171a23] border border-white/10 rounded-md text-[11px] font-medium text-white/90 opacity-0 group-hover/icon:opacity-100 translate-x-[-10px] group-hover/icon:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-50 shadow-xl">
                {tooltip}
            </div>
        </div>
    );
}

function Badge({ text, isPeak }: { text: string, isPeak?: boolean }) {
    return (
        <span className={`px-2 py-1 rounded text-[10px] font-mono tracking-widest uppercase flex items-center border
      ${isPeak
                ? 'bg-[#e6c27a]/10 text-[#e6c27a] border-[#e6c27a]/20 shadow-[0_0_10px_rgba(230,194,122,0.1)]'
                : 'bg-black/40 text-brand-muted/80 border-white/5'
            }
    `}>
            {text}
        </span>
    );
}
