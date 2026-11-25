import type { Language } from '../types';

export const ALLOWED_FEEDBACK_HIGHLIGHTS = [
  'clear_explanation',
  'respectful_listening',
  'accurate_wait',
  'transparent_fees',
  'bilingual_care',
] as const;

export type FeedbackHighlightKey = (typeof ALLOWED_FEEDBACK_HIGHLIGHTS)[number];

export interface FeedbackHighlightOption {
  key: FeedbackHighlightKey;
  en: string;
  ta: string;
}

export const FEEDBACK_HIGHLIGHT_OPTIONS: FeedbackHighlightOption[] = [
  {
    key: 'clear_explanation',
    en: 'Explained clearly in plain language',
    ta: 'எளிய தமிழில் / ஆங்கிலத்தில் தெளிவான விளக்கம்',
  },
  {
    key: 'respectful_listening',
    en: 'Listened patiently without rushing',
    ta: 'அவசரமின்றிப் பொறுமையாகக் கேட்டறிந்தார்',
  },
  {
    key: 'accurate_wait',
    en: 'Punctual & accurate wait time',
    ta: 'சரியான நேர மேலாண்மை & காத்திருப்பு',
  },
  {
    key: 'transparent_fees',
    en: 'Transparent fees & clear plan',
    ta: 'வெளிப்படையான கட்டணம் & சிகிச்சைத் திட்டம்',
  },
  {
    key: 'bilingual_care',
    en: 'Comfortable language support',
    ta: 'என் மொழியில் எளிதான உரையாடல்',
  },
];

export function getHighlightLabel(key: string, language: Language): string {
  const found = FEEDBACK_HIGHLIGHT_OPTIONS.find((opt) => opt.key === key);
  if (!found) return key;
  return language === 'ta' ? found.ta : found.en;
}
