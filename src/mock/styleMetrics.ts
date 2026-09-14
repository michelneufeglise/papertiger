export interface StyleMetric {
  name: string
  value: number
  unit: string
  description: string
}

export interface StyleExample {
  label: string
  text: string
}

export const mockStyleMetrics: StyleMetric[] = [
  {
    name: 'Avg Sentence Length',
    value: 18,
    unit: 'words',
    description: 'Your sentences average 18 words, indicating clear technical writing',
  },
  {
    name: 'Formality Score',
    value: 8.2,
    unit: '/10',
    description: 'High formality appropriate for academic medical writing',
  },
  {
    name: 'Vocabulary Richness',
    value: 7.5,
    unit: '/10',
    description: 'Diverse vocabulary with good use of domain-specific terms',
  },
  {
    name: 'Passive Voice Usage',
    value: 32,
    unit: '%',
    description: 'Moderate passive voice; consider increasing active voice in methods',
  },
  {
    name: 'Readability Index',
    value: 14.2,
    unit: 'grade',
    description: 'Appropriate reading level for peer-reviewed medical journal',
  },
]

export const mockStyleExamples: StyleExample[] = [
  {
    label: 'Your raw draft',
    text: 'The model was trained using data from the hospitals. We used a lot of patient records. The records had many different types of information about patients. The model learned to find patterns in this data. Then we tested it on new data.',
  },
  {
    label: 'Grammar-corrected, style-preserved',
    text: 'The model was trained using data from three academic medical centers. We employed 50,000 patient episodes containing comprehensive clinical information. The model learned to identify subtle patterns in physiologic data. Subsequent testing on prospective cases validated predictive performance.',
  },
]

export interface StyleTuning {
  name: string
  value: number
  min: number
  max: number
  description: string
}

export const mockStyleTunings: StyleTuning[] = [
  {
    name: 'Formality',
    value: 7,
    min: 1,
    max: 10,
    description: 'Adjusts academic rigor and formal language usage',
  },
  {
    name: 'Conciseness',
    value: 6,
    min: 1,
    max: 10,
    description: 'Controls sentence length and content density',
  },
  {
    name: 'Technicality',
    value: 8,
    min: 1,
    max: 10,
    description: 'Determines the level of domain-specific terminology',
  },
]

export const mockPreviewText = 'Deep learning architectures demonstrate significant capability in identifying complex temporal patterns within clinical datasets.'
