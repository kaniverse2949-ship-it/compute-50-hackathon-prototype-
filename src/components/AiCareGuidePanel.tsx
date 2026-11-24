import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  BadgeCheck,
  Compass,
  ExternalLink,
  FileText,
  IndianRupee,
  MapPin,
  MessageCircle,
  Mic,
  PhoneCall,
  Send,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../api';
import { getCopy } from '../i18n';
import type {
  AiMatchResponse,
  ChatMessage,
  DoctorProfile,
  Language,
  MapsGroundedResponse,
} from '../types';
import { LiveVoiceAssistant } from './LiveVoiceAssistant';
import { AiMatchingRadar, SpringButton } from './MotionPrimitives';

export type GuideTab = 'match' | 'chat' | 'voice' | 'maps';

interface AiCareGuidePanelProps {
  token: string;
  language: Language;
  calm?: boolean;
  initialTab?: GuideTab;
  onSelectDoctor: (doctor: DoctorProfile, openBooking?: boolean) => void;
  onClose?: () => void;
}

const SYMPTOM_CHIPS_EN = [
  'Fever',
  'Chest discomfort',
  'Knee or joint pain',
  'Skin rash / itching',
  'Recurring headache',
  'Fatigue / sugar check',
];

const SYMPTOM_CHIPS_TA = [
  'காய்ச்சல்',
  'நெஞ்சு அசௌகரியம்',
  'முழங்கால் / மூட்டு வலி',
  'தோல் அரிப்பு / தடிப்பு',
  'தொடர் தலைவலி',
  'சோர்வு / சர்க்கரை பரிசோதனை',
];

export function AiCareGuidePanel({
  token,
  language,
  calm = false,
  initialTab = 'match',
  onSelectDoctor,
  onClose,
}: AiCareGuidePanelProps) {
  const t = getCopy(language);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<GuideTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Smart Match state
  const [concern, setConcern] = useState('');
  const [budget, setBudget] = useState('700');
  const [location, setLocation] = useState('Chennai');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [preferredTravelArea, setPreferredTravelArea] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<{
    fileName: string;
    mimeType: string;
    base64Data: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiMatchResponse | null>(null);

  // Multi-turn Care Chat state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: 'model',
      text:
        language === 'ta'
          ? 'வணக்கம்! உங்கள் அறிகுறிகள், சரியான மருத்துவப் பிரிவு அல்லது மருத்துவமனை சந்திப்புக்கு எப்படித் தயாராவது என்பது பற்றி என்னிடம் கேட்கலாம்.'
          : 'Hello! Ask me any health navigation question—such as which specialist fits your symptoms, what to bring to a visit, or how consultation fees work.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatSpeed, setChatSpeed] = useState<'balanced' | 'fast'>('balanced');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatEmergency, setChatEmergency] = useState<string | null>(null);

  // Nearby Care (Maps Grounding) state
  const [mapsQuery, setMapsQuery] = useState(
    language === 'ta'
      ? 'அருகிலுள்ள 24 மணி நேர மருந்தகம் மற்றும் மருத்துவமனைகள்'
      : '24-hour pharmacy and diagnostic blood test labs nearby'
  );
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsResult, setMapsResult] = useState<MapsGroundedResponse | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const chips = language === 'ta' ? SYMPTOM_CHIPS_TA : SYMPTOM_CHIPS_EN;

  const toggleSymptom = (chip: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus(
        language === 'ta'
          ? 'உங்கள் உலாவியில் GPS வசதி இல்லை.'
          : 'Geolocation is not supported in this browser.'
      );
      return;
    }
    setGpsStatus(language === 'ta' ? 'இருப்பிடம் பெறப்படுகிறது...' : 'Requesting location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocation((prev) => (prev.trim() ? prev : 'Current GPS Location'));
        setGpsStatus(
          language === 'ta'
            ? 'GPS இருப்பிடம் இணைக்கப்பட்டது'
            : 'GPS location attached with your permission'
        );
      },
      () => {
        setGpsStatus(
          language === 'ta'
            ? 'GPS அனுமதி மறுக்கப்பட்டது — நகரப் பெயரை உள்ளிடவும்.'
            : 'Location permission declined — using your typed city/area.'
        );
      },
      { timeout: 7000 }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError(
        language === 'ta'
          ? 'கோப்பு அளவு 4MB-க்கு குறைவாக இருக்க வேண்டும்.'
          : 'Please choose a file smaller than 4 MB.'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setAttachment({
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        base64Data: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numericBudget = Number(budget);
    if (!concern.trim() || !Number.isFinite(numericBudget) || numericBudget <= 0 || !location.trim()) {
      setError(
        language === 'ta'
          ? 'உடல்நலக் கவலை, கட்டண வரம்பு மற்றும் இடம் ஆகிய மூன்றையும் உள்ளிடவும்.'
          : 'Please fill in your health concern, consultation budget, and current location.'
      );
      return;
    }

    setLoading(true);
    try {
      const data = await api.aiMatch(token, {
        concern: concern.trim(),
        budget: numericBudget,
        location: location.trim(),
        symptoms: selectedSymptoms.join(', '),
        preferredTravelArea: preferredTravelArea.trim() || undefined,
        language,
        coordinates: coords,
        attachment: attachment || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run AI Care Guide right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', text, timestamp: new Date().toISOString() };
    const nextHistory = [...chatHistory, userMsg];
    setChatHistory(nextHistory);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await api.aiChat(token, {
        history: chatHistory,
        message: text,
        language,
        speedMode: chatSpeed,
      });
      setChatHistory((prev) => [
        ...prev,
        { role: 'model', text: res.reply, timestamp: new Date().toISOString() },
      ]);
      if (res.isEmergency && res.emergencyMessage) {
        setChatEmergency(res.emergencyMessage);
      }
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'model',
          text: err instanceof Error ? err.message : 'Unable to reply right now.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSearchNearby = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapsQuery.trim()) return;
    setMapsError(null);
    setMapsLoading(true);
    try {
      const res = await api.nearbyCare(token, {
        query: mapsQuery.trim(),
        location: location.trim() || 'Chennai',
        language,
        coordinates: coords,
      });
      setMapsResult(res);
    } catch (err) {
      setMapsError(err instanceof Error ? err.message : 'Unable to fetch Google Maps places.');
    } finally {
      setMapsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={calm ? undefined : { rotate: [0, 8, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
          </motion.div>
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">{t.aiDrawerTitle}</h2>
            <p className="text-[11px] text-slate-500">
              {language === 'ta' ? 'தமிழ் & ஆங்கில வழிகாட்டி' : 'Match · Chat · Live Voice · Maps'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Care Guide"
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-1.5 overflow-x-auto">
        {(
          [
            { id: 'match', label: language === 'ta' ? 'மருத்துவர் பொருத்தம்' : 'Doctor Match', icon: <Sparkles className="w-3.5 h-3.5" /> },
            { id: 'chat', label: language === 'ta' ? 'உரையாடல்' : 'Care Chat', icon: <MessageCircle className="w-3.5 h-3.5" /> },
            { id: 'voice', label: language === 'ta' ? 'Gemini குரல்' : 'Gemini Voice', icon: <Mic className="w-3.5 h-3.5" /> },
            { id: 'maps', label: language === 'ta' ? 'அருகிலுள்ள சேவை' : 'Nearby Maps', icon: <MapPin className="w-3.5 h-3.5" /> },
          ] as const
        ).map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:border-teal-500'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Mandatory Non-Diagnostic Disclaimer */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
          <span>{t.aiDisclaimer}</span>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'match' && (
            <motion.div
              key="guide-match"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <form onSubmit={handleSubmitMatch} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-xs text-orange-800">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    {t.aiConcernLabel}
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={concern}
                    onChange={(e) => setConcern(e.target.value)}
                    placeholder={t.aiConcernPlaceholder}
                    className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      {t.aiBudgetLabel}
                    </label>
                    <div className="relative">
                      <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        required
                        type="number"
                        min={100}
                        step={50}
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="w-full min-h-[44px] pl-9 pr-3.5 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:border-teal-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      {t.aiLocationLabel}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          required
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Adyar, Chennai"
                          className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleUseGps}
                        title={t.aiUseGps}
                        className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-teal-700 hover:bg-teal-50 cursor-pointer shrink-0 flex items-center gap-1"
                      >
                        <Compass className="w-4 h-4" />
                        <span className="hidden sm:inline">GPS</span>
                      </button>
                    </div>
                    {gpsStatus && <p className="text-[11px] text-slate-500 mt-1">{gpsStatus}</p>}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">{t.aiSymptomsLabel}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map((chip) => {
                      const active = selectedSymptoms.includes(chip);
                      return (
                        <motion.button
                          key={chip}
                          type="button"
                          whileTap={{ scale: 0.94 }}
                          onClick={() => toggleSymptom(chip)}
                          className={`min-h-[34px] px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                            active
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-teal-400'
                          }`}
                        >
                          {chip}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {t.aiTravelLabel}
                    </label>
                    <input
                      value={preferredTravelArea}
                      onChange={(e) => setPreferredTravelArea(e.target.value)}
                      placeholder={language === 'ta' ? 'எ.கா., 5 கி.மீ உள்ளே' : 'e.g. Within 8 km / T. Nagar'}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {t.aiUploadLabel}
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-teal-500 text-xs font-medium text-slate-700 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <Upload className="w-4 h-4 text-teal-600 shrink-0" />
                        <span className="truncate">
                          {attachment
                            ? attachment.fileName
                            : language === 'ta'
                            ? 'படம் / அறிக்கை தேர்வு செய்க'
                            : 'Attach photo or PDF report'}
                        </span>
                      </span>
                      {attachment && (
                        <span
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setAttachment(null);
                          }}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          ×
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <SpringButton type="submit" size="lg" disabled={loading} className="w-full">
                  <Sparkles className="w-4 h-4" />
                  {t.aiFindMatches}
                </SpringButton>
              </form>

              {loading && <AiMatchingRadar label={t.aiMatchingProgress} />}

              {!loading && result && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-2"
                >
                  {result.isEmergency && (
                    <motion.div
                      initial={{ scale: 0.96 }}
                      animate={{ scale: 1 }}
                      className="p-4 rounded-2xl bg-orange-600 text-white space-y-3 shadow-lg shadow-orange-600/25"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-display text-base font-bold">{t.aiEmergencyTitle}</p>
                          <p className="text-xs text-orange-50 mt-1 leading-relaxed">
                            {result.emergencyMessage}
                          </p>
                        </div>
                      </div>
                      <a
                        href="tel:108"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-orange-700 text-xs font-bold shadow-sm"
                      >
                        <PhoneCall className="w-4 h-4" />
                        {t.aiEmergencyCall}
                      </a>
                    </motion.div>
                  )}

                  <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-2">
                    <p className="text-xs font-semibold text-teal-800">
                      {result.suggestedSpecialties.join(' · ')}
                    </p>
                    <p className="text-sm text-slate-800 leading-relaxed">{result.guidanceSummary}</p>
                    {result.reportAnalysis && (
                      <div className="pt-2 border-t border-teal-200/70 flex items-start gap-2 text-xs text-slate-700">
                        <FileText className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                        <span>{result.reportAnalysis}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {result.matches.map((match, idx) => {
                      const d = match.doctor;
                      const docName = language === 'ta' ? d.nameTa : d.name;
                      return (
                        <motion.div
                          key={d.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.07 }}
                          className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={d.photoUrl}
                                alt={docName}
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 rounded-2xl object-cover shrink-0 bg-slate-100"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-display text-sm font-bold text-slate-900 truncate">
                                    {docName}
                                  </p>
                                  {d.verificationStatus === 'verified' && (
                                    <BadgeCheck className="w-4 h-4 text-teal-600 shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 truncate">
                                  {(language === 'ta' ? d.specialtiesTa : d.specialties)[0]} · {d.area},{' '}
                                  {d.city}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="font-mono-num text-sm font-bold text-slate-900">
                                ₹{d.consultationFee}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono-num">
                                {match.distanceKm} km ·{' '}
                                {match.withinBudget
                                  ? language === 'ta'
                                    ? 'பட்ஜெட் உள்ளே'
                                    : 'In budget'
                                  : language === 'ta'
                                  ? 'பட்ஜெட் மேல்'
                                  : 'Above budget'}
                              </p>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50 space-y-1">
                            <p className="text-[11px] font-bold text-slate-700">{t.whyRecommended}</p>
                            <ul className="space-y-1">
                              {match.whyRecommended.map((reason, rIdx) => (
                                <li key={rIdx} className="text-xs text-slate-600 flex items-start gap-2">
                                  <span className="text-teal-600 font-bold">·</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-1">
                            <span className="text-xs text-slate-500 font-mono-num">
                              {language === 'ta' ? 'அடுத்த நேரம்: ' : 'Next slot: '}
                              {match.nextAvailableSlot}
                            </span>
                            <SpringButton size="sm" onClick={() => onSelectDoctor(d, true)}>
                              {t.viewPortfolioBook}
                            </SpringButton>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="guide-chat"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600">
                  {language === 'ta' ? 'உதவி வேகம்' : 'Response Mode'}
                </span>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setChatSpeed('balanced')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                      chatSpeed === 'balanced' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {language === 'ta' ? 'விரிவான பதில்' : 'Balanced'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatSpeed('fast')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                      chatSpeed === 'fast' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {language === 'ta' ? 'விரைவு பதில்' : 'Fast'}
                  </button>
                </div>
              </div>

              {chatEmergency && (
                <div className="p-3.5 rounded-2xl bg-orange-600 text-white text-xs space-y-2">
                  <p className="font-bold">{chatEmergency}</p>
                  <a href="tel:108" className="inline-flex items-center gap-1.5 underline font-bold">
                    <PhoneCall className="w-3.5 h-3.5" /> 108 / 112
                  </a>
                </div>
              )}

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto p-3 rounded-2xl bg-slate-50 border border-slate-200">
                {chatHistory.map((m, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-slate-900 text-white ml-8'
                        : 'bg-white border border-slate-200 text-slate-800 mr-8'
                    }`}
                  >
                    {m.text}
                  </motion.div>
                ))}
                {chatLoading && (
                  <div className="p-3 rounded-2xl bg-white border border-slate-200 mr-12 text-xs text-slate-500 animate-pulse">
                    {language === 'ta' ? 'பதில் தயாராகிறது...' : 'Thinking...'}
                  </div>
                )}
              </div>

              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    language === 'ta'
                      ? 'உங்கள் கேள்வியை இங்கே தட்டச்சு செய்யவும்...'
                      : 'Ask about specialists, preparation, or reports...'
                  }
                  className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                />
                <SpringButton type="submit" disabled={chatLoading || !chatInput.trim()}>
                  <Send className="w-4 h-4" />
                </SpringButton>
              </form>
            </motion.div>
          )}

          {activeTab === 'voice' && (
            <motion.div
              key="guide-voice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <LiveVoiceAssistant token={token} language={language} calm={calm} />
            </motion.div>
          )}

          {activeTab === 'maps' && (
            <motion.div
              key="guide-maps"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <form onSubmit={handleSearchNearby} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City or Area (e.g. Adyar, Chennai)"
                    className="flex-1 min-h-[42px] px-3.5 rounded-xl border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleUseGps}
                    className="min-h-[42px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-teal-700 hover:bg-teal-50 cursor-pointer flex items-center gap-1"
                  >
                    <Compass className="w-4 h-4" />
                    GPS
                  </button>
                </div>
                <input
                  value={mapsQuery}
                  onChange={(e) => setMapsQuery(e.target.value)}
                  placeholder={
                    language === 'ta'
                      ? 'மருந்தகம், இரத்த பரிசோதனை மையம், மருத்துவமனை...'
                      : 'Search nearby pharmacies, labs, urgent clinics...'
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm"
                />
                <SpringButton type="submit" disabled={mapsLoading} className="w-full">
                  <MapPin className="w-4 h-4" />
                  {mapsLoading
                    ? language === 'ta'
                      ? 'Google Maps தேடுகிறது...'
                      : 'Searching Google Maps...'
                    : language === 'ta'
                    ? 'Google Maps வழியாக தேடு'
                    : 'Find Nearby Care via Google Maps'}
                </SpringButton>
              </form>

              {mapsError && (
                <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-xs text-orange-800">
                  {mapsError}
                </div>
              )}

              {mapsResult && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                    {mapsResult.answer}
                  </div>
                  {mapsResult.places.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-800">
                        {language === 'ta' ? 'Google Maps இணைப்புகள்' : 'Verified Google Maps Links'}
                      </p>
                      {mapsResult.places.map((p, idx) => (
                        <a
                          key={idx}
                          href={p.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-2xl border border-slate-200 hover:border-teal-500 transition-colors bg-white"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-teal-700">{p.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </div>
                          {p.reviewSnippets?.[0] && (
                            <p className="text-[11px] text-slate-500 mt-1">{p.reviewSnippets[0]}</p>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
