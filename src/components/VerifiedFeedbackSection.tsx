import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, MessageSquareHeart, ShieldCheck, Star } from 'lucide-react';
import { api } from '../api';
import {
  FEEDBACK_HIGHLIGHT_OPTIONS,
  getHighlightLabel,
  type FeedbackHighlightKey,
} from '../lib/feedback';
import type {
  Appointment,
  DoctorProfile,
  DoctorRatingSummary,
  DoctorReview,
  Language,
} from '../types';
import { SpringButton } from './MotionPrimitives';

interface VerifiedFeedbackSectionProps {
  doctor: DoctorProfile;
  language: Language;
  token?: string;
  isPatient?: boolean;
  patientAppointments?: Appointment[];
  initialAppointmentId?: string;
  autoOpenForm?: boolean;
  onDoctorUpdated?: (updatedDoctor: DoctorProfile) => void;
}

function StarSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= value;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              aria-label={`${label}: ${star} / 5`}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                active
                  ? 'text-amber-500 bg-amber-50 border border-amber-200'
                  : 'text-slate-300 bg-white border border-slate-200 hover:text-amber-400'
              }`}
            >
              <Star className="w-4 h-4" fill={active ? 'currentColor' : 'none'} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VerifiedFeedbackSection({
  doctor,
  language,
  token,
  isPatient = false,
  patientAppointments = [],
  initialAppointmentId,
  autoOpenForm = false,
  onDoctorUpdated,
}: VerifiedFeedbackSectionProps) {
  const isTa = language === 'ta';
  const [reviews, setReviews] = useState<DoctorReview[]>(doctor.reviews || []);
  const [summary, setSummary] = useState<DoctorRatingSummary>(
    doctor.ratingSummary || {
      totalReviews: 0,
      averageOverall: 0,
      averageCommunication: 0,
      averageEmpathy: 0,
      averageWaitTime: 0,
    }
  );

  // Sync if doctor prop updates from parent
  useEffect(() => {
    setReviews(doctor.reviews || []);
    if (doctor.ratingSummary) {
      setSummary(doctor.ratingSummary);
    }
  }, [doctor.id, doctor.reviews, doctor.ratingSummary]);

  // Fetch fresh reviews when section opens
  useEffect(() => {
    let active = true;
    api
      .getDoctorReviews(doctor.id)
      .then((res) => {
        if (!active) return;
        setReviews(res.reviews);
        setSummary(res.summary);
      })
      .catch(() => {
        // Keep existing props gracefully
      });
    return () => {
      active = false;
    };
  }, [doctor.id]);

  const eligibleAppointments = useMemo(
    () =>
      patientAppointments.filter(
        (a) => a.doctorId === doctor.id && a.status !== 'cancelled'
      ),
    [patientAppointments, doctor.id]
  );

  const [formOpen, setFormOpen] = useState(autoOpenForm && eligibleAppointments.length > 0);
  const [selectedAptId, setSelectedAptId] = useState<string>(
    initialAppointmentId || eligibleAppointments[0]?.id || ''
  );

  useEffect(() => {
    if (initialAppointmentId && eligibleAppointments.some((a) => a.id === initialAppointmentId)) {
      setSelectedAptId(initialAppointmentId);
      setFormOpen(true);
    } else if (!selectedAptId && eligibleAppointments[0]) {
      setSelectedAptId(eligibleAppointments[0].id);
    }
  }, [initialAppointmentId, eligibleAppointments, selectedAptId]);

  const existingReviewForSelected = useMemo(
    () => reviews.find((r) => r.appointmentId === selectedAptId),
    [reviews, selectedAptId]
  );

  const [overallRating, setOverallRating] = useState<number>(5);
  const [communicationRating, setCommunicationRating] = useState<number>(5);
  const [empathyRating, setEmpathyRating] = useState<number>(5);
  const [waitTimeRating, setWaitTimeRating] = useState<number>(5);
  const [highlights, setHighlights] = useState<FeedbackHighlightKey[]>(['clear_explanation']);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (existingReviewForSelected) {
      setOverallRating(existingReviewForSelected.overallRating);
      setCommunicationRating(existingReviewForSelected.communicationRating);
      setEmpathyRating(existingReviewForSelected.empathyRating);
      setWaitTimeRating(existingReviewForSelected.waitTimeRating);
      setHighlights(
        existingReviewForSelected.highlights.filter((h): h is FeedbackHighlightKey =>
          FEEDBACK_HIGHLIGHT_OPTIONS.some((o) => o.key === h)
        )
      );
      setComment(existingReviewForSelected.comment);
    }
  }, [existingReviewForSelected]);

  const toggleHighlight = (key: FeedbackHighlightKey) => {
    setHighlights((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedAptId) return;
    setError(null);
    setSubmittedNotice(null);

    if (!comment.trim() && highlights.length === 0) {
      setError(
        isTa
          ? 'குறைந்தது ஒரு சிறப்பம்சத்தைத் தேர்ந்தெடுக்கவும் அல்லது கருத்து எழுதவும்.'
          : 'Please select at least one structured highlight or add a written comment.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitDoctorReview(token, doctor.id, {
        appointmentId: selectedAptId,
        overallRating,
        communicationRating,
        empathyRating,
        waitTimeRating,
        highlights,
        comment: comment.trim(),
      });
      if (res.doctor) {
        setReviews(res.doctor.reviews || [res.review]);
        setSummary(res.summary);
        onDoctorUpdated?.(res.doctor);
      }
      setSubmittedNotice(
        isTa
          ? 'உங்கள் சரிபார்க்கப்பட்ட கருத்து மருத்துவர் சுயவிவரத்தில் சேர்க்கப்பட்டது.'
          : 'Your verified patient feedback is now live on this doctor’s public portfolio.'
      );
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const dimensionRows = [
    {
      label: isTa ? 'விளக்கத்தின் தெளிவு' : 'Clarity of Explanation',
      value: summary.averageCommunication,
    },
    {
      label: isTa ? 'கவனிப்பு & பரிவு' : 'Listening & Empathy',
      value: summary.averageEmpathy,
    },
    {
      label: isTa ? 'நேர மேலாண்மை & காத்திருப்பு' : 'Wait Time Accuracy',
      value: summary.averageWaitTime,
    },
  ];

  return (
    <div id="verified-feedback-section" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
            <MessageSquareHeart className="w-4 h-4 text-teal-600" />
            {isTa
              ? 'சரிபார்க்கப்பட்ட நோயாளி கருத்துகள் & மதிப்பீடுகள்'
              : 'Verified Patient Feedback & Structured Ratings'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isTa
              ? 'உண்மையான சந்திப்பு பதிவு செய்த நோயாளிகள் மட்டுமே மதிப்பீடு வழங்க முடியும்.'
              : 'Only patients with a verified booked or completed visit can submit feedback.'}
          </p>
        </div>

        {isPatient && eligibleAppointments.length > 0 && (
          <SpringButton
            size="sm"
            variant={formOpen ? 'outline' : 'primary'}
            onClick={() => setFormOpen((o) => !o)}
          >
            <Star className="w-3.5 h-3.5" />
            {formOpen
              ? isTa
                ? 'படிவத்தை மூடு'
                : 'Close Form'
              : existingReviewForSelected
              ? isTa
                ? 'கருத்தைத் திருத்து'
                : 'Edit Visit Feedback'
              : isTa
              ? 'கருத்து வழங்கு'
              : 'Leave Verified Feedback'}
          </SpringButton>
        )}
      </div>

      {submittedNotice && (
        <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 text-xs font-medium text-teal-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
          <span>{submittedNotice}</span>
        </div>
      )}

      {/* Structured Feedback Form for Verified Patients */}
      {isPatient && formOpen && eligibleAppointments.length > 0 && (
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="p-4 sm:p-5 rounded-2xl border border-teal-200 bg-teal-50/40 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              {isTa ? 'சரிபார்க்கப்பட்ட சந்திப்புக்கான கருத்து' : 'Verified Visit Feedback Form'}
            </p>
            {eligibleAppointments.length > 1 ? (
              <select
                value={selectedAptId}
                onChange={(e) => setSelectedAptId(e.target.value)}
                aria-label={isTa ? 'சந்திப்பைத் தேர்ந்தெடு' : 'Select appointment'}
                className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono-num"
              >
                {eligibleAppointments.map((apt) => (
                  <option key={apt.id} value={apt.id}>
                    {apt.date} · {apt.time} ({apt.status})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-mono-num text-teal-800 font-semibold">
                {eligibleAppointments[0].date} · {eligibleAppointments[0].time}
              </span>
            )}
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-800">
              {error}
            </div>
          )}

          <div className="divide-y divide-slate-200/70 bg-white rounded-xl border border-slate-200 px-3.5 py-1.5">
            <StarSelector
              label={isTa ? 'ஒட்டுமொத்த மதிப்பீடு' : 'Overall Experience'}
              value={overallRating}
              onChange={setOverallRating}
            />
            <StarSelector
              label={isTa ? 'விளக்கத்தின் தெளிவு' : 'Clarity of Explanation'}
              value={communicationRating}
              onChange={setCommunicationRating}
            />
            <StarSelector
              label={isTa ? 'கவனிப்பு & பரிவு' : 'Listening & Empathy'}
              value={empathyRating}
              onChange={setEmpathyRating}
            />
            <StarSelector
              label={isTa ? 'நேர மேலாண்மை & காத்திருப்பு' : 'Wait Time Accuracy'}
              value={waitTimeRating}
              onChange={setWaitTimeRating}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              {isTa ? 'சிறப்பம்சங்களைத் தேர்ந்தெடுக்கவும்:' : 'Structured consultation highlights:'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEEDBACK_HIGHLIGHT_OPTIONS.map((opt) => {
                const checked = highlights.includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      checked
                        ? 'bg-white border-teal-600 text-slate-900 font-semibold'
                        : 'bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleHighlight(opt.key)}
                      className="w-4 h-4 accent-teal-700"
                    />
                    <span>{isTa ? opt.ta : opt.en}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isTa ? 'உங்கள் அனுபவம் (விருப்பத்திற்குரியது)' : 'Share your experience (Optional)'}
            </label>
            <textarea
              rows={3}
              maxLength={600}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isTa
                  ? 'மருத்துவர் எவ்வாறு விளக்கினார், காத்திருப்பு நேரம் மற்றும் ஆலோசனை அனுபவத்தைப் பகிரவும்...'
                  : 'Describe how clearly the doctor explained things, wait time accuracy, and overall care...'
              }
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="flex justify-end gap-2">
            <SpringButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setFormOpen(false)}
            >
              {isTa ? 'ரத்து' : 'Cancel'}
            </SpringButton>
            <SpringButton type="submit" size="sm" disabled={submitting}>
              {submitting
                ? isTa
                  ? 'சேமிக்கிறது...'
                  : 'Submitting...'
                : existingReviewForSelected
                ? isTa
                  ? 'கருத்தைப் புதுப்பி'
                  : 'Update Feedback'
                : isTa
                ? 'சரிபார்க்கப்பட்ட கருத்தைச் சமர்ப்பி'
                : 'Publish Verified Feedback'}
            </SpringButton>
          </div>
        </motion.form>
      )}

      {/* Eligibility note if signed-in patient hasn't visited this doctor yet */}
      {isPatient && eligibleAppointments.length === 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
          {isTa
            ? 'இந்த மருத்துவரிடம் சந்திப்பு முன்பதிவு செய்த பிறகு நீங்கள் சரிபார்க்கப்பட்ட மதிப்பீடும் கருத்தும் வழங்கலாம்.'
            : 'Book or complete a consultation with this doctor to unlock verified feedback submission.'}
        </div>
      )}

      {/* Aggregate Structured Rating Summary */}
      {summary.totalReviews === 0 ? (
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-700">
            {isTa ? 'இன்னும் சரிபார்க்கப்பட்ட மதிப்பீடுகள் இல்லை' : 'No verified patient reviews yet'}
          </p>
          <p className="text-[11px] text-slate-500">
            {isTa
              ? 'First Cure போலியான மதிப்பீடுகளைக் காட்டாது. உண்மையான சந்திப்புகளுக்குப் பிறகே மதிப்பீடுகள் சேர்க்கப்படும்.'
              : 'First Cure never displays unverified or fabricated ratings. Reviews appear after real patient visits.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/70 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            <div className="sm:col-span-4 space-y-1 sm:border-r sm:border-slate-200 sm:pr-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono-num text-3xl font-bold text-slate-900">
                  {summary.averageOverall.toFixed(1)}
                </span>
                <span className="text-xs font-semibold text-slate-500">/ 5.0</span>
              </div>
              <div className="flex items-center gap-0.5 text-amber-500">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className="w-3.5 h-3.5"
                    fill={n <= Math.round(summary.averageOverall) ? 'currentColor' : 'none'}
                  />
                ))}
              </div>
              <p className="text-[11px] font-medium text-slate-600 font-mono-num">
                {summary.totalReviews}{' '}
                {isTa
                  ? 'சரிபார்க்கப்பட்ட நோயாளி மதிப்பீடுகள்'
                  : summary.totalReviews === 1
                  ? 'verified patient review'
                  : 'verified patient reviews'}
              </p>
            </div>

            <div className="sm:col-span-8 space-y-2.5">
              {dimensionRows.map((dim) => (
                <div key={dim.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{dim.label}</span>
                    <span className="font-mono-num font-bold text-slate-900">
                      {dim.value.toFixed(1)} / 5
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-600 to-sky-600 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (dim.value / 5) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Individual Verified Reviews List */}
          <div className="space-y-3">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {rev.patientDisplayName}
                    </span>
                    <span className="text-[11px] font-semibold text-teal-700 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isTa ? 'சரிபார்க்கப்பட்ட சந்திப்பு' : 'Verified Visit'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-mono-num font-bold text-slate-900">
                      <Star className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
                      {rev.overallRating.toFixed(1)}
                    </span>
                    <span className="text-slate-400 font-mono-num">· {rev.visitDate}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 font-mono-num">
                  {isTa ? 'விளக்கம்' : 'Clarity'} {rev.communicationRating}/5 ·{' '}
                  {isTa ? 'பரிவு' : 'Listening'} {rev.empathyRating}/5 ·{' '}
                  {isTa ? 'நேர மேலாண்மை' : 'Wait Accuracy'} {rev.waitTimeRating}/5
                </p>

                {rev.highlights.length > 0 && (
                  <p className="text-xs text-sky-900 font-medium">
                    {rev.highlights.map((k) => `✓ ${getHighlightLabel(k, language)}`).join(' · ')}
                  </p>
                )}

                {rev.comment && (
                  <p className="text-xs text-slate-700 leading-relaxed">{rev.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
