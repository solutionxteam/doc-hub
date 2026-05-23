/** Brand + semantic color tokens — mirrors the web design system */

export const Brand = {
  50:  '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',   // Primary
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
} as const

export const Status = {
  pending:    '#94a3b8',
  processing: '#3b82f6',
  reviewing:  '#f59e0b',
  approved:   '#10b981',
  pushed:     '#8b5cf6',
  failed:     '#ef4444',
  rejected:   '#64748b',
} as const

export const StatusBg = {
  pending:    '#f1f5f9',
  processing: '#eff6ff',
  reviewing:  '#fffbeb',
  approved:   '#f0fdf4',
  pushed:     '#f5f3ff',
  failed:     '#fef2f2',
  rejected:   '#f8fafc',
} as const

export const Light = {
  background:    '#ffffff',
  card:          '#ffffff',
  muted:         '#f4f4f6',
  mutedFg:       '#6b7280',
  border:        '#e5e7eb',
  foreground:    '#0f172a',
  primaryFg:     '#ffffff',
  sidebar:       '#fafafa',
  sidebarFg:     '#1e293b',
  sidebarMuted:  '#6b7280',
  sidebarBorder: '#e5e7eb',
  tabBar:        '#ffffff',
  tabBarBorder:  '#e5e7eb',
} as const

export const Dark = {
  background:    '#080c1a',
  card:          '#0e1527',
  muted:         '#141d30',
  mutedFg:       '#94a3b8',
  border:        '#1e2d45',
  foreground:    '#f8fafc',
  primaryFg:     '#ffffff',
  sidebar:       '#060a14',
  sidebarFg:     '#f8fafc',
  sidebarMuted:  '#6b7280',
  sidebarBorder: '#1a2540',
  tabBar:        '#0e1527',
  tabBarBorder:  '#1e2d45',
} as const

export const LINE_GREEN = '#06C755'
