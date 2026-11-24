import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  Award,
  BadgeCheck,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck2,
  FileText,
  HeartPulse,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { api } from '../api';
import { getCopy } from '../i18n';
import { compressProfilePhoto } from '../lib/imageUpload';
import type {
  Appointment,
  AvailabilitySlot,
  DoctorProfile,
  Language,
  PatientHealthRecord,
  PeerDiscussion,
  PublicUser,
  ReferralRequest,
  SupervisionRequest,
} from '../types';
import { SpringButton } from './MotionPrimitives';

interface DoctorWorkspaceProps {
  token: string;
  user: PublicUser;
  language: Language;
  calmMotion: boolean;
  onUpdateUser: (user: PublicUser) => void;
  onToggleCalmMotion: () => void;
  onSignOut: () => void;
}

type DoctorTab = 'portfolio' | 'schedule' | 'peers';

export function DoctorWorkspace({
  token,
  user,
  language,
  calmMotion,
  onUpdateUser,
  onToggleCalmMotion,
  onSignOut,
}: DoctorWorkspaceProps) {
  const t = getCopy(language);
  const [tabHistory, setTabHistory] = useState<DoctorTab[]>(['portfolio']);
  const [historyIdx, setHistoryIdx] = useState(0);
  const tab = tabHistory[historyIdx] ?? 'portfolio';
  const canGoBack = historyIdx > 0;
  const canGoForward = historyIdx < tabHistory.length - 1;

  const navigateTab = (next: DoctorTab) => {
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

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [peerBusyId, setPeerBusyId] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sharedRecords, setSharedRecords] = useState<PatientHealthRecord[]>([]);
  const [discussions, setDiscussions] = useState<PeerDiscussion[]>([]);
  const [referrals, setReferrals] = useState<ReferralRequest[]>([]);
  const [supervisions, setSupervisions] = useState<SupervisionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  const myProfile = useMemo(
    () => doctors.find((d) => d.id === user.doctorId) || doctors[0],
    [doctors, user.doctorId]
  );

  // Editable profile fields
  const [hospitalName, setHospitalName] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [fee, setFee] = useState('500');
  const [cancelFee, setCancelFee] = useState('50');
  const [dailyLimit, setDailyLimit] = useState('12');
  const [availableHours, setAvailableHours] = useState('');
  const [bio, setBio] = useState('');
  const [bioTa, setBioTa] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoTranscript, setVideoTranscript] = useState('');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('10:30');

  // New credential form
  const [credTitle, setCredTitle] = useState('');
  const [credIssuer, setCredIssuer] = useState('');
  const [credYear, setCredYear] = useState('2024');
  const [credRegNo, setCredRegNo] = useState('');

  // New case study form
  const [csTitle, setCsTitle] = useState('');
  const [csSummary, setCsSummary] = useState('');
  const [csApproach, setCsApproach] = useState('');
  const [csOutcome, setCsOutcome] = useState('');
  const [csAnonymized, setCsAnonymized] = useState(false);
  const [csConsent, setCsConsent] = useState(false);

  // Peer discussion form & replies
  const [discTitle, setDiscTitle] = useState('');
  const [discQuestion, setDiscQuestion] = useState('');
  const [discAnon, setDiscAnon] = useState(true);
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  // Referral form
  const [refPatientId, setRefPatientId] = useState('');
  const [refToDoctorId, setRefToDoctorId] = useState('');
  const [refReason, setRefReason] = useState('');
  const [refSupNote, setRefSupNote] = useState('');

  // Supervision form
  const [supTargetDocId, setSupTargetDocId] = useState('');
  const [supScope, setSupScope] = useState('');

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
      api.listPeerDiscussions(token),
      api.listReferrals(token),
    ])
      .then(([docRes, aptRes, recRes, peerRes, refRes]) => {
        if (!active) return;
        setDoctors(docRes.doctors);
        setAppointments(aptRes.appointments);
        setSharedRecords(recRes.records);
        setDiscussions(peerRes.discussions);
        setReferrals(refRes.referrals);
        setSupervisions(refRes.supervisions || []);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Unable to load doctor console.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!myProfile) return;
    setHospitalName(myProfile.hospitalName);
    setCity(myProfile.city);
    setArea(myProfile.area);
    setFee(String(myProfile.consultationFee));
    setCancelFee(String(myProfile.cancellationFee));
    setDailyLimit(String(myProfile.dailyLimit));
    setAvailableHours(myProfile.availableHours);
    setBio(myProfile.bio);
    setBioTa(myProfile.bioTa);
    setVideoTitle(myProfile.introVideo?.title || '');
    setVideoTranscript(myProfile.introVideo?.transcript || '');
    setSlots(myProfile.availableSlots || []);
    setNewSlotDate(myProfile.availableSlots?.[0]?.date || new Date().toISOString().slice(0, 10));
  }, [myProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.updateDoctorProfile(token, {
        hospitalName,
        city,
        area,
        consultationFee: Number(fee),
        cancellationFee: Number(cancelFee),
        dailyLimit: Number(dailyLimit),
        availableHours,
        availableSlots: slots,
        bio,
        bioTa,
        introVideo: videoTitle.trim()
          ? {
              title: videoTitle.trim(),
              titleTa: videoTitle.trim(),
              durationSec: myProfile?.introVideo?.durationSec || 95,
              summary: videoTranscript.slice(0, 140),
              summaryTa: videoTranscript.slice(0, 140),
              transcript: videoTranscript,
              transcriptTa: videoTranscript,
            }
          : undefined,
      });
      setDoctors((prev) => prev.map((d) => (d.id === res.doctor.id ? res.doctor : d)));
      showToast(
        language === 'ta' ? 'மருத்துவர் சுயவிவரம் புதுப்பிக்கப்பட்டது.' : 'Doctor portfolio saved.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save portfolio.', true);
    }
  };

  const handleDoctorPhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await compressProfilePhoto(file);
      const [profRes, meRes] = await Promise.all([
        api.updateDoctorProfile(token, { photoUrl: dataUrl }),
        api.updateMe(token, { photoUrl: dataUrl }),
      ]);
      setDoctors((prev) => prev.map((d) => (d.id === profRes.doctor.id ? profRes.doctor : d)));
      onUpdateUser(meRes.user);
      showToast(
        language === 'ta' ? 'சுயவிவரப் படம் புதுப்பிக்கப்பட்டது.' : 'Doctor profile photo updated.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update photo.', true);
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleAddSlot = async () => {
    if (!newSlotDate || !newSlotTime) return;
    const nextSlots = [...slots];
    const existing = nextSlots.find((s) => s.date === newSlotDate);
    if (existing) {
      if (!existing.times.includes(newSlotTime)) {
        existing.times = [...existing.times, newSlotTime].sort();
      }
    } else {
      nextSlots.push({ date: newSlotDate, times: [newSlotTime] });
      nextSlots.sort((a, b) => a.date.localeCompare(b.date));
    }
    setSlots(nextSlots);
    try {
      const res = await api.updateDoctorProfile(token, { availableSlots: nextSlots });
      setDoctors((prev) => prev.map((d) => (d.id === res.doctor.id ? res.doctor : d)));
      showToast(language === 'ta' ? 'புதிய நேரம் சேர்க்கப்பட்டது.' : 'Availability slot added.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save slot.', true);
    }
  };

  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.addDoctorCredential(token, {
        title: credTitle,
        issuer: credIssuer,
        year: credYear,
        registrationNo: credRegNo,
      });
      setDoctors((prev) => prev.map((d) => (d.id === res.doctor.id ? res.doctor : d)));
      setCredTitle('');
      setCredIssuer('');
      setCredRegNo('');
      showToast(
        language === 'ta'
          ? 'சான்றிதழ் சரிபார்ப்புக்குச் சமர்ப்பிக்கப்பட்டது.'
          : 'Credential submitted for verification review.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add credential.', true);
    }
  };

  const handleAddCaseStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csAnonymized || !csConsent) {
      showToast(
        language === 'ta'
          ? 'பெயர் நீக்கம் மற்றும் நோயாளி சம்மதம் இரண்டும் கட்டாயம்.'
          : 'Confirm both anonymization and patient consent first.',
        true
      );
      return;
    }
    try {
      const res = await api.addCaseStudy(token, {
        title: csTitle,
        summary: csSummary,
        clinicalApproach: csApproach,
        outcomeSummary: csOutcome,
        anonymizedConfirmed: csAnonymized,
        patientConsentObtained: csConsent,
      });
      setDoctors((prev) => prev.map((d) => (d.id === res.doctor.id ? res.doctor : d)));
      setCsTitle('');
      setCsSummary('');
      setCsApproach('');
      setCsOutcome('');
      setCsAnonymized(false);
      setCsConsent(false);
      showToast(
        language === 'ta'
          ? 'மருத்துவ ஆய்வு மதிப்பாய்வுக்கு அனுப்பப்பட்டது.'
          : 'Case study submitted for peer review.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit case study.', true);
    }
  };

  const handleAppointmentAction = async (
    aptId: string,
    action: 'confirm' | 'complete' | 'cancel'
  ) => {
    try {
      const res = await api.updateAppointment(token, aptId, { action });
      setAppointments((prev) =>
        prev.map((a) => (a.id === res.appointment.id ? res.appointment : a))
      );
      showToast(
        language === 'ta'
          ? 'சந்திப்பு நிலை புதுப்பிக்கப்பட்டது.'
          : `Appointment marked as ${res.appointment.status}.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update appointment.', true);
    }
  };

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createPeerDiscussion(token, {
        title: discTitle,
        question: discQuestion,
        anonymizedConfirmed: discAnon,
      });
      setDiscussions((prev) => [res.discussion, ...prev]);
      setDiscTitle('');
      setDiscQuestion('');
      showToast(
        language === 'ta' ? 'மருத்துவர் விவாதம் வெளியிடப்பட்டது.' : 'Peer consultation topic posted.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not post topic.', true);
    }
  };

  const handleReplyDiscussion = async (id: string) => {
    const msg = replyMap[id]?.trim();
    if (!msg) return;
    try {
      const res = await api.replyPeerDiscussion(token, id, msg);
      setDiscussions((prev) => prev.map((d) => (d.id === res.discussion.id ? res.discussion : d)));
      setReplyMap((prev) => ({ ...prev, [id]: '' }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not post reply.', true);
    }
  };

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refPatientId || !refToDoctorId || !refReason.trim()) return;
    try {
      const res = await api.createReferral(token, {
        patientId: refPatientId,
        toDoctorId: refToDoctorId,
        clinicalReason: refReason.trim(),
        supervisionNote: refSupNote.trim() || undefined,
      });
      setReferrals((prev) => [res.referral, ...prev]);
      setRefReason('');
      setRefSupNote('');
      showToast(
        language === 'ta'
          ? 'நோயாளி சம்மதத்திற்காகப் பரிந்துரை அனுப்பப்பட்டது.'
          : 'Referral created — awaiting explicit patient consent before sharing records.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create referral.', true);
    }
  };

  const handleEstablishSupervision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile || !supTargetDocId || !supScope.trim()) return;
    try {
      const isSenior = myProfile.seniorMentorEligible && myProfile.verificationStatus === 'verified';
      const payload = isSenior
        ? { supervisorDoctorId: myProfile.id, menteeDoctorId: supTargetDocId, scope: supScope.trim() }
        : { supervisorDoctorId: supTargetDocId, menteeDoctorId: myProfile.id, scope: supScope.trim() };
      const res = await api.createSupervision(token, payload);
      setSupervisions((prev) => [res.supervision, ...prev]);
      setSupScope('');
      showToast(
        language === 'ta' ? 'மேற்பார்வை தொடர்பு பதிவு செய்யப்பட்டது.' : 'Supervision relationship established.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update supervision.', true);
    }
  };

  const navItems: Array<{ id: DoctorTab; label: string; icon: React.ReactNode }> = [
    { id: 'portfolio', label: t.navProfile, icon: <Stethoscope className="w-5 h-5" /> },
    { id: 'schedule', label: t.navSchedule, icon: <CalendarClock className="w-5 h-5" /> },
    { id: 'peers', label: t.navPeers, icon: <Users className="w-5 h-5" /> },
  ];

  const uniquePatients = useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach((a) => map.set(a.patientId, a.patientName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [appointments]);

  const activeTodayCount = appointments.filter((a) => a.status !== 'cancelled').length;

  return (
    <div className="min-h-screen flex flex-col pb-24 md:pb-8">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigateTab('portfolio')}
              className="flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center"
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
                      layoutId="doctor-nav-underline"
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
              onClick={() => navigateTab('portfolio')}
              title="Change profile photo"
              className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {(myProfile?.photoUrl || user.photoUrl) && (
                <img
                  src={myProfile?.photoUrl || user.photoUrl}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                />
              )}
              <span className="hidden sm:inline text-xs font-medium text-slate-700 truncate max-w-[150px]">
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

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {loadError && (
          <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-xs text-orange-800">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />
            <div className="lg:col-span-8 h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {tab === 'portfolio' && myProfile && (
              <motion.div
                key="doc-portfolio"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* Left LinkedIn-Style Summary Card */}
                <div className="lg:col-span-4 space-y-5">
                  <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                    <div className="h-24 bg-gradient-to-r from-teal-700 to-slate-900" />
                    <div className="px-6 pb-6 -mt-10 space-y-3">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleDoctorPhotoPick}
                        className="hidden"
                      />
                      <div className="flex items-end justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={photoBusy}
                          title="Change profile photo"
                          className="relative group cursor-pointer rounded-2xl focus:outline-none"
                        >
                          <img
                            src={myProfile.photoUrl}
                            alt={myProfile.name}
                            referrerPolicy="no-referrer"
                            className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md bg-slate-100"
                          />
                          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow border-2 border-white group-hover:bg-teal-700 transition-colors">
                            <Camera className="w-3.5 h-3.5" />
                          </span>
                        </button>
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
                              : 'Uploading...'
                            : language === 'ta'
                            ? 'படத்தை மாற்று'
                            : 'Change Photo'}
                        </SpringButton>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h1 className="font-display text-xl font-bold text-slate-900">
                            {language === 'ta' ? myProfile.nameTa : myProfile.name}
                          </h1>
                          {myProfile.verificationStatus === 'verified' && (
                            <BadgeCheck className="w-5 h-5 text-teal-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs font-semibold text-teal-700 mt-0.5">
                          {myProfile.specialties.join(' · ')}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {myProfile.qualifications.join(', ')} · Reg: {myProfile.registrationNumber}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-slate-500">{t.consultationFee}</p>
                          <p className="font-mono-num text-base font-bold text-slate-900">
                            ₹{myProfile.consultationFee}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">{t.dailyCapacity}</p>
                          <p className="font-mono-num text-base font-bold text-slate-900">
                            {activeTodayCount} / {myProfile.dailyLimit}
                          </p>
                        </div>
                      </div>

                      {myProfile.auditedPatientVolume && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                          <p className="font-semibold text-slate-800">
                            <span className="font-mono-num">
                              {myProfile.auditedPatientVolume.count.toLocaleString()}
                            </span>{' '}
                            {language === 'ta' ? 'தணிக்கை ஆலோசனைகள்' : 'audited consultations'}
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            {myProfile.auditedPatientVolume.period} · {myProfile.auditedPatientVolume.source}
                          </p>
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-100">
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

                  {/* Credentials List & Verification Upload */}
                  <div className="rounded-3xl bg-white border border-slate-200 p-5 space-y-4">
                    <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-teal-600" />
                      {language === 'ta' ? 'சான்றிதழ்கள் & சரிபார்ப்பு' : 'Credentials & Verification'}
                    </h2>
                    <div className="space-y-2.5">
                      {myProfile.credentials.map((cred) => (
                        <div key={cred.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900">{cred.title}</p>
                            <span
                              className={`text-[11px] font-semibold shrink-0 ${
                                cred.status === 'verified' ? 'text-teal-700' : 'text-amber-700'
                              }`}
                            >
                              {cred.status === 'verified' ? t.verifiedDoctor : t.pendingVerification}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {cred.issuer} · {cred.year} · {cred.registrationNo}
                          </p>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleAddCredential} className="space-y-2.5 pt-2 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-700">
                        {language === 'ta' ? 'புதிய சான்றிதழ் சேர்' : 'Submit Credential for Verification'}
                      </p>
                      <input
                        required
                        value={credTitle}
                        onChange={(e) => setCredTitle(e.target.value)}
                        placeholder="Degree / Fellowship Title"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          required
                          value={credIssuer}
                          onChange={(e) => setCredIssuer(e.target.value)}
                          placeholder="Issuing University"
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs"
                        />
                        <input
                          required
                          value={credRegNo}
                          onChange={(e) => setCredRegNo(e.target.value)}
                          placeholder="Reg / Cert No."
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs"
                        />
                      </div>
                      <SpringButton type="submit" size="sm" variant="outline" className="w-full">
                        {language === 'ta' ? 'சரிபார்ப்புக்கு அனுப்பு' : 'Submit Credential'}
                      </SpringButton>
                    </form>
                  </div>
                </div>

                {/* Right Column: Practice Profile Editor & Case Studies */}
                <div className="lg:col-span-8 space-y-6">
                  <form
                    onSubmit={handleSaveProfile}
                    className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        {language === 'ta'
                          ? 'மருத்துவர் சுயவிவரம், நேரம் & கட்டணம்'
                          : 'Practice Profile, Hours & Fees'}
                      </h2>
                      <SpringButton type="submit" size="sm">
                        {t.savePortfolio}
                      </SpringButton>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {language === 'ta' ? 'மருத்துவமனை பெயர்' : 'Hospital / Clinic'}
                        </label>
                        <input
                          value={hospitalName}
                          onChange={(e) => setHospitalName(e.target.value)}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {language === 'ta' ? 'பகுதி' : 'Area'}
                        </label>
                        <input
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {language === 'ta' ? 'நகரம்' : 'City'}
                        </label>
                        <input
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {t.consultationFee} (₹)
                        </label>
                        <input
                          type="number"
                          min={100}
                          value={fee}
                          onChange={(e) => setFee(e.target.value)}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {t.cancellationChargeLabel} (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={cancelFee}
                          onChange={(e) => setCancelFee(e.target.value)}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {t.dailyCapacity}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={dailyLimit}
                          onChange={(e) => setDailyLimit(e.target.value)}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {language === 'ta' ? 'பணி நேரம்' : 'Available Hours'}
                      </label>
                      <input
                        value={availableHours}
                        onChange={(e) => setAvailableHours(e.target.value)}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Bio (English)
                        </label>
                        <textarea
                          rows={3}
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          className="w-full p-3 rounded-xl border border-slate-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          சுயவிவரம் (தமிழ்)
                        </label>
                        <textarea
                          rows={3}
                          value={bioTa}
                          onChange={(e) => setBioTa(e.target.value)}
                          className="w-full p-3 rounded-xl border border-slate-200 text-sm"
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-teal-600" />
                        {language === 'ta'
                          ? 'நோயாளிகளுக்கான அறிமுக வீடியோ / உரை'
                          : 'Optional Introductory Interview / Approach Video'}
                      </p>
                      <input
                        value={videoTitle}
                        onChange={(e) => setVideoTitle(e.target.value)}
                        placeholder="Intro Video Title"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                      />
                      <textarea
                        rows={2}
                        value={videoTranscript}
                        onChange={(e) => setVideoTranscript(e.target.value)}
                        placeholder="Brief transcript explaining your consultation approach..."
                        className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm"
                      />
                    </div>
                  </form>

                  {/* Anonymized Case Studies Manager */}
                  <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4 shadow-sm">
                    <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                      <FileCheck2 className="w-5 h-5 text-teal-600" />
                      {language === 'ta'
                        ? 'மருத்துவ ஆய்வுகள் (பெயர் நீக்கம் & சம்மதம்)'
                        : 'Reviewed Case Studies (Anonymized & Consented)'}
                    </h2>

                    <div className="space-y-3">
                      {myProfile.caseStudies.map((cs) => (
                        <div key={cs.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-slate-900">
                              {language === 'ta' ? cs.titleTa : cs.title}
                            </p>
                            <span
                              className={`text-xs font-semibold shrink-0 ${
                                cs.status === 'verified' ? 'text-teal-700' : 'text-amber-700'
                              }`}
                            >
                              {cs.status === 'verified' ? 'Verified' : t.pendingVerification}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {language === 'ta' ? cs.summaryTa : cs.summary}
                          </p>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleAddCaseStudy} className="pt-3 border-t border-slate-100 space-y-3">
                      <p className="text-xs font-bold text-slate-800">{t.submitCaseStudy}</p>
                      <input
                        required
                        value={csTitle}
                        onChange={(e) => setCsTitle(e.target.value)}
                        placeholder="Case title (no patient names)"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                      />
                      <textarea
                        required
                        rows={2}
                        value={csSummary}
                        onChange={(e) => setCsSummary(e.target.value)}
                        placeholder="De-identified clinical presentation..."
                        className="w-full p-3 rounded-xl border border-slate-200 text-sm"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          required
                          value={csApproach}
                          onChange={(e) => setCsApproach(e.target.value)}
                          placeholder="Clinical approach"
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                        />
                        <input
                          value={csOutcome}
                          onChange={(e) => setCsOutcome(e.target.value)}
                          placeholder="Documented follow-up outcome"
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 text-sm"
                        />
                      </div>
                      <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={csAnonymized}
                          onChange={(e) => setCsAnonymized(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-teal-600"
                        />
                        <span>
                          {language === 'ta'
                            ? 'நோயாளியை அடையாளம் காணும் அனைத்துத் தகவல்களும் நீக்கப்பட்டுள்ளன.'
                            : 'I confirm all patient-identifying information has been removed.'}
                        </span>
                      </label>
                      <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={csConsent}
                          onChange={(e) => setCsConsent(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-teal-600"
                        />
                        <span>
                          {language === 'ta'
                            ? 'இந்த விவரங்களைப் பகிர நோயாளியிடமிருந்து எழுத்துப்பூர்வ சம்மதம் பெறப்பட்டுள்ளது.'
                            : 'I confirm signed patient consent was obtained prior to submission.'}
                        </span>
                      </label>
                      <SpringButton type="submit" size="sm">
                        {t.submitCaseStudy}
                      </SpringButton>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'schedule' && myProfile && (
              <motion.div
                key="doc-schedule"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                <div className="lg:col-span-8 space-y-5">
                  <div className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-lg font-bold text-slate-900">
                          {t.doctorDashboardTitle}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">{myProfile.availableHours}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">{t.dailyCapacity}</p>
                        <p className="font-mono-num text-lg font-bold text-teal-700">
                          {activeTodayCount} / {myProfile.dailyLimit}
                        </p>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, Math.round((activeTodayCount / myProfile.dailyLimit) * 100))}%`,
                        }}
                        className="h-full bg-teal-600 rounded-full"
                      />
                    </div>

                    {/* Interactive Slot Manager */}
                    <div className="pt-3 border-t border-slate-100 space-y-2.5">
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        {language === 'ta' ? 'நேர அட்டவணை சேர்க்க' : 'Manage Open Appointment Slots'}
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="date"
                          value={newSlotDate}
                          onChange={(e) => setNewSlotDate(e.target.value)}
                          className="min-h-[38px] px-3 rounded-xl border border-slate-200 text-xs font-mono-num"
                        />
                        <input
                          type="time"
                          value={newSlotTime}
                          onChange={(e) => setNewSlotTime(e.target.value)}
                          className="min-h-[38px] px-3 rounded-xl border border-slate-200 text-xs font-mono-num"
                        />
                        <SpringButton size="sm" variant="outline" onClick={handleAddSlot}>
                          <Plus className="w-3.5 h-3.5" />
                          {language === 'ta' ? 'நேரம் சேர்' : 'Add Slot'}
                        </SpringButton>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {appointments.length === 0 ? (
                      <div className="rounded-3xl bg-white border border-slate-200 p-8 text-center text-sm text-slate-500">
                        {language === 'ta'
                          ? 'இன்னும் சந்திப்புகள் பதிவு செய்யப்படவில்லை.'
                          : 'No scheduled patient appointments yet.'}
                      </div>
                    ) : (
                      appointments.map((apt, idx) => (
                        <motion.div
                          key={apt.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="rounded-3xl bg-white border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-display text-base font-bold text-slate-900">
                                {apt.patientName}
                              </p>
                              <span className="text-xs font-semibold text-teal-700 capitalize">
                                · {apt.status}
                              </span>
                            </div>
                            <p className="text-xs font-mono-num text-slate-600">
                              {apt.date} · {apt.time} · ₹{apt.consultationFee} ({apt.paymentStatus})
                            </p>
                            <p className="text-xs text-slate-600">{apt.reason}</p>
                          </div>

                          <div className="flex flex-wrap gap-2 shrink-0">
                            {apt.status === 'pending' && (
                              <SpringButton
                                size="sm"
                                onClick={() => handleAppointmentAction(apt.id, 'confirm')}
                              >
                                {t.acceptVisit}
                              </SpringButton>
                            )}
                            {(apt.status === 'confirmed' || apt.status === 'rescheduled') && (
                              <SpringButton
                                size="sm"
                                onClick={() => handleAppointmentAction(apt.id, 'complete')}
                              >
                                {t.completeVisit}
                              </SpringButton>
                            )}
                            {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                              <SpringButton
                                size="sm"
                                variant="outline"
                                onClick={() => handleAppointmentAction(apt.id, 'cancel')}
                              >
                                {t.cancelVisit}
                              </SpringButton>
                            )}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 rounded-3xl bg-white border border-slate-200 p-6 space-y-4 h-fit">
                  <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    {language === 'ta'
                      ? 'நோயாளி சம்மதத்துடன் பகிரப்பட்ட ஆவணங்கள்'
                      : 'Consented Patient Records'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ta'
                      ? 'நோயாளிகள் வெளிப்படையாகப் பகிர சம்மதித்த ஆவணங்கள் மட்டுமே இங்கு தோன்றும்.'
                      : 'Only records explicitly shared by patients during booking or referral appear here.'}
                  </p>
                  {sharedRecords.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      {language === 'ta' ? 'பகிரப்பட்ட ஆவணங்கள் இல்லை.' : 'No consented records shared yet.'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {sharedRecords.map((rec) => (
                        <div key={rec.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-teal-600" />
                            {rec.title}
                          </p>
                          <p className="text-xs text-slate-600 mt-1">{rec.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {tab === 'peers' && myProfile && (
              <motion.div
                key="doc-peers"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                <div className="lg:col-span-5 space-y-5">
                  <div className="rounded-3xl bg-white border border-slate-200 p-5 space-y-3">
                    <h2 className="font-display text-base font-bold text-slate-900">
                      {language === 'ta' ? 'சக மருத்துவர்கள்' : 'Verified Colleagues'}
                    </h2>
                    <div className="space-y-2.5">
                      {doctors
                        .filter((d) => d.id !== myProfile.id)
                        .map((colleague) => {
                          const connected = myProfile.peerIds.includes(colleague.id);
                          const isBusy = peerBusyId === colleague.id;
                          return (
                            <div
                              key={colleague.id}
                              className="p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={colleague.photoUrl}
                                  alt={colleague.name}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-xl object-cover bg-slate-100 shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                                    {colleague.name}
                                    {colleague.verificationStatus === 'verified' && (
                                      <BadgeCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                    )}
                                  </p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {colleague.specialties[0]} · {colleague.city}
                                    {colleague.seniorMentorEligible ? ' · Senior Mentor' : ''}
                                  </p>
                                </div>
                              </div>
                              <SpringButton
                                size="sm"
                                variant={connected ? 'outline' : 'primary'}
                                disabled={isBusy}
                                title={connected ? 'Disable / disconnect peer' : 'Enable / connect peer'}
                                className={
                                  connected
                                    ? 'border-teal-300 bg-teal-50/70 text-teal-800 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700'
                                    : ''
                                }
                                onClick={async () => {
                                  if (isBusy) return;
                                  setPeerBusyId(colleague.id);
                                  try {
                                    const res = await api.connectPeer(
                                      token,
                                      colleague.id,
                                      connected ? 'disconnect' : 'connect'
                                    );
                                    setDoctors((prev) =>
                                      prev.map((d) => {
                                        if (d.id === res.doctor.id) return res.doctor;
                                        if (res.targetDoctor && d.id === res.targetDoctor.id) {
                                          return res.targetDoctor;
                                        }
                                        return d;
                                      })
                                    );
                                    showToast(
                                      res.connected
                                        ? `Connected with ${colleague.name}`
                                        : `Disconnected from ${colleague.name}`
                                    );
                                  } catch (err) {
                                    showToast(
                                      err instanceof Error ? err.message : 'Peer update failed.',
                                      true
                                    );
                                  } finally {
                                    setPeerBusyId(null);
                                  }
                                }}
                              >
                                {connected ? (
                                  <>
                                    <UserMinus className="w-3.5 h-3.5" />
                                    <span>{language === 'ta' ? 'துண்டி' : 'Disconnect'}</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>{language === 'ta' ? 'இணை' : 'Connect'}</span>
                                  </>
                                )}
                              </SpringButton>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <form
                    onSubmit={handleCreateReferral}
                    className="rounded-3xl bg-white border border-slate-200 p-5 space-y-3"
                  >
                    <h3 className="font-display text-base font-bold text-slate-900">{t.referPatient}</h3>
                    <p className="text-xs text-slate-500">
                      {language === 'ta'
                        ? 'நோயாளி ஒப்புதல் அளித்த பின்னரே மருத்துவ விவரம் பகிரப்படும்.'
                        : 'Patient records stay private until the patient explicitly consents to the referral.'}
                    </p>
                    <select
                      required
                      value={refPatientId}
                      onChange={(e) => setRefPatientId(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-xs"
                    >
                      <option value="">Select Patient</option>
                      {uniquePatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      required
                      value={refToDoctorId}
                      onChange={(e) => setRefToDoctorId(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-xs"
                    >
                      <option value="">Select Specialist Colleague</option>
                      {doctors
                        .filter((d) => d.id !== myProfile.id)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.specialties[0]})
                          </option>
                        ))}
                    </select>
                    <textarea
                      required
                      rows={2}
                      value={refReason}
                      onChange={(e) => setRefReason(e.target.value)}
                      placeholder="Clinical reason for referral..."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      value={refSupNote}
                      onChange={(e) => setRefSupNote(e.target.value)}
                      placeholder="Optional supervision / co-management note"
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs"
                    />
                    <SpringButton type="submit" size="sm" className="w-full">
                      {t.referPatient}
                    </SpringButton>

                    {referrals.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        {referrals.map((r) => (
                          <div key={r.id} className="text-xs text-slate-600 p-2.5 rounded-xl bg-slate-50">
                            <p className="font-semibold text-slate-900">
                              {r.patientName} → {r.toDoctorName}
                            </p>
                            <p className="text-[11px] text-teal-700 mt-0.5">
                              Consent: {r.patientConsentStatus}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </form>

                  <form
                    onSubmit={handleEstablishSupervision}
                    className="rounded-3xl bg-white border border-slate-200 p-5 space-y-3"
                  >
                    <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-teal-600" />
                      {t.requestSupervision}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {myProfile.seniorMentorEligible
                        ? 'As a verified senior specialist, you can supervise junior colleagues transparently.'
                        : 'Connect with an eligible verified senior specialist for clinical supervision.'}
                    </p>
                    <select
                      required
                      value={supTargetDocId}
                      onChange={(e) => setSupTargetDocId(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-xs"
                    >
                      <option value="">
                        {myProfile.seniorMentorEligible
                          ? 'Select Colleague to Supervise'
                          : 'Select Verified Senior Mentor'}
                      </option>
                      {doctors
                        .filter((d) =>
                          myProfile.seniorMentorEligible
                            ? d.id !== myProfile.id
                            : d.id !== myProfile.id && d.seniorMentorEligible && d.verificationStatus === 'verified'
                        )
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.yearsExperience} yrs · {d.specialties[0]})
                          </option>
                        ))}
                    </select>
                    <input
                      required
                      value={supScope}
                      onChange={(e) => setSupScope(e.target.value)}
                      placeholder="Supervision scope (e.g. Cardiac Risk Co-Review)"
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs"
                    />
                    <SpringButton type="submit" size="sm" variant="outline" className="w-full">
                      {myProfile.seniorMentorEligible ? 'Register Supervision' : 'Request Mentorship'}
                    </SpringButton>
                    {supervisions.map((s) => (
                      <div key={s.id} className="p-2.5 rounded-xl bg-teal-50/70 text-xs text-slate-700">
                        <p className="font-semibold">
                          {s.supervisorDoctorName} supervising {s.menteeDoctorName}
                        </p>
                        <p className="text-[11px] text-slate-500">{s.scope}</p>
                      </div>
                    ))}
                  </form>
                </div>

                <div className="lg:col-span-7 space-y-5">
                  <form
                    onSubmit={handleCreateDiscussion}
                    className="rounded-3xl bg-white border border-slate-200 p-6 space-y-3 shadow-sm"
                  >
                    <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-teal-600" />
                      {language === 'ta'
                        ? 'சக மருத்துவர் ஆலோசனைக் களம்'
                        : 'Peer Clinical Consultation Forum'}
                    </h2>
                    <input
                      required
                      value={discTitle}
                      onChange={(e) => setDiscTitle(e.target.value)}
                      placeholder="Topic title (anonymized)"
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 text-sm"
                    />
                    <textarea
                      required
                      rows={3}
                      value={discQuestion}
                      onChange={(e) => setDiscQuestion(e.target.value)}
                      placeholder="Ask colleagues for input (remove all patient identifiers)..."
                      className="w-full p-3.5 rounded-xl border border-slate-200 text-sm"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={discAnon}
                          onChange={(e) => setDiscAnon(e.target.checked)}
                          className="w-4 h-4 accent-teal-600"
                        />
                        <span>De-identified case confirmed</span>
                      </label>
                      <SpringButton type="submit" size="sm">
                        Post to Peers
                      </SpringButton>
                    </div>
                  </form>

                  <div className="space-y-4">
                    {discussions.map((disc) => (
                      <div key={disc.id} className="rounded-3xl bg-white border border-slate-200 p-5 space-y-3">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-semibold text-slate-800">{disc.authorDoctorName}</span>
                            {disc.authorVerified && <BadgeCheck className="w-3.5 h-3.5 text-teal-600" />}
                            <span>· {disc.specialty}</span>
                          </div>
                          <h3 className="font-display text-base font-bold text-slate-900 mt-1">
                            {disc.title}
                          </h3>
                          <p className="text-sm text-slate-700 mt-1 leading-relaxed">{disc.question}</p>
                        </div>

                        {disc.replies.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            {disc.replies.map((rep) => (
                              <div key={rep.id} className="p-3 rounded-2xl bg-slate-50 text-xs">
                                <p className="font-bold text-slate-900 flex items-center gap-1">
                                  {rep.doctorName}
                                  {rep.doctorVerified && <BadgeCheck className="w-3.5 h-3.5 text-teal-600" />}
                                </p>
                                <p className="text-slate-700 mt-1">{rep.message}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <input
                            value={replyMap[disc.id] || ''}
                            onChange={(e) =>
                              setReplyMap((prev) => ({ ...prev, [disc.id]: e.target.value }))
                            }
                            placeholder="Share colleague perspective..."
                            className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs"
                          />
                          <SpringButton
                            size="sm"
                            variant="outline"
                            onClick={() => handleReplyDiscussion(disc.id)}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </SpringButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-3 h-16">
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
              <span className="text-[10px] tracking-tight truncate max-w-[90px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
