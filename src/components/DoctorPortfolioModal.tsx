import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Award,
  BadgeCheck,
  Calendar,
  Clock,
  CreditCard,
  FileCheck2,
  MapPin,
  Pause,
  Play,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import { api } from '../api';
import { getCopy } from '../i18n';
import type {
  Appointment,
  DoctorProfile,
  Language,
  PatientHealthRecord,
} from '../types';
import { ClinicGoogleMap } from './ClinicGoogleMap';
import { SpringButton, SuccessCelebration } from './MotionPrimitives';

interface DoctorPortfolioModalProps {
  doctor: DoctorProfile;
  language: Language;
  token: string;
  isPatient: boolean;
  records: PatientHealthRecord[];
  initialStep?: 'portfolio' | 'book';
  onClose: () => void;
  onBooked: (appointment: Appointment) => void;
}

export function DoctorPortfolioModal({
  doctor,
  language,
  token,
  isPatient,
  records,
  initialStep = 'portfolio',
  onClose,
  onBooked,
}: DoctorPortfolioModalProps) {
  const t = getCopy(language);
  const [view, setView] = useState<'portfolio' | 'book' | 'confirmed'>(initialStep);
  const [imgErr, setImgErr] = useState(false);

  // Intro video simulated player state
  const [playingIntro, setPlayingIntro] = useState(false);
  const [introProgress, setIntroProgress] = useState(0);

  // Booking state
  const [selectedDate, setSelectedDate] = useState(doctor.availableSlots[0]?.date || '');
  const slotsForDate =
    doctor.availableSlots.find((s) => s.date === selectedDate)?.times || [];
  const [selectedTime, setSelectedTime] = useState(slotsForDate[0] || '');
  const [reason, setReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI (GPay / PhonePe)' | 'Debit / Credit Card' | 'NetBanking'>('UPI (GPay / PhonePe)');
  const [consentShare, setConsentShare] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedApt, setConfirmedApt] = useState<Appointment | null>(null);

  useEffect(() => {
    if (!playingIntro) return;
    const timer = setInterval(() => {
      setIntroProgress((p) => {
        if (p >= 100) {
          setPlayingIntro(false);
          return 0;
        }
        return p + 2;
      });
    }, 300);
    return () => clearInterval(timer);
  }, [playingIntro]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    const nextTimes = doctor.availableSlots.find((s) => s.date === date)?.times || [];
    setSelectedTime(nextTimes[0] || '');
  };

  const toggleRecord = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedDate || !selectedTime || !reason.trim()) {
      setError(
        language === 'ta'
          ? 'தேதி, நேரம் மற்றும் சந்திப்புக்கான காரணத்தை உள்ளிடவும்.'
          : 'Please pick a date, time slot, and brief reason for your visit.'
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.bookAppointment(token, {
        doctorId: doctor.id,
        date: selectedDate,
        time: selectedTime,
        reason: reason.trim(),
        paymentMethod,
        patientConsentToShare: consentShare,
        sharedReportIds: consentShare ? selectedRecordIds : [],
      });
      setConfirmedApt(res.appointment);
      setView('confirmed');
      onBooked(res.appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = language === 'ta' ? doctor.nameTa : doctor.name;
  const displayHospital = language === 'ta' ? doctor.hospitalNameTa : doctor.hospitalName;
  const displayBio = language === 'ta' ? doctor.bioTa : doctor.bio;
  const displayCancelPolicy =
    language === 'ta' ? doctor.cancellationPolicyTa : doctor.cancellationPolicy;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-3xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Top sticky modal bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
              {!imgErr ? (
                <img
                  src={doctor.photoUrl}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setImgErr(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-teal-700 font-bold">
                  {displayName.slice(0, 2)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
                  {displayName}
                </h2>
                {doctor.verificationStatus === 'verified' && (
                  <BadgeCheck className="w-4 h-4 text-teal-600 shrink-0" />
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                {(language === 'ta' ? doctor.specialtiesTa : doctor.specialties).join(' · ')} ·{' '}
                {displayHospital}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence mode="wait">
            {view === 'portfolio' && (
              <motion.div
                key="portfolio"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-6"
              >
                {/* Key Metadata Strip (Zero-pill clean inline typography) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div>
                    <p className="text-xs text-slate-500">{t.consultationFee}</p>
                    <p className="font-mono-num text-lg font-bold text-slate-900 mt-0.5">
                      ₹{doctor.consultationFee}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{t.waitTime}</p>
                    <p className="font-mono-num text-lg font-bold text-slate-900 mt-0.5">
                      ~{doctor.expectedWaitMinutes} {t.mins}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">
                      {language === 'ta' ? 'அனுபவம்' : 'Experience'}
                    </p>
                    <p className="font-mono-num text-lg font-bold text-slate-900 mt-0.5">
                      {doctor.yearsExperience} {language === 'ta' ? 'ஆண்டுகள்' : 'yrs'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">
                      {language === 'ta' ? 'சரிபார்ப்பு நிலை' : 'Verification'}
                    </p>
                    <p
                      className={`text-sm font-semibold mt-1 flex items-center gap-1 ${
                        doctor.verificationStatus === 'verified' ? 'text-teal-700' : 'text-amber-700'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {doctor.verificationStatus === 'verified'
                        ? t.verifiedDoctor
                        : t.pendingVerification}
                    </p>
                  </div>
                </div>

                {/* About & Locations */}
                <div className="space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed">{displayBio}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-600" />
                      {doctor.address}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      {doctor.availableHours}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {language === 'ta' ? 'பேசப்படும் மொழிகள்: ' : 'Languages: '}
                    {doctor.languagesSpoken.join(' · ')} · Reg: {doctor.registrationNumber}
                  </p>
                  <ClinicGoogleMap
                    clinicName={displayHospital}
                    clinicAddress={doctor.address}
                    clinicCoordinates={doctor.coordinates}
                    language={language}
                    heightClass="h-44"
                  />
                </div>

                {/* Supervision / Mentorship Transparency */}
                {(doctor.supervisorDoctorName || doctor.menteeDoctorIds.length > 0) && (
                  <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50/50 text-xs text-slate-700 flex items-start gap-3">
                    <UserCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      {doctor.supervisorDoctorName && (
                        <p>
                          <strong>
                            {language === 'ta' ? 'மூத்த மருத்துவ வழிகாட்டல்: ' : 'Clinical Supervision: '}
                          </strong>
                          {doctor.supervisorDoctorName}
                        </p>
                      )}
                      {doctor.menteeDoctorIds.length > 0 && (
                        <p>
                          <strong>
                            {language === 'ta' ? 'பயிற்சி மருத்துவர் வழிகாட்டி: ' : 'Verified Senior Mentor: '}
                          </strong>
                          {language === 'ta'
                            ? `${doctor.menteeDoctorIds.length} இளநிலை மருத்துவர்களுக்கு வழிகாட்டுகிறார்`
                            : `Supervising ${doctor.menteeDoctorIds.length} colleague(s) on First Cure`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Audited Patient Volume (Strictly sourced, no unsupported claims) */}
                {doctor.auditedPatientVolume && (
                  <div className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        {language === 'ta' ? 'தணிக்கை செய்யப்பட்ட நோயாளி எண்ணிக்கை' : 'Audited Outpatient Volume'}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">
                        <span className="font-mono-num">{doctor.auditedPatientVolume.count.toLocaleString()}</span>{' '}
                        {language === 'ta' ? 'ஆலோசனைகள்' : 'documented visits'} ·{' '}
                        {doctor.auditedPatientVolume.period}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 text-right">
                      {language === 'ta' ? 'ஆதாரம்: ' : 'Source: '}
                      {doctor.auditedPatientVolume.source}
                    </span>
                  </div>
                )}

                {/* Introductory Video / Interview */}
                {doctor.introVideo && (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs text-teal-300 flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5" />
                          {language === 'ta' ? 'மருத்துவர் அறிமுக உரை' : 'Doctor Introduction Interview'}
                        </p>
                        <p className="text-sm font-semibold truncate mt-0.5">
                          {language === 'ta' ? doctor.introVideo.titleTa : doctor.introVideo.title}
                        </p>
                      </div>
                      <SpringButton
                        size="sm"
                        variant="primary"
                        onClick={() => setPlayingIntro((p) => !p)}
                      >
                        {playingIntro ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {playingIntro
                          ? language === 'ta'
                            ? 'நிறுத்து'
                            : 'Pause'
                          : language === 'ta'
                          ? 'கேட்கவும்'
                          : 'Play Intro'}
                      </SpringButton>
                    </div>
                    <div className="p-4 bg-slate-50 space-y-2.5">
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-teal-600"
                          animate={{ width: `${introProgress}%` }}
                          transition={{ duration: 0.25 }}
                        />
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed italic">
                        “{language === 'ta' ? doctor.introVideo.transcriptTa : doctor.introVideo.transcript}”
                      </p>
                    </div>
                  </div>
                )}

                {/* Verified Credentials */}
                <div className="space-y-3">
                  <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-teal-600" />
                    {language === 'ta' ? 'கல்வித் தகுதி & சான்றிதழ்கள்' : 'Qualifications & Credentials'}
                  </h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl">
                    {doctor.credentials.map((cred) => (
                      <div key={cred.id} className="p-3.5 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {language === 'ta' ? cred.titleTa : cred.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {cred.issuer} · {cred.year} · {cred.registrationNo}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold shrink-0 ${
                            cred.status === 'verified' ? 'text-teal-700' : 'text-amber-700'
                          }`}
                        >
                          {cred.status === 'verified' ? t.verifiedDoctor : t.pendingVerification}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reviewed Case Studies */}
                <div className="space-y-3">
                  <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-teal-600" />
                    {language === 'ta'
                      ? 'மதிப்பாய்வு செய்யப்பட்ட மருத்துவ ஆய்வுகள் (பெயர் நீக்கப்பட்டது)'
                      : 'Peer-Reviewed Case Studies (Anonymized & Consented)'}
                  </h3>
                  {doctor.caseStudies.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      {language === 'ta'
                        ? 'இன்னும் மருத்துவ ஆய்வுகள் சேர்க்கப்படவில்லை.'
                        : 'No published case studies yet.'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {doctor.caseStudies.map((cs) => (
                        <div key={cs.id} className="p-4 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {language === 'ta' ? cs.titleTa : cs.title}
                            </p>
                            <span
                              className={`text-xs font-semibold shrink-0 ${
                                cs.status === 'verified' ? 'text-teal-700' : 'text-amber-700'
                              }`}
                            >
                              {cs.status === 'verified'
                                ? language === 'ta'
                                  ? 'சரிபார்க்கப்பட்டது'
                                  : 'Reviewed & Verified'
                                : t.pendingVerification}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {language === 'ta' ? cs.summaryTa : cs.summary}
                          </p>
                          <p className="text-xs text-slate-700">
                            <strong>{language === 'ta' ? 'சிகிச்சை அணுகுமுறை: ' : 'Approach: '}</strong>
                            {language === 'ta' ? cs.clinicalApproachTa : cs.clinicalApproach}
                          </p>
                          <p className="text-xs text-slate-500">
                            {language === 'ta' ? cs.outcomeSummaryTa : cs.outcomeSummary}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {view === 'book' && (
              <motion.form
                key="book"
                onSubmit={handleConfirmBooking}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                className="space-y-5"
              >
                {error && (
                  <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-xs text-orange-800">
                    {error}
                  </div>
                )}

                {/* Date Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-teal-600" />
                    {t.selectDate}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {doctor.availableSlots.map((slotGroup) => (
                      <button
                        key={slotGroup.date}
                        type="button"
                        onClick={() => handleDateChange(slotGroup.date)}
                        className={`min-h-[42px] px-4 rounded-xl text-xs font-semibold font-mono-num border transition-colors cursor-pointer ${
                          selectedDate === slotGroup.date
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-teal-500'
                        }`}
                      >
                        {slotGroup.date}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slot Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    <Clock className="w-3.5 h-3.5 inline mr-1.5 text-teal-600" />
                    {t.selectSlot}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {slotsForDate.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setSelectedTime(time)}
                        className={`min-h-[42px] px-4 rounded-xl text-xs font-semibold font-mono-num border transition-colors cursor-pointer ${
                          selectedTime === time
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-teal-500'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t.reasonForVisit} *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      language === 'ta'
                        ? 'உங்கள் அறிகுறிகள் அல்லது கேள்விகளைச் சுருக்கமாக எழுதுங்கள்...'
                        : 'Briefly describe what you would like to discuss during this consultation...'
                    }
                    className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>

                {/* Optional Consent-Gated Record Sharing */}
                {records.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentShare}
                        onChange={(e) => setConsentShare(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-teal-600"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        {language === 'ta'
                          ? 'இந்த மருத்துவருடன் எனது மருத்துவ அறிக்கைகளைப் பகிர சம்மதிக்கிறேன்'
                          : 'I consent to share selected health records with this doctor'}
                      </span>
                    </label>
                    {consentShare && (
                      <div className="pl-6 space-y-1.5">
                        {records.map((rec) => (
                          <label key={rec.id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedRecordIds.includes(rec.id)}
                              onChange={() => toggleRecord(rec.id)}
                              className="w-3.5 h-3.5 accent-teal-600"
                            />
                            <span>{rec.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Transparent Fee & Cancellation Charge Disclosure */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <p className="text-xs font-bold text-slate-900">{t.feeDisclosureTitle}</p>
                  <div className="flex justify-between text-xs text-slate-700">
                    <span>{t.consultationFee}</span>
                    <span className="font-mono-num font-semibold">₹{doctor.consultationFee}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-700">
                    <span>{t.platformFee}</span>
                    <span className="font-mono-num font-semibold">₹0</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-700 pt-1 border-t border-slate-200">
                    <span>{t.cancellationChargeLabel}</span>
                    <span className="font-mono-num font-semibold">
                      {doctor.cancellationFee === 0 ? '₹0 (Free)' : `₹${doctor.cancellationFee}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pt-1">{displayCancelPolicy}</p>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    <CreditCard className="w-3.5 h-3.5 inline mr-1.5 text-teal-600" />
                    {language === 'ta' ? 'கட்டணம் செலுத்தும் முறை' : 'Payment Method'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(['UPI (GPay / PhonePe)', 'Debit / Credit Card', 'NetBanking'] as const).map(
                      (method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`min-h-[42px] px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            paymentMethod === method
                              ? 'border-teal-600 bg-teal-50 text-teal-800'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          {method}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <SpringButton variant="outline" onClick={() => setView('portfolio')}>
                    {language === 'ta' ? 'பின்செல்க' : 'Back to Portfolio'}
                  </SpringButton>
                  <SpringButton type="submit" disabled={submitting}>
                    {submitting
                      ? language === 'ta'
                        ? 'கட்டணம் செயலாக்கம்...'
                        : 'Processing...'
                      : `${t.payAndConfirm} · ₹${doctor.consultationFee}`}
                  </SpringButton>
                </div>
              </motion.form>
            )}

            {view === 'confirmed' && confirmedApt && (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-4"
              >
                <SuccessCelebration
                  title={t.paymentSuccessTitle}
                  subtitle={`${displayName} · ${confirmedApt.date} at ${confirmedApt.time} · ${displayHospital}`}
                  reference={confirmedApt.paymentReference}
                />
                <div className="mt-4 flex justify-center">
                  <SpringButton onClick={onClose}>
                    {language === 'ta' ? 'சந்திப்புகளைப் பார்க்கவும்' : 'Done'}
                  </SpringButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky footer CTA when viewing portfolio */}
        {view === 'portfolio' && isPatient && (
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">{t.consultationFee}</p>
              <p className="font-mono-num text-base font-bold text-slate-900">
                ₹{doctor.consultationFee}
              </p>
            </div>
            <SpringButton size="lg" onClick={() => setView('book')}>
              <Stethoscope className="w-4 h-4" />
              {t.bookAppointment}
            </SpringButton>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
