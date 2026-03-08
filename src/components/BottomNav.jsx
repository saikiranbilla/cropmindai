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
      style={{ background: '#0d1220', borderTop: '1px solid #1e2d4a' }}
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe"
    >
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-4 text-xs font-medium transition-colors duration-150 ${
              isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                className={isActive ? 'drop-shadow-[0_0_6px_rgba(96,165,250,0.7)]' : ''}
              />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
