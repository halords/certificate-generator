import React, { useState } from 'react'
import { useStore } from './store/useStore'
import CanvasEditor from './components/CanvasEditor'
import CsvUpload from './components/CsvUpload'
import GeneratePDF from './components/GeneratePDF'
import { ChevronLeft, ChevronRight, Layout } from 'lucide-react'

function App() {
  const currentStep = useStore((state) => state.currentStep)
  const setStep = useStore((state) => state.setStep)
  const [isCollapsed, setIsCollapsed] = useState(true)

  const steps = [
    { num: 1, title: 'Draw Fields' },
    { num: 2, title: 'Upload Data' },
    { num: 3, title: 'Generate PDF' }
  ]

  return (
    <div className="h-screen w-screen flex bg-slate-50 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <aside 
        className={`${isCollapsed ? 'w-20' : 'w-72'} bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800 shadow-2xl z-20 transition-all duration-300 relative group/sidebar`}
      >
        {/* Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-primary-500 transition-colors z-30"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`p-8 pb-4 transition-all duration-300 ${isCollapsed ? 'px-4 flex flex-col items-center' : ''}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform shrink-0">
              <span className="text-xl font-black italic">CG</span>
            </div>
            {!isCollapsed && (
              <h1 className="text-lg font-black tracking-tighter uppercase leading-none animate-in fade-in duration-300">
                Cert<br /><span className="text-primary-400">Gen</span>
              </h1>
            )}
          </div>
          {!isCollapsed && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] animate-in fade-in duration-300">Bulk Certificate Editor</p>}
        </div>

        {/* Stepper Vertical */}
        <nav className={`flex-grow p-6 space-y-1 transition-all duration-300 ${isCollapsed ? 'px-2' : ''}`}>
          {steps.map((step) => {
            const isActive = currentStep === step.num
            const isCompleted = currentStep > step.num
            return (
              <button
                key={step.num}
                onClick={() => setStep(step.num)}
                title={isCollapsed ? step.title : ''}
                className={`w-full flex items-center transition-all group ${
                  isCollapsed ? 'justify-center p-3' : 'gap-4 p-4'
                } rounded-2xl ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm transition-all shadow-inner shrink-0 ${
                  isActive ? 'bg-white/20 text-white scale-110' : isCompleted ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  {isCompleted ? '✓' : step.num}
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col items-start translate-y-[-1px] animate-in fade-in slide-in-from-left-2 duration-300">
                    <span className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${isActive ? 'text-primary-200' : 'text-slate-500'}`}>Step {step.num}</span>
                    <span className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                      {step.title}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </nav>

        <div className={`p-8 border-t border-slate-800 transition-all duration-300 ${isCollapsed ? 'p-4 flex justify-center' : ''}`}>
          {isCollapsed ? (
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
          ) : (
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 animate-in fade-in duration-300 w-full">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Status</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-bold text-slate-300">System Ready</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow relative flex flex-col bg-white overflow-hidden transition-all duration-300">
        {currentStep === 1 && <CanvasEditor />}
        {currentStep === 2 && <CsvUpload />}
        {currentStep === 3 && <GeneratePDF />}
      </main>
    </div>
  )
}

export default App
