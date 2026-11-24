import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type {
  AvailabilitySlot,
  CaseStudyItem,
  CredentialItem,
  DoctorProfile,
  PeerDiscussion,
} from '../types.ts';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  role: text('role').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  mobile: text('mobile').notNull(),
  gender: text('gender').notNull(),
  preferredLanguage: text('preferred_language').notNull().default('en'),
  ethnicity: text('ethnicity'),
  consentHealthData: boolean('consent_health_data').notNull().default(true),
  consentTimestamp: text('consent_timestamp').notNull(),
  doctorId: text('doctor_id'),
  photoUrl: text('photo_url'),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const doctors = pgTable('doctors', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  name: text('name').notNull(),
  nameTa: text('name_ta').notNull(),
  photoUrl: text('photo_url').notNull(),
  specialties: jsonb('specialties').$type<string[]>().notNull(),
  specialtiesTa: jsonb('specialties_ta').$type<string[]>().notNull(),
  qualifications: jsonb('qualifications').$type<string[]>().notNull(),
  registrationNumber: text('registration_number').notNull(),
  yearsExperience: integer('years_experience').notNull(),
  hospitalName: text('hospital_name').notNull(),
  hospitalNameTa: text('hospital_name_ta').notNull(),
  city: text('city').notNull(),
  area: text('area').notNull(),
  address: text('address').notNull(),
  coordinates: jsonb('coordinates').$type<{ lat: number; lng: number }>().notNull(),
  serviceLocations: jsonb('service_locations').$type<string[]>().notNull(),
  languagesSpoken: jsonb('languages_spoken').$type<string[]>().notNull(),
  consultationFee: integer('consultation_fee').notNull(),
  cancellationFee: integer('cancellation_fee').notNull(),
  cancellationWindowHours: integer('cancellation_window_hours').notNull(),
  cancellationPolicy: text('cancellation_policy').notNull(),
  cancellationPolicyTa: text('cancellation_policy_ta').notNull(),
  expectedWaitMinutes: integer('expected_wait_minutes').notNull(),
  dailyLimit: integer('daily_limit').notNull(),
  availableHours: text('available_hours').notNull(),
  availableSlots: jsonb('available_slots').$type<AvailabilitySlot[]>().notNull(),
  verificationStatus: text('verification_status').notNull(),
  auditedPatientVolume: jsonb('audited_patient_volume').$type<DoctorProfile['auditedPatientVolume']>(),
  bio: text('bio').notNull(),
  bioTa: text('bio_ta').notNull(),
  credentials: jsonb('credentials').$type<CredentialItem[]>().notNull(),
  introVideo: jsonb('intro_video').$type<DoctorProfile['introVideo']>(),
  caseStudies: jsonb('case_studies').$type<CaseStudyItem[]>().notNull(),
  seniorMentorEligible: boolean('senior_mentor_eligible').notNull().default(false),
  supervisorDoctorId: text('supervisor_doctor_id'),
  supervisorDoctorName: text('supervisor_doctor_name'),
  menteeDoctorIds: jsonb('mentee_doctor_ids').$type<string[]>().notNull(),
  peerIds: jsonb('peer_ids').$type<string[]>().notNull(),
});

export const appointments = pgTable('appointments', {
  id: text('id').primaryKey(),
  patientId: text('patient_id')
    .references(() => users.id)
    .notNull(),
  patientName: text('patient_name').notNull(),
  doctorId: text('doctor_id')
    .references(() => doctors.id)
    .notNull(),
  doctorName: text('doctor_name').notNull(),
  doctorSpecialty: text('doctor_specialty').notNull(),
  hospitalName: text('hospital_name').notNull(),
  clinicAddress: text('clinic_address').notNull(),
  clinicCoordinates: jsonb('clinic_coordinates').$type<{ lat: number; lng: number }>().notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  reason: text('reason').notNull(),
  symptoms: jsonb('symptoms').$type<string[]>(),
  consultationFee: integer('consultation_fee').notNull(),
  cancellationFee: integer('cancellation_fee').notNull(),
  cancellationPolicy: text('cancellation_policy').notNull(),
  paymentStatus: text('payment_status').notNull(),
  paymentMethod: text('payment_method').notNull(),
  paymentReference: text('payment_reference').notNull(),
  status: text('status').notNull(),
  expectedWaitMinutes: integer('expected_wait_minutes').notNull(),
  notes: text('notes'),
  sharedReportIds: jsonb('shared_report_ids').$type<string[]>().notNull(),
  patientConsentToShare: boolean('patient_consent_to_share').notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const healthRecords = pgTable('health_records', {
  id: text('id').primaryKey(),
  patientId: text('patient_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  summary: text('summary').notNull(),
  uploadedAt: text('uploaded_at').notNull(),
  sharedWithDoctorIds: jsonb('shared_with_doctor_ids').$type<string[]>().notNull(),
  dataUrl: text('data_url'),
});

export const peerDiscussions = pgTable('peer_discussions', {
  id: text('id').primaryKey(),
  authorDoctorId: text('author_doctor_id')
    .references(() => doctors.id)
    .notNull(),
  authorDoctorName: text('author_doctor_name').notNull(),
  authorSpecialty: text('author_specialty').notNull(),
  authorVerified: boolean('author_verified').notNull().default(false),
  title: text('title').notNull(),
  specialty: text('specialty').notNull(),
  question: text('question').notNull(),
  anonymizedConfirmed: boolean('anonymized_confirmed').notNull().default(true),
  replies: jsonb('replies').$type<PeerDiscussion['replies']>().notNull(),
  createdAt: text('created_at').notNull(),
});

export const referrals = pgTable('referrals', {
  id: text('id').primaryKey(),
  fromDoctorId: text('from_doctor_id')
    .references(() => doctors.id)
    .notNull(),
  fromDoctorName: text('from_doctor_name').notNull(),
  toDoctorId: text('to_doctor_id')
    .references(() => doctors.id)
    .notNull(),
  toDoctorName: text('to_doctor_name').notNull(),
  toSpecialty: text('to_specialty').notNull(),
  patientId: text('patient_id')
    .references(() => users.id)
    .notNull(),
  patientName: text('patient_name').notNull(),
  clinicalReason: text('clinical_reason').notNull(),
  supervisionNote: text('supervision_note'),
  patientConsentStatus: text('patient_consent_status').notNull(),
  createdAt: text('created_at').notNull(),
});

export const supervisions = pgTable('supervisions', {
  id: text('id').primaryKey(),
  supervisorDoctorId: text('supervisor_doctor_id')
    .references(() => doctors.id)
    .notNull(),
  supervisorDoctorName: text('supervisor_doctor_name').notNull(),
  menteeDoctorId: text('mentee_doctor_id')
    .references(() => doctors.id)
    .notNull(),
  menteeDoctorName: text('mentee_doctor_name').notNull(),
  scope: text('scope').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  appointments: many(appointments),
  healthRecords: many(healthRecords),
  referrals: many(referrals),
}));

export const doctorsRelations = relations(doctors, ({ many }) => ({
  appointments: many(appointments),
  peerDiscussions: many(peerDiscussions),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(users, {
    fields: [appointments.patientId],
    references: [users.id],
  }),
  doctor: one(doctors, {
    fields: [appointments.doctorId],
    references: [doctors.id],
  }),
}));

export const healthRecordsRelations = relations(healthRecords, ({ one }) => ({
  patient: one(users, {
    fields: [healthRecords.patientId],
    references: [users.id],
  }),
}));

export const peerDiscussionsRelations = relations(peerDiscussions, ({ one }) => ({
  author: one(doctors, {
    fields: [peerDiscussions.authorDoctorId],
    references: [doctors.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  patient: one(users, {
    fields: [referrals.patientId],
    references: [users.id],
  }),
  fromDoctor: one(doctors, {
    fields: [referrals.fromDoctorId],
    references: [doctors.id],
  }),
  toDoctor: one(doctors, {
    fields: [referrals.toDoctorId],
    references: [doctors.id],
  }),
}));
