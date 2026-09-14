export interface PaperSection {
  id: string
  title: string
  slug: string
  content: string
}

export const mockPaperSections: PaperSection[] = [
  {
    id: 'abstract',
    title: 'Abstract',
    slug: 'abstract',
    content:
      'Early detection of patient deterioration is critical for improving outcomes in intensive care settings. We present a deep neural network model trained on continuous vital signs and electronic health record data to predict acute deterioration events within 6-12 hours of occurrence. Our model was trained on 50,000 patient episodes from three major academic medical centers, achieving an AUC of 0.92 and sensitivity of 0.87 at 90% specificity. Clinical validation across 5,000 prospective cases demonstrated a 34% reduction in unexpected rapid response events when alerts were integrated into standard care workflows. Our findings suggest that real-time machine learning models can provide significant clinical value in patient monitoring and resource allocation.',
  },
  {
    id: 'introduction',
    title: 'Introduction',
    slug: 'introduction',
    content:
      'Acute deterioration in hospitalized patients represents a significant cause of morbidity and mortality, with rapid response team (RRT) activations occurring in 1-5% of all hospitalizations [1, 2]. Traditional vital sign monitoring relies on periodic manual assessment, creating potential gaps in detection [3]. Recent advances in artificial intelligence and machine learning have demonstrated the capability to identify subtle patterns in patient data that precede clinical deterioration [4, 5]. Previous studies using logistic regression and random forest models have shown promise, but these approaches are limited by their inability to capture complex temporal patterns in sequential vital sign data [6]. Deep learning architectures, particularly recurrent neural networks and attention mechanisms, have shown superior performance in time-series medical data analysis [7, 8]. This study aims to develop and validate a practical deep learning model for predicting imminent patient deterioration using readily available clinical data.',
  },
  {
    id: 'methods',
    title: 'Methods',
    slug: 'methods',
    content:
      'Data Source and Cohort: We collected data from three academic medical centers spanning 2018-2021. Our study population included all adult patients (≥18 years) admitted to general medical and surgical floors with continuous cardiac monitoring. Exclusion criteria included palliative care patients and those with do-not-resuscitate orders. Our final cohort comprised 50,000 patient episodes.\n\nFeature Engineering: We extracted 95 features from two data sources: (1) continuous vital signs (heart rate, blood pressure, respiratory rate, oxygen saturation, temperature) sampled at 15-minute intervals, and (2) laboratory values (lactate, creatinine, WBC, hemoglobin) with irregular sampling intervals. All features were normalized to zero mean and unit variance.\n\nModel Architecture: We implemented a bidirectional LSTM network with two hidden layers (128 units each) followed by an attention mechanism and a dense classification layer. The model processes sequences of 48 hours of prior data to predict deterioration within the subsequent 6-12 hour window.\n\nTraining Protocol: We split data into training (60%), validation (20%), and test (20%) sets. Early stopping was implemented based on validation loss with a patience of 15 epochs.',
  },
  {
    id: 'results',
    title: 'Results',
    slug: 'results',
    content:
      'Model Performance on Test Set: Our LSTM model achieved an AUC of 0.92 (95% CI: 0.90-0.94) for predicting deterioration events. At a threshold optimized for 90% specificity, sensitivity was 0.87 with positive predictive value of 0.64 and negative predictive value of 0.97. The model demonstrated superior performance compared to logistic regression (AUC 0.74) and random forest (AUC 0.81) baselines.\n\nClinical Validation: Prospective evaluation across 5,000 cases at the three study sites demonstrated that integration of model alerts into standard care workflows resulted in: (1) 34% reduction in unexpected rapid response events, (2) 22% decrease in ICU transfers from medical floors, and (3) 19% reduction in in-hospital mortality among alerted patients (p<0.05). Model alert acceptance rate was 78%, with clinicians overriding alerts in cases where patient status had already stabilized.\n\nSubgroup Analysis: Model performance was consistent across age groups, but sensitivity decreased to 0.71 in immunocompromised patients and 0.79 in patients with sepsis.',
  },
  {
    id: 'discussion',
    title: 'Discussion',
    slug: 'discussion',
    content:
      'This study demonstrates that deep learning models can effectively predict acute patient deterioration using continuous physiologic monitoring data. Our model\'s 0.92 AUC exceeds previously published single-center studies and represents a meaningful improvement over traditional statistical approaches. The 34% reduction in unexpected rapid response events suggests substantial clinical utility, though this benefit may reflect both improved detection and the Hawthorne effect of increased clinician vigilance.\n\nThe 78% alert acceptance rate indicates that clinical integration is feasible when alerts are appropriately integrated into existing workflows. Alerts were most often accepted in ICU and emergency department settings but had lower utilization rates on general medical floors, suggesting that implementation strategies must be customized by unit type.\n\nLimitations of our study include: (1) potential selection bias in the prospective validation cohort, (2) heterogeneous vital sign sampling intervals across institutions, and (3) inability to capture all relevant clinical context (e.g., family conversations, patient preference changes). Future work should focus on integrating text data from clinical notes and evaluating generalizability across diverse hospital systems with different EHR platforms.',
  },
]

export const mockPaperTitle = 'Deep Learning for Early Detection of Patient Deterioration: A Prospective Multi-Center Validation Study'

export function calculateWordCount(sections: PaperSection[]): number {
  return sections.reduce((total, section) => {
    const words = section.content.split(/\s+/).filter(Boolean).length
    return total + words
  }, 0)
}
