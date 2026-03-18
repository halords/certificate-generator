import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { jsPDF } from 'jspdf'
import { Download, FileText, Loader2, PartyPopper, RefreshCw, CheckCircle2, Layout, X } from 'lucide-react'

const GeneratePDF = () => {
  const { templateUrl, textFields, csvData, setStep, templateDimensions, customFonts } = useStore()
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)

  // Helper to split text into normal and ordinal parts
  const parseOrdinals = (text) => {
    if (!text) return [{ text: '', isSup: false }]
    // Match numbers followed by st, nd, rd, th (case insensitive)
    const regex = /(\d+)(st|nd|rd|th)\b/gi
    const parts = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      // Text before the match
      if (match.index > lastIndex) {
        parts.push({ text: text.substring(lastIndex, match.index), isSup: false })
      }
      // The number part
      parts.push({ text: match[1], isSup: false })
      // The ordinal suffix
      parts.push({ text: match[2], isSup: true })
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push({ text: text.substring(lastIndex), isSup: false })
    }
    return parts
  }

  const generate = async () => {
    if (!templateUrl || !csvData || csvData.length === 0 || !templateDimensions.width) return

    setGenerating(true)
    setProgress(0)

    try {
      const { width: imgWidth, height: imgHeight, scale: canvasScale } = templateDimensions

      // Initialize PDF to match original image dimensions exactly
      const doc = new jsPDF({
        orientation: imgWidth > imgHeight ? 'l' : 'p',
        unit: 'px',
        format: [imgWidth, imgHeight]
      })

      const total = csvData.length

      // Load Custom Fonts into jsPDF
      if (customFonts && customFonts.length > 0) {
        customFonts.forEach(font => {
          // dataUri is typically "data:font/ttf;base64,AAEAAAA..." or similar
          const base64Str = font.dataUri.split(',')[1];
          if (base64Str) {
            doc.addFileToVFS(`${font.name}.ttf`, base64Str);
            doc.addFont(`${font.name}.ttf`, font.name, 'normal');
          }
        });
      }

      for (let i = 0; i < total; i++) {
        if (i > 0) doc.addPage([imgWidth, imgHeight])

        const row = csvData[i]

        // 1. Add background image
        doc.addImage(templateUrl, 'PNG', 0, 0, imgWidth, imgHeight)

        // 2. Add text fields
        textFields.forEach(field => {
          // Fallback to exactly what the canvas displays if no CSV data matches
          const fallbackText = (field.text && !field.text.startsWith('{{')) ? field.text : field.name.toUpperCase();
          const value = String(row[field.name] || fallbackText)

          let pdfFontSize = field.fontSize / canvasScale
          const pdfX = field.left / canvasScale
          const pdfY = field.top / canvasScale
          const pdfWidth = field.width / canvasScale

          doc.setTextColor(field.fill)

          let styleString = 'normal';
          if (field.fontWeight === 'bold' && field.fontStyle === 'italic') {
            styleString = 'bolditalic';
          } else if (field.fontWeight === 'bold') {
            styleString = 'bold';
          } else if (field.fontStyle === 'italic') {
            styleString = 'italic';
          }

          if (field.fontFamily) {
            doc.setFont(field.fontFamily, styleString);
          } else {
            doc.setFont('helvetica', styleString);
          }

          let finalLines = [value]
          let textX = pdfX

          // Apply Alignment Offset
          if (field.textAlign === 'center') {
            textX = pdfX + (pdfWidth / 2)
          } else if (field.textAlign === 'right') {
            textX = pdfX + pdfWidth
          }

          if (field.textBehavior === 'shrink') {
            // Shrink to Fit
            doc.setFontSize(pdfFontSize)
            let textWidth = doc.getTextWidth(value)

            while (textWidth > pdfWidth && pdfFontSize > 4) {
              pdfFontSize -= 0.5
              doc.setFontSize(pdfFontSize)
              textWidth = doc.getTextWidth(value)
            }
            renderTextChunks(doc, value, textX, pdfY, pdfFontSize, field.textAlign, pdfWidth)
          } else if (field.textBehavior === 'wrap') {
            // Paragraph Wrap
            doc.setFontSize(pdfFontSize)
            finalLines = doc.splitTextToSize(value, pdfWidth)
            finalLines.forEach((line, idx) => {
              renderTextChunks(doc, line, textX, pdfY + (idx * pdfFontSize), pdfFontSize, field.textAlign, pdfWidth)
            })
          } else {
            // Default: Overflow
            doc.setFontSize(pdfFontSize)
            renderTextChunks(doc, value, textX, pdfY, pdfFontSize, field.textAlign, pdfWidth)
          }
        })

        setProgress(Math.round(((i + 1) / total) * 100))
        // Small delay to allow UI to update
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 10))
      }

      const pdfBlobUrl = doc.output('bloburl');
      window.open(pdfBlobUrl, '_blank');

      setCompleted(true)
    } catch (error) {
      console.error('PDF Generation failed:', error)
      alert('Failed to generate PDF. Check console for details.')
    } finally {
      setGenerating(false)
    }
  }

  // Separate function to render chunks with superscript support
  const renderTextChunks = (doc, text, x, y, baseFontSize, align, maxWidth) => {
    const chunks = parseOrdinals(text)
    const supSize = baseFontSize * 0.6
    const supOffset = baseFontSize * 0.15

    // Calculate total width of all chunks to handle alignment
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
    <div className="flex flex-col items-center p-10 w-full h-full bg-slate-50/30 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* Left Side: Preview */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Layout size={16} /> Live Sample Preview
          </h3>
          <div
            className="relative bg-white p-2 rounded-2xl shadow-xl border border-slate-100 group"
          >
            <div className="relative overflow-hidden rounded-lg w-full h-auto" style={{ containerType: 'inline-size' }}>
              <img src={templateUrl} alt="Template" className="w-full h-auto" />
              {csvData && csvData.length > 0 && textFields.map(field => {
                const fallbackText = (field.text && !field.text.startsWith('{{')) ? field.text : field.name.toUpperCase();
                const val = String(csvData[0][field.name] || fallbackText)

                const canvasWidth = templateDimensions.width * templateDimensions.scale
                const canvasHeight = templateDimensions.height * templateDimensions.scale

                let style = {
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
                  pointerEvents: 'none'
                }

                if (field.textBehavior === 'wrap') {
                  style.whiteSpace = 'pre-wrap'
                  style.wordBreak = 'break-word'
                } else if (field.textBehavior === 'shrink') {
                  // Visual approximation of shrink using standard modern CSS limiters
                  style.whiteSpace = 'nowrap'
                } else {
                  // Overflow mode
                  style.whiteSpace = 'nowrap'
                  style.overflow = 'visible'
                }

                return (
                  <div key={field.id} style={style}>
                    {parseOrdinals(val).map((chunk, idx) => (
                      <span key={idx} style={chunk.isSup ? { fontSize: '0.6em', verticalAlign: 'super', lineHeight: 0 } : {}}>
                        {chunk.text}
                      </span>
                    ))}
                  </div>
                )
              })}
            </div>
            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px] pointer-events-none rounded-2xl">
              <span className="bg-white px-4 py-2 rounded-xl text-xs font-bold text-slate-800 shadow-lg select-none">WYSIWYG Mode Active</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 text-center font-medium italic">Showing preview for: {csvData?.[0]?.[textFields[0]?.name] || 'Row 1'}</p>
        </div>

        {/* Right Side: Generation Controls */}
        <div className="flex flex-col justify-center">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-10 flex flex-col items-center text-center space-y-8">
              {completed && (
                <div className="w-full p-6 bg-primary-50 rounded-2xl border border-primary-100 animate-in zoom-in duration-500 relative">
                  <button 
                    onClick={() => setCompleted(false)}
                    className="absolute top-2 right-2 p-1 text-primary-400 hover:text-primary-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 rounded-full bg-primary-100 text-primary-600">
                      <PartyPopper size={32} className="animate-bounce" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">Success!</h3>
                      <p className="text-xs text-slate-500 font-medium">{csvData?.length || 0} Certificates Processed Successfully</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative">
                <div className={`p-8 rounded-full bg-slate-50 transition-all duration-500 ${generating ? 'animate-pulse scale-110' : ''}`}>
                  <FileText size={48} className={generating ? 'text-primary-600' : 'text-slate-300'} />
                </div>
                {generating && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={64} className="text-primary-500 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-800">Export Options</h2>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                  Processing {csvData?.length || 0} certificates at {templateDimensions.width}x{templateDimensions.height} resolution.
                </p>
              </div>

              {generating ? (
                <div className="w-full space-y-4">
                  <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                    <span>Generating PDF...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={generate}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl shadow-xl transition-all hover:translate-y-[-4px] active:translate-y-0 flex items-center justify-center gap-3 group"
                >
                  <FileText size={20} className="group-hover:translate-y-1 transition-transform" />
                  {completed ? "Generate Again" : `Preview ${csvData?.length || 0} PDFs`}
                </button>
              )}

              <button
                onClick={() => {
                  setCompleted(false);
                  setStep(1);
                  window.location.reload();
                }}
                disabled={generating}
                className="text-slate-400 hover:text-slate-800 text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} />
                Reset & Restart
              </button>
            </div>
        </div>
      </div>
    </div>
  )
}

export default GeneratePDF
