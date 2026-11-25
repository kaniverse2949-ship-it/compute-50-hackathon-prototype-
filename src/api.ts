import type {
  AiMatchResponse,
  Appointment,
  ChatMessage,
  ChatResponse,
  DoctorProfile,
  DoctorRatingSummary,
  DoctorReview,
  Language,
  MapsGroundedResponse,
  PatientHealthRecord,
  PeerDiscussion,
  PublicUser,
  ReferralRequest,
  SupervisionRequest,
  UserRole,
} from './types';

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register(payload: {
    role: UserRole;
    name: string;
    email: string;
    mobile: string;
    password: string;
    gender: string;
    preferredLanguage: Language;
    ethnicity?: string;
    consentHealthData: boolean;
    specialty?: string;
    hospitalName?: string;
    city?: string;
    area?: string;
    registrationNumber?: string;
    consultationFee?: number;
  }) {
    return requestJson<{ token: string; user: PublicUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string; preferredLanguage: Language }) {
    return requestJson<{ token: string; user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  demoLogin(demoKey: 'patient' | 'doctor1' | 'doctor2', preferredLanguage: Language) {
    return requestJson<{ token: string; user: PublicUser }>('/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ demoKey, preferredLanguage }),
    });
  },

  googleAuth(
    idToken: string,
    payload: {
      role: UserRole;
      name?: string;
      email?: string;
      mobile?: string;
      gender?: string;
      preferredLanguage: Language;
      ethnicity?: string;
      consentHealthData: boolean;
      specialty?: string;
      hospitalName?: string;
      city?: string;
      area?: string;
      registrationNumber?: string;
      consultationFee?: number;
    }
  ) {
    return requestJson<{ token: string; user: PublicUser }>(
      '/api/auth/google',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      idToken
    );
  },

  updateMe(
    token: string,
    payload: { preferredLanguage?: Language; consentHealthData?: boolean; photoUrl?: string | null }
  ) {
    return requestJson<{ user: PublicUser }>(
      '/api/me',
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    );
  },

  listDoctors(params?: { q?: string; specialty?: string; city?: string; maxFee?: number }) {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.specialty) sp.set('specialty', params.specialty);
    if (params?.city) sp.set('city', params.city);
    if (params?.maxFee) sp.set('maxFee', String(params.maxFee));
    const qs = sp.toString();
    return requestJson<{ doctors: DoctorProfile[] }>(`/api/doctors${qs ? `?${qs}` : ''}`);
  },

  getDoctorReviews(doctorId: string) {
    return requestJson<{ reviews: DoctorReview[]; summary: DoctorRatingSummary }>(
      `/api/doctors/${encodeURIComponent(doctorId)}/reviews`
    );
  },

  submitDoctorReview(
    token: string,
    doctorId: string,
    payload: {
      appointmentId: string;
      overallRating: number;
      communicationRating: number;
      empathyRating: number;
      waitTimeRating: number;
      highlights: string[];
      comment: string;
    }
  ) {
    return requestJson<{
      review: DoctorReview;
      doctor: DoctorProfile;
      summary: DoctorRatingSummary;
    }>(
      `/api/doctors/${encodeURIComponent(doctorId)}/reviews`,
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  aiMatch(
    token: string,
    payload: {
      concern: string;
      budget: number;
      location: string;
      symptoms?: string;
      preferredTravelArea?: string;
      language: Language;
      coordinates?: { lat: number; lng: number };
      attachment?: { mimeType: string; base64Data: string; fileName: string };
    }
  ) {
    return requestJson<AiMatchResponse>(
      '/api/ai/match',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  aiChat(
    token: string,
    payload: {
      history: ChatMessage[];
      message: string;
      language: Language;
      speedMode?: 'fast' | 'balanced';
    }
  ) {
    return requestJson<ChatResponse>(
      '/api/ai/chat',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  nearbyCare(
    token: string,
    payload: {
      query: string;
      location: string;
      language: Language;
      coordinates?: { lat: number; lng: number };
    }
  ) {
    return requestJson<MapsGroundedResponse>(
      '/api/ai/nearby-care',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  listAppointments(token: string) {
    return requestJson<{ appointments: Appointment[] }>('/api/appointments', {}, token);
  },

  bookAppointment(
    token: string,
    payload: {
      doctorId: string;
      date: string;
      time: string;
      reason: string;
      paymentMethod: string;
      patientConsentToShare: boolean;
      sharedReportIds: string[];
    }
  ) {
    return requestJson<{ appointment: Appointment }>(
      '/api/appointments',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  updateAppointment(
    token: string,
    id: string,
    payload: { action: 'cancel' | 'reschedule' | 'confirm' | 'complete'; date?: string; time?: string; notes?: string }
  ) {
    return requestJson<{ appointment: Appointment }>(
      `/api/appointments/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    );
  },

  listRecords(token: string) {
    return requestJson<{ records: PatientHealthRecord[] }>('/api/records', {}, token);
  },

  uploadRecord(
    token: string,
    payload: { title: string; fileName: string; mimeType: string; summary: string; dataUrl?: string }
  ) {
    return requestJson<{ record: PatientHealthRecord }>(
      '/api/records',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  updateDoctorProfile(token: string, payload: Partial<DoctorProfile>) {
    return requestJson<{ doctor: DoctorProfile }>(
      '/api/doctor/profile',
      { method: 'PATCH', body: JSON.stringify(payload) },
      token
    );
  },

  addDoctorCredential(
    token: string,
    payload: { title: string; issuer: string; year: string; registrationNo: string }
  ) {
    return requestJson<{ doctor: DoctorProfile }>(
      '/api/doctor/credentials',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  addCaseStudy(
    token: string,
    payload: {
      title: string;
      summary: string;
      clinicalApproach: string;
      outcomeSummary: string;
      anonymizedConfirmed: boolean;
      patientConsentObtained: boolean;
    }
  ) {
    return requestJson<{ doctor: DoctorProfile }>(
      '/api/doctor/case-studies',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  listPeerDiscussions(token: string) {
    return requestJson<{ discussions: PeerDiscussion[] }>('/api/peers/discussions', {}, token);
  },

  createPeerDiscussion(
    token: string,
    payload: { title: string; question: string; anonymizedConfirmed: boolean }
  ) {
    return requestJson<{ discussion: PeerDiscussion }>(
      '/api/peers/discussions',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  replyPeerDiscussion(token: string, id: string, message: string) {
    return requestJson<{ discussion: PeerDiscussion }>(
      `/api/peers/discussions/${encodeURIComponent(id)}/reply`,
      { method: 'POST', body: JSON.stringify({ message }) },
      token
    );
  },

  connectPeer(token: string, targetDoctorId: string, action: 'connect' | 'disconnect' | 'toggle' = 'toggle') {
    return requestJson<{ doctor: DoctorProfile; targetDoctor?: DoctorProfile; connected: boolean }>(
      '/api/peers/connect',
      { method: 'POST', body: JSON.stringify({ targetDoctorId, action }) },
      token
    );
  },

  listReferrals(token: string) {
    return requestJson<{ referrals: ReferralRequest[]; supervisions?: SupervisionRequest[] }>(
      '/api/referrals',
      {},
      token
    );
  },

  createReferral(
    token: string,
    payload: {
      toDoctorId: string;
      patientId: string;
      clinicalReason: string;
      supervisionNote?: string;
    }
  ) {
    return requestJson<{ referral: ReferralRequest }>(
      '/api/referrals',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  respondReferralConsent(token: string, id: string, decision: 'consented' | 'declined') {
    return requestJson<{ referral: ReferralRequest }>(
      `/api/referrals/${encodeURIComponent(id)}/consent`,
      { method: 'PATCH', body: JSON.stringify({ decision }) },
      token
    );
  },

  createSupervision(
    token: string,
    payload: { supervisorDoctorId: string; menteeDoctorId: string; scope: string }
  ) {
    return requestJson<{ supervision: SupervisionRequest }>(
      '/api/supervisions',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },
};
