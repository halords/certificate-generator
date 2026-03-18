import { create } from 'zustand'

export const useStore = create((set) => ({
  currentStep: 1,
  setStep: (step) => set({ currentStep: step }),

  templateUrl: null, // data URL of the uploaded template image
  setTemplateUrl: (url) => set({ templateUrl: url }),

  textFields: [], // Array of objects: { id, name, text, fontFamily, fontSize, fill, fontWeight, fontStyle, left, top, width, height }
  setTextFields: (fields) => set({ textFields: fields }),

  csvData: null, // Array of parsed CSV rows (objects)
  setCsvData: (data) => set({ csvData: data }),
  
  csvHeaders: [],
  setCsvHeaders: (headers) => set({ csvHeaders: headers }),

  customFonts: [], // Array of { name, arrayBuffer }
  addCustomFont: (font) => set((state) => ({ customFonts: [...state.customFonts, font] })),

  templateDimensions: { width: 0, height: 0, scale: 1 },
  setTemplateDimensions: (dims) => set({ templateDimensions: dims })
}))
