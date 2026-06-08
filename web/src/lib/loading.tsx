"use client"

/**
 * Global loading context for Slippy
 * Usage:
 *   const { setLoading } = useAppLoading()
 *   setLoading(true, "กำลังอัปโหลด...")
 *   await doWork()
 *   setLoading(false)
 *
 * Or use withLoading helper:
 *   await withLoading(async () => { ... }, "กำลังบันทึก...")
 */

import { createContext, useContext, useState, useCallback, useRef } from "react"

interface LoadingState {
  active:  boolean
  message: string
}

interface LoadingCtx {
  loading:     LoadingState
  setLoading:  (active: boolean, message?: string) => void
  withLoading: <T>(fn: () => Promise<T>, message?: string) => Promise<T>
}

const Ctx = createContext<LoadingCtx>({
  loading:     { active: false, message: "" },
  setLoading:  () => {},
  withLoading: async (fn) => fn(),
})

export function AppLoadingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoadingState] = useState<LoadingState>({ active: false, message: "" })
  const depthRef = useRef(0)   // handle nested calls

  const setLoading = useCallback((active: boolean, message = "กำลังดำเนินการ...") => {
    if (active) {
      depthRef.current++
      setLoadingState({ active: true, message })
    } else {
      depthRef.current = Math.max(0, depthRef.current - 1)
      if (depthRef.current === 0) {
        setLoadingState({ active: false, message: "" })
      }
    }
  }, [])

  const withLoading = useCallback(async <T,>(fn: () => Promise<T>, message = "กำลังดำเนินการ..."): Promise<T> => {
    setLoading(true, message)
    try {
      return await fn()
    } finally {
      setLoading(false)
    }
  }, [setLoading])

  return (
    <Ctx.Provider value={{ loading, setLoading, withLoading }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAppLoading() {
  return useContext(Ctx)
}
