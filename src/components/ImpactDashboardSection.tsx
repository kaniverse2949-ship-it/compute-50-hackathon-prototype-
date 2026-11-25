import React from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Globe,
  Info,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { DoctorProfile, Language } from '../types';

interface ImpactDashboardSectionProps {
  language: Language;
  doctors: DoctorProfile[];
  liveSearchCount: number;
  liveAiCount: number;
  liveSavedCount: number;
  liveBookingsCount: number;
}

export function ImpactDashboardSection({
  language,
  doctors,
  liveSearchCount,
  liveAiCount,
  liveSavedCount,
  liveBookingsCount,
}: ImpactDashboardSectionProps) {
  const isTa = language === 'ta';
  const verifiedDoctorsCount = doctors.filter((d) => d.verificationStatus === 'verified').length;
  const avgWait =
    doctors.length > 0
      ? Math.round(
          doctors.reduce((acc, d) => acc + d.expectedWaitMinutes, 0) / doctors.length
        )
      : 14;

  // Simulated prototype usage baseline metrics clearly labeled as simulated demo data
  const simulatedSessionsTotal = 1280 + liveSearchCount + liveAiCount;
  const simulatedMatchesTotal = 468 + liveAiCount;
  const simulatedBookingsTotal = 194 + liveBookingsCount;

  const languageBreakdown = [
    {
      label: isTa ? 'தமிழ் (Tamil)' : 'Tamil (தமிழ்)',
      percent: 54,
      sessions: 691,
      color: 'bg-teal-700',
    },
    {
      label: isTa ? 'ஆங்கிலம் (English)' : 'English',
      percent: 34,
      sessions: 435,
      color: 'bg-sky-700',
    },
    {
      label: isTa ? 'பிற இந்திய மொழிகள் (हिन्दी · తెలుగు · മലയാളം · ಕನ್ನಡ)' : 'Regional Languages (HI · TE · ML · KN)',
      percent: 12,
      sessions: 154,
      color: 'bg-cyan-600',
    },
  ];

  const specialtyActivity = [
    {
      name: isTa ? 'பொது மருத்துவம் & சர்க்கரை நோய்' : 'General Medicine & Diabetology',
      searches: 312,
      share: 88,
    },
    {
      name: isTa ? 'இதயவியல்' : 'Cardiology & Preventive Heart',
      searches: 264,
      share: 74,
    },
    {
      name: isTa ? 'எலும்பு & மூட்டு மருத்துவம்' : 'Orthopedics & Joint Care',
      searches: 198,
      share: 56,
    },
    {
      name: isTa ? 'தோல் & குழந்தைகள் நலம்' : 'Dermatology & Skin Wellness',
      searches: 175,
      share: 49,
    },
    {
      name: isTa ? 'மகளிர் நலம் & நரம்பியல்' : 'Gynecology & Neurology',
      searches: 148,
      share: 42,
    },
  ];

  const cityActivity = [
    { city: 'Chennai', doctorsCount: doctors.filter((d) => d.city === 'Chennai').length, queries: 742 },
    { city: 'Coimbatore', doctorsCount: doctors.filter((d) => d.city === 'Coimbatore').length, queries: 286 },
    { city: 'Madurai', doctorsCount: doctors.filter((d) => d.city === 'Madurai').length, queries: 252 },
  ];

  return (
    <div className="space-y-6">
      {/* Explicit Simulated Data Disclosure Header */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-800 via-teal-700 to-sky-800 text-white p-6 sm:p-7 shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold">
                {isTa
                  ? 'First Cure தாக்கம் & பயன்பாட்டுப் புள்ளிவிவரம்'
                  : 'First Cure Impact & Bilingual Adoption Dashboard'}
              </h1>
              <p className="text-xs text-teal-100 mt-0.5">
                {isTa
                  ? 'இருமொழி மருத்துவ அணுகல், தேடல் செயல்பாடு மற்றும் வெளிப்படையான சரிபார்ப்பு அளவீடுகள்'
                  : 'Tracking bilingual health navigation, transparent discovery activity & verified clinical coverage'}
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-white/15 border border-white/25 text-white inline-flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-200" />
            {isTa
              ? 'மாதிரிப் புள்ளிவிவரம் (Simulated Prototype Data)'
              : 'Simulated Prototype Data + Live Session Counters'}
          </span>
        </div>

        <p className="text-xs text-sky-100 leading-relaxed max-w-4xl">
          {isTa
            ? 'அறிவிப்பு: கீழே உள்ள தொகுக்கப்பட்ட பயன்பாட்டு எண்கள் (1,280+ அமர்வுகள்) ஹேக்கத்தான் முன்மாதிரி விளக்கத்திற்கான மாதிரித் தரவுகளாகும். தற்போதைய அமர்வின் தேடல்கள் மற்றும் சரிபார்க்கப்பட்ட மருத்துவர்கள் எண்ணிக்கை உங்கள் செயலியிலிருந்து நேரடியாகக் கணக்கிடப்படுகின்றன.'
            : 'Transparency Note: Baseline adoption numbers below represent simulated prototype telemetry for hackathon demonstration, combined with real live counts from your active session and verified directory records.'}
        </p>
      </div>

      {/* Key Metrics Row (Tabular Numerals, No Pill Clutter) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-1">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-teal-700" />
            {isTa ? 'இருமொழி வழிகாட்டுதல் அமர்வுகள்' : 'Bilingual Care Sessions (Simulated)'}
          </p>
          <p className="font-mono-num text-2xl font-bold text-slate-900">
            {simulatedSessionsTotal.toLocaleString()}
          </p>
          <p className="text-[11px] text-teal-700 font-medium">
            {isTa ? '54% தமிழ் · 34% ஆங்கிலம்' : '54% Tamil · 34% English · 12% Regional'}
          </p>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-1">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <BadgeCheck className="w-3.5 h-3.5 text-sky-700" />
            {isTa ? 'சரிபார்க்கப்பட்ட மருத்துவர்கள் (நேரடி)' : 'Verified Directory Clinicians (Live)'}
          </p>
          <p className="font-mono-num text-2xl font-bold text-slate-900">
            {verifiedDoctorsCount} / {doctors.length}
          </p>
          <p className="text-[11px] text-slate-500">
            {isTa ? `சராசரி காத்திருப்பு: ~${avgWait} நிமிடம்` : `Avg expected wait: ~${avgWait} mins`}
          </p>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-1">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            {isTa ? 'AI & மருத்துவர் பொருத்தங்கள்' : 'AI Navigation & Matches (Simulated)'}
          </p>
          <p className="font-mono-num text-2xl font-bold text-slate-900">
            {simulatedMatchesTotal.toLocaleString()}
          </p>
          <p className="text-[11px] text-sky-700 font-medium font-mono-num">
            {isTa
              ? `இந்த அமர்வில்: ${liveSearchCount} தேடல் · ${liveAiCount} AI`
              : `This session: ${liveSearchCount} searches · ${liveAiCount} AI runs`}
          </p>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-1">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sky-700" />
            {isTa ? 'டெமோ சந்திப்புகள் & சேமிப்பு' : 'Demo Bookings & Saved (Mixed)'}
          </p>
          <p className="font-mono-num text-2xl font-bold text-slate-900">
            {simulatedBookingsTotal.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 font-mono-num">
            {isTa
              ? `உங்கள் சேமிப்புகள்: ${liveSavedCount} மருத்துவர்`
              : `Saved by you: ${liveSavedCount} doctor(s) · ${liveBookingsCount} session apt(s)`}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Language Usage Split */}
        <div className="lg:col-span-6 rounded-3xl bg-white border border-slate-200 p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                {isTa ? 'மொழிப் பயன்பாட்டுப் பகிர்வு (மாதிரி)' : 'Language Preference Breakdown (Simulated)'}
              </h2>
              <p className="text-xs text-slate-500">
                {isTa
                  ? 'பயனர்கள் தேர்ந்தெடுத்த முதன்மை வழிசெலுத்தல் & AI மொழி'
                  : 'Primary interface & AI companion language selected at onboarding'}
              </p>
            </div>
            <Globe className="w-5 h-5 text-teal-700 shrink-0" />
          </div>

          <div className="space-y-4">
            {languageBreakdown.map((item, idx) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{item.label}</span>
                  <span className="font-mono-num text-slate-600">
                    {item.sessions} · <strong className="text-slate-900">{item.percent}%</strong>
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percent}%` }}
                    transition={{ duration: 0.7, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className={`h-full rounded-full ${item.color}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Regional Coverage */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-700" />
              {isTa ? 'நகர வாரியான மருத்துவர் & தேடல் செயல்பாடு' : 'Regional Clinic Coverage & Discovery (City)'}
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {cityActivity.map((c) => (
                <div key={c.city} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <p className="text-xs font-bold text-slate-900">{c.city}</p>
                  <p className="text-[11px] text-teal-700 font-mono-num mt-0.5">
                    {c.doctorsCount} {isTa ? 'மருத்துவர்' : 'listed'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono-num">
                    ~{c.queries} {isTa ? 'தேடல் (மாதிரி)' : 'queries (sim)'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Specialty Discovery Activity */}
        <div className="lg:col-span-6 rounded-3xl bg-white border border-slate-200 p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                {isTa ? 'மருத்துவப் பிரிவு தேடல் செயல்பாடு (மாதிரி)' : 'Doctor Discovery by Specialty (Simulated)'}
              </h2>
              <p className="text-xs text-slate-500">
                {isTa
                  ? 'நோயாளிகள் அதிகம் தேடிய சிறப்பு மருத்துவப் பிரிவுகள்'
                  : 'Relative discovery interest across clinical specialties in prototype evaluation'}
              </p>
            </div>
            <Search className="w-5 h-5 text-sky-700 shrink-0" />
          </div>

          <div className="space-y-3.5">
            {specialtyActivity.map((spec, idx) => (
              <div key={spec.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{spec.name}</span>
                  <span className="font-mono-num font-semibold text-slate-700">
                    {spec.searches} {isTa ? 'தேடல்கள்' : 'searches'}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${spec.share}%` }}
                    transition={{ duration: 0.7, delay: 0.1 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-teal-600 to-sky-600"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Ethical & Safety Guarantees */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">
                  {isTa ? 'சான்றளிக்கப்பட்டவை மட்டுமே' : 'Strict Credential Truthfulness'}
                </p>
                <p className="text-slate-600 mt-0.5">
                  {isTa
                    ? 'சரிபார்க்கப்பட்ட மருத்துவர்களுக்கு மட்டுமே சரிபார்ப்பு முத்திரை.'
                    : 'Pending accounts never display verified badges or fabricated reviews.'}
                </p>
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">
                  {isTa ? 'நோயறிதல் அல்லாத AI' : 'Non-Diagnostic AI Design'}
                </p>
                <p className="text-slate-600 mt-0.5">
                  {isTa
                    ? '108/112 அவசர எச்சரிக்கை & மருத்துவர் பரிந்துரை மட்டுமே.'
                    : 'Built-in emergency 108/112 escalation with zero diagnostic claims.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
