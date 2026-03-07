import { createContext, useContext, useState } from 'react'
import { demoScenario } from '../data/demoScenario'

const DemoContext = createContext(null)

export function DemoProvider({ children }) {
  const [demoMode, setDemoMode] = useState(true)

  return (
    <DemoContext.Provider value={{ demoMode, setDemoMode, scenario: demoScenario }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>')
  return ctx
}
