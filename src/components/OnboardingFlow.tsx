import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Globe,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Type,
  UserRound,
} from 'lucide-react';
import { api } from '../api';
import { getCopy, LANGUAGE_OPTIONS } from '../i18n';
import { signInWithGooglePopup } from '../lib/firebase';
import type { Language, PublicUser, UserRole } from '../types';
import { AppFooter } from './AppFooter';
import {
  AnimatedCareIllustration,
  ParallaxTiltCard,
  SpringButton,
} from './MotionPrimitives';

interface OnboardingFlowProps {
  language: Language;
  onSelectLanguage: (lang: Language) => void;
  calmMotion: boolean;
  onToggleCalmMotion: () => void;
  largeText?: boolean;
  onToggleLargeText?: () => void;
  onAuthenticated: (token: string, user: PublicUser) => void;
}

export function OnboardingFlow({
  language,
  onSelectLanguage,
  calmMotion,
  onToggleCalmMotion,
  largeText = false,
  onToggleLargeText,
  onAuthenticated,
}: OnboardingFlowProps) {
  const t = getCopy(language);
  const [step, setStep] = useState<'language' | 'auth'>('language');
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [role, setRole] = useState<UserRole>('patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);

  // Registration fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | 'non_binary' | 'prefer_not_to_say'>('female');
  const [password, setPassword] = useState('');
  const [showEthnicity, setShowEthnicity] = useState(false);
  const [ethnicity, setEthnicity] = useState('');
  const [consentHealthData, setConsentHealthData] = useState(true);

  // Doctor extra fields
  const [specialty, setSpecialty] = useState('General Medicine');
  const [hospitalName, setHospitalName] = useState('');
  const [city, setCity] = useState('Chennai');
  const [area, setArea] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [consultationFee, setConsultationFee] = useState('500');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleLanguagePick = (lang: Language) => {
    onSelectLanguage(lang);
    setStep('auth');
  };

  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register({
        role,
        name,
        email,
        mobile,
        password,
        gender,
        preferredLanguage: language,
        ethnicity: showEthnicity && ethnicity.trim() ? ethnicity.trim() : undefined,
        consentHealthData,
        ...(role === 'doctor'
          ? {
              specialty,
              hospitalName,
              city,
              area,
              registrationNumber,
              consultationFee: Number(consultationFee) || 500,
            }
          : {}),
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({
        email: loginEmail,
        password: loginPassword,
        preferredLanguage: language,
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const googleUser = await signInWithGooglePopup();
      const res = await api.googleAuth(googleUser.idToken, {
        role,
        name: name.trim() || googleUser.displayName,
        email: googleUser.email,
        mobile: mobile.trim() || undefined,
        gender,
        preferredLanguage: language,
        ethnicity: showEthnicity && ethnicity.trim() ? ethnicity.trim() : undefined,
        consentHealthData,
        ...(role === 'doctor'
          ? {
              specialty,
              hospitalName,
              city,
              area,
              registrationNumber,
              consultationFee: Number(consultationFee) || 500,
            }
          : {}),
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'ta'
          ? 'Google உள்நுழைவு தோல்வியடைந்தது'
          : 'Google sign-in failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Clean 3-zone header */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <motion.div
            whileHover={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 0.45 }}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-700 to-sky-700 text-white flex items-center justify-center shadow-md shadow-teal-700/25"
          >
            <HeartPulse className="w-5 h-5" />
          </motion.div>
          <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
            {t.brand}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleLargeText && (
            <button
              type="button"
              onClick={onToggleLargeText}
              aria-pressed={largeText}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                largeText
                  ? 'border-sky-700 bg-sky-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-sky-600'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>{largeText ? t.standardTextLabel : t.largeTextLabel}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCalmMotion}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-teal-500 transition-colors cursor-pointer whitespace-nowrap"
          >
            {calmMotion ? t.expressiveMotion : t.calmMotion}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pb-12 pt-2 flex items-center">
        <AnimatePresence mode="wait">
          {step === 'language' ? (
            <motion.section
              key="step-language"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
            >
              {/* Left column: Multi-language selection & trust pillars */}
              <div className="lg:col-span-7 flex flex-col justify-center bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-teal-700 mb-3 flex-wrap">
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>English · தமிழ் · हिन्दी · తెలుగు · മലയാളം · ಕನ್ನಡ</span>
                </div>

                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-[1.12] tracking-tight">
                  {t.chooseLangTitle}
                </h1>
                <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                  {t.chooseLangSubtitle}
                </p>

                <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {LANGUAGE_OPTIONS.map((opt, idx) => {
                    const selected = language === opt.code;
                    return (
                      <motion.button
                        key={opt.code}
                        type="button"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 + idx * 0.04, type: 'spring', stiffness: 360, damping: 26 }}
                        whileHover={{ y: -2, scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleLanguagePick(opt.code)}
                        className={`group text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[104px] ${
                          selected
                            ? 'border-teal-600 bg-teal-600 text-white shadow-lg shadow-teal-600/25'
                            : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:border-teal-500 text-slate-900 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-display text-lg font-bold leading-tight">
                              {opt.nativeName}
                            </p>
                            <p
                              className={`text-[11px] font-medium mt-0.5 ${
                                selected ? 'text-teal-100' : 'text-slate-500'
                              }`}
                            >
                              {opt.englishName}
                            </p>
                          </div>
                          {selected ? (
                            <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                          ) : (
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                          )}
                        </div>
                        <p
                          className={`text-[11px] leading-snug mt-2 line-clamp-2 ${
                            selected ? 'text-teal-50' : 'text-slate-600'
                          }`}
                        >
                          {opt.subLabel}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-6">
                  <AnimatedCareIllustration calm={calmMotion} />
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
                  {[
                    {
                      icon: Sparkles,
                      text:
                        language === 'ta'
                          ? 'மருத்துவர் பரிந்துரைக்கான தெளிவான காரணங்கள்'
                          : 'Transparent reasons why each doctor matches you',
                    },
                    {
                      icon: ShieldCheck,
                      text:
                        language === 'ta'
                          ? 'உங்கள் சம்மதத்துடன் மட்டுமே ஆவணப் பகிர்வு'
                          : 'Consent-gated records & verified credentials',
                    },
                    {
                      icon: Stethoscope,
                      text:
                        language === 'ta'
                          ? 'நோயாளி & மருத்துவர் தனித்தனி அனுபவம்'
                          : 'Dedicated workflows for patients & doctors',
                    },
                  ].map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 + idx * 0.08 }}
                        className="flex items-start gap-2.5"
                      >
                        <Icon className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        <span>{item.text}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Right column: Clinic Visual Showcase */}
              <ParallaxTiltCard
                calm={calmMotion}
                className="lg:col-span-5 relative rounded-3xl overflow-hidden border border-slate-200 min-h-[280px] lg:min-h-[480px] bg-teal-900 shadow-lg"
              >
                {!heroImgError ? (
                  <motion.img
                    initial={{ scale: 1.06 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                    src="/src/assets/images/hero_care_clinic_1795533391892.jpg"
                    alt="First Cure sunlit healthcare reception"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-teal-700 to-slate-900 flex items-center justify-center p-8 text-white">
                    <HeartPulse className="w-16 h-16 opacity-60" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent flex flex-col justify-end p-6 sm:p-8 text-white">
                  <p className="text-xs font-medium text-teal-200">
                    {language === 'ta' ? 'First Cure · நம்பகமான பராமரிப்பு' : 'First Cure · Calm Clinical Navigation'}
                  </p>
                  <p className="font-display text-xl sm:text-2xl font-semibold mt-1 leading-snug">
                    {t.tagline}
                  </p>
                </div>
              </ParallaxTiltCard>
            </motion.section>
          ) : (
            <motion.section
              key="step-auth"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              {/* Left sidebar: Role selection & Quick Demo */}
              <div className="lg:col-span-5 space-y-4">
                <button
                  type="button"
                  onClick={() => setStep('language')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-700 cursor-pointer min-h-[36px]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {language === 'ta' ? 'மொழி மாற்றம்' : 'Change Language'}
                </button>

                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    {language === 'ta' ? 'உங்கள் பங்கைத் தேர்ந்தெடுக்கவும்' : 'Choose how you want to continue'}
                  </h2>

                  <div className="space-y-3">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setRole('patient')}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                        role === 'patient'
                          ? 'border-teal-600 bg-teal-50/60 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 font-display font-semibold text-slate-900">
                          <UserRound className="w-5 h-5 text-teal-600" />
                          {t.patientRole}
                        </span>
                        {role === 'patient' && <CheckCircle2 className="w-5 h-5 text-teal-600" />}
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{t.patientRoleDesc}</p>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setRole('doctor')}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                        role === 'doctor'
                          ? 'border-teal-600 bg-teal-50/60 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 font-display font-semibold text-slate-900">
                          <Stethoscope className="w-5 h-5 text-teal-600" />
                          {t.doctorRole}
                        </span>
                        {role === 'doctor' && <CheckCircle2 className="w-5 h-5 text-teal-600" />}
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{t.doctorRoleDesc}</p>
                    </motion.button>
                  </div>
                </div>

                {/* Consent & Verified Care Summary */}
                <div className="bg-gradient-to-br from-teal-900 to-sky-900 text-white rounded-3xl p-6 space-y-3 shadow-sm">
                  <p className="text-xs font-semibold text-sky-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-300" />
                    {language === 'ta'
                      ? 'பாதுகாப்பான & சம்மத அடிப்படையிலான தளம்'
                      : 'Private & Consent-Gated Care'}
                  </p>
                  <p className="text-xs text-teal-100 leading-relaxed">
                    {language === 'ta'
                      ? 'உங்கள் மருத்துவ ஆவணங்கள் நீங்கள் சம்மதிக்கும் மருத்துவர்களுக்கு மட்டுமே காட்டப்படும். அனைத்து மருத்துவர் தகுதிகளும் சரிபார்க்கப்பட்ட பின்பே சரிபார்ப்பு முத்திரை வழங்கப்படும்.'
                      : 'Your health records stay encrypted and private until you explicitly choose to share them during booking or referral. Credential badges are displayed strictly after verification.'}
                  </p>
                </div>
              </div>

              {/* Right column: Sign In / Create Account Form */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setError(null);
                    }}
                    className={`min-h-[38px] px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                      authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {t.createAccount}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setError(null);
                    }}
                    className={`min-h-[38px] px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                      authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {t.signIn}
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-orange-50 border border-orange-200 text-sm text-orange-800">
                    {error}
                  </div>
                )}

                <div className="mb-5">
                  <SpringButton
                    type="button"
                    variant="outline"
                    size="md"
                    disabled={loading}
                    onClick={handleGoogleSignIn}
                    className="w-full border-slate-300 text-slate-800 hover:border-teal-600"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>
                      {language === 'ta'
                        ? `Google மூலம் தொடரவும் (${role === 'patient' ? 'நோயாளி' : 'மருத்துவர்'})`
                        : `Continue with Google (${role === 'patient' ? 'Patient' : 'Doctor'})`}
                    </span>
                  </SpringButton>
                  <div className="flex items-center gap-3 mt-4 text-xs text-slate-400">
                    <span className="flex-1 h-px bg-slate-200" />
                    <span>{language === 'ta' ? 'அல்லது படிவத்தைப் பயன்படுத்தவும்' : 'or continue with email'}</span>
                    <span className="flex-1 h-px bg-slate-200" />
                  </div>
                </div>

                {authMode === 'register' ? (
                  <form onSubmit={handleSubmitRegister} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {t.fullName} *
                        </label>
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={role === 'doctor' ? 'Dr. Karthikeyan S.' : 'Priya Venkatesh'}
                          className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {t.mobile} *
                        </label>
                        <input
                          required
                          type="tel"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          placeholder="+91 98400 00000"
                          className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {t.email} *
                        </label>
                        <input
                          required
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {t.gender} *
                        </label>
                        <select
                          value={gender}
                          onChange={(e) =>
                            setGender(e.target.value as 'female' | 'male' | 'non_binary' | 'prefer_not_to_say')
                          }
                          className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-teal-600"
                        >
                          <option value="female">{t.genderFemale}</option>
                          <option value="male">{t.genderMale}</option>
                          <option value="non_binary">{t.genderNonBinary}</option>
                          <option value="prefer_not_to_say">{t.genderPreferNot}</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {t.password} *
                      </label>
                      <input
                        required
                        minLength={6}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                      />
                    </div>

                    {role === 'doctor' && (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                        <p className="text-xs font-semibold text-slate-800">
                          {language === 'ta' ? 'மருத்துவப் பணி விவரங்கள்' : 'Practice & Verification Details'}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            required
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            placeholder="Primary Specialty (e.g. Cardiology)"
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                          />
                          <input
                            required
                            value={registrationNumber}
                            onChange={(e) => setRegistrationNumber(e.target.value)}
                            placeholder="Medical Reg. No (e.g. TNMC-78231)"
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                          />
                          <input
                            required
                            value={hospitalName}
                            onChange={(e) => setHospitalName(e.target.value)}
                            placeholder="Hospital / Clinic Name"
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                          />
                          <input
                            required
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                            placeholder="Area & City (e.g. Adyar, Chennai)"
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                          />
                          <input
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="City"
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                          />
                          <input
                            type="number"
                            min={100}
                            value={consultationFee}
                            onChange={(e) => setConsultationFee(e.target.value)}
                            placeholder="Fee in ₹"
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Optional Ethnicity with explicit disclosure */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">{t.ethnicityLabel}</span>
                        <button
                          type="button"
                          onClick={() => setShowEthnicity((v) => !v)}
                          className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                        >
                          {showEthnicity ? t.ethnicitySkip : language === 'ta' ? 'விரும்பினால் உள்ளிடவும்' : 'Add optionally'}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{t.ethnicityExplain}</p>
                      {showEthnicity && (
                        <input
                          value={ethnicity}
                          onChange={(e) => setEthnicity(e.target.value)}
                          placeholder={language === 'ta' ? 'விருப்பம் இருந்தால் மட்டும்' : 'Optional self-description'}
                          className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 bg-white text-sm mt-1"
                        />
                      )}
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={consentHealthData}
                        onChange={(e) => setConsentHealthData(e.target.checked)}
                        className="mt-1 w-4 h-4 accent-teal-600 shrink-0"
                      />
                      <span className="text-xs text-slate-600 leading-relaxed">{t.consentLabel}</span>
                    </label>

                    <SpringButton type="submit" size="lg" disabled={loading} className="w-full">
                      {loading
                        ? language === 'ta'
                          ? 'செயலாக்கப்படுகிறது...'
                          : 'Creating Account...'
                        : `${t.createAccount} (${role === 'patient' ? (language === 'ta' ? 'நோயாளி' : 'Patient') : language === 'ta' ? 'மருத்துவர்' : 'Doctor'})`}
                    </SpringButton>
                  </form>
                ) : (
                  <form onSubmit={handleSubmitLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t.email}</label>
                      <input
                        required
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="ananya@firstcure.demo"
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t.password}</label>
                      <input
                        required
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
                      />
                    </div>
                    <SpringButton type="submit" size="lg" disabled={loading} className="w-full">
                      {loading ? (language === 'ta' ? 'உள்நுழைகிறது...' : 'Signing in...') : t.signIn}
                    </SpringButton>
                  </form>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
      <AppFooter language={language} />
    </div>
  );
}
