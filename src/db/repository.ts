import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  appointments,
  doctorReviews,
  doctors,
  healthRecords,
  peerDiscussions,
  referrals,
  supervisions,
  users,
} from './schema.ts';
import { parseLanguage } from '../i18n.ts';
import { createInitialDatabase, hashPassword } from '../server/seedData.ts';
import type { StoredUser } from '../server/seedData.ts';
import type {
  Appointment,
  AvailabilitySlot,
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
} from '../types.ts';

let seedPromise: Promise<void> | null = null;
let seededFlag = false;

function futureDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function normalizeSlots(slots: AvailabilitySlot[]): { slots: AvailabilitySlot[]; changed: boolean } {
  const today = futureDate(0);
  const valid = slots.filter((s) => s.date >= today && s.times.length > 0);
  if (valid.length === 0) {
    return {
      slots: [
        { date: futureDate(0), times: ['16:30', '17:30', '18:30'] },
        { date: futureDate(1), times: ['09:30', '10:30', '11:30', '17:00'] },
        { date: futureDate(2), times: ['10:00', '11:30', '17:30'] },
      ],
      changed: true,
    };
  }
  return { slots: valid, changed: valid.length !== slots.length };
}

export async function ensureSeeded(): Promise<void> {
  if (seededFlag) return;
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        const existing = await db.select({ id: doctors.id }).from(doctors).limit(1);
        if (existing.length > 0) {
          seededFlag = true;
          return;
        }
        const initial = createInitialDatabase();

        for (const u of initial.users) {
          await db
            .insert(users)
            .values({
              id: u.id,
              uid: u.id,
              role: u.role,
              name: u.name,
              email: u.email,
              mobile: u.mobile,
              gender: u.gender,
              preferredLanguage: u.preferredLanguage,
              ethnicity: u.ethnicity ?? null,
              consentHealthData: u.consentHealthData,
              consentTimestamp: u.consentTimestamp || new Date().toISOString(),
              doctorId: u.doctorId ?? null,
              passwordHash: u.passwordHash,
              passwordSalt: u.passwordSalt,
              createdAt: u.createdAt,
            })
            .onConflictDoNothing();
        }

        for (const d of initial.doctors) {
          await db
            .insert(doctors)
            .values({
              id: d.id,
              userId: d.userId ?? null,
              name: d.name,
              nameTa: d.nameTa,
              photoUrl: d.photoUrl,
              specialties: d.specialties,
              specialtiesTa: d.specialtiesTa,
              qualifications: d.qualifications,
              registrationNumber: d.registrationNumber,
              yearsExperience: d.yearsExperience,
              hospitalName: d.hospitalName,
              hospitalNameTa: d.hospitalNameTa,
              city: d.city,
              area: d.area,
              address: d.address,
              coordinates: d.coordinates,
              serviceLocations: d.serviceLocations,
              languagesSpoken: d.languagesSpoken,
              consultationFee: d.consultationFee,
              cancellationFee: d.cancellationFee,
              cancellationWindowHours: d.cancellationWindowHours,
              cancellationPolicy: d.cancellationPolicy,
              cancellationPolicyTa: d.cancellationPolicyTa,
              expectedWaitMinutes: d.expectedWaitMinutes,
              dailyLimit: d.dailyLimit,
              availableHours: d.availableHours,
              availableSlots: d.availableSlots,
              verificationStatus: d.verificationStatus,
              auditedPatientVolume: d.auditedPatientVolume ?? null,
              bio: d.bio,
              bioTa: d.bioTa,
              credentials: d.credentials,
              introVideo: d.introVideo ?? null,
              caseStudies: d.caseStudies,
              seniorMentorEligible: d.seniorMentorEligible,
              supervisorDoctorId: d.supervisorDoctorId ?? null,
              supervisorDoctorName: d.supervisorDoctorName ?? null,
              menteeDoctorIds: d.menteeDoctorIds,
              peerIds: d.peerIds,
            })
            .onConflictDoNothing();
        }

        for (const a of initial.appointments) {
          await db
            .insert(appointments)
            .values({
              id: a.id,
              patientId: a.patientId,
              patientName: a.patientName,
              doctorId: a.doctorId,
              doctorName: a.doctorName,
              doctorSpecialty: a.doctorSpecialty,
              hospitalName: a.hospitalName,
              clinicAddress: a.clinicAddress,
              clinicCoordinates: a.clinicCoordinates,
              date: a.date,
              time: a.time,
              reason: a.reason,
              symptoms: a.symptoms ?? [],
              consultationFee: a.consultationFee,
              cancellationFee: a.cancellationFee,
              cancellationPolicy: a.cancellationPolicy,
              paymentStatus: a.paymentStatus,
              paymentMethod: a.paymentMethod || 'UPI',
              paymentReference: a.paymentReference || 'FC-TXN-SEED',
              status: a.status,
              expectedWaitMinutes: a.expectedWaitMinutes,
              notes: a.notes ?? null,
              sharedReportIds: a.sharedReportIds,
              patientConsentToShare: a.patientConsentToShare,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            })
            .onConflictDoNothing();
        }

        for (const r of initial.healthRecords) {
          await db
            .insert(healthRecords)
            .values({
              id: r.id,
              patientId: r.patientId,
              title: r.title,
              fileName: r.fileName,
              mimeType: r.mimeType,
              summary: r.summary,
              uploadedAt: r.uploadedAt,
              sharedWithDoctorIds: r.sharedWithDoctorIds,
              dataUrl: r.dataUrl ?? null,
            })
            .onConflictDoNothing();
        }

        for (const p of initial.peerDiscussions) {
          await db
            .insert(peerDiscussions)
            .values({
              id: p.id,
              authorDoctorId: p.authorDoctorId,
              authorDoctorName: p.authorDoctorName,
              authorSpecialty: p.authorSpecialty,
              authorVerified: p.authorVerified,
              title: p.title,
              specialty: p.specialty,
              question: p.question,
              anonymizedConfirmed: p.anonymizedConfirmed,
              replies: p.replies,
              createdAt: p.createdAt,
            })
            .onConflictDoNothing();
        }

        for (const ref of initial.referrals) {
          await db
            .insert(referrals)
            .values({
              id: ref.id,
              fromDoctorId: ref.fromDoctorId,
              fromDoctorName: ref.fromDoctorName,
              toDoctorId: ref.toDoctorId,
              toDoctorName: ref.toDoctorName,
              toSpecialty: ref.toSpecialty,
              patientId: ref.patientId,
              patientName: ref.patientName,
              clinicalReason: ref.clinicalReason,
              supervisionNote: ref.supervisionNote ?? null,
              patientConsentStatus: ref.patientConsentStatus,
              createdAt: ref.createdAt,
            })
            .onConflictDoNothing();
        }

        for (const sup of initial.supervisions) {
          await db
            .insert(supervisions)
            .values({
              id: sup.id,
              supervisorDoctorId: sup.supervisorDoctorId,
              supervisorDoctorName: sup.supervisorDoctorName,
              menteeDoctorId: sup.menteeDoctorId,
              menteeDoctorName: sup.menteeDoctorName,
              scope: sup.scope,
              status: sup.status,
              createdAt: sup.createdAt,
            })
            .onConflictDoNothing();
        }

        seededFlag = true;
      } catch (error) {
        seedPromise = null;
        console.error('Database seed check failed:', error);
        throw new Error('Database initialization failed. Please try again.', { cause: error });
      }
    })();
  }
  await seedPromise;
}

function mapUserRow(row: typeof users.$inferSelect): StoredUser {
  return {
    id: row.id,
    role: row.role as UserRole,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    gender: row.gender as PublicUser['gender'],
    preferredLanguage: parseLanguage(row.preferredLanguage),
    ethnicity: row.ethnicity ?? undefined,
    consentHealthData: row.consentHealthData,
    consentTimestamp: row.consentTimestamp,
    doctorId: row.doctorId ?? undefined,
    photoUrl: row.photoUrl ?? undefined,
    createdAt: row.createdAt,
    passwordHash: row.passwordHash,
    passwordSalt: row.passwordSalt,
  };
}

function mapDoctorRow(row: typeof doctors.$inferSelect): DoctorProfile {
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    name: row.name,
    nameTa: row.nameTa,
    photoUrl: row.photoUrl,
    specialties: row.specialties,
    specialtiesTa: row.specialtiesTa,
    qualifications: row.qualifications,
    registrationNumber: row.registrationNumber,
    yearsExperience: row.yearsExperience,
    hospitalName: row.hospitalName,
    hospitalNameTa: row.hospitalNameTa,
    city: row.city,
    area: row.area,
    address: row.address,
    coordinates: row.coordinates,
    serviceLocations: row.serviceLocations,
    languagesSpoken: row.languagesSpoken,
    consultationFee: row.consultationFee,
    cancellationFee: row.cancellationFee,
    cancellationWindowHours: row.cancellationWindowHours,
    cancellationPolicy: row.cancellationPolicy,
    cancellationPolicyTa: row.cancellationPolicyTa,
    expectedWaitMinutes: row.expectedWaitMinutes,
    dailyLimit: row.dailyLimit,
    availableHours: row.availableHours,
    availableSlots: row.availableSlots,
    verificationStatus: row.verificationStatus as DoctorProfile['verificationStatus'],
    auditedPatientVolume: row.auditedPatientVolume ?? undefined,
    bio: row.bio,
    bioTa: row.bioTa,
    credentials: row.credentials,
    introVideo: row.introVideo ?? undefined,
    caseStudies: row.caseStudies,
    seniorMentorEligible: row.seniorMentorEligible,
    supervisorDoctorId: row.supervisorDoctorId ?? undefined,
    supervisorDoctorName: row.supervisorDoctorName ?? undefined,
    menteeDoctorIds: row.menteeDoctorIds,
    peerIds: row.peerIds,
  };
}

function mapAppointmentRow(row: typeof appointments.$inferSelect): Appointment {
  return {
    id: row.id,
    patientId: row.patientId,
    patientName: row.patientName,
    doctorId: row.doctorId,
    doctorName: row.doctorName,
    doctorSpecialty: row.doctorSpecialty,
    hospitalName: row.hospitalName,
    clinicAddress: row.clinicAddress,
    clinicCoordinates: row.clinicCoordinates,
    date: row.date,
    time: row.time,
    reason: row.reason,
    symptoms: row.symptoms ?? undefined,
    consultationFee: row.consultationFee,
    cancellationFee: row.cancellationFee,
    cancellationPolicy: row.cancellationPolicy,
    paymentStatus: row.paymentStatus as Appointment['paymentStatus'],
    paymentMethod: row.paymentMethod,
    paymentReference: row.paymentReference,
    status: row.status as Appointment['status'],
    expectedWaitMinutes: row.expectedWaitMinutes,
    notes: row.notes ?? undefined,
    sharedReportIds: row.sharedReportIds,
    patientConsentToShare: row.patientConsentToShare,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapRecordRow(row: typeof healthRecords.$inferSelect): PatientHealthRecord {
  return {
    id: row.id,
    patientId: row.patientId,
    title: row.title,
    fileName: row.fileName,
    mimeType: row.mimeType,
    summary: row.summary,
    uploadedAt: row.uploadedAt,
    sharedWithDoctorIds: row.sharedWithDoctorIds,
    dataUrl: row.dataUrl ?? undefined,
  };
}

function mapDiscussionRow(row: typeof peerDiscussions.$inferSelect): PeerDiscussion {
  return {
    id: row.id,
    authorDoctorId: row.authorDoctorId,
    authorDoctorName: row.authorDoctorName,
    authorSpecialty: row.authorSpecialty,
    authorVerified: row.authorVerified,
    title: row.title,
    specialty: row.specialty,
    question: row.question,
    anonymizedConfirmed: row.anonymizedConfirmed,
    replies: row.replies,
    createdAt: row.createdAt,
  };
}

function mapReferralRow(row: typeof referrals.$inferSelect): ReferralRequest {
  return {
    id: row.id,
    fromDoctorId: row.fromDoctorId,
    fromDoctorName: row.fromDoctorName,
    toDoctorId: row.toDoctorId,
    toDoctorName: row.toDoctorName,
    toSpecialty: row.toSpecialty,
    patientId: row.patientId,
    patientName: row.patientName,
    clinicalReason: row.clinicalReason,
    supervisionNote: row.supervisionNote ?? undefined,
    patientConsentStatus: row.patientConsentStatus as ReferralRequest['patientConsentStatus'],
    createdAt: row.createdAt,
  };
}

function mapSupervisionRow(row: typeof supervisions.$inferSelect): SupervisionRequest {
  return {
    id: row.id,
    supervisorDoctorId: row.supervisorDoctorId,
    supervisorDoctorName: row.supervisorDoctorName,
    menteeDoctorId: row.menteeDoctorId,
    menteeDoctorName: row.menteeDoctorName,
    scope: row.scope,
    status: row.status as SupervisionRequest['status'],
    createdAt: row.createdAt,
  };
}

function mapReviewRow(row: typeof doctorReviews.$inferSelect): DoctorReview {
  return {
    id: row.id,
    doctorId: row.doctorId,
    appointmentId: row.appointmentId,
    patientDisplayName: row.patientDisplayName,
    verifiedVisit: row.verifiedVisit,
    visitDate: row.visitDate,
    overallRating: row.overallRating,
    communicationRating: row.communicationRating,
    empathyRating: row.empathyRating,
    waitTimeRating: row.waitTimeRating,
    highlights: row.highlights,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

export function computeRatingSummary(reviewsList: DoctorReview[]): DoctorRatingSummary {
  const totalReviews = reviewsList.length;
  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      averageOverall: 0,
      averageCommunication: 0,
      averageEmpathy: 0,
      averageWaitTime: 0,
    };
  }
  const round1 = (sum: number) => Math.round((sum / totalReviews) * 10) / 10;
  return {
    totalReviews,
    averageOverall: round1(reviewsList.reduce((acc, r) => acc + r.overallRating, 0)),
    averageCommunication: round1(reviewsList.reduce((acc, r) => acc + r.communicationRating, 0)),
    averageEmpathy: round1(reviewsList.reduce((acc, r) => acc + r.empathyRating, 0)),
    averageWaitTime: round1(reviewsList.reduce((acc, r) => acc + r.waitTimeRating, 0)),
  };
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  await ensureSeeded();
  try {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ? mapUserRow(rows[0]) : null;
  } catch (error) {
    console.error('findUserById failed:', error);
    throw new Error('Failed to load user account.', { cause: error });
  }
}

export async function findUserByUid(uid: string): Promise<StoredUser | null> {
  await ensureSeeded();
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ? mapUserRow(rows[0]) : null;
  } catch (error) {
    console.error('findUserByUid failed:', error);
    throw new Error('Failed to verify user account.', { cause: error });
  }
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  await ensureSeeded();
  try {
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0] ? mapUserRow(rows[0]) : null;
  } catch (error) {
    console.error('findUserByEmail failed:', error);
    throw new Error('Failed to look up user account.', { cause: error });
  }
}

export async function createAccountWithOptionalDoctor(params: {
  user: StoredUser;
  uid: string;
  doctor?: DoctorProfile;
}): Promise<StoredUser> {
  await ensureSeeded();
  try {
    if (params.doctor) {
      await db.insert(doctors).values({
        id: params.doctor.id,
        userId: params.doctor.userId ?? null,
        name: params.doctor.name,
        nameTa: params.doctor.nameTa,
        photoUrl: params.doctor.photoUrl,
        specialties: params.doctor.specialties,
        specialtiesTa: params.doctor.specialtiesTa,
        qualifications: params.doctor.qualifications,
        registrationNumber: params.doctor.registrationNumber,
        yearsExperience: params.doctor.yearsExperience,
        hospitalName: params.doctor.hospitalName,
        hospitalNameTa: params.doctor.hospitalNameTa,
        city: params.doctor.city,
        area: params.doctor.area,
        address: params.doctor.address,
        coordinates: params.doctor.coordinates,
        serviceLocations: params.doctor.serviceLocations,
        languagesSpoken: params.doctor.languagesSpoken,
        consultationFee: params.doctor.consultationFee,
        cancellationFee: params.doctor.cancellationFee,
        cancellationWindowHours: params.doctor.cancellationWindowHours,
        cancellationPolicy: params.doctor.cancellationPolicy,
        cancellationPolicyTa: params.doctor.cancellationPolicyTa,
        expectedWaitMinutes: params.doctor.expectedWaitMinutes,
        dailyLimit: params.doctor.dailyLimit,
        availableHours: params.doctor.availableHours,
        availableSlots: params.doctor.availableSlots,
        verificationStatus: params.doctor.verificationStatus,
        auditedPatientVolume: params.doctor.auditedPatientVolume ?? null,
        bio: params.doctor.bio,
        bioTa: params.doctor.bioTa,
        credentials: params.doctor.credentials,
        introVideo: params.doctor.introVideo ?? null,
        caseStudies: params.doctor.caseStudies,
        seniorMentorEligible: params.doctor.seniorMentorEligible,
        supervisorDoctorId: params.doctor.supervisorDoctorId ?? null,
        supervisorDoctorName: params.doctor.supervisorDoctorName ?? null,
        menteeDoctorIds: params.doctor.menteeDoctorIds,
        peerIds: params.doctor.peerIds,
      });
    }

    const inserted = await db
      .insert(users)
      .values({
        id: params.user.id,
        uid: params.uid,
        role: params.user.role,
        name: params.user.name,
        email: params.user.email,
        mobile: params.user.mobile,
        gender: params.user.gender,
        preferredLanguage: params.user.preferredLanguage,
        ethnicity: params.user.ethnicity ?? null,
        consentHealthData: params.user.consentHealthData,
        consentTimestamp: params.user.consentTimestamp || new Date().toISOString(),
        doctorId: params.user.doctorId ?? null,
        passwordHash: params.user.passwordHash,
        passwordSalt: params.user.passwordSalt,
        createdAt: params.user.createdAt,
      })
      .returning();

    return mapUserRow(inserted[0]);
  } catch (error) {
    console.error('createAccountWithOptionalDoctor failed:', error);
    throw new Error('Could not create user account. Please try again.', { cause: error });
  }
}

export async function upsertGoogleUser(params: {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  mobile: string;
  gender: PublicUser['gender'];
  preferredLanguage: Language;
  ethnicity?: string;
  consentHealthData: boolean;
  doctor?: DoctorProfile;
}): Promise<StoredUser> {
  await ensureSeeded();
  try {
    const existingByUid = await db.select().from(users).where(eq(users.uid, params.uid)).limit(1);
    if (existingByUid[0]) {
      const updated = await db
        .update(users)
        .set({
          preferredLanguage: params.preferredLanguage,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByUid[0].id))
        .returning();
      return mapUserRow(updated[0]);
    }

    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, params.email.toLowerCase()))
      .limit(1);
    if (existingByEmail[0]) {
      const updated = await db
        .update(users)
        .set({
          uid: params.uid,
          preferredLanguage: params.preferredLanguage,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      return mapUserRow(updated[0]);
    }

    if (params.doctor) {
      await db.insert(doctors).values({
        id: params.doctor.id,
        userId: params.doctor.userId ?? null,
        name: params.doctor.name,
        nameTa: params.doctor.nameTa,
        photoUrl: params.doctor.photoUrl,
        specialties: params.doctor.specialties,
        specialtiesTa: params.doctor.specialtiesTa,
        qualifications: params.doctor.qualifications,
        registrationNumber: params.doctor.registrationNumber,
        yearsExperience: params.doctor.yearsExperience,
        hospitalName: params.doctor.hospitalName,
        hospitalNameTa: params.doctor.hospitalNameTa,
        city: params.doctor.city,
        area: params.doctor.area,
        address: params.doctor.address,
        coordinates: params.doctor.coordinates,
        serviceLocations: params.doctor.serviceLocations,
        languagesSpoken: params.doctor.languagesSpoken,
        consultationFee: params.doctor.consultationFee,
        cancellationFee: params.doctor.cancellationFee,
        cancellationWindowHours: params.doctor.cancellationWindowHours,
        cancellationPolicy: params.doctor.cancellationPolicy,
        cancellationPolicyTa: params.doctor.cancellationPolicyTa,
        expectedWaitMinutes: params.doctor.expectedWaitMinutes,
        dailyLimit: params.doctor.dailyLimit,
        availableHours: params.doctor.availableHours,
        availableSlots: params.doctor.availableSlots,
        verificationStatus: params.doctor.verificationStatus,
        auditedPatientVolume: params.doctor.auditedPatientVolume ?? null,
        bio: params.doctor.bio,
        bioTa: params.doctor.bioTa,
        credentials: params.doctor.credentials,
        introVideo: params.doctor.introVideo ?? null,
        caseStudies: params.doctor.caseStudies,
        seniorMentorEligible: params.doctor.seniorMentorEligible,
        supervisorDoctorId: params.doctor.supervisorDoctorId ?? null,
        supervisorDoctorName: params.doctor.supervisorDoctorName ?? null,
        menteeDoctorIds: params.doctor.menteeDoctorIds,
        peerIds: params.doctor.peerIds,
      });
    }

    const randomPass = hashPassword(`google-${params.uid}-${Date.now()}`);
    const userId = params.doctor?.userId || `user-${params.uid.slice(0, 10)}`;
    const result = await db
      .insert(users)
      .values({
        id: userId,
        uid: params.uid,
        role: params.role,
        name: params.name,
        email: params.email.toLowerCase(),
        mobile: params.mobile,
        gender: params.gender,
        preferredLanguage: params.preferredLanguage,
        ethnicity: params.ethnicity ?? null,
        consentHealthData: params.consentHealthData,
        consentTimestamp: new Date().toISOString(),
        doctorId: params.doctor?.id ?? null,
        passwordHash: randomPass.hash,
        passwordSalt: randomPass.salt,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: params.email.toLowerCase(),
          preferredLanguage: params.preferredLanguage,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapUserRow(result[0]);
  } catch (error) {
    console.error('upsertGoogleUser failed:', error);
    throw new Error('Failed to synchronize Google account.', { cause: error });
  }
}

export async function updateUserPreferences(
  userId: string,
  updates: { preferredLanguage?: Language; consentHealthData?: boolean; photoUrl?: string | null }
): Promise<StoredUser> {
  await ensureSeeded();
  try {
    const patch: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (updates.preferredLanguage) {
      patch.preferredLanguage = updates.preferredLanguage;
    }
    if (typeof updates.consentHealthData === 'boolean') {
      patch.consentHealthData = updates.consentHealthData;
      patch.consentTimestamp = new Date().toISOString();
    }
    if (updates.photoUrl !== undefined) {
      patch.photoUrl = updates.photoUrl;
    }
    const rows = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
    if (!rows[0]) {
      throw new Error('User not found');
    }
    return mapUserRow(rows[0]);
  } catch (error) {
    console.error('updateUserPreferences failed:', error);
    throw new Error('Failed to update user preferences.', { cause: error });
  }
}

export async function listAllDoctors(): Promise<DoctorProfile[]> {
  await ensureSeeded();
  try {
    const [rows, reviewRows] = await Promise.all([
      db.select().from(doctors),
      db.select().from(doctorReviews).orderBy(desc(doctorReviews.createdAt)),
    ]);
    const reviewsByDoc = new Map<string, DoctorReview[]>();
    for (const r of reviewRows) {
      const mapped = mapReviewRow(r);
      const list = reviewsByDoc.get(mapped.doctorId) || [];
      list.push(mapped);
      reviewsByDoc.set(mapped.doctorId, list);
    }

    const list: DoctorProfile[] = [];
    for (const row of rows) {
      const doc = mapDoctorRow(row);
      const normalized = normalizeSlots(doc.availableSlots);
      if (normalized.changed) {
        doc.availableSlots = normalized.slots;
        await db
          .update(doctors)
          .set({ availableSlots: normalized.slots })
          .where(eq(doctors.id, doc.id));
      }
      const docReviews = reviewsByDoc.get(doc.id) || [];
      doc.reviews = docReviews;
      doc.ratingSummary = computeRatingSummary(docReviews);
      list.push(doc);
    }
    return list;
  } catch (error) {
    console.error('listAllDoctors failed:', error);
    throw new Error('Failed to load doctors.', { cause: error });
  }
}

export async function findDoctorById(doctorId: string): Promise<DoctorProfile | null> {
  await ensureSeeded();
  try {
    const [rows, reviewRows] = await Promise.all([
      db.select().from(doctors).where(eq(doctors.id, doctorId)).limit(1),
      db
        .select()
        .from(doctorReviews)
        .where(eq(doctorReviews.doctorId, doctorId))
        .orderBy(desc(doctorReviews.createdAt)),
    ]);
    if (!rows[0]) return null;
    const doc = mapDoctorRow(rows[0]);
    const docReviews = reviewRows.map(mapReviewRow);
    doc.reviews = docReviews;
    doc.ratingSummary = computeRatingSummary(docReviews);
    return doc;
  } catch (error) {
    console.error('findDoctorById failed:', error);
    throw new Error('Failed to load doctor profile.', { cause: error });
  }
}

export async function updateDoctorById(
  doctorId: string,
  patch: Partial<typeof doctors.$inferInsert>
): Promise<DoctorProfile> {
  await ensureSeeded();
  try {
    const rows = await db.update(doctors).set(patch).where(eq(doctors.id, doctorId)).returning();
    if (!rows[0]) throw new Error('Doctor not found');
    const doc = mapDoctorRow(rows[0]);
    const docReviews = await listDoctorReviews(doctorId);
    doc.reviews = docReviews;
    doc.ratingSummary = computeRatingSummary(docReviews);
    return doc;
  } catch (error) {
    console.error('updateDoctorById failed:', error);
    throw new Error('Failed to update doctor profile.', { cause: error });
  }
}

export async function listDoctorReviews(doctorId: string): Promise<DoctorReview[]> {
  await ensureSeeded();
  try {
    const rows = await db
      .select()
      .from(doctorReviews)
      .where(eq(doctorReviews.doctorId, doctorId))
      .orderBy(desc(doctorReviews.createdAt));
    return rows.map(mapReviewRow);
  } catch (error) {
    console.error('listDoctorReviews failed:', error);
    throw new Error('Failed to load doctor feedback.', { cause: error });
  }
}

export async function upsertDoctorReview(params: {
  id: string;
  doctorId: string;
  patientId: string;
  appointmentId: string;
  patientDisplayName: string;
  visitDate: string;
  overallRating: number;
  communicationRating: number;
  empathyRating: number;
  waitTimeRating: number;
  highlights: string[];
  comment: string;
  createdAt: string;
}): Promise<DoctorReview> {
  await ensureSeeded();
  try {
    const rows = await db
      .insert(doctorReviews)
      .values({
        id: params.id,
        doctorId: params.doctorId,
        patientId: params.patientId,
        appointmentId: params.appointmentId,
        patientDisplayName: params.patientDisplayName,
        verifiedVisit: true,
        visitDate: params.visitDate,
        overallRating: params.overallRating,
        communicationRating: params.communicationRating,
        empathyRating: params.empathyRating,
        waitTimeRating: params.waitTimeRating,
        highlights: params.highlights,
        comment: params.comment,
        createdAt: params.createdAt,
      })
      .onConflictDoUpdate({
        target: doctorReviews.appointmentId,
        set: {
          overallRating: params.overallRating,
          communicationRating: params.communicationRating,
          empathyRating: params.empathyRating,
          waitTimeRating: params.waitTimeRating,
          highlights: params.highlights,
          comment: params.comment,
          createdAt: params.createdAt,
        },
      })
      .returning();
    return mapReviewRow(rows[0]);
  } catch (error) {
    console.error('upsertDoctorReview failed:', error);
    throw new Error('Failed to save verified patient feedback.', { cause: error });
  }
}

export async function listAppointmentsForUser(user: StoredUser): Promise<Appointment[]> {
  await ensureSeeded();
  try {
    const rows =
      user.role === 'patient'
        ? await db
            .select()
            .from(appointments)
            .where(eq(appointments.patientId, user.id))
            .orderBy(desc(appointments.createdAt))
        : user.doctorId
        ? await db
            .select()
            .from(appointments)
            .where(eq(appointments.doctorId, user.doctorId))
            .orderBy(desc(appointments.createdAt))
        : [];
    return rows.map(mapAppointmentRow);
  } catch (error) {
    console.error('listAppointmentsForUser failed:', error);
    throw new Error('Failed to load appointments.', { cause: error });
  }
}

export async function countActiveAppointmentsOnDate(
  doctorId: string,
  date: string
): Promise<number> {
  await ensureSeeded();
  try {
    const rows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.doctorId, doctorId));
    return rows.filter((a) => a.date === date && a.status !== 'cancelled').length;
  } catch (error) {
    console.error('countActiveAppointmentsOnDate failed:', error);
    throw new Error('Failed to verify doctor slot availability.', { cause: error });
  }
}

export async function findAppointmentById(id: string): Promise<Appointment | null> {
  await ensureSeeded();
  try {
    const rows = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    return rows[0] ? mapAppointmentRow(rows[0]) : null;
  } catch (error) {
    console.error('findAppointmentById failed:', error);
    throw new Error('Failed to load appointment.', { cause: error });
  }
}

export async function createAppointmentRecord(apt: Appointment): Promise<Appointment> {
  await ensureSeeded();
  try {
    const rows = await db
      .insert(appointments)
      .values({
        id: apt.id,
        patientId: apt.patientId,
        patientName: apt.patientName,
        doctorId: apt.doctorId,
        doctorName: apt.doctorName,
        doctorSpecialty: apt.doctorSpecialty,
        hospitalName: apt.hospitalName,
        clinicAddress: apt.clinicAddress,
        clinicCoordinates: apt.clinicCoordinates,
        date: apt.date,
        time: apt.time,
        reason: apt.reason,
        symptoms: apt.symptoms ?? [],
        consultationFee: apt.consultationFee,
        cancellationFee: apt.cancellationFee,
        cancellationPolicy: apt.cancellationPolicy,
        paymentStatus: apt.paymentStatus,
        paymentMethod: apt.paymentMethod || 'UPI',
        paymentReference: apt.paymentReference || 'FC-TXN-000000',
        status: apt.status,
        expectedWaitMinutes: apt.expectedWaitMinutes,
        notes: apt.notes ?? null,
        sharedReportIds: apt.sharedReportIds,
        patientConsentToShare: apt.patientConsentToShare,
        createdAt: apt.createdAt,
        updatedAt: apt.updatedAt,
      })
      .returning();
    return mapAppointmentRow(rows[0]);
  } catch (error) {
    console.error('createAppointmentRecord failed:', error);
    throw new Error('Failed to book appointment.', { cause: error });
  }
}

export async function updateAppointmentRecord(
  id: string,
  patch: Partial<typeof appointments.$inferInsert>
): Promise<Appointment> {
  await ensureSeeded();
  try {
    const rows = await db
      .update(appointments)
      .set(patch)
      .where(eq(appointments.id, id))
      .returning();
    if (!rows[0]) throw new Error('Appointment not found');
    return mapAppointmentRow(rows[0]);
  } catch (error) {
    console.error('updateAppointmentRecord failed:', error);
    throw new Error('Failed to update appointment.', { cause: error });
  }
}

export async function listRecordsForUser(user: StoredUser): Promise<PatientHealthRecord[]> {
  await ensureSeeded();
  try {
    if (user.role === 'patient') {
      const rows = await db
        .select()
        .from(healthRecords)
        .where(eq(healthRecords.patientId, user.id))
        .orderBy(desc(healthRecords.uploadedAt));
      return rows.map(mapRecordRow);
    }
    const all = await db.select().from(healthRecords).orderBy(desc(healthRecords.uploadedAt));
    const docId = user.doctorId;
    return all
      .map(mapRecordRow)
      .filter((r) => Boolean(docId) && r.sharedWithDoctorIds.includes(docId!));
  } catch (error) {
    console.error('listRecordsForUser failed:', error);
    throw new Error('Failed to load health records.', { cause: error });
  }
}

export async function shareRecordsWithDoctor(
  patientId: string,
  doctorId: string,
  onlyRecordIds?: string[]
): Promise<string[]> {
  await ensureSeeded();
  try {
    const rows = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.patientId, patientId));
    const sharedIds: string[] = [];
    for (const r of rows) {
      if (onlyRecordIds && !onlyRecordIds.includes(r.id)) continue;
      sharedIds.push(r.id);
      if (!r.sharedWithDoctorIds.includes(doctorId)) {
        const nextShared = [...r.sharedWithDoctorIds, doctorId];
        await db
          .update(healthRecords)
          .set({ sharedWithDoctorIds: nextShared })
          .where(eq(healthRecords.id, r.id));
      }
    }
    return sharedIds;
  } catch (error) {
    console.error('shareRecordsWithDoctor failed:', error);
    throw new Error('Failed to update record sharing consent.', { cause: error });
  }
}

export async function createHealthRecord(rec: PatientHealthRecord): Promise<PatientHealthRecord> {
  await ensureSeeded();
  try {
    const rows = await db
      .insert(healthRecords)
      .values({
        id: rec.id,
        patientId: rec.patientId,
        title: rec.title,
        fileName: rec.fileName,
        mimeType: rec.mimeType,
        summary: rec.summary,
        uploadedAt: rec.uploadedAt,
        sharedWithDoctorIds: rec.sharedWithDoctorIds,
        dataUrl: rec.dataUrl ?? null,
      })
      .returning();
    return mapRecordRow(rows[0]);
  } catch (error) {
    console.error('createHealthRecord failed:', error);
    throw new Error('Failed to save health record.', { cause: error });
  }
}

export async function listPeerDiscussions(): Promise<PeerDiscussion[]> {
  await ensureSeeded();
  try {
    const rows = await db
      .select()
      .from(peerDiscussions)
      .orderBy(desc(peerDiscussions.createdAt));
    return rows.map(mapDiscussionRow);
  } catch (error) {
    console.error('listPeerDiscussions failed:', error);
    throw new Error('Failed to load peer discussions.', { cause: error });
  }
}

export async function createPeerDiscussion(disc: PeerDiscussion): Promise<PeerDiscussion> {
  await ensureSeeded();
  try {
    const rows = await db
      .insert(peerDiscussions)
      .values({
        id: disc.id,
        authorDoctorId: disc.authorDoctorId,
        authorDoctorName: disc.authorDoctorName,
        authorSpecialty: disc.authorSpecialty,
        authorVerified: disc.authorVerified,
        title: disc.title,
        specialty: disc.specialty,
        question: disc.question,
        anonymizedConfirmed: disc.anonymizedConfirmed,
        replies: disc.replies,
        createdAt: disc.createdAt,
      })
      .returning();
    return mapDiscussionRow(rows[0]);
  } catch (error) {
    console.error('createPeerDiscussion failed:', error);
    throw new Error('Failed to post peer discussion.', { cause: error });
  }
}

export async function findPeerDiscussionById(id: string): Promise<PeerDiscussion | null> {
  await ensureSeeded();
  try {
    const rows = await db
      .select()
      .from(peerDiscussions)
      .where(eq(peerDiscussions.id, id))
      .limit(1);
    return rows[0] ? mapDiscussionRow(rows[0]) : null;
  } catch (error) {
    console.error('findPeerDiscussionById failed:', error);
    throw new Error('Failed to load discussion.', { cause: error });
  }
}

export async function updatePeerDiscussionReplies(
  id: string,
  replies: PeerDiscussion['replies']
): Promise<PeerDiscussion> {
  await ensureSeeded();
  try {
    const rows = await db
      .update(peerDiscussions)
      .set({ replies })
      .where(eq(peerDiscussions.id, id))
      .returning();
    if (!rows[0]) throw new Error('Discussion not found');
    return mapDiscussionRow(rows[0]);
  } catch (error) {
    console.error('updatePeerDiscussionReplies failed:', error);
    throw new Error('Failed to post reply.', { cause: error });
  }
}

export async function listReferralsForUser(user: StoredUser): Promise<ReferralRequest[]> {
  await ensureSeeded();
  try {
    if (user.role === 'patient') {
      const rows = await db
        .select()
        .from(referrals)
        .where(eq(referrals.patientId, user.id))
        .orderBy(desc(referrals.createdAt));
      return rows.map(mapReferralRow);
    }
    const all = await db.select().from(referrals).orderBy(desc(referrals.createdAt));
    return all
      .map(mapReferralRow)
      .filter((r) => r.fromDoctorId === user.doctorId || r.toDoctorId === user.doctorId);
  } catch (error) {
    console.error('listReferralsForUser failed:', error);
    throw new Error('Failed to load referrals.', { cause: error });
  }
}

export async function createReferralRecord(ref: ReferralRequest): Promise<ReferralRequest> {
  await ensureSeeded();
  try {
    const rows = await db
      .insert(referrals)
      .values({
        id: ref.id,
        fromDoctorId: ref.fromDoctorId,
        fromDoctorName: ref.fromDoctorName,
        toDoctorId: ref.toDoctorId,
        toDoctorName: ref.toDoctorName,
        toSpecialty: ref.toSpecialty,
        patientId: ref.patientId,
        patientName: ref.patientName,
        clinicalReason: ref.clinicalReason,
        supervisionNote: ref.supervisionNote ?? null,
        patientConsentStatus: ref.patientConsentStatus,
        createdAt: ref.createdAt,
      })
      .returning();
    return mapReferralRow(rows[0]);
  } catch (error) {
    console.error('createReferralRecord failed:', error);
    throw new Error('Failed to create referral.', { cause: error });
  }
}

export async function findReferralById(id: string): Promise<ReferralRequest | null> {
  await ensureSeeded();
  try {
    const rows = await db.select().from(referrals).where(eq(referrals.id, id)).limit(1);
    return rows[0] ? mapReferralRow(rows[0]) : null;
  } catch (error) {
    console.error('findReferralById failed:', error);
    throw new Error('Failed to load referral.', { cause: error });
  }
}

export async function updateReferralConsent(
  id: string,
  decision: 'consented' | 'declined'
): Promise<ReferralRequest> {
  await ensureSeeded();
  try {
    const rows = await db
      .update(referrals)
      .set({ patientConsentStatus: decision })
      .where(eq(referrals.id, id))
      .returning();
    if (!rows[0]) throw new Error('Referral not found');
    return mapReferralRow(rows[0]);
  } catch (error) {
    console.error('updateReferralConsent failed:', error);
    throw new Error('Failed to update referral consent.', { cause: error });
  }
}

export async function listSupervisions(): Promise<SupervisionRequest[]> {
  await ensureSeeded();
  try {
    const rows = await db
      .select()
      .from(supervisions)
      .orderBy(desc(supervisions.createdAt));
    return rows.map(mapSupervisionRow);
  } catch (error) {
    console.error('listSupervisions failed:', error);
    throw new Error('Failed to load supervision relationships.', { cause: error });
  }
}

export async function createSupervisionRecord(
  sup: SupervisionRequest
): Promise<SupervisionRequest> {
  await ensureSeeded();
  try {
    const rows = await db
      .insert(supervisions)
      .values({
        id: sup.id,
        supervisorDoctorId: sup.supervisorDoctorId,
        supervisorDoctorName: sup.supervisorDoctorName,
        menteeDoctorId: sup.menteeDoctorId,
        menteeDoctorName: sup.menteeDoctorName,
        scope: sup.scope,
        status: sup.status,
        createdAt: sup.createdAt,
      })
      .returning();
    return mapSupervisionRow(rows[0]);
  } catch (error) {
    console.error('createSupervisionRecord failed:', error);
    throw new Error('Failed to create supervision relationship.', { cause: error });
  }
}
