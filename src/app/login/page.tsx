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
      </div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onSubmit={handleSubmit}
        className="relative z-10 w-[340px] glass-panel rounded-2xl border border-brand-border/60 p-8 flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-11 h-11 rounded-xl bg-[#e94a47] flex items-center justify-center">
            <span className="font-serif text-[18px] text-[#f5f2ec]">W</span>
          </div>
          <h1 className="font-serif text-xl tracking-wide text-brand-text/90">Weddit</h1>
          <p className="text-xs text-brand-muted">Enter the password to continue.</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-brand-border/60 bg-black/20 px-3 focus-within:border-[#e94a47]/50 transition-colors">
            <Lock className="w-4 h-4 text-brand-muted shrink-0" />
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="flex-1 bg-transparent py-2.5 text-sm text-brand-text/90 placeholder:text-brand-muted/60 outline-none"
            />
          </div>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="flex items-center justify-center gap-2 bg-[#e94a47] hover:bg-[#f0625f] text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Unlock
        </button>
      </motion.form>
    </div>
  )
}
