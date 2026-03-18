import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { fabric } from 'fabric'
import { Type, Trash2, ChevronRight, Layout, Settings2, Palette, ListChecks, Type as FontIcon, AlignLeft, AlignCenter, AlignRight, Maximize, WrapText, ArrowRightToLine, Upload, Save, Bookmark, X, Plus, FileUp, Download, Edit2, Check } from 'lucide-react'

const CanvasEditor = () => {
  const { templateUrl, textFields, setTextFields, setStep, setTemplateDimensions } = useStore()
  const canvasRef = useRef(null)
  const fabricCanvas = useRef(null)
  
  // Track selected by ID for better React state syncing
  const [selectedId, setSelectedId] = useState(null)
  const [refreshCounter, setRefreshCounter] = useState(0) // Used to force re-renders of the sidebar
  const [presets, setPresets] = useState([])
  const [showSaveNaming, setShowSaveNaming] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [loadCounter, setLoadCounter] = useState(0)
  const [activePresetId, setActivePresetId] = useState(null)
  const [missingFonts, setMissingFonts] = useState([])
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [isHovering, setIsHovering] = useState(false)

  const defaultFonts = ['sans-serif', 'serif', 'monospace', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact']
  const fileInputRef = useRef(null)
  const templateInputRef = useRef(null)
  const importInputRef = useRef(null)

  // Load presets from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('certificate_presets')
    if (saved) {
      try {
        setPresets(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse presets", e)
      }
    }
  }, [])

  const savePreset = () => {
    if (!newPresetName.trim()) return
    
    // Identified unique custom fonts used in current textFields
    const customFontNames = useStore.getState().customFonts.map(f => f.name)
    const requiredCustomFonts = [...new Set(
      textFields
        .filter(f => customFontNames.includes(f.fontFamily))
        .map(f => f.fontFamily)
    )]

    const newPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      templateUrl,
      textFields,
      requiredCustomFonts,
      timestamp: new Date().toISOString()
    }

    const updatedPresets = [newPreset, ...presets]
    
    try {
      localStorage.setItem('certificate_presets', JSON.stringify(updatedPresets))
      setPresets(updatedPresets)
      setShowSaveNaming(false)
      setNewPresetName('')
    } catch (e) {
      alert("Failed to save preset. Storage may be full (max 5MB). Try deleting old presets.")
      console.error(e)
    }
  }

  const loadPreset = (preset) => {
    if (!window.confirm(`Load preset "${preset.name}"? This will replace your current design.`)) return
    
    // Update store
    useStore.getState().setTemplateUrl(preset.templateUrl)
    useStore.getState().setTextFields(preset.textFields)
    setLoadCounter(c => c + 1)
    setActivePresetId(preset.id)

    // Check for missing fonts
    const currentCustomFonts = useStore.getState().customFonts.map(f => f.name)
    const missing = (preset.requiredCustomFonts || []).filter(f => !currentCustomFonts.includes(f))
    setMissingFonts(missing)
    
    // The useEffect[templateUrl, loadCounter] in CanvasEditor will handle re-initializing the fabric canvas
  }

  const updatePreset = (id, e) => {
    if (e) e.stopPropagation()
    const preset = presets.find(p => p.id === id)
    if (!preset) return

    if (!window.confirm(`Update preset "${preset.name}" with current design?`)) return

    const customFontNames = useStore.getState().customFonts.map(f => f.name)
    const requiredCustomFonts = [...new Set(
      textFields
        .filter(f => customFontNames.includes(f.fontFamily))
        .map(f => f.fontFamily)
    )]

    const updatedPresets = presets.map(p => 
      p.id === id 
        ? { ...p, templateUrl, textFields, requiredCustomFonts, timestamp: new Date().toISOString() } 
        : p
    )

    try {
      localStorage.setItem('certificate_presets', JSON.stringify(updatedPresets))
      setPresets(updatedPresets)
      setActivePresetId(id)
    } catch (e) {
      alert("Failed to update preset. Storage may be full.")
      console.error(e)
    }
  }

  const deletePreset = (id, e) => {
    e.stopPropagation()
    if (!window.confirm("Delete this preset?")) return
    
    const updatedPresets = presets.filter(p => p.id !== id)
    localStorage.setItem('certificate_presets', JSON.stringify(updatedPresets))
    setPresets(updatedPresets)
    if (activePresetId === id) setActivePresetId(null)
  }

  const exportPreset = (preset) => {
    const dataStr = JSON.stringify(preset, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `${preset.name.replace(/\s+/g, '_')}_preset.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const handleImportPreset = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const importedPreset = JSON.parse(event.target.result)
        
        // Basic validation
        if (!importedPreset.name || !importedPreset.templateUrl || !Array.isArray(importedPreset.textFields)) {
          alert("Invalid preset file format.")
          return
        }

        // Give it a new ID to avoid collisions
        importedPreset.id = Date.now().toString()
        importedPreset.timestamp = new Date().toISOString()

        const updatedPresets = [importedPreset, ...presets]
        localStorage.setItem('certificate_presets', JSON.stringify(updatedPresets))
        setPresets(updatedPresets)
        alert(`Preset "${importedPreset.name}" imported successfully!`)
      } catch (e) {
        console.error("Failed to import preset", e)
        alert("Failed to import preset. Check file format.")
      }
    }
    reader.readAsText(file)
  }

  const handleFileUpload = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const url = e.target.result
        useStore.getState().setTemplateUrl(url)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleChangeTemplate = (e) => {
    const file = e.target.files[0]
    handleFileUpload(file)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsHovering(false)
    const file = e.dataTransfer.files[0]
    handleFileUpload(file)
  }, [])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    setIsHovering(true)
  }, [])

  const onDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsHovering(false)
  }, [])

  const handleFileClick = (e) => {
    const file = e.target.files[0]
    handleFileUpload(file)
  }

  const renamePreset = (id, newName) => {
    if (!newName.trim()) return
    const updatedPresets = presets.map(p => p.id === id ? { ...p, name: newName.trim() } : p)
    localStorage.setItem('certificate_presets', JSON.stringify(updatedPresets))
    setPresets(updatedPresets)
    setRenamingId(null)
  }

  const applyOrdinalsToCanvas = (obj) => {
    if (!obj || !obj.text) return
    const text = String(obj.text)
    const regex = /(\d+)(st|nd|rd|th)\b/gi
    let match
    
    // Clear existing styles first by resetting styles object entirely.
    // This prevents individual characters from locking their fontSize
    // and overriding the global object fontSize when the user scales or uses sliders.
    obj.styles = {}

    while ((match = regex.exec(text)) !== null) {
      const suffixIdx = match.index + match[1].length
      const suffixLen = match[2].length
      
      // Apply superscript style to the suffix (st, nd, rd, th)
      obj.setSelectionStyles({ 
        deltaY: -obj.fontSize * 0.15, 
        fontSize: obj.fontSize * 0.6 
      }, suffixIdx, suffixIdx + suffixLen)
    }
    
    // Force re-render for this object
    obj.dirty = true
  }

  useEffect(() => {
    if (!templateUrl) return

    let isAlive = true
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#f1f5f9'
    })
    fabricCanvas.current = canvas

    fabric.Image.fromURL(templateUrl, (img) => {
      // Prevent running if component was unmounted or effect re-ran
      if (!isAlive || !fabricCanvas.current) return

      const originalWidth = img.width
      const originalHeight = img.height
      const ratio = Math.min(800 / originalWidth, 600 / originalHeight)
      
      setTemplateDimensions({
        width: originalWidth,
        height: originalHeight,
        scale: ratio
      })

      img.scale(ratio)
      
      canvas.setDimensions({
        width: originalWidth * ratio,
        height: originalHeight * ratio
      })
      
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas))
    })

    // Load existing fields if any
    textFields.forEach(field => {
      // Display text uppercase and without braces
      const displayText = (field.text && !field.text.startsWith('{{')) ? field.text : field.name.toUpperCase()
      
      const text = new fabric.Textbox(displayText, {
        left: field.left,
        top: field.top,
        width: field.width || 200,
        fontSize: field.fontSize,
        fill: field.fill,
        fontFamily: field.fontFamily || 'sans-serif',
        fontWeight: field.fontWeight || 'normal',
        fontStyle: field.fontStyle || 'normal',
        textAlign: field.textAlign || 'left',
        lineHeight: 1,
        id: field.id,
        name: field.name,
        textBehavior: field.textBehavior || 'overflow', // Custom property: 'overflow', 'wrap', 'shrink'
        hasControls: true,
        cornerSize: 8,
        transparentCorners: false,
        cornerColor: '#2563eb',
        borderColor: '#2563eb'
      })
      
      applyOrdinalsToCanvas(text)
      canvas.add(text)
    })

    canvas.on('selection:created', (e) => setSelectedId(e.target?.id || null))
    canvas.on('selection:updated', (e) => setSelectedId(e.target?.id || null))
    canvas.on('selection:cleared', () => setSelectedId(null))
    
    // Sync direct text editing back to name meta
    canvas.on('text:changed', (e) => {
      const obj = e.target
      let rawText = obj.text
      // The user typed something direct. Since we don't know the intended variable mapping
      // if they just type "HELLO", we map it to "HELLO".
      // We don't use braces anymore.
      obj.name = rawText
      applyOrdinalsToCanvas(obj)
      updateStoreFields()
    })

    // Custom rendering for center guidelines and 1-inch margins
    canvas.on('after:render', () => {
      const ctx = canvas.contextContainer;
      const w = canvas.width;
      const h = canvas.height;
      
      // Calculate 1 inch in pixels dynamically assuming standard physical paper sizes (8.5x11 inches)
      const { width: docWidth, height: docHeight, scale } = useStore.getState().templateDimensions;
      const physicalWidthInches = docWidth > docHeight ? 11 : 8.5;
      const marginPx = (docWidth / physicalWidthInches) * (scale || 1);
      
      ctx.save();
      ctx.beginPath();
      
      // Center guides (Subtle, dashed)
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.4)'; // Primary color with opacity
      ctx.lineWidth = 1;
      
      // Vertical Center
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      
      // Horizontal Center
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // 1-Inch Side Margins (Red dotted, more distinct warning)
      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; // Red color for margins
      ctx.lineWidth = 1;
      
      // Left Margin
      ctx.moveTo(marginPx, 0);
      ctx.lineTo(marginPx, h);
      
      // Right Margin
      ctx.moveTo(w - marginPx, 0);
      ctx.lineTo(w - marginPx, h);
      
      ctx.stroke();
      ctx.restore();
    })

    const enforceBoundingBox = (obj) => {
      if (!obj) return;
      
      const { width: docWidth, height: docHeight, scale } = useStore.getState().templateDimensions;
      const physicalWidthInches = docWidth > docHeight ? 11 : 8.5;
      const marginPx = (docWidth / physicalWidthInches) * (scale || 1);
      
      const objWidth = obj.width * obj.scaleX;
      
      // Restrict Left Margin
      if (obj.left < marginPx) {
        obj.set('left', marginPx);
      }
      
      // Restrict Right Margin
      if (obj.left + objWidth > canvas.width - marginPx) {
        // If the object itself is wider than the allowed area, clamp to left margin
        if (objWidth > canvas.width - (marginPx * 2)) {
          obj.set('left', marginPx);
        } else {
          obj.set('left', canvas.width - marginPx - objWidth);
        }
      }
    };

    // Keyboard Nudge Support
    const handleKeyDown = (e) => {
      const activeObj = canvas.getActiveObject()
      if (!activeObj) return

      // Don't nudge if user is actively typing in the text field or an input box
      if (activeObj.isEditing || e.target.tagName.toLowerCase() === 'input') return

      let step = e.shiftKey ? 10 : 2 // Shift+Arrow moves faster
      
      let moved = false;
      switch (e.key) {
        case 'ArrowUp':
          activeObj.set('top', activeObj.top - step)
          moved = true;
          break
        case 'ArrowDown':
          activeObj.set('top', activeObj.top + step)
          moved = true;
          break
        case 'ArrowLeft':
          activeObj.set('left', activeObj.left - step)
          moved = true;
          break
        case 'ArrowRight':
          activeObj.set('left', activeObj.left + step)
          moved = true;
          break
        default:
          return // Let other keys behave normally
      }
      
      if (moved) {
        e.preventDefault() // Prevent scrolling
        enforceBoundingBox(activeObj)
        activeObj.setCoords() // Update bounding box
        canvas.renderAll()
        updateStoreFields()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    canvas.on('object:moving', (e) => enforceBoundingBox(e.target));

    canvas.on('object:scaling', (e) => {
      const obj = e.target;
      if (obj && obj.type === 'textbox') {
        const scaleX = obj.scaleX;
        const scaleY = obj.scaleY;
        const maxScale = Math.max(scaleX, scaleY);
        
        obj.set({
          width: obj.width * scaleX,
          fontSize: obj.fontSize * maxScale,
          scaleX: 1,
          scaleY: 1
        });
        
        applyOrdinalsToCanvas(obj);
      }
      enforceBoundingBox(e.target);
    })

    canvas.on('object:modified', () => updateStoreFields())

    return () => {
      isAlive = false
      window.removeEventListener('keydown', handleKeyDown)
      canvas.dispose()
      fabricCanvas.current = null
    }
  }, [templateUrl, loadCounter])

  const updateStoreFields = () => {
    if (!fabricCanvas.current) return
    const objects = fabricCanvas.current.getObjects('textbox')
    const fields = objects.map(obj => ({
      id: obj.id,
      name: obj.name,
      text: obj.text,
      fontSize: obj.fontSize,
      fill: obj.fill,
      fontFamily: obj.fontFamily,
      fontWeight: obj.fontWeight,
      fontStyle: obj.fontStyle,
      textAlign: obj.textAlign,
      textBehavior: obj.textBehavior || 'overflow',
      left: obj.left,
      top: obj.top,
      width: obj.width * obj.scaleX,
      height: obj.height * obj.scaleY
    }))
    setTextFields(fields)
    setRefreshCounter(c => c + 1)
  }

  const applyTextBehavior = (obj, behavior) => {
    obj.set('textBehavior', behavior);
    // Note: To avoid Fabric.js rendering crashes, we allow default wrapping on the canvas 
    // and handle the strict wrapping/shrink-to-fit rules perfectly in the PDF generation.
  }

  const addTextField = () => {
    if (!fabricCanvas.current) return
    const fieldCount = fabricCanvas.current.getObjects('textbox').length
    const defaultName = `Variable_${fieldCount + 1}`
    const id = Math.random().toString(36).substr(2, 9)
    const text = new fabric.Textbox(defaultName.toUpperCase(), {
      left: 100,
      top: 100 + (fieldCount * 30),
      width: 200,
      fontSize: 24,
      fill: '#000000',
      fontFamily: 'sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      lineHeight: 1,
      id: id,
      name: defaultName,
      textBehavior: 'overflow',
      cornerSize: 8,
      transparentCorners: false,
      cornerColor: '#2563eb',
      borderColor: '#2563eb'
    })
    applyTextBehavior(text, 'overflow');
    fabricCanvas.current.add(text)
    fabricCanvas.current.setActiveObject(text)
    setSelectedId(id)
    updateStoreFields()
  }

  const deleteSelected = () => {
    if (!fabricCanvas.current) return
    const active = fabricCanvas.current.getActiveObject()
    if (active) {
      fabricCanvas.current.remove(active)
      fabricCanvas.current.discardActiveObject()
      setSelectedId(null)
      updateStoreFields()
    }
  }

  const updateSelectedField = (key, value) => {
    if (!fabricCanvas.current) return
    const active = fabricCanvas.current.getActiveObject()
    if (active) {
      if (key === 'textBehavior') {
        applyTextBehavior(active, value);
      } else {
        active.set(key, value)
      }
      
      if (key === 'name') {
        active.name = value
        active.set('text', value.toUpperCase())
      }
      // Re-apply ordinals logic for any attribute change (e.g. fontSize, text)
      applyOrdinalsToCanvas(active)
      active.setCoords()
      fabricCanvas.current.renderAll()
      updateStoreFields()
    }
  }

  const handleFontUpload = (e, applyToSelection = true) => {
    if (!fabricCanvas.current) return
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      // Remove extension to use as font-family name, remove spaces/special chars
      const baseName = file.name.split('.').slice(0, -1).join('.');
      const fontFamilyName = baseName.replace(/[^a-zA-Z0-9]/g, '');

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target.result; // Data URL
        
        // Inject CSS rule so the canvas can render it
        const newStyle = document.createElement('style');
        newStyle.appendChild(document.createTextNode(`
          @font-face {
            font-family: '${fontFamilyName}';
            src: url('${result}');
          }
        `));
        document.head.appendChild(newStyle);

        // Save to store so GeneratePDF can embed it
        useStore.getState().addCustomFont({
          name: fontFamilyName,
          dataUri: result
        })

        // Update state if it was a missing font
        setMissingFonts(prev => prev.filter(f => f !== fontFamilyName))

        // We use a small timeout to let the browser parse the injected font
        setTimeout(() => {
          if (applyToSelection) {
            updateSelectedField('fontFamily', fontFamilyName);
          }
          if (fabricCanvas.current) {
            fabricCanvas.current.renderAll();
          }
        }, 100);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    e.target.value = null;
  }


  const selectFieldById = (id) => {
    if (!fabricCanvas.current) return
    const objects = fabricCanvas.current.getObjects()
    const target = objects.find(obj => obj.id === id)
    if (target) {
      fabricCanvas.current.setActiveObject(target)
      setSelectedId(id)
      fabricCanvas.current.renderAll()
    }
  }

  // Get current active object properties from the Fabric instance
  const getActiveObjectProps = () => {
    if (!selectedId || !fabricCanvas.current) return null
    const obj = fabricCanvas.current.getObjects().find(o => o.id === selectedId)
    return obj || null
  }

  const activeObj = getActiveObjectProps()

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden">
      {/* Sidebar Controls */}
      <div className="w-80 bg-white border-r border-slate-100 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-50 bg-white">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <Layout size={18} className="text-primary-600" />
            Design Canvas
          </h2>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Canvas Tools</p>
            <button 
              onClick={() => templateInputRef.current?.click()}
              className="text-primary-600 hover:text-primary-700 flex items-center gap-1 font-bold transition-all text-[10px] bg-primary-50 px-2 py-1 rounded-lg"
              title="Change the background certificate template"
            >
              <FileUp size={12} /> Swap Template
            </button>
            <input 
              type="file" 
              ref={templateInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleChangeTemplate} 
            />
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-5 pb-20 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
          {/* Preset Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-slate-400 font-black text-[10px] uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <Bookmark size={14} />
                Saved Presets
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => importInputRef.current?.click()}
                  className="text-slate-500 hover:text-primary-600 flex items-center gap-1 font-bold transition-all text-[10px] bg-slate-50 hover:bg-primary-50 px-2 py-1 rounded-lg"
                  title="Import preset from JSON file"
                >
                  <Upload size={12} /> Import
                </button>
                <input 
                  type="file" 
                  ref={importInputRef} 
                  className="hidden" 
                  accept=".json" 
                  onChange={handleImportPreset} 
                />
                {templateUrl && !showSaveNaming && (
                  <button 
                    onClick={() => setShowSaveNaming(true)}
                    className="text-primary-600 font-bold transition-all text-[10px] bg-primary-50 px-2 py-1 rounded-lg"
                  >
                    <Plus size={12} /> New
                  </button>
                )}
              </div>
            </div>

            {showSaveNaming && (
              <div className="p-4 bg-primary-50 rounded-2xl border border-primary-200 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-primary-600 uppercase">Preset Name</span>
                  <button onClick={() => setShowSaveNaming(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                  placeholder="e.g. Master Diploma"
                  className="w-full px-3 py-2 bg-white border-2 border-primary-200 rounded-xl focus:border-primary-500 outline-none text-sm font-bold text-slate-800 transition-all mb-3"
                />
                <button
                  onClick={savePreset}
                  disabled={!newPresetName.trim()}
                  className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Save size={14} />
                  Save Design
                </button>
              </div>
            )}

            {/* Missing Fonts Alert */}
            {missingFonts.length > 0 && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 animate-in slide-in-from-top duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase">
                    <FontIcon size={14} />
                    Missing Fonts Required
                  </div>
                  <button 
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.ttf,.otf';
                      input.multiple = true;
                      input.onchange = (e) => handleFontUpload(e, false);
                      input.click();
                    }}
                    className="text-[10px] font-black bg-amber-200 text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-300 transition-colors uppercase flex items-center gap-1"
                  >
                    <Upload size={10} /> Upload All
                  </button>
                </div>
                <div className="space-y-2">
                  {missingFonts.map(font => (
                    <div key={font} className="bg-white p-3 rounded-xl border border-amber-100 flex items-center justify-between shadow-sm">
                      <span className="text-xs font-bold text-slate-700">{font}</span>
                      <button 
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.ttf,.otf';
                          input.onchange = (e) => handleFontUpload(e, false);
                          input.click();
                        }}
                        className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-600 rounded-lg transition-all"
                        title={`Upload ${font}`}
                      >
                        <Upload size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-amber-500 mt-2 italic font-medium">Upload several at once to restore design.</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              {presets.length === 0 ? (
                <div className="text-[10px] text-slate-400 italic font-medium px-1">
                  No saved designs yet.
                </div>
              ) : (
                presets.map(preset => (
                  <div 
                    key={preset.id}
                    onClick={() => loadPreset(preset)}
                    className={`group relative p-3 border rounded-xl hover:shadow-sm transition-all cursor-pointer flex items-center justify-between overflow-hidden ${
                      activePresetId === preset.id 
                      ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-100' 
                      : 'bg-white border-slate-100 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-12 flex-grow">
                      {renamingId === preset.id ? (
                        <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                          <input 
                            autoFocus
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renamePreset(preset.id, renameValue)
                              if (e.key === 'Escape') setRenamingId(null)
                            }}
                            className="flex-grow px-2 py-1 bg-white border border-primary-300 rounded text-xs font-bold outline-none"
                          />
                          <button 
                            onClick={() => renamePreset(preset.id, renameValue)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            onClick={() => setRenamingId(null)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className={`text-xs font-bold truncate ${activePresetId === preset.id ? 'text-primary-700' : 'text-slate-700'}`}>
                            {preset.name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">
                            {preset.textFields.length} variables • {new Date(preset.timestamp).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="absolute right-2 flex items-center gap-1">
                      {renamingId !== preset.id && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setRenamingId(preset.id); setRenameValue(preset.name); }}
                            className="p-1.5 text-slate-300 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Rename preset"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => updatePreset(preset.id, e)}
                            className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                              activePresetId === preset.id 
                              ? 'text-primary-500 hover:bg-primary-100' 
                              : 'text-slate-300 hover:text-primary-500 hover:bg-primary-50'
                            }`}
                            title="Update with current design"
                          >
                            <Save size={14} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); exportPreset(preset); }}
                            className="p-1.5 text-slate-300 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Export preset to JSON"
                          >
                            <Download size={14} />
                          </button>
                          <button 
                            onClick={(e) => deletePreset(preset.id, e)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Delete preset"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="h-px bg-slate-100 w-full mt-4"></div>
          </div>
            <button
              onClick={addTextField}
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group mb-2"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform" />
              Add Variable Field
            </button>

          {activeObj ? (
            <div key={activeObj.id} className="space-y-6 animate-in slide-in-from-left duration-300">
              <div className="p-5 bg-primary-50/50 rounded-2xl border border-primary-100 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-primary-800 font-bold text-xs uppercase tracking-wider">
                  <Settings2 size={16} />
                  Field Settings
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-primary-600 mb-1 ml-1 uppercase">Field Name (CSV Header)</label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={activeObj.name || ''}
                      onChange={(e) => updateSelectedField('name', e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-primary-100 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none font-bold text-slate-800 transition-all shadow-sm"
                      placeholder="e.g. FullName"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-300">
                       <FontIcon size={16} />
                    </div>
                  </div>
                  <p className="text-[10px] text-primary-400 mt-2 ml-1 italic font-medium">This MUST match your CSV column title exactly.</p>
                </div>

                <div className="pt-2">
                  <label className="block text-[10px] font-black text-slate-400 mb-2 ml-1 uppercase">Font Family</label>
                  <div className="space-y-2">
                    <select
                      value={activeObj.fontFamily}
                      onChange={(e) => updateSelectedField('fontFamily', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                      style={{ fontFamily: activeObj.fontFamily }}
                    >
                      {defaultFonts.map(font => (
                        <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                      ))}
                      {useStore.getState().customFonts.map(font => (
                        <option key={font.name} value={font.name} style={{ fontFamily: font.name }}>{font.name} (Custom)</option>
                      ))}
                    </select>
                    
                    <div>
                      <input 
                      type="file" 
                      accept=".ttf,.otf" 
                      multiple
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={(e) => handleFontUpload(e, true)}
                    />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-xs shadow-sm"
                      >
                        <Upload size={14} />
                        Upload Custom Font (.ttf/.otf)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-[10px] font-black text-slate-400 mb-2 ml-1 uppercase flex justify-between">
                    <span>Font Size</span>
                    <span className="text-primary-500 font-bold tracking-widest text-[8px]">PX</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="10"
                      max="150"
                      value={activeObj.fontSize}
                      onChange={(e) => updateSelectedField('fontSize', parseInt(e.target.value))}
                      className="flex-grow h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={activeObj.fontSize}
                      onChange={(e) => updateSelectedField('fontSize', parseInt(e.target.value) || 24)}
                      className="w-16 h-8 text-sm font-bold text-center text-slate-700 bg-white border-2 border-slate-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 ml-1 uppercase flex items-center gap-1">
                    <Palette size={12} /> Text Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={activeObj.fill}
                      onChange={(e) => updateSelectedField('fill', e.target.value)}
                      className="w-full h-12 p-1.5 bg-white border border-slate-200 rounded-xl cursor-pointer shadow-sm hover:border-primary-300 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 ml-1 uppercase flex items-center gap-1">
                    <Type size={12} /> Formatting
                  </label>
                  <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                    <button
                      onClick={() => updateSelectedField('fontWeight', activeObj.fontWeight === 'bold' ? 'normal' : 'bold')}
                      className={`flex-1 py-1.5 flex justify-center rounded-lg transition-all ${activeObj.fontWeight === 'bold' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Bold"
                    >
                      <span className="font-bold">B</span>
                    </button>
                    <button
                      onClick={() => updateSelectedField('fontStyle', activeObj.fontStyle === 'italic' ? 'normal' : 'italic')}
                      className={`flex-1 py-1.5 flex justify-center rounded-lg transition-all ${activeObj.fontStyle === 'italic' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Italic"
                    >
                      <span className="italic font-serif">I</span>
                    </button>
                  </div>

                  <label className="block text-[10px] font-black text-slate-400 mb-2 ml-1 uppercase flex items-center gap-1">
                    <Layout size={12} /> Alignment
                  </label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => updateSelectedField('textAlign', 'left')}
                      className={`flex-1 py-1.5 flex justify-center rounded-lg transition-all ${activeObj.textAlign === 'left' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Left Align"
                    >
                      <AlignLeft size={16} />
                    </button>
                    <button
                      onClick={() => updateSelectedField('textAlign', 'center')}
                      className={`flex-1 py-1.5 flex justify-center rounded-lg transition-all ${activeObj.textAlign === 'center' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Center Align"
                    >
                      <AlignCenter size={16} />
                    </button>
                    <button
                      onClick={() => updateSelectedField('textAlign', 'right')}
                      className={`flex-1 py-1.5 flex justify-center rounded-lg transition-all ${activeObj.textAlign === 'right' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Right Align"
                    >
                      <AlignRight size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 ml-1 uppercase flex items-center gap-1">
                    <Maximize size={12} /> Bounds Behavior
                  </label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => updateSelectedField('textBehavior', 'overflow')}
                      className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-lg transition-all ${activeObj.textBehavior === 'overflow' || !activeObj.textBehavior ? 'bg-white shadow-sm text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Allow Text to Overflow Bounds"
                    >
                      <ArrowRightToLine size={16} className="mb-1" />
                      <span className="text-[9px] font-bold uppercase">Extend</span>
                    </button>
                    <button
                      onClick={() => updateSelectedField('textBehavior', 'wrap')}
                      className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-lg transition-all ${activeObj.textBehavior === 'wrap' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Wrap Text to Next Line"
                    >
                      <WrapText size={16} className="mb-1" />
                      <span className="text-[9px] font-bold uppercase">Wrap</span>
                    </button>
                    <button
                      onClick={() => updateSelectedField('textBehavior', 'shrink')}
                      className={`flex-1 py-1.5 flex flex-col items-center justify-center rounded-lg transition-all ${activeObj.textBehavior === 'shrink' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Shrink Font Size to Fit Width"
                    >
                      <FontIcon size={16} className="mb-1" />
                      <span className="text-[9px] font-bold uppercase">Shrink</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 ml-1">Resize the blue box on the canvas to set bounds.</p>
                </div>

                <div className="pt-4 border-t border-primary-100/50">
                  <button
                    onClick={deleteSelected}
                    className="w-full py-3 bg-white hover:bg-red-50 text-red-500 border border-red-100 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md hover:border-red-200"
                  >
                    <Trash2 size={16} />
                    Remove this Field
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                <ListChecks size={16} />
                Active Fields ({textFields.length})
              </div>
              {textFields.length === 0 ? (
                <div className="text-center py-12 px-6 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 text-sm flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <Type size={20} className="text-slate-300" />
                  </div>
                  <p className="font-medium">No fields added yet.<br/>Click the button above to start.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {textFields.map(field => (
                    <div 
                      key={field.id}
                      onClick={() => selectFieldById(field.id)}
                      className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-primary-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 truncate mr-2">{field.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Font: {field.fontFamily}, {field.fontSize}px</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 bg-white mt-auto">
          <button
            onClick={() => setStep(2)}
            disabled={!templateUrl || textFields.length === 0}
            className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              templateUrl && textFields.length > 0 
              ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-200' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Confirm & Import
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className="flex-grow flex items-center justify-center p-8 bg-slate-100/50 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[#f8fafc]">
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>
        </div>
        
        {templateUrl ? (
          <div className="relative shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-sm bg-white ring-1 ring-slate-200 overflow-auto max-h-full max-w-full custom-scrollbar animate-in zoom-in duration-300">
            <canvas ref={canvasRef} />
          </div>
        ) : (
          <div 
            className={`relative border-3 border-dashed rounded-3xl p-12 w-full max-w-xl flex flex-col items-center justify-center transition-all duration-300 ${
              isHovering ? 'border-primary-500 bg-primary-50/50 scale-[1.02]' : 'border-slate-200 bg-white/80 backdrop-blur-sm'
            }`}
          >
            <input
              type="file"
              onChange={handleFileClick}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept="image/*"
            />
            <div className={`p-4 rounded-2xl mb-4 transition-colors ${isHovering ? 'bg-primary-100 text-primary-600' : 'bg-slate-50 text-slate-400'}`}>
              <Upload size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Upload Certificate Template</h3>
            <p className="text-slate-500 text-center mb-6 text-sm font-medium">Drag and drop your certificate image here, or click to browse files.</p>
            <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span className="px-3 py-1 bg-white rounded-full shadow-sm border border-slate-100">PNG</span>
              <span className="px-3 py-1 bg-white rounded-full shadow-sm border border-slate-100">JPG</span>
              <span className="px-3 py-1 bg-white rounded-full shadow-sm border border-slate-100">WEBP</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CanvasEditor
