export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const now = new Date()

export const mockMessages: Message[] = [
  {
    id: '1',
    role: 'user',
    content: 'I\'m starting a research paper on machine learning applications in healthcare. What should my paper structure look like?',
    timestamp: new Date(now.getTime() - 5 * 60000),
  },
  {
    id: '2',
    role: 'assistant',
    content: 'A strong healthcare ML paper typically follows this structure:\n\n1. **Abstract** - Concise summary of your research question, methods, and key findings\n2. **Introduction** - Background on the problem and your specific contribution\n3. **Methods** - Detailed description of your ML approach and dataset\n4. **Results** - Quantitative and qualitative findings with tables/figures\n5. **Discussion** - Interpretation of results and implications\n6. **References** - Properly cited sources\n\nI can help you draft each section and refine your style as you write.',
    timestamp: new Date(now.getTime() - 4 * 60000),
  },
  {
    id: '3',
    role: 'user',
    content: 'Great! Can you help me draft an abstract first? The focus is on predicting patient deterioration using neural networks.',
    timestamp: new Date(now.getTime() - 2 * 60000),
  },
]

export const mockAssistantReplies = [
  'Excellent direction. For predicting patient deterioration, you\'ll want to emphasize your dataset size, the prediction window, and expected clinical impact. Should we start with the research question or data description?',
  'That\'s a critical application. Consider highlighting: the patient population studied, your model architecture (RNN, Transformer, etc.), prediction accuracy metrics (AUC, sensitivity), and clinical validation approach.',
  'Neural networks are well-suited for this. The abstract should lead with the clinical problem—how many patients deteriorate unexpectedly in your setting—then position your model as a solution.',
  'Good choice on neural networks for temporal patient data. I\'d recommend mentioning your data granularity (hourly vitals?) and whether you\'re predicting hours or days ahead.',
]

export function getRandomAssistantReply(): string {
  return mockAssistantReplies[Math.floor(Math.random() * mockAssistantReplies.length)]
}
