'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Lock } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        // Read the intended destination at submit time to avoid useSearchParams
        // (which would require a Suspense boundary and can trip the build).
        const from = new URLSearchParams(window.location.search).get('from')
        window.location.href = from && from.startsWith('/') ? from : '/'
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Incorrect password')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-brand-bg text-brand-text relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#9381ff]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#e6c27a]/5 rounded-full blur-[120px]" />
      </div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onSubmit={handleSubmit}
        className="relative z-10 w-[340px] glass-panel rounded-2xl border border-brand-border/60 p-8 flex flex-col gap-6 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#9381ff] to-[#6a56cc] flex items-center justify-center shadow-[0_0_20px_rgba(147,129,255,0.3)]">
            <span className="font-serif font-bold text-[18px] text-transparent bg-clip-text bg-gradient-to-b from-[#fffaeb] to-[#e0c890]">W</span>
          </div>
          <h1 className="font-serif text-xl tracking-wide text-white/90">Weddit</h1>
          <p className="text-xs text-brand-muted">Enter the password to continue.</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-brand-border/60 bg-black/20 px-3 focus-within:border-[#9381ff]/50 transition-colors">
            <Lock className="w-4 h-4 text-brand-muted shrink-0" />
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="flex-1 bg-transparent py-2.5 text-sm text-white/90 placeholder:text-brand-muted/60 outline-none"
            />
          </div>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="flex items-center justify-center gap-2 bg-[#9381ff]/20 hover:bg-[#9381ff]/30 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all border border-[#9381ff]/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#9381ff]" /> : null}
          Unlock
        </button>
      </motion.form>
    </div>
  )
}
