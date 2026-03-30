import React, { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { jsPDF } from 'jspdf'
import { Download, FileText, Loader2, PartyPopper, RefreshCw, CheckCircle2, Layout, X, Search, Eye } from 'lucide-react'

const GeneratePDF = () => {
  const { templateUrl, textFields, csvData, setStep, templateDimensions, customFonts } = useStore()
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const getAvailableFontStyle = (doc, family, requestedStyle) => {
    const list = doc.getFontList?.()
    const styles = list?.[family]
    if (!styles) return null
    if (styles.includes(requestedStyle)) return requestedStyle
    if (styles.includes('normal')) return 'normal'
    return styles[0] || null
  }

  // Helper to split text into normal and ordinal parts
  const parseOrdinals = (text) => {
    if (!text) return [{ text: '', isSup: false }]
    const regex = /(\d+)(st|nd|rd|th)\b/gi
    const parts = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.substring(lastIndex, match.index), isSup: false })
      }
      parts.push({ text: match[1], isSup: false })
      parts.push({ text: match[2], isSup: true })
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push({ text: text.substring(lastIndex), isSup: false })
    }
    return parts
  }

  const filteredData = useMemo(() => {
    if (!csvData) return []
    const reversed = [...csvData].reverse()
    if (!searchTerm) return reversed
    return reversed.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }, [csvData, searchTerm])

  const generate = async (singleRow = null) => {
    const dataToProcess = singleRow ? [singleRow] : csvData
    if (!templateUrl || !dataToProcess || dataToProcess.length === 0 || !templateDimensions.width) return

    setGenerating(true)
    setProgress(0)

    try {
      const { width: imgWidth, height: imgHeight, scale: canvasScale } = templateDimensions

      const doc = new jsPDF({
        orientation: imgWidth > imgHeight ? 'l' : 'p',
        unit: 'px',
        format: [imgWidth, imgHeight]
      })

      const total = dataToProcess.length

      if (customFonts && customFonts.length > 0) {
        customFonts.forEach((font) => {
          const base64Str = font.dataUri.split(',')[1]
          if (base64Str) {
            const filename = `${font.name}.ttf`
            doc.addFileToVFS(filename, base64Str)
            doc.addFont(filename, font.name, 'normal')
            doc.addFont(filename, font.name, 'bold')
            doc.addFont(filename, font.name, 'italic')
            doc.addFont(filename, font.name, 'bolditalic')
          }
        })
      }

      for (let i = 0; i < total; i++) {
        if (i > 0) doc.addPage([imgWidth, imgHeight])

        const row = dataToProcess[i]
        doc.addImage(templateUrl, 'PNG', 0, 0, imgWidth, imgHeight)

        textFields.forEach(field => {
          const fallbackText = (field.text && !field.text.startsWith('{{')) ? field.text : field.name.toUpperCase();
          const value = String(row[field.name] || fallbackText)

          let pdfFontSize = field.fontSize / canvasScale
          const pdfX = field.left / canvasScale
          const pdfY = field.top / canvasScale
          const pdfWidth = field.width / canvasScale

          doc.setTextColor(field.fill)

          let styleString = 'normal'
          if (field.fontWeight === 'bold' && field.fontStyle === 'italic') {
            styleString = 'bolditalic'
          } else if (field.fontWeight === 'bold') {
            styleString = 'bold'
          } else if (field.fontStyle === 'italic') {
            styleString = 'italic'
          }

          if (field.fontFamily) {
            const availableStyle = getAvailableFontStyle(doc, field.fontFamily, styleString)
            if (availableStyle) doc.setFont(field.fontFamily, availableStyle)
            else doc.setFont('helvetica', styleString)
          } else {
            doc.setFont('helvetica', styleString)
          }

          let startX = pdfX
          if (field.textAlign === 'center') {
            startX = pdfX + (pdfWidth / 2)
          } else if (field.textAlign === 'right') {
            startX = pdfX + pdfWidth
          }

          if (field.textBehavior === 'shrink') {
            doc.setFontSize(pdfFontSize)
            let textWidth = doc.getTextWidth(value)
            while (textWidth > pdfWidth && pdfFontSize > 4) {
              pdfFontSize -= 0.5
              doc.setFontSize(pdfFontSize)
              textWidth = doc.getTextWidth(value)
            }
            renderTextChunks(doc, value, startX, pdfY, pdfFontSize, field.textAlign)
          } else if (field.textBehavior === 'wrap') {
            doc.setFontSize(pdfFontSize)
            const finalLines = doc.splitTextToSize(value, pdfWidth)
            finalLines.forEach((line, idx) => {
              renderTextChunks(doc, line, startX, pdfY + (idx * pdfFontSize), pdfFontSize, field.textAlign)
            })
          } else {
            doc.setFontSize(pdfFontSize)
            renderTextChunks(doc, value, startX, pdfY, pdfFontSize, field.textAlign)
          }
        })

        setProgress(Math.round(((i + 1) / total) * 100))
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 10))
      }

      const pdfBlobUrl = doc.output('bloburl');
      window.open(pdfBlobUrl, '_blank');

      if (!singleRow) setCompleted(true)
    } catch (error) {
      console.error('PDF Generation failed:', error)
      alert('Failed to generate PDF. Check console for details.')
    } finally {
      setGenerating(false)
    }
  }

  const renderTextChunks = (doc, text, x, y, baseFontSize, align) => {
    const chunks = parseOrdinals(text)
    const supSize = baseFontSize * 0.6
    const supOffset = baseFontSize * 0.15

    let totalWidth = 0
    chunks.forEach(chunk => {
      doc.setFontSize(chunk.isSup ? supSize : baseFontSize)
      totalWidth += doc.getTextWidth(chunk.text)
    })

    let startX = x
    if (align === 'center') startX = x - (totalWidth / 2)
    else if (align === 'right') startX = x - totalWidth

    let runningX = startX
    chunks.forEach(chunk => {
      const fs = chunk.isSup ? supSize : baseFontSize
      const yOffset = chunk.isSup ? -supOffset : 0
      doc.setFontSize(fs)
      doc.text(chunk.text, runningX, y + yOffset, { baseline: 'top' })
      runningX += doc.getTextWidth(chunk.text)
    })
  }

  return (
    <div className="flex flex-col items-center p-6 w-full h-full bg-slate-50/50 overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl w-full flex flex-col gap-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Finalize & Preview</h1>
            <p className="text-slate-500 text-sm font-medium">Verify your data and generate certificates.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Search entries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all w-64 shadow-sm"
                />
             </div>
             <button
              onClick={() => generate()}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              <FileText size={18} />
              PDF Preview All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column: Data Table (2/3) */}
          <div className="xl:col-span-2 space-y-4">
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry</th>
                        {textFields.slice(0, 3).map(field => (
                          <th key={field.id} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.name}</th>
                        ))}
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-400">#{csvData.length - idx}</span>
                          </td>
                          {textFields.slice(0, 3).map(field => (
                            <td key={field.id} className="px-6 py-4">
                              <span className="text-sm font-semibold text-slate-700 truncate block max-w-[150px]">
                                {row[field.name] || '-'}
                              </span>
                            </td>
                          ))}
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => generate(row)}
                              className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                              title="Individual Preview"
                            >
                              <Eye size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredData.length === 0 && (
                        <tr>
                          <td colSpan={textFields.length + 2} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                              <Search size={32} strokeWidth={1.5} />
                              <p className="text-sm font-medium">No results found for "{searchTerm}"</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Total displayed: {filteredData.length} entries</p>
          </div>

          {/* Right Column: Live Preview & Progress (1/3) */}
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Live Template</h3>
                <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-bold rounded-full">WYSIWYG</span>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-slate-100 aspect-[1.41] bg-slate-50" style={{ containerType: 'inline-size' }}>
                <img src={templateUrl} alt="Template" className="w-full h-auto" />
                {csvData && csvData.length > 0 && textFields.map(field => {
                  const val = String(csvData[0][field.name] || field.text || '')
                  const canvasWidth = templateDimensions.width * templateDimensions.scale
                  const canvasHeight = templateDimensions.height * templateDimensions.scale

                  return (
                    <div 
                      key={field.id} 
                      style={{
                        position: 'absolute',
                        left: `${(field.left / canvasWidth) * 100}%`,
                        top: `${(field.top / canvasHeight) * 100}%`,
                        width: `${(field.width / canvasWidth) * 100}%`,
                        fontSize: `${(field.fontSize / canvasWidth) * 100}cqi`,
                        color: field.fill,
                        fontFamily: field.fontFamily || 'sans-serif',
                        fontWeight: field.fontWeight || 'normal',
                        fontStyle: field.fontStyle || 'normal',
                        textAlign: field.textAlign || 'left',
                        lineHeight: 1.16,
                        pointerEvents: 'none',
                        whiteSpace: field.textBehavior === 'wrap' ? 'pre-wrap' : 'nowrap',
                        overflow: field.textBehavior === 'shrink' ? 'hidden' : 'visible'
                      }}
                    >
                      {val}
                    </div>
                  )
                })}
              </div>
            </div>

            {generating && (
              <div className="bg-white p-6 rounded-2xl border border-primary-100 shadow-lg shadow-primary-500/5 space-y-4 animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between text-xs font-black text-primary-600 uppercase tracking-tighter">
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Generating PDFs...
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-500 transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {completed && !generating && (
              <div className="bg-primary-50 p-6 rounded-2xl border border-primary-100 space-y-3 animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-3 text-primary-600">
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black tracking-tight">Success!</h4>
                    <p className="text-[10px] font-bold opacity-70 uppercase tracking-tighter">All certificates processed</p>
                  </div>
                </div>
                <button 
                  onClick={() => setStep(1)}
                  className="w-full py-2 bg-white text-primary-600 text-xs font-bold rounded-xl border border-primary-200 hover:bg-primary-100 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  Start New Session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GeneratePDF

