import { createContext, useContext, useState } from 'react'
import { demoScenario } from '../data/demoScenario'

const DemoContext = createContext(null)

export function DemoProvider({ children }) {
  const [demoMode, setDemoMode] = useState(true)
  // Starts as static demo scenario; overwritten when the live pipeline resolves.
  const [appData, setAppData] = useState(demoScenario)

  function updateAssessmentData(newData) {
    setAppData(newData)
  }

  return (
    <DemoContext.Provider value={{ demoMode, setDemoMode, scenario: demoScenario, appData, updateAssessmentData }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>')
  return ctx
}
