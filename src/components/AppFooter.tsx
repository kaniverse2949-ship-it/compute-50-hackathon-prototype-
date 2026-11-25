import React from 'react';
import { HeartPulse, Lock, PhoneCall, ShieldAlert } from 'lucide-react';
import type { Language } from '../types';

interface AppFooterProps {
  language: Language;
  onNavigate?: (target: 'discover' | 'ai' | 'appointments' | 'impact' | 'privacy') => void;
  hasBottomNav?: boolean;
}

export function AppFooter({ language, onNavigate, hasBottomNav = false }: AppFooterProps) {
  const isTa = language === 'ta';

  return (
    <footer
      className={`mt-10 border-t border-slate-200/90 bg-white/95 backdrop-blur-sm ${
        hasBottomNav ? 'pb-20 md:pb-8' : 'pb-8'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Emergency & Non-Diagnostic Safety Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-teal-900 via-teal-800 to-sky-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-sky-200 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-display text-sm font-bold">
                {isTa
                  ? 'மருத்துவ பாதுகாப்பு & அவசர உதவி அறிவிப்பு'
                  : 'Medical Safety & Emergency Care Notice'}
              </p>
              <p className="text-xs text-teal-100 leading-relaxed max-w-3xl">
                {isTa
                  ? 'First Cure தகவல் வழிகாட்டுதல் மட்டுமே வழங்குகிறது — இது நோயறிதல் அல்ல அல்லது மருந்து பரிந்துரைக்காது. நெஞ்சு வலி, மூச்சுத் திணறல், மயக்கம் போன்ற அவசர நிலைகளில் உடனே அவசர எண்ணை அழைக்கவும்.'
                  : 'First Cure provides informational care navigation only — never medical diagnoses or prescriptions. For chest pain, severe bleeding, breathing trouble, or sudden weakness, seek immediate emergency care.'}
              </p>
            </div>
          </div>
          <a
            href="tel:108"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white text-teal-900 font-display text-xs font-bold inline-flex items-center justify-center gap-2 hover:bg-sky-50 transition-colors shrink-0 whitespace-nowrap"
          >
            <PhoneCall className="w-4 h-4 text-orange-600" />
            <span>{isTa ? 'அவசர உதவி: 108 / 112' : 'Emergency: 108 / 112'}</span>
          </a>
        </div>

        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs text-slate-600">
          <div className="md:col-span-5 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-700 to-sky-700 text-white flex items-center justify-center">
                <HeartPulse className="w-4 h-4" />
              </div>
              <span className="font-display text-sm font-bold text-slate-900">First Cure</span>
            </div>
            <p className="leading-relaxed text-slate-600">
              {isTa
                ? 'தமிழ் மற்றும் ஆங்கிலத்தில் நோயாளிகள் சான்றளிக்கப்பட்ட மருத்துவர்களைத் தெளிவான காரணங்களுடன் கண்டறிய உதவும் மருத்துவ வழிகாட்டி தளம்.'
                : 'Bilingual patient-first healthcare discovery platform connecting communities with verified clinicians through transparent matching and consent-gated records.'}
            </p>
          </div>

          <div className="md:col-span-4 space-y-2">
            <p className="font-display text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-teal-700" />
              {isTa ? 'தனியுரிமை & மாதிரித் தரவு அறிவிப்பு' : 'Privacy & Prototype Disclosure'}
            </p>
            <p className="leading-relaxed text-slate-600">
              {isTa
                ? 'நோயாளி ஆவணங்கள் சம்மதமின்றிப் பகிரப்படாது. சரிபார்க்கப்பட்ட மருத்துவர்களுக்கு மட்டுமே சரிபார்ப்பு முத்திரை காட்டப்படும். தாக்கப் புள்ளிவிவரங்கள் மற்றும் டெமோ கட்டணம் முன்மாதிரி விளக்கத்திற்கானவை.'
                : 'Health documents stay private until you explicitly consent. Verified badges appear strictly when verification exists. Demo accounts, checkout flows, and Impact metrics include simulated prototype data.'}
            </p>
          </div>

          <div className="md:col-span-3 space-y-2">
            <p className="font-display text-xs font-bold text-slate-900">
              {isTa ? 'விரைவு இணைப்புகள்' : 'Quick Navigation'}
            </p>
            {onNavigate ? (
              <div className="flex flex-col items-start gap-1">
                {(
                  [
                    { id: 'discover', label: isTa ? 'மருத்துவர்கள் தேடல்' : 'Find Doctors' },
                    { id: 'ai', label: isTa ? 'AI மருத்துவ வழிகாட்டி' : 'AI Health Companion' },
                    { id: 'appointments', label: isTa ? 'சந்திப்புகள்' : 'Appointments' },
                    { id: 'impact', label: isTa ? 'தாக்கப் புள்ளிவிவரம்' : 'Impact Dashboard' },
                    { id: 'privacy', label: isTa ? 'தனியுரிமை & ஆவணங்கள்' : 'Privacy & Records' },
                  ] as const
                ).map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => {
                      onNavigate(link.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="py-1 text-xs font-medium text-sky-700 hover:text-teal-800 hover:underline cursor-pointer"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 leading-relaxed">
                {isTa
                  ? 'தமிழ் · English · हिन्दी · తెలుగు · മലയാളം · ಕನ್ನಡ'
                  : 'Accessible in English, Tamil & regional languages · Mobile & desktop ready'}
              </p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            {isTa
              ? 'First Cure · நோயாளி மைய இருமொழி சுகாதார தளம்'
              : 'First Cure · Bilingual Patient-Centered Healthcare Platform'}
          </span>
          <span>
            {isTa
              ? 'அவசர மருத்துவ தேவைக்கு எப்போதும் 108 / 112 அழைக்கவும்'
              : 'Always verify clinical advice with a qualified physician'}
          </span>
        </div>
      </div>
    </footer>
  );
}
