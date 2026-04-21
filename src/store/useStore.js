import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set) => ({
      currentStep: 1,
      setStep: (step) => set({ currentStep: step }),

      templateUrl: null,
      setTemplateUrl: (url) => set({ templateUrl: url }),

      textFields: [],
      setTextFields: (fields) => set({ textFields: fields }),

      csvData: null,
      setCsvData: (data) => set({ csvData: data }),
      
      csvHeaders: [],
      setCsvHeaders: (headers) => set({ csvHeaders: headers }),

      builtInPresets: [],
      setBuiltInPresets: (presets) => set({ builtInPresets: presets }),

      systemFonts: [], // Built-in fonts from assets folder
      setSystemFonts: (fonts) => set({ systemFonts: fonts }),

      customFonts: [], // User-uploaded fonts
      setCustomFonts: (fonts) => set({ customFonts: fonts }),
      addCustomFont: (font) => set((state) => ({ 
        customFonts: state.customFonts.find(f => f.name === font.name) 
          ? state.customFonts 
          : [...state.customFonts, font] 
      })),

      templateDimensions: { width: 0, height: 0, scale: 1 },
      setTemplateDimensions: (dims) => set({ templateDimensions: dims })
    }),
    {
      name: 'certificate-storage',
      partialize: (state) => ({
        templateUrl: state.templateUrl,
        textFields: state.textFields,
        customFonts: state.customFonts,
        templateDimensions: state.templateDimensions
      }),
    }
  )
)
