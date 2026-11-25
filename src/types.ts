export type Language = 'en' | 'ta' | 'hi' | 'te' | 'ml' | 'kn';
export type UserRole = 'patient' | 'doctor';

export interface PublicUser {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  mobile: string;
  gender: 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';
  preferredLanguage: Language;
  ethnicity?: string;
  consentHealthData: boolean;
  consentTimestamp?: string;
  doctorId?: string;
  photoUrl?: string;
  createdAt: string;
}

export interface CredentialItem {
  id: string;
  title: string;
  titleTa: string;
  issuer: string;
  year: string;
  registrationNo: string;
  status: 'verified' | 'pending_review';
}

export interface CaseStudyItem {
  id: string;
  title: string;
  titleTa: string;
  specialty: string;
  summary: string;
  summaryTa: string;
  clinicalApproach: string;
  clinicalApproachTa: string;
  outcomeSummary: string;
  outcomeSummaryTa: string;
  anonymizedConfirmed: boolean;
  patientConsentObtained: boolean;
  status: 'verified' | 'pending_review';
  reviewedBy?: string;
  publishedAt: string;
}

export interface IntroVideo {
  title: string;
  titleTa: string;
  durationSec: number;
  summary: string;
  summaryTa: string;
  transcript: string;
  transcriptTa: string;
  externalUrl?: string;
}

export interface AvailabilitySlot {
  date: string; // YYYY-MM-DD
  times: string[];
}

export interface DoctorReview {
  id: string;
  doctorId: string;
  patientId?: string;
  appointmentId: string;
  patientDisplayName: string;
  verifiedVisit: boolean;
  visitDate: string;
  overallRating: number;
  communicationRating: number;
  empathyRating: number;
  waitTimeRating: number;
  highlights: string[];
  comment: string;
  createdAt: string;
}

export interface DoctorRatingSummary {
  totalReviews: number;
  averageOverall: number;
  averageCommunication: number;
  averageEmpathy: number;
  averageWaitTime: number;
}

export interface DoctorProfile {
  id: string;
  userId?: string;
  name: string;
  nameTa: string;
  photoUrl: string;
  specialties: string[];
  specialtiesTa: string[];
  qualifications: string[];
  registrationNumber: string;
  yearsExperience: number;
  hospitalName: string;
  hospitalNameTa: string;
  city: string;
  area: string;
  address: string;
  coordinates: { lat: number; lng: number };
  serviceLocations: string[];
  languagesSpoken: string[];
  consultationFee: number;
  cancellationFee: number;
  cancellationWindowHours: number;
  cancellationPolicy: string;
  cancellationPolicyTa: string;
  expectedWaitMinutes: number;
  dailyLimit: number;
  availableHours: string;
  availableSlots: AvailabilitySlot[];
  verificationStatus: 'verified' | 'pending_review';
  auditedPatientVolume?: {
    count: number;
    period: string;
    source: string;
  };
  bio: string;
  bioTa: string;
  credentials: CredentialItem[];
  introVideo?: IntroVideo;
  caseStudies: CaseStudyItem[];
  seniorMentorEligible: boolean;
  supervisorDoctorId?: string;
  supervisorDoctorName?: string;
  menteeDoctorIds: string[];
  peerIds: string[];
  reviews?: DoctorReview[];
  ratingSummary?: DoctorRatingSummary;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  hospitalName: string;
  clinicAddress: string;
  clinicCoordinates: { lat: number; lng: number };
  date: string;
  time: string;
  reason: string;
  symptoms?: string[];
  consultationFee: number;
  cancellationFee: number;
  cancellationPolicy: string;
  paymentStatus: 'paid' | 'pending' | 'refunded' | 'partial_refund';
  paymentMethod?: string;
  paymentReference?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  expectedWaitMinutes: number;
  sharedReportIds: string[];
  patientConsentToShare: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientHealthRecord {
  id: string;
  patientId: string;
  title: string;
  fileName: string;
  mimeType: string;
  summary: string;
  uploadedAt: string;
  sharedWithDoctorIds: string[];
  dataUrl?: string;
}

export interface PeerDiscussion {
  id: string;
  authorDoctorId: string;
  authorDoctorName: string;
  authorSpecialty: string;
  authorVerified: boolean;
  title: string;
  specialty: string;
  question: string;
  anonymizedConfirmed: boolean;
  replies: {
    id: string;
    doctorId: string;
    doctorName: string;
    doctorVerified: boolean;
    message: string;
    createdAt: string;
  }[];
  createdAt: string;
}

export interface ReferralRequest {
  id: string;
  fromDoctorId: string;
  fromDoctorName: string;
  toDoctorId: string;
  toDoctorName: string;
  toSpecialty: string;
  patientId: string;
  patientName: string;
  clinicalReason: string;
  supervisionNote?: string;
  patientConsentStatus: 'awaiting_patient' | 'consented' | 'declined';
  createdAt: string;
}

export interface SupervisionRequest {
  id: string;
  supervisorDoctorId: string;
  supervisorDoctorName: string;
  menteeDoctorId: string;
  menteeDoctorName: string;
  scope: string;
  status: 'active' | 'pending';
  createdAt: string;
}

export interface MatchedDoctorResult {
  doctor: DoctorProfile;
  matchScore: number;
  distanceKm: number;
  withinBudget: boolean;
  nextAvailableSlot: string;
  whyRecommended: string[];
}

export interface AiMatchResponse {
  isEmergency: boolean;
  emergencyMessage?: string;
  guidanceSummary: string;
  suggestedSpecialties: string[];
  disclaimer: string;
  reportAnalysis?: string;
  matches: MatchedDoctorResult[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface ChatResponse {
  reply: string;
  isEmergency: boolean;
  emergencyMessage?: string;
  modelUsed: string;
}

export interface MapsGroundingPlace {
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

export interface MapsGroundedResponse {
  answer: string;
  places: MapsGroundingPlace[];
}
