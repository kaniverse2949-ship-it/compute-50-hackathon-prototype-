import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  HeartPulse,
  LogOut,
  MapPin,
  Mic,
  Navigation,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { api } from '../api';
import { getCopy, getLanguageLabel } from '../i18n';
import { compressProfilePhoto } from '../lib/imageUpload';
import type {
  Appointment,
  DoctorProfile,
  Language,
  PatientHealthRecord,
  PublicUser,
  ReferralRequest,
} from '../types';
import { AiCareGuidePanel, type GuideTab } from './AiCareGuidePanel';
import { DirectionsModal } from './DirectionsModal';
import { DoctorPortfolioModal } from './DoctorPortfolioModal';
import {
  AnimatedCareIllustration,
  ParallaxTiltCard,
  SpringButton,
} from './MotionPrimitives';

interface PatientWorkspaceProps {
  token: string;
  user: PublicUser;
  language: Language;
  calmMotion: boolean;
  onUpdateUser: (user: PublicUser) => void;
  onToggleCalmMotion: () => void;
  onSignOut: () => void;
}

type PatientTab = 'discover' | 'ai' | 'appointments' | 'privacy';

export function PatientWorkspace({
  token,
  user,
  language,
  calmMotion,
  onUpdateUser,
  onToggleCalmMotion,
  onSignOut,
}: PatientWorkspaceProps) {
  const t = getCopy(language);
  const [tabHistory, setTabHistory] = useState<PatientTab[]>(['discover']);
  const [historyIdx, setHistoryIdx] = useState(0);
  const tab = tabHistory[historyIdx] ?? 'discover';
  const canGoBack = historyIdx > 0;
  const canGoForward = historyIdx < tabHistory.length - 1;

  const navigateTab = (next: PatientTab) => {
    if (next === tab) return;
    const trimmed = tabHistory.slice(0, historyIdx + 1);
    setTabHistory([...trimmed, next]);
    setHistoryIdx(trimmed.length);
  };
  const goBack = () => {
    if (canGoBack) setHistoryIdx((i) => i - 1);
  };
  const goForward = () => {
    if (canGoForward) setHistoryIdx((i) => i + 1);
  };

  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiInitialTab, setAiInitialTab] = useState<GuideTab>('match');
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const openAiGuide = (targetTab: GuideTab = 'match') => {
    setAiInitialTab(targetTab);
    setAiDrawerOpen(true);
  };

  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<PatientHealthRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [maxFee, setMaxFee] = useState<number>(1500);

  // Modals
  const [activeDoctor, setActiveDoctor] = useState<{
    doctor: DoctorProfile;
    initialStep: 'portfolio' | 'book';
  } | null>(null);
  const [directionsApt, setDirectionsApt] = useState<Appointment | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // Record upload form
  const [recTitle, setRecTitle] = useState('');
  const [recFileName, setRecFileName] = useState('');
  const [recMimeType, setRecMimeType] = useState('application/pdf');
  const [recDataUrl, setRecDataUrl] = useState<string | undefined>(undefined);
  const [recSummary, setRecSummary] = useState('');

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast((curr) => (curr?.text === text ? null : curr)), 4500);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      api.listDoctors(),
      api.listAppointments(token),
      api.listRecords(token),
      api.listReferrals(token),
    ])
      .then(([docRes, aptRes, recRes, refRes]) => {
        if (!active) return;
        setDoctors(docRes.doctors);
        setAppointments(aptRes.appointments);
        setRecords(recRes.records);
        setReferrals(refRes.referrals);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Unable to load dashboard data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const specialties = useMemo(() => {
    const set = new Set<string>();
    doctors.forEach((d) => d.specialties.forEach((s) => set.add(s)));
    return ['all', ...Array.from(set)];
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return doctors.filter((d) => {
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.nameTa.toLowerCase().includes(q) ||
        d.hospitalName.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q) ||
        d.area.toLowerCase().includes(q) ||
        d.specialties.some((s) => s.toLowerCase().includes(q)) ||
        d.specialtiesTa.some((s) => s.toLowerCase().includes(q));
      const matchesSpec =
        selectedSpecialty === 'all' ||
        d.specialties.some((s) => s.toLowerCase() === selectedSpecialty.toLowerCase());
      const matchesFee = d.consultationFee <= maxFee;
      return matchesQuery && matchesSpec && matchesFee;
    });
  }, [doctors, searchQuery, selectedSpecialty, maxFee]);

  const handleOpenReschedule = (apt: Appointment) => {
    const doc = doctors.find((d) => d.id === apt.doctorId);
    const firstSlot = doc?.availableSlots[0];
    setRescheduleTarget(apt);
    setRescheduleDate(firstSlot?.date || apt.date);
    setRescheduleTime(firstSlot?.times[0] || apt.time);
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget || busyAction) return;
    setBusyAction(true);
    try {
      const res = await api.updateAppointment(token, rescheduleTarget.id, {
        action: 'reschedule',
        date: rescheduleDate,
        time: rescheduleTime,
      });
      setAppointments((prev) =>
        prev.map((a) => (a.id === res.appointment.id ? res.appointment : a))
      );
      setRescheduleTarget(null);
      showToast(
        language === 'ta' ? 'சந்திப்பு நேரம் மாற்றப்பட்டது.' : 'Appointment rescheduled successfully.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to reschedule.', true);
    } finally {
      setBusyAction(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget || busyAction) return;
    setBusyAction(true);
    try {
      const res = await api.updateAppointment(token, cancelTarget.id, {
        action: 'cancel',
      });
      setAppointments((prev) =>
        prev.map((a) => (a.id === res.appointment.id ? res.appointment : a))
      );
      setCancelTarget(null);
      showToast(
        language === 'ta' ? 'சந்திப்பு ரத்து செய்யப்பட்டது.' : 'Appointment cancelled and refund processed.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to cancel.', true);
    } finally {
      setBusyAction(false);
    }
  };

  const handleReferralDecision = async (id: string, decision: 'consented' | 'declined') => {
    try {
      const res = await api.respondReferralConsent(token, id, decision);
      setReferrals((prev) => prev.map((r) => (r.id === res.referral.id ? res.referral : r)));
      showToast(
        decision === 'consented'
          ? language === 'ta'
            ? 'பரிந்துரை மருத்துவருடன் ஆவணப் பகிர்வுக்கு சம்மதிக்கப்பட்டது.'
            : 'Consent recorded. Referred specialist can now review your shared records.'
          : language === 'ta'
          ? 'பரிந்துரை பகிர்வு மறுக்கப்பட்டது.'
          : 'Referral record sharing declined.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update referral.', true);
    }
  };

  const handleRecordFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRecFileName(f.name);
    setRecMimeType(f.type || 'application/pdf');
    if (f.size < 1_500_000) {
      const reader = new FileReader();
      reader.onload = () => setRecDataUrl(String(reader.result || ''));
      reader.readAsDataURL(f);
    }
  };

  const handleUploadRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle.trim()) return;
    try {
      const res = await api.uploadRecord(token, {
        title: recTitle.trim(),
        fileName: recFileName.trim() || 'patient-upload.pdf',
        mimeType: recMimeType,
        summary: recSummary.trim() || 'Uploaded via First Cure Patient Vault.',
        dataUrl: recDataUrl,
      });
      setRecords((prev) => [res.record, ...prev]);
      setRecTitle('');
      setRecFileName('');
      setRecSummary('');
      setRecDataUrl(undefined);
      showToast(
        language === 'ta' ? 'மருத்துவ அறிக்கை பாதுகாப்பாகச் சேமிக்கப்பட்டது.' : 'Health record saved privately.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to upload record.', true);
    }
  };

  const handlePatientPhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await compressProfilePhoto(file);
      const res = await api.updateMe(token, { photoUrl: dataUrl });
      onUpdateUser(res.user);
      showToast(
        language === 'ta' ? 'சுயவிவரப் படம் புதுப்பிக்கப்பட்டது.' : 'Profile photo updated.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update photo.', true);
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePatientPhoto = async () => {
    setPhotoBusy(true);
    try {
      const res = await api.updateMe(token, { photoUrl: null });
      onUpdateUser(res.user);
      showToast(language === 'ta' ? 'சுயவிவரப் படம் நீக்கப்பட்டது.' : 'Profile photo removed.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to remove photo.', true);
    } finally {
      setPhotoBusy(false);
    }
  };

  const navItems: Array<{ id: PatientTab; label: string; icon: React.ReactNode }> = [
    { id: 'discover', label: t.navDiscover, icon: <Search className="w-5 h-5" /> },
    { id: 'ai', label: t.navAiGuide, icon: <Sparkles className="w-5 h-5" /> },
    { id: 'appointments', label: t.navAppointments, icon: <CalendarClock className="w-5 h-5" /> },
    { id: 'privacy', label: t.navPrivacy, icon: <ShieldCheck className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col pb-24 md:pb-8">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigateTab('discover')}
              className="flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.45 }}
                className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-600/20"
              >
                <HeartPulse className="w-4 h-4" />
              </motion.div>
              <span className="font-display text-lg font-bold text-slate-900 whitespace-nowrap">
                {t.brand}
              </span>
            </button>

            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
              <button
                type="button"
                onClick={goBack}
                disabled={!canGoBack}
                aria-label="Back tab"
                title="Back"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-700 hover:border-teal-500 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goForward}
                disabled={!canGoForward}
                aria-label="Forward tab"
                title="Forward"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-700 hover:border-teal-500 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7">
            {navItems.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTab(item.id)}
                  className={`relative py-2 text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active ? 'text-teal-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="patient-nav-underline"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigateTab('privacy')}
              title="Change profile photo"
              className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                  <UserRound className="w-4 h-4" />
                </div>
              )}
              <span className="hidden sm:inline text-xs font-medium text-slate-700 truncate max-w-[130px]">
                {user.name}
              </span>
            </button>
            <SpringButton size="sm" variant="outline" onClick={onSignOut}>
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.signOut}</span>
            </SpringButton>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            className={`fixed top-20 right-4 z-50 max-w-sm px-4 py-3 rounded-2xl shadow-xl text-xs font-medium flex items-center gap-2.5 ${
              toast.isError ? 'bg-orange-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {toast.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            )}
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {loadError && (
          <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-xs text-orange-800">
            {loadError}
          </div>
        )}

        <AnimatePresence mode="wait">
          {tab === 'discover' && (
            <motion.div
              key="tab-discover"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28 }}
              className="space-y-6"
            >
              {/* Hero Discovery Banner with Parallax Tilt */}
              <ParallaxTiltCard calm={calmMotion}>
                <section className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center shadow-sm">
                  <div className="lg:col-span-8 space-y-4">
                    <p className="text-xs font-semibold text-teal-700">
                      {language === 'ta'
                        ? `வணக்கம் ${user.name}`
                        : `Welcome, ${user.name} · ${getLanguageLabel(language)}`}
                    </p>
                    <h1 className="font-display text-2xl sm:text-4xl font-bold text-slate-900 leading-tight">
                      {t.heroTitle}
                    </h1>
                    <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                      {t.heroSubtitle}
                    </p>
                    <AnimatedCareIllustration calm={calmMotion} />
                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      <SpringButton size="lg" onClick={() => openAiGuide('match')}>
                        <Sparkles className="w-4 h-4" />
                        {t.openAiGuide}
                      </SpringButton>
                      <SpringButton
                        size="lg"
                        variant="secondary"
                        onClick={() => openAiGuide('voice')}
                      >
                        <Mic className="w-4 h-4 text-teal-300" />
                        {language === 'ta' ? 'Gemini குரல் உரையாடல்' : 'Gemini Voice Chat'}
                      </SpringButton>
                      <SpringButton
                        size="lg"
                        variant="outline"
                        onClick={() => navigateTab('appointments')}
                      >
                        <CalendarClock className="w-4 h-4" />
                        {t.navAppointments} ({appointments.length})
                      </SpringButton>
                    </div>
                  </div>

                  {/* Quick Workspace Comfort & Voice Card (no repeated language prompt) */}
                  <div className="lg:col-span-4 rounded-2xl bg-slate-50 border border-slate-200/80 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Mic className="w-4 h-4 text-teal-600" />
                        {language === 'ta' ? 'Gemini நேரடி குரல்' : 'Gemini Live Voice'}
                      </span>
                      <SpringButton size="sm" onClick={() => openAiGuide('voice')}>
                        {language === 'ta' ? 'தொடங்கு' : 'Talk Now'}
                      </SpringButton>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {language === 'ta'
                        ? 'அறிகுறிகள் மற்றும் மருத்துவர் பொருத்தம் குறித்து Gemini உடன் நேரடியாகப் பேசுங்கள்.'
                        : 'Hands-free Gemini voice guidance for symptoms, fees, and specialist matching.'}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                      <span className="text-xs font-semibold text-slate-700">
                        {language === 'ta' ? 'அசைவு அமைப்பு' : 'Animation Comfort'}
                      </span>
                      <button
                        type="button"
                        onClick={onToggleCalmMotion}
                        className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        {calmMotion ? t.expressiveMotion : t.calmMotion}
                      </button>
                    </div>
                  </div>
                </section>
              </ParallaxTiltCard>

              {/* Search & Filter Controls */}
              <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-7 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      className="w-full min-h-[46px] pl-11 pr-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                    />
                  </div>
                  <div className="md:col-span-5 flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {t.budgetMax}:
                    </span>
                    <input
                      type="range"
                      min={400}
                      max={1500}
                      step={50}
                      value={maxFee}
                      onChange={(e) => setMaxFee(Number(e.target.value))}
                      className="flex-1 accent-teal-600"
                    />
                    <span className="font-mono-num text-xs font-bold text-slate-900 w-14 text-right">
                      ₹{maxFee}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {specialties.map((spec) => {
                    const active = selectedSpecialty === spec;
                    return (
                      <motion.button
                        key={spec}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedSpecialty(spec)}
                        className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {spec === 'all' ? t.allSpecialties : spec}
                      </motion.button>
                    );
                  })}
                </div>
              </section>

              {/* Doctor Cards Grid */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="h-64 rounded-3xl bg-white border border-slate-200 animate-pulse" />
                  ))}
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center space-y-3">
                  <p className="font-display text-lg font-bold text-slate-900">
                    {language === 'ta'
                      ? 'உங்கள் தேடலுக்குப் பொருத்தமான மருத்துவர்கள் இல்லை.'
                      : 'No doctors match this filter yet.'}
                  </p>
                  <SpringButton
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedSpecialty('all');
                      setMaxFee(1500);
                    }}
                  >
                    {language === 'ta' ? 'வடிப்பான்களை மீட்டமை' : 'Reset Filters'}
                  </SpringButton>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredDoctors.map((doc, idx) => {
                    const docName = language === 'ta' ? doc.nameTa : doc.name;
                    const docHospital = language === 'ta' ? doc.hospitalNameTa : doc.hospitalName;
                    const docSpecs = language === 'ta' ? doc.specialtiesTa : doc.specialties;
                    const nextSlot = doc.availableSlots[0];
                    return (
                      <motion.article
                        key={doc.id}
                        initial={{ opacity: 0, y: 18, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          delay: idx * 0.055,
                          type: 'spring',
                          stiffness: 280,
                          damping: 24,
                        }}
                        whileHover={{ y: -4, scale: 1.01 }}
                        className="rounded-3xl bg-white border border-slate-200 p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-lg hover:border-teal-300 transition-all"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-3.5">
                            <img
                              src={doc.photoUrl}
                              alt={docName}
                              referrerPolicy="no-referrer"
                              className="w-16 h-16 rounded-2xl object-cover shrink-0 bg-slate-100"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-display text-base font-bold text-slate-900 truncate">
                                  {docName}
                                </h3>
                                {doc.verificationStatus === 'verified' && (
                                  <BadgeCheck className="w-4 h-4 text-teal-600 shrink-0" />
                                )}
                              </div>
                              <p className="text-xs font-medium text-teal-700 truncate mt-0.5">
                                {docSpecs.join(' · ')}
                              </p>
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {doc.qualifications.join(', ')} · {doc.yearsExperience} {t.yearsExp}
                              </p>
                            </div>
                          </div>

                          <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                            <p className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {docHospital} · {doc.area}, {doc.city}
                              </span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>
                                {t.waitTime}: ~<span className="font-mono-num">{doc.expectedWaitMinutes}</span>{' '}
                                {t.mins}
                                {nextSlot && nextSlot.times[0]
                                  ? ` · ${nextSlot.date} ${nextSlot.times[0]}`
                                  : ''}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] text-slate-500">{t.consultationFee}</p>
                            <p className="font-mono-num text-base font-bold text-slate-900">
                              ₹{doc.consultationFee}
                            </p>
                          </div>
                          <SpringButton
                            size="sm"
                            onClick={() => setActiveDoctor({ doctor: doc, initialStep: 'portfolio' })}
                          >
                            {t.viewPortfolioBook}
                          </SpringButton>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'ai' && (
            <motion.div
              key="tab-ai"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto rounded-3xl border border-slate-200 overflow-hidden shadow-sm bg-white"
            >
              <AiCareGuidePanel
                token={token}
                language={language}
                calm={calmMotion}
                initialTab={aiInitialTab}
                onSelectDoctor={(doc, openBooking) =>
                  setActiveDoctor({
                    doctor: doc,
                    initialStep: openBooking ? 'book' : 'portfolio',
                  })
                }
              />
            </motion.div>
          )}

          {tab === 'appointments' && (
            <motion.div
              key="tab-appointments"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {referrals.length > 0 && (
                <section className="rounded-3xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    {language === 'ta'
                      ? 'மருத்துவர் பரிந்துரை & சம்மதக் கோரிக்கைகள்'
                      : 'Specialist Referrals & Record Sharing Consent'}
                  </h2>
                  <div className="space-y-3">
                    {referrals.map((ref) => (
                      <div
                        key={ref.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900">
                            {ref.fromDoctorName} → {ref.toDoctorName} ({ref.toSpecialty})
                          </p>
                          <p className="text-xs text-slate-600">{ref.clinicalReason}</p>
                          {ref.supervisionNote && (
                            <p className="text-xs text-teal-700">{ref.supervisionNote}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ref.patientConsentStatus === 'awaiting_patient' ? (
                            <>
                              <SpringButton
                                size="sm"
                                onClick={() => handleReferralDecision(ref.id, 'consented')}
                              >
                                {t.approveReferral}
                              </SpringButton>
                              <SpringButton
                                size="sm"
                                variant="outline"
                                onClick={() => handleReferralDecision(ref.id, 'declined')}
                              >
                                {t.declineReferral}
                              </SpringButton>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-teal-700">
                              {ref.patientConsentStatus === 'consented'
                                ? language === 'ta'
                                  ? 'சம்மதம் அளிக்கப்பட்டது'
                                  : 'Consent Granted'
                                : language === 'ta'
                                ? 'மறுக்கப்பட்டது'
                                : 'Declined'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    {t.navAppointments}
                  </h2>
                  <SpringButton size="sm" onClick={() => navigateTab('discover')}>
                    {language === 'ta' ? 'புதிய சந்திப்பு' : 'Book New Visit'}
                  </SpringButton>
                </div>

                {appointments.length === 0 ? (
                  <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center space-y-3">
                    <p className="text-sm text-slate-600">
                      {language === 'ta'
                        ? 'உங்களுக்கு இன்னும் சந்திப்புகள் இல்லை.'
                        : 'You do not have any appointments yet.'}
                    </p>
                    <SpringButton onClick={() => navigateTab('discover')}>{t.navDiscover}</SpringButton>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {appointments.map((apt, idx) => (
                      <motion.div
                        key={apt.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-base font-bold text-slate-900">
                              {apt.doctorName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {apt.doctorSpecialty} · {apt.hospitalName}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-bold capitalize ${
                              apt.status === 'cancelled'
                                ? 'text-orange-700'
                                : apt.status === 'completed'
                                ? 'text-slate-600'
                                : 'text-teal-700'
                            }`}
                          >
                            {apt.status}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-50 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-slate-500">{t.selectDate}</p>
                            <p className="font-mono-num font-bold text-slate-900 mt-0.5">
                              {apt.date} · {apt.time}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">{t.waitTime}</p>
                            <p className="font-mono-num font-bold text-slate-900 mt-0.5">
                              ~{apt.expectedWaitMinutes} {t.mins}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">{t.consultationFee}</p>
                            <p className="font-mono-num font-bold text-slate-900 mt-0.5">
                              ₹{apt.consultationFee} · {apt.paymentStatus}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600">{apt.reason}</p>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          <SpringButton
                            size="sm"
                            variant="outline"
                            onClick={() => setDirectionsApt(apt)}
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            {t.directions}
                          </SpringButton>
                          {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                            <>
                              <SpringButton
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenReschedule(apt)}
                              >
                                {t.reschedule}
                              </SpringButton>
                              <SpringButton
                                size="sm"
                                variant="ghost"
                                onClick={() => setCancelTarget(apt)}
                                className="text-orange-700 hover:bg-orange-50"
                              >
                                {t.cancelVisit}
                              </SpringButton>
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {tab === 'privacy' && (
            <motion.div
              key="tab-privacy"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              <div className="lg:col-span-5 rounded-3xl bg-white border border-slate-200 p-6 space-y-4 h-fit">
                <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-teal-600" />
                  {language === 'ta' ? 'மருத்துவ அறிக்கை சேமிப்பகம்' : 'Private Health Records'}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {language === 'ta'
                    ? 'உங்கள் அறிக்கைகள் பாதுகாக்கப்படுகின்றன. நீங்கள் சம்மதிக்கும் மருத்துவர்கள் மட்டுமே பார்க்க முடியும்.'
                    : 'Your records stay private and are shared only with doctors you explicitly authorize.'}
                </p>

                <form onSubmit={handleUploadRecord} className="space-y-3">
                  <input
                    required
                    value={recTitle}
                    onChange={(e) => setRecTitle(e.target.value)}
                    placeholder={
                      language === 'ta' ? 'அறிக்கை தலைப்பு (எ.கா. இரத்தப் பரிசோதனை)' : 'Record Title (e.g. Thyroid Panel)'
                    }
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm"
                  />
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleRecordFilePick}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-slate-100 file:text-slate-800 file:font-semibold"
                  />
                  <textarea
                    rows={3}
                    value={recSummary}
                    onChange={(e) => setRecSummary(e.target.value)}
                    placeholder={
                      language === 'ta' ? 'சுருக்கமான குறிப்பு...' : 'Key measurements or notes...'
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm"
                  />
                  <SpringButton type="submit" className="w-full">
                    {language === 'ta' ? 'பாதுகாப்பாகச் சேமி' : 'Save to Private Vault'}
                  </SpringButton>
                </form>
              </div>

              <div className="lg:col-span-7 space-y-5">
                <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    {language === 'ta' ? 'சேமிக்கப்பட்ட ஆவணங்கள்' : 'Saved Records'}
                  </h3>
                  {records.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      {language === 'ta' ? 'ஆவணங்கள் எதுவும் இல்லை.' : 'No uploaded records yet.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {records.map((rec) => (
                        <div key={rec.id} className="py-3 flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <FileText className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{rec.title}</p>
                              <p className="text-xs text-slate-600 mt-0.5">{rec.summary}</p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                {rec.fileName} ·{' '}
                                {rec.sharedWithDoctorIds.length > 0
                                  ? language === 'ta'
                                    ? `${rec.sharedWithDoctorIds.length} மருத்துவருடன் பகிரப்பட்டது`
                                    : `Shared with ${rec.sharedWithDoctorIds.length} doctor(s)`
                                  : language === 'ta'
                                  ? 'தனிப்பட்டது'
                                  : 'Private only'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    {language === 'ta' ? 'சுயவிவரப் படம்' : 'Profile Photo'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4">
                    {user.photoUrl ? (
                      <img
                        src={user.photoUrl}
                        alt={user.name}
                        className="w-16 h-16 rounded-2xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                        <UserRound className="w-7 h-7" />
                      </div>
                    )}
                    <div className="flex-1 min-w-[200px] space-y-2">
                      <p className="text-xs text-slate-600">
                        {language === 'ta'
                          ? 'உங்கள் நோயாளி சுயவிவரப் படத்தை எப்போது வேண்டுமானாலும் மாற்றலாம்.'
                          : 'Upload or update your profile photo anytime. Stored securely in your account.'}
                      </p>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePatientPhotoPick}
                        className="hidden"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <SpringButton
                          size="sm"
                          variant="outline"
                          disabled={photoBusy}
                          onClick={() => photoInputRef.current?.click()}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          {photoBusy
                            ? language === 'ta'
                              ? 'சேமிக்கிறது...'
                              : 'Saving...'
                            : user.photoUrl
                            ? language === 'ta'
                              ? 'படத்தை மாற்று'
                              : 'Change Photo'
                            : language === 'ta'
                            ? 'படம் சேர்'
                            : 'Upload Photo'}
                        </SpringButton>
                        {user.photoUrl && (
                          <SpringButton
                            size="sm"
                            variant="ghost"
                            disabled={photoBusy}
                            onClick={handleRemovePatientPhoto}
                            className="text-orange-700 hover:bg-orange-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {language === 'ta' ? 'நீக்கு' : 'Remove'}
                          </SpringButton>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    {language === 'ta' ? 'காட்சி & அணுகல் அமைப்புகள்' : 'Display & Accessibility'}
                  </h3>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {language === 'ta' ? 'அசைவு குறைப்பு வசதி' : 'Motion Preference'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {language === 'ta'
                          ? 'அமைதியான காட்சி மாற்றங்களுக்கு இயக்கவும்'
                          : 'Switch between expressive springs and calmer transitions'}
                      </p>
                    </div>
                    <SpringButton size="sm" variant="outline" onClick={onToggleCalmMotion}>
                      {calmMotion ? t.expressiveMotion : t.calmMotion}
                    </SpringButton>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Persistent AI Care Guide & Gemini Voice Buttons */}
      {tab !== 'ai' && !aiDrawerOpen && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            y: calmMotion ? 0 : [0, -4, 0],
          }}
          transition={{
            y: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-30 flex items-center gap-2"
        >
          <SpringButton
            size="lg"
            variant="secondary"
            onClick={() => openAiGuide('voice')}
            className="shadow-xl rounded-2xl"
          >
            <Mic className="w-5 h-5 text-teal-300" />
            <span className="hidden sm:inline">Gemini Voice</span>
          </SpringButton>
          <SpringButton
            size="lg"
            onClick={() => openAiGuide('match')}
            className="shadow-xl shadow-teal-600/35 rounded-2xl"
          >
            <Sparkles className="w-5 h-5" />
            <span>{t.openAiGuide}</span>
          </SpringButton>
        </motion.div>
      )}

      {/* Floating AI Care Guide Slide-over Drawer */}
      <AnimatePresence>
        {aiDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex justify-end"
            onClick={() => setAiDrawerOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl h-full bg-white shadow-2xl overflow-hidden"
            >
              <AiCareGuidePanel
                token={token}
                language={language}
                calm={calmMotion}
                initialTab={aiInitialTab}
                onClose={() => setAiDrawerOpen(false)}
                onSelectDoctor={(doc, openBooking) => {
                  setAiDrawerOpen(false);
                  setActiveDoctor({
                    doctor: doc,
                    initialStep: openBooking ? 'book' : 'portfolio',
                  });
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Fixed Bottom Thumb Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 min-h-[44px] cursor-pointer ${
                active ? 'text-teal-700 font-bold' : 'text-slate-500 font-medium'
              }`}
            >
              {item.icon}
              <span className="text-[10px] tracking-tight truncate max-w-[76px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Doctor Portfolio & Booking Modal */}
      <AnimatePresence>
        {activeDoctor && (
          <DoctorPortfolioModal
            doctor={activeDoctor.doctor}
            initialStep={activeDoctor.initialStep}
            language={language}
            token={token}
            isPatient={true}
            records={records}
            onClose={() => setActiveDoctor(null)}
            onBooked={(apt) => {
              setAppointments((prev) => [apt, ...prev]);
              showToast(t.paymentSuccessTitle);
            }}
          />
        )}
      </AnimatePresence>

      {/* Clinic Directions Modal */}
      <AnimatePresence>
        {directionsApt && (
          <DirectionsModal
            appointment={directionsApt}
            language={language}
            onClose={() => setDirectionsApt(null)}
          />
        )}
      </AnimatePresence>

      {/* Reschedule Modal */}
      <AnimatePresence>
        {rescheduleTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setRescheduleTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-slate-900">{t.reschedule}</h3>
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.selectDate}
                  </label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.selectSlot}
                  </label>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <SpringButton variant="outline" onClick={() => setRescheduleTarget(null)}>
                  {language === 'ta' ? 'மூடு' : 'Close'}
                </SpringButton>
                <SpringButton disabled={busyAction} onClick={handleConfirmReschedule}>
                  {language === 'ta' ? 'நேரத்தை மாற்று' : 'Confirm New Slot'}
                </SpringButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Disclosure Modal */}
      <AnimatePresence>
        {cancelTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setCancelTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            >
              <h3 className="font-display text-lg font-bold text-slate-900">{t.cancelVisit}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{cancelTarget.cancellationPolicy}</p>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span>{language === 'ta' ? 'செலுத்திய கட்டணம்' : 'Paid Consultation Fee'}</span>
                  <span className="font-mono-num font-bold">₹{cancelTarget.consultationFee}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.cancellationChargeLabel}</span>
                  <span className="font-mono-num font-bold text-orange-700">
                    - ₹{cancelTarget.cancellationFee}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                  <span>{language === 'ta' ? 'திருப்பித் தரப்படும் தொகை' : 'Estimated Refund'}</span>
                  <span className="font-mono-num">
                    ₹{Math.max(0, cancelTarget.consultationFee - cancelTarget.cancellationFee)}
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <SpringButton variant="outline" onClick={() => setCancelTarget(null)}>
                  {language === 'ta' ? 'சந்திப்பை வைத்திரு' : 'Keep Visit'}
                </SpringButton>
                <SpringButton variant="danger" disabled={busyAction} onClick={handleConfirmCancel}>
                  {language === 'ta' ? 'ரத்து செய்' : 'Confirm Cancellation'}
                </SpringButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
