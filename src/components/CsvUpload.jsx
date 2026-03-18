import React, { useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, AlertCircle, CheckCircle2, Table as TableIcon, ChevronRight, X } from 'lucide-react'

const CsvUpload = () => {
  const { textFields, setCsvData, setCsvHeaders, setStep } = useStore()
  const [error, setError] = useState(null)
  const [previewData, setPreviewData] = useState([])
  const [headers, setHeaders] = useState([])
  const [fileName, setFileName] = useState('')

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setError(null)

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);

          if (data.length === 0) {
            setError('Excel file is empty');
            return;
          }

          const h = Object.keys(data[0]);
          processData(data, h);
        } catch (err) {
          setError('Error parsing Excel: ' + err.message);
        }
      };
      reader.onerror = () => setError('File reading error');
      reader.readAsBinaryString(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const h = results.meta.fields
          const data = results.data
          processData(data, h);
        },
        error: (err) => {
          setError('Error parsing CSV: ' + err.message)
        }
      })
    }
  }

  const processData = (data, h) => {
    // Validate headers against textFields
    const missingFields = textFields.filter(tf => !h.includes(tf.name))

    if (missingFields.length > 0) {
      setError(`File is missing columns matching these field names: ${missingFields.map(f => f.name).join(', ')}`)
      return
    }

    setHeaders(h)
    setPreviewData(data.slice(0, 5)) // Preview first 5 rows
    setCsvData(data)
    setCsvHeaders(h)
  }

  const reset = () => {
    setCsvData(null)
    setCsvHeaders([])
    setPreviewData([])
    setHeaders([])
    setFileName('')
    setError(null)
  }

  return (
    <div className="flex flex-col items-center p-8 w-full h-full bg-slate-50 overflow-y-auto">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-slate-800">Import Certificate Data</h2>
          <p className="text-slate-500 mt-2">Upload a CSV or Excel file where the column headers match your canvas fields.</p>
        </div>

        {/* Required Headers Notice */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertCircle size={16} /> Expected File Columns
          </h3>
          <div className="flex flex-wrap gap-2">
            {textFields.map(field => (
              <span key={field.id} className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm">
                {field.name}
              </span>
            ))}
          </div>
        </div>

        {!fileName ? (
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-slate-800 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative border-2 border-dashed border-slate-200 bg-white rounded-3xl p-12 flex flex-col items-center justify-center transition-all hover:border-primary-500">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="p-4 bg-primary-50 text-primary-600 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                <FileSpreadsheet size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Select Data File</h3>
              <p className="text-slate-500 text-center">Click or drag a .csv or Excel file here to import your data.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {error ? (
              <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-start gap-4 text-red-700">
                <AlertCircle className="shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold mb-1">Upload Error</h4>
                  <p className="text-sm border-b border-red-200 pb-4 mb-4">{error}</p>
                  <button onClick={reset} className="text-sm font-bold bg-white px-4 py-2 rounded-xl shadow-sm hover:bg-red-600 hover:text-white transition-colors">
                    Try Another File
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 text-primary-600 rounded-lg">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{fileName}</h3>
                      <p className="text-xs text-slate-500 font-medium">Successfully parsed {headers.length} columns</p>
                    </div>
                  </div>
                  <button onClick={reset} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-4 uppercase tracking-wider">
                    <TableIcon size={16} /> Data Preview (First 5 Rows)
                  </div>
                  <div className="overflow-x-auto overflow-y-auto max-h-64 rounded-2xl border border-slate-100 shadow-inner custom-scrollbar">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500">
                          {headers.map(h => (
                            <th key={h} className="px-4 py-3 font-bold border-b border-slate-100">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            {headers.map(h => (
                              <th key={h} className="px-4 py-3 font-medium text-slate-600 border-b border-slate-50">{row[h]}</th>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setStep(3)}
                    className="px-10 py-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl shadow-lg transition-all hover:translate-y-[-2px] active:scale-95 flex items-center gap-2"
                  >
                    Next: Generate PDF
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CsvUpload
