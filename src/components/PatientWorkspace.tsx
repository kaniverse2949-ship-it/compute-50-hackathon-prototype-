import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  BadgeCheck,
  BarChart3,
  Bookmark,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  HeartPulse,
  History,
  LogOut,
  MapPin,
  Mic,
  Navigation,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Type,
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
import { AppFooter } from './AppFooter';
import { DirectionsModal } from './DirectionsModal';
import { DoctorPortfolioModal } from './DoctorPortfolioModal';
import { HealthResourcesSection } from './HealthResourcesSection';
import { ImpactDashboardSection } from './ImpactDashboardSection';
import {
  AnimatedCareIllustration,
  ParallaxTiltCard,
  SpringButton,
} from './MotionPrimitives';

interface PatientWorkspaceProps {
  token: string;
  user: PublicUser;
  language: Language;
  onChangeLanguage?: (lang: Language) => void;
  calmMotion: boolean;
  onUpdateUser: (user: PublicUser) => void;
  onToggleCalmMotion: () => void;
  largeText?: boolean;
  onToggleLargeText?: () => void;
  onSignOut: () => void;
}

type PatientTab = 'discover' | 'ai' | 'appointments' | 'impact' | 'privacy';

interface RecentSearchEntry {
  id: string;
  query: string;
  specialty: string;
  city: string;
  spokenLang: string;
  maxFee: number;
  label: string;
}

export function PatientWorkspace({
  token,
  user,
  language,
  onChangeLanguage,
  calmMotion,
  onUpdateUser,
  onToggleCalmMotion,
  largeText = false,
  onToggleLargeText,
  onSignOut,
}: PatientWorkspaceProps) {
  const isTa = language === 'ta';
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

  // Smart Discovery Search & Multi-Facet Filter State (Feature 2)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedSpokenLang, setSelectedSpokenLang] = useState('all');
  const [maxFee, setMaxFee] = useState<number>(1500);

  // Patient Dashboard Saved Doctors & Recent Searches State (Feature 3)
  const savedStorageKey = `fc_saved_docs_${user.id}`;
  const recentStorageKey = `fc_recent_searches_${user.id}`;

  const [savedDoctorIds, setSavedDoctorIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(savedStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return ['doc-amala-rajan', 'doc-arjun-karthik'];
  });

  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>(() => {
    try {
      const raw = window.localStorage.getItem(recentStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [
      {
        id: 'demo-rs-1',
        query: '',
        specialty: 'Cardiology',
        city: 'Chennai',
        spokenLang: 'Tamil',
        maxFee: 1000,
        label: 'Cardiology · Chennai · Tamil',
      },
      {
        id: 'demo-rs-2',
        query: '',
        specialty: 'General Medicine',
        city: 'all',
        spokenLang: 'all',
        maxFee: 600,
        label: 'General Medicine · ≤₹600',
      },
    ];
  });

  const [liveSearchCount, setLiveSearchCount] = useState(0);
  const [liveAiCount, setLiveAiCount] = useState(0);

  useEffect(() => {
    try {
      window.localStorage.setItem(savedStorageKey, JSON.stringify(savedDoctorIds));
    } catch {
      // ignore
    }
  }, [savedDoctorIds, savedStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(recentStorageKey, JSON.stringify(recentSearches));
    } catch {
      // ignore
    }
  }, [recentSearches, recentStorageKey]);

  // Modals
  const [activeDoctor, setActiveDoctor] = useState<{
    doctor: DoctorProfile;
    initialStep: 'portfolio' | 'book' | 'feedback';
    feedbackAptId?: string;
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

  const cities = useMemo(() => {
    const set = new Set<string>();
    doctors.forEach((d) => {
      if (d.city) set.add(d.city);
    });
    return ['all', ...Array.from(set)];
  }, [doctors]);

  const spokenLanguages = useMemo(() => {
    const set = new Set<string>();
    doctors.forEach((d) => d.languagesSpoken.forEach((l) => set.add(l)));
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
      const matchesCity =
        selectedCity === 'all' ||
        d.city.toLowerCase() === selectedCity.toLowerCase() ||
        d.area.toLowerCase().includes(selectedCity.toLowerCase());
      const matchesSpokenLang =
        selectedSpokenLang === 'all' ||
        d.languagesSpoken.some((l) => l.toLowerCase() === selectedSpokenLang.toLowerCase());
      const matchesFee = d.consultationFee <= maxFee;
      return matchesQuery && matchesSpec && matchesCity && matchesSpokenLang && matchesFee;
    });
  }, [doctors, searchQuery, selectedSpecialty, selectedCity, selectedSpokenLang, maxFee]);

  // Debounced auto-record meaningful searches into Recent Searches
  useEffect(() => {
    const hasFilter =
      searchQuery.trim().length >= 2 ||
      selectedSpecialty !== 'all' ||
      selectedCity !== 'all' ||
      selectedSpokenLang !== 'all' ||
      maxFee < 1500;
    if (!hasFilter) return;

    const timer = setTimeout(() => {
      const parts: string[] = [];
      if (searchQuery.trim()) parts.push(`"${searchQuery.trim()}"`);
      if (selectedSpecialty !== 'all') parts.push(selectedSpecialty);
      if (selectedCity !== 'all') parts.push(selectedCity);
      if (selectedSpokenLang !== 'all') parts.push(selectedSpokenLang);
      if (maxFee < 1500) parts.push(`≤₹${maxFee}`);
      const label = parts.join(' · ');
      if (!label) return;

      setLiveSearchCount((c) => c + 1);
      setRecentSearches((prev) => {
        const filtered = prev.filter((item) => item.label !== label);
        const entry: RecentSearchEntry = {
          id: `rs-${Date.now()}`,
          query: searchQuery.trim(),
          specialty: selectedSpecialty,
          city: selectedCity,
          spokenLang: selectedSpokenLang,
          maxFee,
          label,
        };
        return [entry, ...filtered].slice(0, 5);
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedSpecialty, selectedCity, selectedSpokenLang, maxFee]);

  const savedDoctors = useMemo(
    () => doctors.filter((d) => savedDoctorIds.includes(d.id)),
    [doctors, savedDoctorIds]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments.filter(
        (a) => a.status !== 'cancelled' && a.status !== 'completed'
      ),
    [appointments]
  );

  const toggleSaveDoctor = (doctorId: string, docName: string) => {
    setSavedDoctorIds((prev) => {
      const exists = prev.includes(doctorId);
      const next = exists ? prev.filter((id) => id !== doctorId) : [doctorId, ...prev];
      showToast(
        exists
          ? isTa
            ? `${docName} சேமிப்பிலிருந்து நீக்கப்பட்டது.`
            : `Removed ${docName} from Saved Doctors.`
          : isTa
          ? `${docName} உங்கள் சேமிப்பில் சேர்க்கப்பட்டது.`
          : `Saved ${docName} to your dashboard.`
      );
      return next;
    });
  };

  const applyRecentSearch = (entry: RecentSearchEntry) => {
    setSearchQuery(entry.query);
    setSelectedSpecialty(entry.specialty);
    setSelectedCity(entry.city);
    setSelectedSpokenLang(entry.spokenLang);
    setMaxFee(entry.maxFee);
  };

  const resetDiscoveryFilters = () => {
    setSearchQuery('');
    setSelectedSpecialty('all');
    setSelectedCity('all');
    setSelectedSpokenLang('all');
    setMaxFee(1500);
  };

  const buildMatchExplanation = (doc: DoctorProfile): string => {
    const reasons: string[] = [];
    if (selectedSpecialty !== 'all') {
      reasons.push(
        isTa
          ? `தேர்ந்தெடுத்த ${selectedSpecialty} பிரிவுடன் பொருந்துகிறது`
          : `Matches ${selectedSpecialty} filter`
      );
    }
    if (selectedCity !== 'all') {
      reasons.push(
        isTa ? `${doc.area}, ${doc.city}-இல் அமைந்துள்ளது` : `Located in ${doc.area}, ${doc.city}`
      );
    }
    if (selectedSpokenLang !== 'all') {
      reasons.push(
        isTa
          ? `${selectedSpokenLang} மொழியில் ஆலோசனை`
          : `Consults in ${selectedSpokenLang}`
      );
    }
    if (searchQuery.trim()) {
      reasons.push(
        isTa
          ? `"${searchQuery.trim()}" தேடலுடன் பொருத்தம்`
          : `Matches "${searchQuery.trim()}"`
      );
    }
    if (maxFee < 1500) {
      reasons.push(
        isTa
          ? `₹${maxFee} பட்ஜெட்டிற்குள் கட்டணம் (₹${doc.consultationFee})`
          : `Within your ₹${maxFee} budget (₹${doc.consultationFee})`
      );
    }
    if (reasons.length === 0) {
      const langs = doc.languagesSpoken.join(', ');
      return isTa
        ? `${doc.area}, ${doc.city} · ${langs} மொழிகள் · ${
            doc.verificationStatus === 'verified'
              ? 'சான்றளிக்கப்பட்ட தகுதிகள்'
              : 'சரிபார்ப்பு நிலுவையில்'
          }`
        : `Serves ${doc.area}, ${doc.city} · Speaks ${langs} · ${
            doc.verificationStatus === 'verified'
              ? 'Verified credentials'
              : 'Verification pending review'
          }`;
    }
    if (doc.verificationStatus === 'verified') {
      reasons.push(isTa ? 'சான்றளிக்கப்பட்ட தகுதிகள்' : 'Verified credentials');
    }
    return reasons.join(' · ');
  };

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
        isTa ? 'சந்திப்பு நேரம் மாற்றப்பட்டது.' : 'Appointment rescheduled successfully.'
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
        isTa ? 'சந்திப்பு ரத்து செய்யப்பட்டது.' : 'Appointment cancelled and refund processed.'
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
          ? isTa
            ? 'பரிந்துரை மருத்துவருடன் ஆவணப் பகிர்வுக்கு சம்மதிக்கப்பட்டது.'
            : 'Consent recorded. Referred specialist can now review your shared records.'
          : isTa
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
        isTa ? 'மருத்துவ அறிக்கை பாதுகாப்பாகச் சேமிக்கப்பட்டது.' : 'Health record saved privately.'
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
      showToast(isTa ? 'சுயவிவரப் படம் புதுப்பிக்கப்பட்டது.' : 'Profile photo updated.');
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
      showToast(isTa ? 'சுயவிவரப் படம் நீக்கப்பட்டது.' : 'Profile photo removed.');
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
    { id: 'impact', label: t.navImpact, icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'privacy', label: t.navPrivacy, icon: <ShieldCheck className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
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
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-700 to-sky-700 text-white flex items-center justify-center shadow-sm shadow-teal-700/20"
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

          <nav className="hidden md:flex items-center gap-6">
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
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-600 to-sky-600 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigateTab('privacy')}
              title="Profile & photo settings"
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
              <span className="hidden sm:inline text-xs font-medium text-slate-700 truncate max-w-[120px]">
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
              {/* Hero Discovery Banner with Deep Teal + Medical Blue clinical atmosphere */}
              <ParallaxTiltCard calm={calmMotion}>
                <section className="rounded-3xl fc-hero-wash border border-slate-200 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center shadow-sm">
                  <div className="lg:col-span-8 space-y-4">
                    <p className="text-xs font-semibold text-teal-800">
                      {isTa
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
                        <Mic className="w-4 h-4 text-sky-200" />
                        {isTa ? 'AI & Gemini குரல் வழிகாட்டி' : 'AI Care & Gemini Voice'}
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

                  {/* Quick Accessibility & Unified AI/Voice Card */}
                  <div className="lg:col-span-4 rounded-2xl bg-white/90 border border-slate-200/90 p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-teal-700" />
                        {isTa ? 'ஒருங்கிணைந்த AI & குரல்' : 'Unified Care & Voice'}
                      </span>
                      <SpringButton size="sm" onClick={() => openAiGuide('match')}>
                        <Mic className="w-3.5 h-3.5" />
                        {isTa ? 'தொடங்கு' : 'Open Guide'}
                      </SpringButton>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {isTa
                        ? 'மருத்துவர் பொருத்தம், உரையாடல் மற்றும் Gemini நேரடி குரல் உதவி அனைத்தும் ஒரே இடத்தில்.'
                        : 'Text chat, specialist matching, nearby maps & live Gemini voice in one workspace.'}
                    </p>
                    <div className="space-y-2.5 pt-2 border-t border-slate-200/80">
                      {onToggleLargeText && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Type className="w-3.5 h-3.5 text-sky-700" />
                            {isTa ? 'எழுத்து அளவு' : 'Readable Text'}
                          </span>
                          <button
                            type="button"
                            onClick={onToggleLargeText}
                            aria-pressed={largeText}
                            className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-sky-800 hover:border-sky-600 cursor-pointer"
                          >
                            {largeText ? t.standardTextLabel : t.largeTextLabel}
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          {isTa ? 'அசைவு அமைப்பு' : 'Animation Comfort'}
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
                  </div>
                </section>
              </ParallaxTiltCard>

              {/* Patient Dashboard Overview Row: Upcoming Appointments & Saved Doctors (Feature 3) */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Upcoming Appointments Panel */}
                <div className="lg:col-span-6 rounded-3xl bg-white border border-slate-200 p-5 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-teal-700" />
                      {isTa ? 'வரவிருக்கும் சந்திப்புகள்' : 'Upcoming Appointments'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigateTab('appointments')}
                      className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
                    >
                      {isTa ? 'அனைத்தும் காண்க' : `View all (${appointments.length})`}
                    </button>
                  </div>

                  {upcomingAppointments.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between gap-3">
                      <span>
                        {isTa
                          ? 'வரவிருக்கும் சந்திப்புகள் இல்லை. கீழே உள்ள மருத்துவர்களில் இருந்து டெமோ முன்பதிவு செய்யலாம்.'
                          : 'No upcoming appointments yet. Book a demo slot from any specialist below.'}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {upcomingAppointments.slice(0, 2).map((apt) => (
                        <div
                          key={apt.id}
                          className="p-3.5 rounded-2xl bg-slate-50/85 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {apt.doctorName}
                            </p>
                            <p className="text-xs text-slate-600 truncate">
                              {apt.doctorSpecialty} · {apt.hospitalName}
                            </p>
                            <p className="text-xs font-mono-num text-teal-800 font-semibold">
                              {apt.date} · {apt.time} · ₹{apt.consultationFee} (Demo)
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <SpringButton
                              size="sm"
                              variant="outline"
                              onClick={() => setDirectionsApt(apt)}
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              {t.directions}
                            </SpringButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Saved Doctors Panel */}
                <div className="lg:col-span-6 rounded-3xl bg-white border border-slate-200 p-5 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-sky-700" />
                      {t.savedDoctorsTitle} ({savedDoctors.length})
                    </h2>
                    <span className="text-[11px] text-slate-500">
                      {isTa ? 'மாதிரிப் பட்டியல்' : 'Quick shortlist'}
                    </span>
                  </div>

                  {savedDoctors.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                      {isTa
                        ? 'சேமிக்கப்பட்ட மருத்துவர்கள் இல்லை. மருத்துவர் அட்டையில் உள்ள சேமி பொத்தானைத் தட்டவும்.'
                        : 'No saved doctors yet. Tap the bookmark button on any doctor card to shortlist them here.'}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {savedDoctors.slice(0, 2).map((doc) => {
                        const dName = isTa ? doc.nameTa : doc.name;
                        const dSpec = (isTa ? doc.specialtiesTa : doc.specialties)[0];
                        return (
                          <div
                            key={doc.id}
                            className="p-3.5 rounded-2xl bg-slate-50/85 border border-slate-200/90 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={doc.photoUrl}
                                alt={dName}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-xl object-cover shrink-0 bg-slate-100"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate flex items-center gap-1">
                                  <span>{dName}</span>
                                  {doc.verificationStatus === 'verified' && (
                                    <BadgeCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                  )}
                                </p>
                                <p className="text-xs text-slate-600 truncate">
                                  {dSpec} · {doc.city} · <span className="font-mono-num">₹{doc.consultationFee}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <SpringButton
                                size="sm"
                                onClick={() => setActiveDoctor({ doctor: doc, initialStep: 'book' })}
                              >
                                {isTa ? 'முன்பதிவு' : 'Book'}
                              </SpringButton>
                              <button
                                type="button"
                                aria-label={`Remove ${dName} from saved`}
                                onClick={() => toggleSaveDoctor(doc.id, dName)}
                                className="min-h-[38px] min-w-[38px] rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-orange-600 hover:border-orange-300 flex items-center justify-center cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Smart Discovery Search, Location, Language & Budget Filters (Feature 2) */}
              <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center">
                  <div className="lg:col-span-5 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      aria-label={t.searchPlaceholder}
                      className="w-full min-h-[46px] pl-11 pr-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  {/* Location Filter */}
                  <div className="lg:col-span-2">
                    <label className="sr-only" htmlFor="fc-filter-city">
                      {t.filterLocation}
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-sky-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        id="fc-filter-city"
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="w-full min-h-[46px] pl-9 pr-3 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-600 cursor-pointer"
                      >
                        {cities.map((c) => (
                          <option key={c} value={c}>
                            {c === 'all' ? t.allCities : c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Language Spoken Filter */}
                  <div className="lg:col-span-2">
                    <label className="sr-only" htmlFor="fc-filter-lang">
                      {t.filterLanguage}
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-teal-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        id="fc-filter-lang"
                        value={selectedSpokenLang}
                        onChange={(e) => setSelectedSpokenLang(e.target.value)}
                        className="w-full min-h-[46px] pl-9 pr-3 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-600 cursor-pointer"
                      >
                        {spokenLanguages.map((langOpt) => (
                          <option key={langOpt} value={langOpt}>
                            {langOpt === 'all' ? t.allLanguages : langOpt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Max Consultation Fee Slider */}
                  <div className="lg:col-span-3 flex items-center gap-3 px-2">
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {t.budgetMax}:
                    </span>
                    <input
                      type="range"
                      min={400}
                      max={1500}
                      step={50}
                      value={maxFee}
                      aria-label={t.budgetMax}
                      onChange={(e) => setMaxFee(Number(e.target.value))}
                      className="flex-1 accent-teal-700"
                    />
                    <span className="font-mono-num text-xs font-bold text-slate-900 w-12 text-right">
                      ₹{maxFee}
                    </span>
                  </div>
                </div>

                {/* Specialty Interactive Tabs */}
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
                            ? 'bg-gradient-to-r from-teal-700 to-sky-700 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {spec === 'all' ? t.allSpecialties : spec}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Recent Searches Bar (Feature 3) */}
                {recentSearches.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 inline-flex items-center gap-1">
                        <History className="w-3.5 h-3.5 text-sky-700" />
                        {t.recentSearchesTitle}:
                      </span>
                      {recentSearches.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => applyRecentSearch(entry)}
                          className="min-h-[32px] px-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-sky-500 hover:bg-sky-50/70 text-xs font-medium text-slate-700 cursor-pointer transition-colors"
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecentSearches([])}
                      className="text-[11px] font-semibold text-slate-500 hover:text-orange-700 cursor-pointer"
                    >
                      {isTa ? 'அழி' : 'Clear'}
                    </button>
                  </div>
                )}
              </section>

              {/* Doctor Cards Grid */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="h-72 rounded-3xl bg-white border border-slate-200 animate-pulse" />
                  ))}
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center space-y-3">
                  <p className="font-display text-lg font-bold text-slate-900">
                    {isTa
                      ? 'உங்கள் தேடலுக்குப் பொருத்தமான மருத்துவர்கள் இல்லை.'
                      : 'No doctors match all selected filters.'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {isTa
                      ? 'நகரம், மொழி அல்லது கட்டண வரம்பை மாற்றி மீண்டும் முயற்சிக்கவும்.'
                      : 'Try expanding your fee range or switching city / language filters.'}
                  </p>
                  <SpringButton variant="outline" onClick={resetDiscoveryFilters}>
                    {isTa ? 'வடிப்பான்களை மீட்டமை' : 'Reset All Filters'}
                  </SpringButton>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredDoctors.map((doc, idx) => {
                    const docName = isTa ? doc.nameTa : doc.name;
                    const docHospital = isTa ? doc.hospitalNameTa : doc.hospitalName;
                    const docSpecs = isTa ? doc.specialtiesTa : doc.specialties;
                    const nextSlot = doc.availableSlots[0];
                    const isSaved = savedDoctorIds.includes(doc.id);
                    const isVerified = doc.verificationStatus === 'verified';

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
                        className="rounded-3xl bg-white border border-slate-200 p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-lg hover:border-teal-400 transition-all"
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
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <h3 className="font-display text-base font-bold text-slate-900 truncate">
                                    {docName}
                                  </h3>
                                  {isVerified && (
                                    <BadgeCheck
                                      aria-label={t.verifiedDoctor}
                                      className="w-4 h-4 text-teal-600 shrink-0"
                                    />
                                  )}
                                </div>
                                <button
                                  type="button"
                                  aria-pressed={isSaved}
                                  aria-label={isSaved ? `Unsave ${docName}` : `Save ${docName}`}
                                  onClick={() => toggleSaveDoctor(doc.id, docName)}
                                  className={`min-h-[36px] min-w-[36px] rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                    isSaved
                                      ? 'bg-sky-50 border-sky-300 text-sky-700'
                                      : 'bg-white border-slate-200 text-slate-400 hover:text-sky-700 hover:border-sky-300'
                                  }`}
                                >
                                  <Bookmark
                                    className="w-4 h-4"
                                    fill={isSaved ? 'currentColor' : 'none'}
                                  />
                                </button>
                              </div>
                              <p className="text-xs font-medium text-teal-700 truncate mt-0.5">
                                {docSpecs.join(' · ')}
                              </p>
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {doc.qualifications.join(', ')} · {doc.yearsExperience} {t.yearsExp}
                              </p>
                            </div>
                          </div>

                          {/* Clean unboxed metadata lines */}
                          <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                            <p className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {docHospital} · {doc.area}, {doc.city}
                              </span>
                            </p>
                            <p className="flex items-center gap-1.5 truncate">
                              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {doc.languagesSpoken.join(' · ')} ·{' '}
                                <span className={isVerified ? 'text-teal-700 font-semibold' : 'text-amber-700 font-medium'}>
                                  {isVerified ? t.verifiedDoctor : t.pendingVerification}
                                </span>
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
                            {doc.ratingSummary && doc.ratingSummary.totalReviews > 0 && (
                              <p className="flex items-center gap-1.5 font-medium text-slate-800">
                                <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" />
                                <span className="font-mono-num font-bold">
                                  {doc.ratingSummary.averageOverall.toFixed(1)}
                                </span>
                                <span className="text-slate-500">
                                  · {doc.ratingSummary.totalReviews}{' '}
                                  {isTa
                                    ? 'சரிபார்க்கப்பட்ட மதிப்பீடு'
                                    : doc.ratingSummary.totalReviews === 1
                                    ? 'verified review'
                                    : 'verified reviews'}
                                </span>
                              </p>
                            )}
                          </div>

                          {/* Transparent Why This Doctor Matches Explanation (Feature 2) */}
                          <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200/75 text-xs text-slate-700 leading-relaxed">
                            <span className="font-semibold text-sky-900 block mb-0.5">
                              {isTa ? 'பொருத்தத்திற்கான காரணம்:' : 'Why this matches:'}
                            </span>
                            <span>{buildMatchExplanation(doc)}</span>
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

              {/* Accessible Health Information Resources (Feature 3) */}
              <HealthResourcesSection language={language} />
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
                onChangeLanguage={onChangeLanguage}
                calm={calmMotion}
                initialTab={aiInitialTab}
                onAiInteraction={() => setLiveAiCount((c) => c + 1)}
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
                    {isTa
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
                                ? isTa
                                  ? 'சம்மதம் அளிக்கப்பட்டது'
                                  : 'Consent Granted'
                                : isTa
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900">
                      {t.navAppointments}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {isTa
                        ? 'மாதிரி முன்பதிவு & கட்டணத் தளம் (Demo Flow)'
                        : 'Demo appointment schedule with transparent fee & cancellation terms'}
                    </p>
                  </div>
                  <SpringButton size="sm" onClick={() => navigateTab('discover')}>
                    {isTa ? 'புதிய சந்திப்பு' : 'Book New Visit'}
                  </SpringButton>
                </div>

                {appointments.length === 0 ? (
                  <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center space-y-3">
                    <p className="text-sm text-slate-600">
                      {isTa
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
                          {apt.status !== 'cancelled' && (() => {
                            const matchedDoc = doctors.find((d) => d.id === apt.doctorId);
                            if (!matchedDoc) return null;
                            const alreadyReviewed = matchedDoc.reviews?.some(
                              (r) => r.appointmentId === apt.id
                            );
                            return (
                              <SpringButton
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setActiveDoctor({
                                    doctor: matchedDoc,
                                    initialStep: 'feedback',
                                    feedbackAptId: apt.id,
                                  })
                                }
                              >
                                <Star
                                  className="w-3.5 h-3.5 text-amber-500"
                                  fill={alreadyReviewed ? 'currentColor' : 'none'}
                                />
                                {alreadyReviewed
                                  ? isTa
                                    ? 'கருத்து பதிவு செய்யப்பட்டது'
                                    : 'Edit Feedback'
                                  : isTa
                                  ? 'மதிப்பீடு & கருத்து'
                                  : 'Leave Feedback'}
                              </SpringButton>
                            );
                          })()}
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

          {tab === 'impact' && (
            <motion.div
              key="tab-impact"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ImpactDashboardSection
                language={language}
                doctors={doctors}
                liveSearchCount={liveSearchCount}
                liveAiCount={liveAiCount}
                liveSavedCount={savedDoctorIds.length}
                liveBookingsCount={appointments.length}
              />
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
                  {isTa ? 'மருத்துவ அறிக்கை சேமிப்பகம்' : 'Private Health Records'}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isTa
                    ? 'உங்கள் அறிக்கைகள் பாதுகாக்கப்படுகின்றன. நீங்கள் சம்மதிக்கும் மருத்துவர்கள் மட்டுமே பார்க்க முடியும்.'
                    : 'Your records stay private and are shared only with doctors you explicitly authorize.'}
                </p>

                <form onSubmit={handleUploadRecord} className="space-y-3">
                  <input
                    required
                    value={recTitle}
                    onChange={(e) => setRecTitle(e.target.value)}
                    placeholder={
                      isTa ? 'அறிக்கை தலைப்பு (எ.கா. இரத்தப் பரிசோதனை)' : 'Record Title (e.g. Thyroid Panel)'
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
                      isTa ? 'சுருக்கமான குறிப்பு...' : 'Key measurements or notes...'
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm"
                  />
                  <SpringButton type="submit" className="w-full">
                    {isTa ? 'பாதுகாப்பாகச் சேமி' : 'Save to Private Vault'}
                  </SpringButton>
                </form>
              </div>

              <div className="lg:col-span-7 space-y-5">
                <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    {isTa ? 'சேமிக்கப்பட்ட ஆவணங்கள்' : 'Saved Records'}
                  </h3>
                  {records.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      {isTa ? 'ஆவணங்கள் எதுவும் இல்லை.' : 'No uploaded records yet.'}
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
                                  ? isTa
                                    ? `${rec.sharedWithDoctorIds.length} மருத்துவருடன் பகிரப்பட்டது`
                                    : `Shared with ${rec.sharedWithDoctorIds.length} doctor(s)`
                                  : isTa
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
                    {isTa ? 'சுயவிவரப் படம்' : 'Profile Photo'}
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
                        {isTa
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
                            ? isTa
                              ? 'சேமிக்கிறது...'
                              : 'Saving...'
                            : user.photoUrl
                            ? isTa
                              ? 'படத்தை மாற்று'
                              : 'Change Photo'
                            : isTa
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
                            {isTa ? 'நீக்கு' : 'Remove'}
                          </SpringButton>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    {isTa ? 'காட்சி & அணுகல் அமைப்புகள்' : 'Display & Accessibility'}
                  </h3>

                  {onToggleLargeText && (
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {isTa ? 'எளிதாகப் படிக்கும் எழுத்து அளவு' : 'Readable Text Size'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {isTa
                            ? 'தெளிவாகப் படிக்க பெரிய எழுத்து அளவைத் தேர்ந்தெடுக்கவும்'
                            : 'Increase text and label legibility across every screen'}
                        </p>
                      </div>
                      <SpringButton size="sm" variant="outline" onClick={onToggleLargeText}>
                        <Type className="w-3.5 h-3.5" />
                        {largeText ? t.standardTextLabel : t.largeTextLabel}
                      </SpringButton>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {isTa ? 'அசைவு குறைப்பு வசதி' : 'Motion Preference'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isTa
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

      <AppFooter
        language={language}
        onNavigate={(target) => navigateTab(target)}
        hasBottomNav
      />

      {/* Unified Floating AI Care & Gemini Voice Guide Button */}
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
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-30"
        >
          <SpringButton
            size="lg"
            onClick={() => openAiGuide('match')}
            className="shadow-xl shadow-teal-700/35 rounded-2xl"
          >
            <Sparkles className="w-5 h-5" />
            <Mic className="w-4 h-4 text-sky-200" />
            <span>{isTa ? 'AI & குரல் வழிகாட்டி' : 'AI Care & Voice'}</span>
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
                onChangeLanguage={onChangeLanguage}
                calm={calmMotion}
                initialTab={aiInitialTab}
                onAiInteraction={() => setLiveAiCount((c) => c + 1)}
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 h-16">
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
              <span className="text-[10px] tracking-tight truncate max-w-[66px]">{item.label}</span>
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
            initialFeedbackAppointmentId={activeDoctor.feedbackAptId}
            language={language}
            token={token}
            isPatient={true}
            records={records}
            patientAppointments={appointments}
            onClose={() => setActiveDoctor(null)}
            onBooked={(apt) => {
              setAppointments((prev) => [apt, ...prev]);
              showToast(t.paymentSuccessTitle);
            }}
            onDoctorUpdated={(updatedDoc) => {
              setDoctors((prev) =>
                prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
              );
              setActiveDoctor((curr) =>
                curr && curr.doctor.id === updatedDoc.id
                  ? { ...curr, doctor: updatedDoc }
                  : curr
              );
              showToast(
                isTa
                  ? 'மருத்துவர் மதிப்பீடு புதுப்பிக்கப்பட்டது.'
                  : 'Verified patient feedback published.'
              );
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
                  {isTa ? 'மூடு' : 'Close'}
                </SpringButton>
                <SpringButton disabled={busyAction} onClick={handleConfirmReschedule}>
                  {isTa ? 'நேரத்தை மாற்று' : 'Confirm New Slot'}
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
                  <span>{isTa ? 'செலுத்திய கட்டணம்' : 'Paid Consultation Fee'}</span>
                  <span className="font-mono-num font-bold">₹{cancelTarget.consultationFee}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.cancellationChargeLabel}</span>
                  <span className="font-mono-num font-bold text-orange-700">
                    - ₹{cancelTarget.cancellationFee}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                  <span>{isTa ? 'திருப்பித் தரப்படும் தொகை' : 'Estimated Refund'}</span>
                  <span className="font-mono-num">
                    ₹{Math.max(0, cancelTarget.consultationFee - cancelTarget.cancellationFee)}
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <SpringButton variant="outline" onClick={() => setCancelTarget(null)}>
                  {isTa ? 'சந்திப்பை வைத்திரு' : 'Keep Visit'}
                </SpringButton>
                <SpringButton variant="danger" disabled={busyAction} onClick={handleConfirmCancel}>
                  {isTa ? 'ரத்து செய்' : 'Confirm Cancellation'}
                </SpringButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
