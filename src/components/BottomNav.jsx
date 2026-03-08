import { NavLink } from 'react-router-dom'
import { Camera, Brain, Map, FileText } from 'lucide-react'

const navItems = [
  { to: '/scout', icon: Camera, label: 'Scout' },
  { to: '/agents', icon: Brain, label: 'Agents' },
  { to: '/map', icon: Map, label: 'Map' },
  { to: '/report', icon: FileText, label: 'Report' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] backdrop-blur-md h-16"
    >
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-4 transition-colors duration-150 ${isActive ? 'text-[var(--accent-primary)] font-semibold' : 'text-[var(--text-muted)] font-medium hover:text-[var(--text-secondary)]'
            }`
          }
          style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', textDecoration: 'none' }}
        >
          {({ isActive }) => (
            <>
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                style={{ filter: isActive ? 'drop-shadow(0 0 8px rgba(0,229,160,0.5))' : 'none' }}
              />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
