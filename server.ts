import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveServerMessage } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { getLanguageLabel, isSupportedLanguage, parseLanguage } from './src/i18n.ts';
import { hashPassword, verifyPassword } from './src/server/seedData.ts';
import type { StoredUser } from './src/server/seedData.ts';
import {
  computeRatingSummary,
  countActiveAppointmentsOnDate,
  createAccountWithOptionalDoctor,
  createAppointmentRecord,
  createHealthRecord,
  createPeerDiscussion,
  createReferralRecord,
  createSupervisionRecord,
  findAppointmentById,
  findDoctorById,
  findPeerDiscussionById,
  findReferralById,
  findUserByEmail,
  findUserById,
  findUserByUid,
  listAllDoctors,
  listAppointmentsForUser,
  listDoctorReviews,
  listPeerDiscussions,
  listRecordsForUser,
  listReferralsForUser,
  listSupervisions,
  shareRecordsWithDoctor,
  updateAppointmentRecord,
  updateDoctorById,
  updatePeerDiscussionReplies,
  updateReferralConsent,
  updateUserPreferences,
  upsertDoctorReview,
  upsertGoogleUser,
} from './src/db/repository.ts';
import {
  runAiDoctorMatch,
  runGeminiCareChat,
  runMapsGroundedCareSearch,
} from './src/server/aiService.ts';
import type {
  Appointment,
  AvailabilitySlot,
  CaseStudyItem,
  ChatMessage,
  CredentialItem,
  DoctorProfile,
  DoctorRatingSummary,
  DoctorReview,
  Language,
  PatientHealthRecord,
  PeerDiscussion,
  PublicUser,
  ReferralRequest,
  SupervisionRequest,
  UserRole,
} from './src/types.ts';

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface SessionPayload {
  userId: string;
  role: UserRole;
  exp: number;
}

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _h, passwordSalt: _s, ...pub } = user;
  return pub;
}

function signToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionPayload;
    if (!parsed.userId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function resolveUserFromToken(token: string): Promise<StoredUser | null> {
  const hmacPayload = verifyToken(token);
  if (hmacPayload) {
    return await findUserById(hmacPayload.userId);
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return await findUserByUid(decoded.uid);
  } catch {
    return null;
  }
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = authHeader.slice(7).trim();
  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      return;
    }
    req.authUser = user;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify session.';
    res.status(503).json({ error: message });
  }
}

function sanitizeString(value: unknown, maxLen = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function futureDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function buildNewDoctorProfile(params: {
  doctorId: string;
  userId: string;
  name: string;
  preferredLanguage: Language;
  specialty: string;
  hospitalName: string;
  city: string;
  area: string;
  registrationNumber: string;
  yearsExperience: number;
  consultationFee: number;
}): DoctorProfile {
  const displayName = params.name.startsWith('Dr.') ? params.name : `Dr. ${params.name}`;
  const displayNameTa = params.name.startsWith('Dr.') ? params.name : `டாக்டர் ${params.name}`;
  return {
    id: params.doctorId,
    userId: params.userId,
    name: displayName,
    nameTa: displayNameTa,
    photoUrl: '/src/assets/images/doctor_arjun_portrait_1795533391435.jpg',
    specialties: [params.specialty],
    specialtiesTa: [params.specialty],
    qualifications: ['MBBS'],
    registrationNumber: params.registrationNumber,
    yearsExperience: params.yearsExperience,
    hospitalName: params.hospitalName,
    hospitalNameTa: params.hospitalName,
    city: params.city,
    area: params.area,
    address: `${params.area}, ${params.city}`,
    coordinates: { lat: 13.0475, lng: 80.237 },
    serviceLocations: [`${params.area}, ${params.city}`],
    languagesSpoken: params.preferredLanguage === 'ta' ? ['Tamil', 'English'] : ['English', 'Tamil'],
    consultationFee: params.consultationFee,
    cancellationFee: 50,
    cancellationWindowHours: 3,
    cancellationPolicy: 'Free cancellation up to 3 hours before appointment. ₹50 fee thereafter.',
    cancellationPolicyTa: '3 மணி நேரத்திற்கு முன் இலவச ரத்து. அதற்குப் பின் ₹50 கட்டணம்.',
    expectedWaitMinutes: 15,
    dailyLimit: 12,
    availableHours: '09:30 AM – 01:00 PM, 05:00 PM – 08:00 PM',
    availableSlots: [
      { date: futureDate(0), times: ['16:30', '17:30'] },
      { date: futureDate(1), times: ['10:00', '11:00', '17:00', '18:00'] },
      { date: futureDate(2), times: ['10:00', '11:30', '17:30'] },
    ],
    verificationStatus: 'pending_review',
    bio: 'Registered physician building verified First Cure portfolio.',
    bioTa: 'First Cure தளத்தில் பதிவு செய்த மருத்துவர்.',
    credentials: [
      {
        id: `cred-${crypto.randomUUID().slice(0, 6)}`,
        title: `Medical Registration (${params.registrationNumber})`,
        titleTa: `மருத்துவப் பதிவு (${params.registrationNumber})`,
        issuer: 'State Medical Council',
        year: '2022',
        registrationNo: params.registrationNumber,
        status: 'pending_review',
      },
    ],
    caseStudies: [],
    seniorMentorEligible: false,
    menteeDoctorIds: [],
    peerIds: [],
  };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'first-cure' });
  });

  app.get('/api/maps/client-config', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({ apiKey });
  });

  // Firebase Google Sign-In synchronization
  app.post('/api/auth/google', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Firebase ID token required.' });
      return;
    }
    const idToken = authHeader.slice(7).trim();
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = (decoded.email || sanitizeString(req.body.email, 160)).toLowerCase();
      if (!email) {
        res.status(400).json({ error: 'Google account email is required.' });
        return;
      }

      const role: UserRole = req.body.role === 'doctor' ? 'doctor' : 'patient';
      const preferredLanguage: Language = parseLanguage(req.body.preferredLanguage);
      const name = sanitizeString(req.body.name || decoded.name, 120) || email.split('@')[0];
      const mobile = sanitizeString(req.body.mobile, 30) || '+91 98400 00000';
      const gender = ['female', 'male', 'non_binary', 'prefer_not_to_say'].includes(req.body.gender)
        ? (req.body.gender as PublicUser['gender'])
        : 'prefer_not_to_say';
      const ethnicity = sanitizeString(req.body.ethnicity, 80) || undefined;
      const consentHealthData = req.body.consentHealthData !== false;

      if (!consentHealthData) {
        res.status(400).json({ error: 'Explicit consent is required before using First Cure.' });
        return;
      }

      const existingUser = (await findUserByUid(decoded.uid)) || (await findUserByEmail(email));
      let newDoctor: DoctorProfile | undefined;
      if (!existingUser && role === 'doctor') {
        const userId = `user-${decoded.uid.slice(0, 10)}`;
        const doctorId = `doc-${crypto.randomUUID().slice(0, 8)}`;
        newDoctor = buildNewDoctorProfile({
          doctorId,
          userId,
          name,
          preferredLanguage,
          specialty: sanitizeString(req.body.specialty, 80) || 'General Medicine',
          hospitalName: sanitizeString(req.body.hospitalName, 120) || 'Community Care Clinic',
          city: sanitizeString(req.body.city, 80) || 'Chennai',
          area: sanitizeString(req.body.area, 80) || 'Central',
          registrationNumber:
            sanitizeString(req.body.registrationNumber, 40) ||
            `TNMC-${Math.floor(10000 + Math.random() * 89999)}`,
          yearsExperience: Number(req.body.yearsExperience) || 3,
          consultationFee: Number(req.body.consultationFee) || 500,
        });
      }

      const syncedUser = await upsertGoogleUser({
        uid: decoded.uid,
        email,
        name,
        role,
        mobile,
        gender,
        preferredLanguage,
        ethnicity,
        consentHealthData,
        doctor: newDoctor,
      });

      const sessionToken = signToken({
        userId: syncedUser.id,
        role: syncedUser.role,
        exp: Date.now() + 1000 * 60 * 60 * 12,
      });

      res.json({ token: sessionToken, user: toPublicUser(syncedUser) });
    } catch (error) {
      console.error('Google auth failed:', error);
      res.status(401).json({ error: 'Could not verify Google sign-in token.' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const role: UserRole = req.body.role === 'doctor' ? 'doctor' : 'patient';
      const name = sanitizeString(req.body.name, 120);
      const email = sanitizeString(req.body.email, 160).toLowerCase();
      const mobile = sanitizeString(req.body.mobile, 30);
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      const gender = ['female', 'male', 'non_binary', 'prefer_not_to_say'].includes(req.body.gender)
        ? (req.body.gender as PublicUser['gender'])
        : 'prefer_not_to_say';
      const preferredLanguage: Language = parseLanguage(req.body.preferredLanguage);
      const ethnicity = sanitizeString(req.body.ethnicity, 80) || undefined;
      const consentHealthData = Boolean(req.body.consentHealthData);

      if (!name || !email || !mobile || password.length < 6) {
        res.status(400).json({
          error: 'Name, email, mobile number, and a password (min 6 characters) are required.',
        });
        return;
      }
      if (!consentHealthData) {
        res.status(400).json({ error: 'Explicit consent is required before registering with First Cure.' });
        return;
      }

      const existing = await findUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
        return;
      }

      const { hash, salt } = hashPassword(password);
      const userId = `user-${crypto.randomUUID().slice(0, 8)}`;
      let doctorId: string | undefined;
      let newDoctor: DoctorProfile | undefined;

      if (role === 'doctor') {
        doctorId = `doc-${crypto.randomUUID().slice(0, 8)}`;
        newDoctor = buildNewDoctorProfile({
          doctorId,
          userId,
          name,
          preferredLanguage,
          specialty: sanitizeString(req.body.specialty, 80) || 'General Medicine',
          hospitalName: sanitizeString(req.body.hospitalName, 120) || 'Community Care Clinic',
          city: sanitizeString(req.body.city, 80) || 'Chennai',
          area: sanitizeString(req.body.area, 80) || 'Central',
          registrationNumber:
            sanitizeString(req.body.registrationNumber, 40) ||
            `TNMC-${Math.floor(10000 + Math.random() * 89999)}`,
          yearsExperience: Number(req.body.yearsExperience) || 3,
          consultationFee: Number(req.body.consultationFee) || 500,
        });
      }

      const newUser: StoredUser = {
        id: userId,
        role,
        name,
        email,
        mobile,
        gender,
        preferredLanguage,
        ethnicity,
        consentHealthData: true,
        consentTimestamp: new Date().toISOString(),
        doctorId,
        createdAt: new Date().toISOString(),
        passwordHash: hash,
        passwordSalt: salt,
      };

      const saved = await createAccountWithOptionalDoctor({
        user: newUser,
        uid: userId,
        doctor: newDoctor,
      });

      const token = signToken({
        userId: saved.id,
        role: saved.role,
        exp: Date.now() + 1000 * 60 * 60 * 12,
      });

      res.status(201).json({ token, user: toPublicUser(saved) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = sanitizeString(req.body.email, 160).toLowerCase();
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      let user = await findUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      if (isSupportedLanguage(req.body.preferredLanguage)) {
        user = await updateUserPreferences(user.id, { preferredLanguage: req.body.preferredLanguage });
      }

      const token = signToken({
        userId: user.id,
        role: user.role,
        exp: Date.now() + 1000 * 60 * 60 * 12,
      });

      res.json({ token, user: toPublicUser(user) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/auth/demo', async (req, res) => {
    try {
      const demoKey = sanitizeString(req.body.demoKey, 60);
      const targetIdMap: Record<string, string> = {
        patient: 'user-patient-1',
        doctor1: 'user-doc-1',
        doctor2: 'user-doc-2',
      };
      const userId = targetIdMap[demoKey];
      let user = userId ? await findUserById(userId) : null;
      if (!user) {
        res.status(404).json({ error: 'Demo profile not found.' });
        return;
      }
      if (isSupportedLanguage(req.body.preferredLanguage)) {
        user = await updateUserPreferences(user.id, { preferredLanguage: req.body.preferredLanguage });
      }
      const token = signToken({
        userId: user.id,
        role: user.role,
        exp: Date.now() + 1000 * 60 * 60 * 12,
      });
      res.json({ token, user: toPublicUser(user) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Demo login failed.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/me', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      let nextPhotoUrl: string | null | undefined = undefined;
      if (req.body.photoUrl === null || req.body.photoUrl === '') {
        nextPhotoUrl = null;
      } else if (typeof req.body.photoUrl === 'string') {
        const raw = req.body.photoUrl.trim();
        if (
          (raw.startsWith('data:image/') && raw.length <= 600_000) ||
          ((raw.startsWith('https://') || raw.startsWith('/src/assets/')) && raw.length <= 500)
        ) {
          nextPhotoUrl = raw;
        }
      }
      const updated = await updateUserPreferences(user.id, {
        preferredLanguage: isSupportedLanguage(req.body.preferredLanguage)
          ? req.body.preferredLanguage
          : undefined,
        consentHealthData:
          typeof req.body.consentHealthData === 'boolean' ? req.body.consentHealthData : undefined,
        photoUrl: nextPhotoUrl,
      });
      res.json({ user: toPublicUser(updated) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update preferences.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/doctors', async (req, res) => {
    try {
      let results = await listAllDoctors();
      const q = sanitizeString(req.query.q, 100).toLowerCase();
      const specialty = sanitizeString(req.query.specialty, 80).toLowerCase();
      const city = sanitizeString(req.query.city, 80).toLowerCase();
      const maxFee = Number(req.query.maxFee) || 0;

      if (q) {
        results = results.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.nameTa.toLowerCase().includes(q) ||
            d.hospitalName.toLowerCase().includes(q) ||
            d.city.toLowerCase().includes(q) ||
            d.area.toLowerCase().includes(q) ||
            d.specialties.some((s) => s.toLowerCase().includes(q)) ||
            d.specialtiesTa.some((s) => s.toLowerCase().includes(q))
        );
      }
      if (specialty && specialty !== 'all') {
        results = results.filter((d) =>
          d.specialties.some((s) => s.toLowerCase().includes(specialty))
        );
      }
      if (city && city !== 'all') {
        results = results.filter(
          (d) => d.city.toLowerCase().includes(city) || d.area.toLowerCase().includes(city)
        );
      }
      if (maxFee > 0) {
        results = results.filter((d) => d.consultationFee <= maxFee);
      }

      res.json({ doctors: results });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load doctors.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/doctors/:id/reviews', async (req, res) => {
    try {
      const doctorId = sanitizeString(req.params.id, 80);
      const doctor = await findDoctorById(doctorId);
      if (!doctor) {
        res.status(404).json({ error: 'Doctor not found.' });
        return;
      }
      const reviews = await listDoctorReviews(doctor.id);
      const summary: DoctorRatingSummary = computeRatingSummary(reviews);
      res.json({ reviews, summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load doctor reviews.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/doctors/:id/reviews', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'patient') {
        res.status(403).json({
          error: 'Only verified patient accounts can submit feedback for doctors.',
        });
        return;
      }

      const doctorId = sanitizeString(req.params.id, 80);
      const doctor = await findDoctorById(doctorId);
      if (!doctor) {
        res.status(404).json({ error: 'Doctor profile not found.' });
        return;
      }

      const requestedAptId = sanitizeString(req.body.appointmentId, 80);
      const userAppointments = await listAppointmentsForUser(user);
      const eligibleAppointments = userAppointments.filter(
        (a) => a.doctorId === doctor.id && a.status !== 'cancelled'
      );

      const verifiedAppointment = requestedAptId
        ? eligibleAppointments.find((a) => a.id === requestedAptId)
        : eligibleAppointments[0];

      if (!verifiedAppointment) {
        res.status(403).json({
          error:
            'Verified visit required: you can only leave feedback after booking or completing an appointment with this doctor.',
        });
        return;
      }

      const parseScore = (val: unknown): number | null => {
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1 || n > 5) return null;
        return n;
      };

      const overallRating = parseScore(req.body.overallRating);
      const communicationRating = parseScore(req.body.communicationRating);
      const empathyRating = parseScore(req.body.empathyRating);
      const waitTimeRating = parseScore(req.body.waitTimeRating);

      if (
        overallRating === null ||
        communicationRating === null ||
        empathyRating === null ||
        waitTimeRating === null
      ) {
        res.status(400).json({
          error:
            'Please provide ratings from 1 to 5 for overall experience, explanation clarity, listening, and wait time accuracy.',
        });
        return;
      }

      const allowedHighlights = new Set([
        'clear_explanation',
        'respectful_listening',
        'accurate_wait',
        'transparent_fees',
        'bilingual_care',
      ]);
      const rawHighlights = Array.isArray(req.body.highlights) ? req.body.highlights : [];
      const highlights: string[] = Array.from(
        new Set<string>(
          rawHighlights.filter(
            (h: unknown): h is string => typeof h === 'string' && allowedHighlights.has(h)
          )
        )
      ).slice(0, 5);

      const comment = sanitizeString(req.body.comment, 600);
      if (!comment && highlights.length === 0) {
        res.status(400).json({
          error: 'Please add a short written comment or select at least one structured highlight.',
        });
        return;
      }

      const nameParts = user.name.trim().split(/\s+/).filter(Boolean);
      const patientDisplayName =
        nameParts.length > 1
          ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0].toUpperCase()}.`
          : nameParts[0] || 'Verified Patient';

      const review: DoctorReview = await upsertDoctorReview({
        id: `rev-${crypto.randomUUID().slice(0, 8)}`,
        doctorId: doctor.id,
        patientId: user.id,
        appointmentId: verifiedAppointment.id,
        patientDisplayName,
        visitDate: verifiedAppointment.date,
        overallRating,
        communicationRating,
        empathyRating,
        waitTimeRating,
        highlights,
        comment,
        createdAt: new Date().toISOString(),
      });

      const updatedDoctor = await findDoctorById(doctor.id);
      res.status(201).json({
        review,
        doctor: updatedDoctor,
        summary: updatedDoctor?.ratingSummary || computeRatingSummary([review]),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit doctor feedback.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/match', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const doctorsList = await listAllDoctors();
      const concern = sanitizeString(req.body.concern, 1500);
      const budget = Number(req.body.budget);
      const location = sanitizeString(req.body.location, 160);
      const symptoms = sanitizeString(req.body.symptoms, 500);
      const preferredTravelArea = sanitizeString(req.body.preferredTravelArea, 160);
      const language: Language = parseLanguage(req.body.language, req.authUser!.preferredLanguage);
      const coordinates =
        req.body.coordinates &&
        typeof req.body.coordinates.lat === 'number' &&
        typeof req.body.coordinates.lng === 'number'
          ? { lat: req.body.coordinates.lat, lng: req.body.coordinates.lng }
          : undefined;

      if (!concern || !Number.isFinite(budget) || budget <= 0 || !location) {
        res.status(400).json({
          error:
            language === 'ta'
              ? 'உடல்நலக் கவலை, கட்டண வரம்பு மற்றும் தற்போதைய இடம் ஆகிய மூன்றும் கட்டாயம்.'
              : 'Health concern, consultation budget, and current location are required for personalized matching.',
        });
        return;
      }

      let attachment:
        | { mimeType: string; base64Data: string; fileName: string }
        | undefined;
      if (req.body.attachment && typeof req.body.attachment.base64Data === 'string') {
        const mimeType = sanitizeString(req.body.attachment.mimeType, 80);
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowedMimes.includes(mimeType)) {
          attachment = {
            mimeType,
            base64Data: req.body.attachment.base64Data.slice(0, 6_000_000),
            fileName: sanitizeString(req.body.attachment.fileName, 120) || 'medical-upload',
          };
        }
      }

      const result = await runAiDoctorMatch(
        {
          concern,
          budget,
          location,
          symptoms,
          preferredTravelArea,
          language,
          coordinates,
          attachment,
        },
        doctorsList
      );

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI Care Guide encountered an error.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/chat', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const doctorsList = await listAllDoctors();
      const message = sanitizeString(req.body.message, 1500);
      const language: Language = parseLanguage(req.body.language, req.authUser!.preferredLanguage);
      const speedMode = req.body.speedMode === 'fast' ? 'fast' : 'balanced';
      const rawHistory = Array.isArray(req.body.history) ? req.body.history : [];
      const history: ChatMessage[] = rawHistory
        .filter(
          (m: unknown): m is ChatMessage =>
            Boolean(m) &&
            typeof m === 'object' &&
            ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'model') &&
            typeof (m as ChatMessage).text === 'string'
        )
        .map((m: ChatMessage) => ({
          role: m.role,
          text: m.text.slice(0, 1500),
          timestamp: m.timestamp || '',
        }));

      if (!message) {
        res.status(400).json({ error: 'Message is required.' });
        return;
      }

      const result = await runGeminiCareChat({
        history,
        message,
        language,
        speedMode,
        doctors: doctorsList,
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Care chat failed.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/nearby-care', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const query = sanitizeString(req.body.query, 400);
      const location = sanitizeString(req.body.location, 160) || 'Chennai';
      const language: Language = parseLanguage(req.body.language, req.authUser!.preferredLanguage);
      const coordinates =
        req.body.coordinates &&
        typeof req.body.coordinates.lat === 'number' &&
        typeof req.body.coordinates.lng === 'number'
          ? { lat: req.body.coordinates.lat, lng: req.body.coordinates.lng }
          : undefined;

      if (!query) {
        res.status(400).json({ error: 'Search query is required.' });
        return;
      }

      const result = await runMapsGroundedCareSearch({
        query,
        location,
        language,
        coordinates,
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nearby Maps search failed.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/appointments', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const list = await listAppointmentsForUser(req.authUser!);
      res.json({ appointments: list });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load appointments.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/appointments', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'patient') {
        res.status(403).json({ error: 'Only patient accounts can book appointments.' });
        return;
      }

      const doctorId = sanitizeString(req.body.doctorId, 80);
      const date = sanitizeString(req.body.date, 20);
      const time = sanitizeString(req.body.time, 20);
      const reason = sanitizeString(req.body.reason, 600);
      const paymentMethod = sanitizeString(req.body.paymentMethod, 60) || 'UPI';
      const patientConsentToShare = Boolean(req.body.patientConsentToShare);
      const sharedReportIds = Array.isArray(req.body.sharedReportIds)
        ? req.body.sharedReportIds.filter((id: unknown): id is string => typeof id === 'string')
        : [];

      const doctor = await findDoctorById(doctorId);
      if (!doctor) {
        res.status(404).json({ error: 'Selected doctor not found.' });
        return;
      }
      if (!date || !time || !reason) {
        res.status(400).json({ error: 'Date, time slot, and visit reason are required.' });
        return;
      }

      const activeCountOnDate = await countActiveAppointmentsOnDate(doctor.id, date);
      if (activeCountOnDate >= doctor.dailyLimit) {
        res.status(409).json({
          error: 'This doctor has reached their daily appointment limit for the selected date.',
        });
        return;
      }

      const validRecordIds = patientConsentToShare
        ? await shareRecordsWithDoctor(user.id, doctor.id, sharedReportIds)
        : [];

      const newApt: Appointment = {
        id: `apt-${crypto.randomUUID().slice(0, 8)}`,
        patientId: user.id,
        patientName: user.name,
        doctorId: doctor.id,
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialties[0] || 'Consultation',
        hospitalName: doctor.hospitalName,
        clinicAddress: doctor.address,
        clinicCoordinates: doctor.coordinates,
        date,
        time,
        reason,
        consultationFee: doctor.consultationFee,
        cancellationFee: doctor.cancellationFee,
        cancellationPolicy: doctor.cancellationPolicy,
        paymentStatus: 'paid',
        paymentMethod,
        paymentReference: `FC-TXN-${Math.floor(100000 + Math.random() * 899999)}`,
        status: 'confirmed',
        expectedWaitMinutes: doctor.expectedWaitMinutes,
        sharedReportIds: validRecordIds,
        patientConsentToShare,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const created = await createAppointmentRecord(newApt);
      res.status(201).json({ appointment: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to book appointment.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/appointments/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      const aptId = sanitizeString(req.params.id, 80);
      const apt = await findAppointmentById(aptId);
      if (!apt) {
        res.status(404).json({ error: 'Appointment not found.' });
        return;
      }

      const isOwnerPatient = user.role === 'patient' && apt.patientId === user.id;
      const isAssignedDoctor = user.role === 'doctor' && apt.doctorId === user.doctorId;
      if (!isOwnerPatient && !isAssignedDoctor) {
        res.status(403).json({ error: 'You are not authorized to modify this appointment.' });
        return;
      }

      const action = sanitizeString(req.body.action, 40);
      const patch: Partial<Appointment> = { updatedAt: new Date().toISOString() };

      if (action === 'cancel') {
        patch.status = 'cancelled';
        patch.paymentStatus = apt.cancellationFee > 0 ? 'partial_refund' : 'refunded';
        patch.notes = sanitizeString(req.body.notes, 300) || apt.notes;
      } else if (action === 'reschedule') {
        const nextDate = sanitizeString(req.body.date, 20);
        const nextTime = sanitizeString(req.body.time, 20);
        if (!nextDate || !nextTime) {
          res.status(400).json({ error: 'New date and time are required to reschedule.' });
          return;
        }
        patch.date = nextDate;
        patch.time = nextTime;
        patch.status = 'rescheduled';
      } else if (action === 'confirm' && isAssignedDoctor) {
        patch.status = 'confirmed';
      } else if (action === 'complete' && isAssignedDoctor) {
        patch.status = 'completed';
        patch.notes = sanitizeString(req.body.notes, 400) || apt.notes;
      } else {
        res.status(400).json({ error: 'Unsupported appointment action for your role.' });
        return;
      }

      const updated = await updateAppointmentRecord(apt.id, patch);
      res.json({ appointment: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update appointment.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/records', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const records = await listRecordsForUser(req.authUser!);
      res.json({ records });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load health records.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/records', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'patient') {
        res.status(403).json({ error: 'Only patients can upload personal health records.' });
        return;
      }
      const title = sanitizeString(req.body.title, 140);
      const fileName = sanitizeString(req.body.fileName, 140);
      const mimeType = sanitizeString(req.body.mimeType, 80) || 'application/pdf';
      const summary = sanitizeString(req.body.summary, 600);
      const dataUrl =
        typeof req.body.dataUrl === 'string' && req.body.dataUrl.startsWith('data:')
          ? req.body.dataUrl.slice(0, 2_000_000)
          : undefined;
      if (!title || !fileName) {
        res.status(400).json({ error: 'Record title and file name are required.' });
        return;
      }
      const record: PatientHealthRecord = {
        id: `rec-${crypto.randomUUID().slice(0, 8)}`,
        patientId: user.id,
        title,
        fileName,
        mimeType,
        summary: summary || 'Uploaded securely by patient.',
        uploadedAt: new Date().toISOString(),
        sharedWithDoctorIds: [],
        dataUrl,
      };
      const created = await createHealthRecord(record);
      res.status(201).json({ record: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save health record.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/doctor/profile', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'doctor' || !user.doctorId) {
        res.status(403).json({ error: 'Doctor role required.' });
        return;
      }
      const doc = await findDoctorById(user.doctorId);
      if (!doc) {
        res.status(404).json({ error: 'Doctor profile not found.' });
        return;
      }

      const patch: Partial<DoctorProfile> = {};
      if (typeof req.body.hospitalName === 'string' && req.body.hospitalName.trim()) {
        patch.hospitalName = sanitizeString(req.body.hospitalName, 140);
      }
      if (typeof req.body.city === 'string' && req.body.city.trim()) {
        patch.city = sanitizeString(req.body.city, 80);
      }
      if (typeof req.body.area === 'string' && req.body.area.trim()) {
        patch.area = sanitizeString(req.body.area, 80);
      }
      if (typeof req.body.bio === 'string' && req.body.bio.trim()) {
        patch.bio = sanitizeString(req.body.bio, 600);
      }
      if (typeof req.body.bioTa === 'string' && req.body.bioTa.trim()) {
        patch.bioTa = sanitizeString(req.body.bioTa, 600);
      }
      if (typeof req.body.availableHours === 'string' && req.body.availableHours.trim()) {
        patch.availableHours = sanitizeString(req.body.availableHours, 160);
      }
      if (typeof req.body.photoUrl === 'string' && req.body.photoUrl.trim()) {
        const rawPhoto = req.body.photoUrl.trim();
        if (
          (rawPhoto.startsWith('data:image/') && rawPhoto.length <= 600_000) ||
          ((rawPhoto.startsWith('https://') || rawPhoto.startsWith('/src/assets/')) &&
            rawPhoto.length <= 500)
        ) {
          patch.photoUrl = rawPhoto;
        }
      }
      if (Number.isFinite(Number(req.body.consultationFee)) && Number(req.body.consultationFee) > 0) {
        patch.consultationFee = Math.round(Number(req.body.consultationFee));
      }
      if (Number.isFinite(Number(req.body.cancellationFee)) && Number(req.body.cancellationFee) >= 0) {
        const fee = Math.round(Number(req.body.cancellationFee));
        patch.cancellationFee = fee;
        patch.cancellationPolicy =
          fee === 0
            ? `Free cancellation up to ${doc.cancellationWindowHours} hours before appointment. No cancellation charge.`
            : `Free cancellation up to ${doc.cancellationWindowHours} hours before slot. ₹${fee} late-cancellation charge applies thereafter.`;
      }
      if (Number.isFinite(Number(req.body.dailyLimit)) && Number(req.body.dailyLimit) >= 1) {
        patch.dailyLimit = Math.min(40, Math.round(Number(req.body.dailyLimit)));
      }
      if (Array.isArray(req.body.availableSlots)) {
        const cleanedSlots: AvailabilitySlot[] = req.body.availableSlots
          .filter(
            (s: unknown): s is AvailabilitySlot =>
              Boolean(s) &&
              typeof s === 'object' &&
              typeof (s as AvailabilitySlot).date === 'string' &&
              Array.isArray((s as AvailabilitySlot).times)
          )
          .map((s: AvailabilitySlot) => ({
            date: sanitizeString(s.date, 20),
            times: s.times.filter((t): t is string => typeof t === 'string').slice(0, 12),
          }))
          .filter((s: AvailabilitySlot) => s.date && s.times.length > 0);
        if (cleanedSlots.length > 0) {
          patch.availableSlots = cleanedSlots;
        }
      }
      if (Array.isArray(req.body.specialties) && req.body.specialties.length > 0) {
        patch.specialties = req.body.specialties
          .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 5);
      }
      if (req.body.introVideo && typeof req.body.introVideo === 'object') {
        patch.introVideo = {
          title: sanitizeString(req.body.introVideo.title, 140) || 'Doctor Care Philosophy',
          titleTa: sanitizeString(req.body.introVideo.titleTa, 140) || 'மருத்துவ அணுகுமுறை',
          durationSec: Number(req.body.introVideo.durationSec) || 90,
          summary: sanitizeString(req.body.introVideo.summary, 300),
          summaryTa: sanitizeString(req.body.introVideo.summaryTa, 300),
          transcript: sanitizeString(req.body.introVideo.transcript, 600),
          transcriptTa: sanitizeString(req.body.introVideo.transcriptTa, 600),
          externalUrl: sanitizeString(req.body.introVideo.externalUrl, 300) || undefined,
        };
      }

      const updated = await updateDoctorById(doc.id, patch);
      res.json({ doctor: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update doctor profile.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/doctor/credentials', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'doctor' || !user.doctorId) {
        res.status(403).json({ error: 'Doctor role required.' });
        return;
      }
      const doc = await findDoctorById(user.doctorId);
      if (!doc) {
        res.status(404).json({ error: 'Doctor profile not found.' });
        return;
      }
      const title = sanitizeString(req.body.title, 140);
      const issuer = sanitizeString(req.body.issuer, 140);
      const year = sanitizeString(req.body.year, 10);
      const registrationNo = sanitizeString(req.body.registrationNo, 60);
      if (!title || !issuer || !registrationNo) {
        res.status(400).json({
          error: 'Credential title, issuer, and registration number are required.',
        });
        return;
      }
      const cred: CredentialItem = {
        id: `cred-${crypto.randomUUID().slice(0, 6)}`,
        title,
        titleTa: title,
        issuer,
        year: year || '2026',
        registrationNo,
        status: 'pending_review',
      };
      const updated = await updateDoctorById(doc.id, {
        credentials: [...doc.credentials, cred],
      });
      res.status(201).json({ credential: cred, doctor: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add credential.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/doctor/case-studies', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'doctor' || !user.doctorId) {
        res.status(403).json({ error: 'Doctor role required.' });
        return;
      }
      const doc = await findDoctorById(user.doctorId);
      if (!doc) {
        res.status(404).json({ error: 'Doctor profile not found.' });
        return;
      }

      const title = sanitizeString(req.body.title, 160);
      const summary = sanitizeString(req.body.summary, 600);
      const clinicalApproach = sanitizeString(req.body.clinicalApproach, 500);
      const outcomeSummary = sanitizeString(req.body.outcomeSummary, 400);
      const anonymizedConfirmed = Boolean(req.body.anonymizedConfirmed);
      const patientConsentObtained = Boolean(req.body.patientConsentObtained);

      if (!anonymizedConfirmed || !patientConsentObtained) {
        res.status(400).json({
          error:
            'Both patient-identifying information removal and patient consent confirmation are mandatory.',
        });
        return;
      }
      if (!title || !summary || !clinicalApproach) {
        res.status(400).json({ error: 'Title, clinical summary, and approach are required.' });
        return;
      }

      const item: CaseStudyItem = {
        id: `case-${crypto.randomUUID().slice(0, 6)}`,
        title,
        titleTa: title,
        specialty: doc.specialties[0] || 'Clinical Care',
        summary,
        summaryTa: summary,
        clinicalApproach,
        clinicalApproachTa: clinicalApproach,
        outcomeSummary: outcomeSummary || 'Documented clinical follow-up completed.',
        outcomeSummaryTa: outcomeSummary || 'மருத்துவத் தொடர் கண்காணிப்பு பதிவு செய்யப்பட்டது.',
        anonymizedConfirmed: true,
        patientConsentObtained: true,
        status: 'pending_review',
        publishedAt: new Date().toISOString().slice(0, 10),
      };
      const updated = await updateDoctorById(doc.id, {
        caseStudies: [item, ...doc.caseStudies],
      });
      res.status(201).json({ caseStudy: item, doctor: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit case study.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/peers/discussions', requireAuth, async (req: AuthedRequest, res) => {
    try {
      if (req.authUser!.role !== 'doctor') {
        res.status(403).json({ error: 'Peer network is restricted to registered doctors.' });
        return;
      }
      const discussions = await listPeerDiscussions();
      res.json({ discussions });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load peer discussions.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/peers/discussions', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'doctor' || !user.doctorId) {
        res.status(403).json({ error: 'Doctor role required.' });
        return;
      }
      const doc = await findDoctorById(user.doctorId);
      if (!doc) {
        res.status(404).json({ error: 'Doctor profile not found.' });
        return;
      }
      const title = sanitizeString(req.body.title, 160);
      const question = sanitizeString(req.body.question, 800);
      const anonymizedConfirmed = Boolean(req.body.anonymizedConfirmed);
      if (!title || !question || !anonymizedConfirmed) {
        res.status(400).json({
          error: 'Title, anonymized case question, and anonymization confirmation are required.',
        });
        return;
      }
      const disc: PeerDiscussion = {
        id: `peer-${crypto.randomUUID().slice(0, 6)}`,
        authorDoctorId: doc.id,
        authorDoctorName: doc.name,
        authorSpecialty: doc.specialties[0] || 'General',
        authorVerified: doc.verificationStatus === 'verified',
        title,
        specialty: doc.specialties[0] || 'General',
        question,
        anonymizedConfirmed: true,
        replies: [],
        createdAt: new Date().toISOString(),
      };
      const created = await createPeerDiscussion(disc);
      res.status(201).json({ discussion: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create discussion.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/peers/discussions/:id/reply', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'doctor' || !user.doctorId) {
        res.status(403).json({ error: 'Doctor role required.' });
        return;
      }
      const doc = await findDoctorById(user.doctorId);
      const discId = sanitizeString(req.params.id, 80);
      const disc = await findPeerDiscussionById(discId);
      if (!doc || !disc) {
        res.status(404).json({ error: 'Discussion or doctor not found.' });
        return;
      }
      const message = sanitizeString(req.body.message, 600);
      if (!message) {
        res.status(400).json({ error: 'Reply message is required.' });
        return;
      }
      const nextReplies = [
        ...disc.replies,
        {
          id: `rep-${crypto.randomUUID().slice(0, 6)}`,
          doctorId: doc.id,
          doctorName: doc.name,
          doctorVerified: doc.verificationStatus === 'verified',
          message,
          createdAt: new Date().toISOString(),
        },
      ];
      const updated = await updatePeerDiscussionReplies(disc.id, nextReplies);
      res.json({ discussion: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reply to discussion.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/peers/connect', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'doctor' || !user.doctorId) {
        res.status(403).json({ error: 'Doctor role required.' });
        return;
      }
      const doc = await findDoctorById(user.doctorId);
      const targetDoc = await findDoctorById(sanitizeString(req.body.targetDoctorId, 80));
      if (!doc || !targetDoc || doc.id === targetDoc.id) {
        res.status(404).json({ error: 'Peer doctor not found.' });
        return;
      }
      const currentlyConnected = doc.peerIds.includes(targetDoc.id);
      const requestedAction = req.body.action;
      const shouldConnect =
        requestedAction === 'connect'
          ? true
          : requestedAction === 'disconnect'
          ? false
          : !currentlyConnected;

      const docPeers = shouldConnect
        ? doc.peerIds.includes(targetDoc.id)
          ? doc.peerIds
          : [...doc.peerIds, targetDoc.id]
        : doc.peerIds.filter((id) => id !== targetDoc.id);

      const targetPeers = shouldConnect
        ? targetDoc.peerIds.includes(doc.id)
          ? targetDoc.peerIds
          : [...targetDoc.peerIds, doc.id]
        : targetDoc.peerIds.filter((id) => id !== doc.id);

      const updatedDoc = await updateDoctorById(doc.id, { peerIds: docPeers });
      const updatedTargetDoc = await updateDoctorById(targetDoc.id, { peerIds: targetPeers });
      res.json({ doctor: updatedDoc, targetDoctor: updatedTargetDoc, connected: shouldConnect });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update peer connection.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/referrals', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      const referralsList = await listReferralsForUser(user);
      if (user.role === 'patient') {
        res.json({ referrals: referralsList });
        return;
      }
      const supervisionsList = await listSupervisions();
      res.json({ referrals: referralsList, supervisions: supervisionsList });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load referrals.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/referrals', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'doctor' || !user.doctorId) {
        res.status(403).json({ error: 'Doctor role required.' });
        return;
      }
      const fromDoc = await findDoctorById(user.doctorId);
      const toDoc = await findDoctorById(sanitizeString(req.body.toDoctorId, 80));
      const patient = await findUserById(sanitizeString(req.body.patientId, 80));
      const clinicalReason = sanitizeString(req.body.clinicalReason, 500);
      const supervisionNote = sanitizeString(req.body.supervisionNote, 300);

      if (!fromDoc || !toDoc || !patient || patient.role !== 'patient' || !clinicalReason) {
        res.status(400).json({
          error: 'Receiving doctor, patient, and clinical reason are required.',
        });
        return;
      }

      const referral: ReferralRequest = {
        id: `ref-${crypto.randomUUID().slice(0, 6)}`,
        fromDoctorId: fromDoc.id,
        fromDoctorName: fromDoc.name,
        toDoctorId: toDoc.id,
        toDoctorName: toDoc.name,
        toSpecialty: toDoc.specialties[0] || 'Specialist',
        patientId: patient.id,
        patientName: patient.name,
        clinicalReason,
        supervisionNote: supervisionNote || undefined,
        patientConsentStatus: 'awaiting_patient',
        createdAt: new Date().toISOString(),
      };

      const created = await createReferralRecord(referral);
      res.status(201).json({ referral: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create referral.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/referrals/:id/consent', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      const refId = sanitizeString(req.params.id, 80);
      const referral = await findReferralById(refId);
      if (!referral || user.role !== 'patient' || referral.patientId !== user.id) {
        res.status(403).json({
          error: 'Only the patient named in the referral can update consent.',
        });
        return;
      }
      const decision = req.body.decision === 'consented' ? 'consented' : 'declined';
      const updated = await updateReferralConsent(referral.id, decision);

      if (decision === 'consented') {
        await shareRecordsWithDoctor(user.id, referral.toDoctorId);
      }
      res.json({ referral: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update referral consent.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/supervisions', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.authUser!;
      if (user.role !== 'doctor' || !user.doctorId) {
        res.status(403).json({ error: 'Doctor role required.' });
        return;
      }
      const supervisor = await findDoctorById(sanitizeString(req.body.supervisorDoctorId, 80));
      const mentee = await findDoctorById(sanitizeString(req.body.menteeDoctorId, 80));
      const scope = sanitizeString(req.body.scope, 240);

      if (!supervisor || !mentee || !scope) {
        res.status(400).json({
          error: 'Supervisor, mentee, and supervision scope are required.',
        });
        return;
      }
      if (!supervisor.seniorMentorEligible || supervisor.verificationStatus !== 'verified') {
        res.status(400).json({ error: 'Only verified senior doctors are eligible to supervise.' });
        return;
      }
      if (user.doctorId !== supervisor.id && user.doctorId !== mentee.id) {
        res.status(403).json({
          error: 'You can only establish supervision involving your own practice.',
        });
        return;
      }

      const sup: SupervisionRequest = {
        id: `sup-${crypto.randomUUID().slice(0, 6)}`,
        supervisorDoctorId: supervisor.id,
        supervisorDoctorName: supervisor.name,
        menteeDoctorId: mentee.id,
        menteeDoctorName: mentee.name,
        scope,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      await updateDoctorById(mentee.id, {
        supervisorDoctorId: supervisor.id,
        supervisorDoctorName: supervisor.name,
      });
      const nextMentees = supervisor.menteeDoctorIds.includes(mentee.id)
        ? supervisor.menteeDoctorIds
        : [...supervisor.menteeDoctorIds, mentee.id];
      await updateDoctorById(supervisor.id, { menteeDoctorIds: nextMentees });
      const created = await createSupervisionRecord(sup);
      res.status(201).json({ supervision: created });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create supervision.';
      res.status(500).json({ error: message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  // Create HTTP server & attach WebSocket bridge for Gemini 3.8 Live Voice API
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (clientWs, req) => {
    const urlObj = new URL(req.url || '/live', `http://${req.headers.host || 'localhost'}`);
    const token = urlObj.searchParams.get('token') || '';
    const langParam: Language = parseLanguage(urlObj.searchParams.get('lang'));
    const user = await resolveUserFromToken(token);

    if (!user) {
      clientWs.send(JSON.stringify({ error: 'Authentication required for voice assistant.' }));
      clientWs.close();
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY not configured on server.' }));
      clientWs.close();
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const targetLangLabel = getLanguageLabel(langParam);
    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;

    try {
      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `You are First Cure's calm, empathetic voice care navigator.
Respond naturally in ${targetLangLabel}. Keep answers concise and soothing (2-4 short sentences).
Help the user clarify symptoms, choose an appropriate specialist type, or prepare for their clinic visit.
Never claim to be a doctor and never give a confirmed diagnosis. For chest pain, severe breathing trouble, stroke signs, or heavy bleeding, tell them immediately to call 108 or 112.`,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== 1) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(JSON.stringify({ inputTranscript: content.inputTranscription.text }));
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(JSON.stringify({ outputTranscript: content.outputTranscription.text }));
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err: unknown) => {
            if (clientWs.readyState === 1) {
              clientWs.send(
                JSON.stringify({
                  error: err instanceof Error ? err.message : 'Live voice stream error',
                })
              );
            }
          },
        },
      });

      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify({ ready: true }));
      }
    } catch (err) {
      if (clientWs.readyState === 1) {
        clientWs.send(
          JSON.stringify({
            error: err instanceof Error ? err.message : 'Could not start voice session',
          })
        );
      }
      clientWs.close();
      return;
    }

    clientWs.on('message', (rawData) => {
      if (!liveSession) return;
      try {
        const msg = JSON.parse(rawData.toString()) as { audio?: string; text?: string };
        if (msg.audio) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.text) {
          liveSession.sendRealtimeInput({ text: msg.text });
        }
      } catch {
        // Ignore malformed frame
      }
    });

    clientWs.on('close', () => {
      try {
        liveSession?.close();
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`First Cure server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start First Cure server:', err);
  process.exit(1);
});
