import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface OrgInfo {
  id:        string
  name:      string
  plan:      string
  doc_quota: number
  doc_used:  number
  role:      string
}

interface AuthState {
  session:     Session | null
  user:        User   | null
  profile:     { full_name: string | null; avatar_url: string | null } | null
  org:         OrgInfo | null
  initialized: boolean

  // actions
  initialize:     () => Promise<void>
  signIn:         (email: string, password: string) => Promise<{ error: string | null }>
  signOut:        () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshOrg:     () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session:     null,
  user:        null,
  profile:     null,
  org:         null,
  initialized: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    set({ session, user: session?.user ?? null })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null })
      if (session?.user) {
        get().refreshProfile()
        get().refreshOrg()
      } else {
        set({ profile: null, org: null })
      }
    })

    if (session?.user) {
      await Promise.all([get().refreshProfile(), get().refreshOrg()])
    }
    set({ initialized: true })
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    await Promise.all([get().refreshProfile(), get().refreshOrg()])
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null, org: null })
  },

  refreshProfile: async () => {
    const { user } = get()
    if (!user) return
    const { data } = await supabase
      .from('users')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single()
    set({ profile: data })
  },

  refreshOrg: async () => {
    const { user } = get()
    if (!user) return
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    if (!membership) return

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, plan, doc_quota, doc_used')
      .eq('id', membership.organization_id)
      .single()

    if (org) set({ org: { ...org, role: membership.role } })
  },
}))
