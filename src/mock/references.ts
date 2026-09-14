export interface Reference {
  id: string
  name: string
  type: 'pdf' | 'docx' | 'image'
  size: number
  pages: number
  extractedText: string
  ocrStatus: 'idle' | 'processing' | 'success' | 'error'
  uploadedAt: Date
}

export const mockReferences: Reference[] = [
  {
    id: 'ref-1',
    name: 'Deep Learning in Healthcare - A Systematic Review.pdf',
    type: 'pdf',
    size: 2400000,
    pages: 42,
    extractedText: 'Deep learning has emerged as a powerful tool in healthcare applications, from medical image analysis to clinical decision support. This systematic review examines 150+ studies published between 2018-2023, synthesizing findings on CNN applications in radiology, RNN models for patient monitoring, and transformer architectures for NLP in clinical notes...',
    ocrStatus: 'success',
    uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'ref-2',
    name: 'Patient Risk Stratification Dataset.docx',
    type: 'docx',
    size: 1200000,
    pages: 18,
    extractedText: 'This document describes the methodology and results of our patient risk stratification study conducted across three major hospitals. The dataset comprises 50,000 patient records with 120+ clinical features extracted from EHR systems. We evaluated multiple machine learning models including gradient boosting, random forests, and neural networks...',
    ocrStatus: 'success',
    uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'ref-3',
    name: 'ECG_Analysis_Methods.pdf',
    type: 'pdf',
    size: 3100000,
    pages: 56,
    extractedText: 'Electrocardiogram (ECG) analysis is fundamental to cardiology and emergency medicine. Modern neural network approaches have shown promise in detecting arrhythmias and predicting adverse events. This paper reviews convolutional neural network (CNN) architectures adapted for 1D ECG signal processing...',
    ocrStatus: 'success',
    uploadedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  },
]

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
