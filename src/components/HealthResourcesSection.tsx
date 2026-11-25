import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, ChevronDown, Info, PhoneCall, ShieldCheck } from 'lucide-react';
import type { Language } from '../types';

interface ResourceArticle {
  id: string;
  categoryEn: string;
  categoryTa: string;
  titleEn: string;
  titleTa: string;
  summaryEn: string;
  summaryTa: string;
  pointsEn: string[];
  pointsTa: string[];
  whenToSeekEn: string;
  whenToSeekTa: string;
}

const HEALTH_GUIDES: ResourceArticle[] = [
  {
    id: 'res-cardio-prep',
    categoryEn: 'Preventive Checkups',
    categoryTa: 'முன்னெச்சரிக்கை பரிசோதனை',
    titleEn: 'Preparing for a Blood Pressure or Heart Checkup',
    titleTa: 'இரத்த அழுத்தம் & இதயப் பரிசோதனைக்குத் தயாராகும் எளிய வழிகள்',
    summaryEn: 'Simple steps before your appointment help your cardiologist or physician read baseline measurements accurately.',
    summaryTa: 'மருத்துவமனைக்குச் செல்லும் முன் பின்பற்ற வேண்டிய எளிய வழிகள் மருத்துவர் துல்லியமாகப் பரிசோதிக்க உதவும்.',
    pointsEn: [
      'Avoid coffee, tea, or brisk exercise for 30 minutes before BP measurement.',
      'Bring a written list or clear photo of current medications and doses.',
      'Note down when symptoms (like mild palpitations or dizziness) happen and how long they last.',
    ],
    pointsTa: [
      'இரத்த அழுத்தம் பரிசோதிப்பதற்கு 30 நிமிடங்களுக்கு முன் காபி, டீ மற்றும் கடின உடற்பயிற்சியைத் தவிர்க்கவும்.',
      'நீங்கள் தற்போது எடுத்துக்கொள்ளும் மருந்துகளின் பட்டியல் அல்லது படத்தைக் கொண்டு வரவும்.',
      'படபடப்பு அல்லது தலைசுற்றல் எப்போது ஏற்படுகிறது, எவ்வளவு நேரம் நீடிக்கிறது என்பதைக் குறித்து வைத்துக்கொள்ளவும்.',
    ],
    whenToSeekEn: 'Seek urgent 108 / 112 care immediately for crushing chest pain, pain spreading to arm/jaw, or sudden shortness of breath.',
    whenToSeekTa: 'கடுமையான நெஞ்சு வலி, தோள்பட்டைக்குப் பரவும் வலி அல்லது மூச்சுத் திணறல் இருந்தால் உடனே 108 / 112 ஐ அழைக்கவும்.',
  },
  {
    id: 'res-lab-literacy',
    categoryEn: 'Lab Report Literacy',
    categoryTa: 'ஆய்வக அறிக்கை புரிதல்',
    titleEn: 'Understanding HbA1c & Routine Blood Test Numbers',
    titleTa: 'HbA1c சர்க்கரை அளவு & இரத்தப் பரிசோதனை எண்களைப் புரிந்துகொள்ளல்',
    summaryEn: 'Knowing what routine numbers measure makes conversations with your doctor calmer and clearer.',
    summaryTa: 'இரத்தப் பரிசோதனை எண்கள் எதைக் குறிக்கின்றன என்பதை அறிந்துகொண்டால் மருத்துவருடன் தெளிவாகப் பேச முடியும்.',
    pointsEn: [
      'HbA1c reflects average blood sugar patterns over roughly the past 2–3 months, unlike a single morning fasting test.',
      'Reference ranges on lab sheets can vary slightly between laboratories—always review trends together with your clinician.',
      'Share prior test reports via your consented vault so doctors can compare changes over time.',
    ],
    pointsTa: [
      'HbA1c என்பது ஒரு நாள் அளவு அல்ல; கடந்த 2–3 மாதங்களின் சராசரி இரத்த சர்க்கரை அளவைக் காட்டுகிறது.',
      'ஆய்வகத்திற்கு ஆய்வகம் இயல்பு எண்கள் சிறிது மாறுபடலாம்—எப்போதும் மருத்துவருடன் இணைந்து மதிப்பாய்வு செய்யவும்.',
      'பழைய அறிக்கைகளைப் பாதுகாப்பான பெட்டகத்தில் சேமித்து மருத்துவரிடம் காட்டினால் மாற்றங்களை ஒப்பிட உதவும்.',
    ],
    whenToSeekEn: 'Consult a physician promptly if you experience sudden extreme thirst, unexplained weight loss, or persistent dizziness.',
    whenToSeekTa: 'அதிக தாகம், காரணமின்றி எடை குறைதல் அல்லது தொடர் மயக்கம் ஏற்பட்டால் உடனே மருத்துவரை அணுகவும்.',
  },
  {
    id: 'res-joint-care',
    categoryEn: 'Mobility & Joints',
    categoryTa: 'மூட்டு & எலும்பு நலம்',
    titleEn: 'Knee Comfort & Preparing for an Orthopedic Consultation',
    titleTa: 'முழங்கால் வலி & எலும்பு மருத்துவரைச் சந்திப்பதற்கான தயாரிப்பு',
    summaryEn: 'Clear context about pain triggers helps orthopedists choose conservative physical therapy before imaging.',
    summaryTa: 'வலி எப்போது அதிகரிக்கிறது என்பதைச் சரியாகக் கூறுவது தேவையற்ற பரிசோதனைகளைத் தவிர்த்து சரியான பிசியோதெரபி பெற உதவும்.',
    pointsEn: [
      'Track whether discomfort occurs mainly climbing stairs, squatting, or after sitting still.',
      'Wear comfortable footwear and loose trousers/saree-friendly attire so knee movement can be examined easily.',
      'Bring any X-ray films or reports taken within the past 6 months.',
    ],
    pointsTa: [
      'படிக்கட்டு ஏறும்போது, தரையில் அமரும்போது அல்லது நீண்ட நேரம் உட்கார்ந்த பின் வலி வருகிறதா எனக் கவனிக்கவும்.',
      'மருத்துவர் முழங்காலைப் பரிசோதிக்க வசதியாகத் தளர்வான உடை அணிந்து செல்லவும்.',
      'கடந்த 6 மாதங்களில் எடுத்த X-Ray அல்லது அறிக்கைகள் இருந்தால் எடுத்துச் செல்லவும்.',
    ],
    whenToSeekEn: 'Seek prompt care if a joint becomes hot, visibly swollen after an injury, or cannot bear weight.',
    whenToSeekTa: 'காயத்திற்குப் பின் மூட்டு அதிகம் வீங்கினாலோ, சிவந்து சூடானாலோ அல்லது கால் ஊன்ற முடியாவிட்டாலோ உடனே மருத்துவரைப் பார்க்கவும்.',
  },
  {
    id: 'res-emergency-signs',
    categoryEn: 'Emergency Awareness',
    categoryTa: 'அவசர சிகிச்சை விழிப்புணர்வு',
    titleEn: 'When to Skip Clinic Waiting & Call 108 / 112 Immediately',
    titleTa: 'எப்போது காத்திருக்காமல் உடனே 108 / 112 அவசர எண்ணை அழைக்க வேண்டும்?',
    summaryEn: 'Online booking and AI care guides are strictly for routine planning—never delay emergency care for warning signs.',
    summaryTa: 'ஆன்லைன் முன்பதிவும் AI வழிகாட்டியும் சாதாரண திட்டமிடலுக்கு மட்டுமே; அவசர அறிகுறிகளில் தாமதிக்காதீர்கள்.',
    pointsEn: [
      'Chest tightness, pressure, cold sweat, or sudden breathlessness.',
      'Sudden face drooping, arm weakness, slurred speech, or sudden severe confusion.',
      'High fever with stiff neck, seizures, severe allergic swelling, or uncontrolled bleeding.',
    ],
    pointsTa: [
      'நெஞ்சு அழுத்தம், வலி, குளிர் வியர்வை அல்லது திடீர் மூச்சுத் திணறல்.',
      'முகம் ஒருபக்கமாகக் கோணுதல், கை/கால் பலவீனம் அல்லது பேச்சு குழறுதல்.',
      'அதிக காய்ச்சலுடன் கழுத்து விறைப்பு, வலிப்பு, தீவிர ஒவ்வாமை வீக்கம் அல்லது நிற்காத இரத்தப்போக்கு.',
    ],
    whenToSeekEn: 'Call 108 or 112 immediately or go directly to the nearest hospital emergency department.',
    whenToSeekTa: 'உடனடியாக 108 அல்லது 112 ஐ அழைக்கவும் அல்லது அருகிலுள்ள அவசர சிகிச்சைப் பிரிவுக்குச் செல்லவும்.',
  },
];

export function HealthResourcesSection({ language }: { language: Language }) {
  const isTa = language === 'ta';
  const [openId, setOpenId] = useState<string>('res-cardio-prep');

  return (
    <section className="rounded-3xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-700" />
            {isTa
              ? 'எளிய சுகாதாரத் தகவல் வளங்கள்'
              : 'Accessible Health Information Resources'}
          </h2>
          <p className="text-xs text-slate-600">
            {isTa
              ? 'மருத்துவமனை சந்திப்புக்கு முன் அறிந்துகொள்ள வேண்டிய பொதுத் தகவல்கள் (தமிழ் & ஆங்கிலம்).'
              : 'Plain-language bilingual guides for clinic preparation & warning-sign awareness.'}
          </p>
        </div>
        <span className="text-[11px] font-semibold text-sky-800 inline-flex items-center gap-1.5 shrink-0">
          <Info className="w-3.5 h-3.5 text-sky-700" />
          {isTa ? 'பொது விழிப்புணர்வு தகவல் மட்டும்' : 'Informational only · Non-diagnostic'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {HEALTH_GUIDES.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border transition-colors ${
                isOpen
                  ? 'border-teal-300 bg-gradient-to-br from-teal-50/45 via-white to-sky-50/40'
                  : 'border-slate-200 bg-slate-50/50 hover:border-sky-300'
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenId(isOpen ? '' : item.id)}
                className="w-full text-left p-4 min-h-[56px] flex items-start justify-between gap-3 cursor-pointer"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] font-semibold text-teal-700">
                    {isTa ? item.categoryTa : item.categoryEn}
                  </p>
                  <h3 className="font-display text-sm font-bold text-slate-900 leading-snug">
                    {isTa ? item.titleTa : item.titleEn}
                  </h3>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 shrink-0 mt-1 transition-transform ${
                    isOpen ? 'rotate-180 text-teal-700' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2.5 border-t border-slate-200/70 pt-3">
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {isTa ? item.summaryTa : item.summaryEn}
                      </p>
                      <ul className="space-y-1.5">
                        {(isTa ? item.pointsTa : item.pointsEn).map((pt, idx) => (
                          <li key={idx} className="text-xs text-slate-600 flex items-start gap-2 leading-relaxed">
                            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="pt-2 border-t border-slate-200/60 flex items-start gap-2 text-xs text-sky-900">
                        <PhoneCall className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                        <span>{isTa ? item.whenToSeekTa : item.whenToSeekEn}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
