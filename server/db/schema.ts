export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientProfile {
  id: string;
  userId: string;
  fullName: string;
  mobile: string;
  preferredLocation: string;
  address: string;
  latitude: number;
  longitude: number;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  emergencyContact?: string;
  createdAt: string;
  updatedAt: string;
}

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export interface DoctorProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  mobile: string;
  specializationId: string;
  specializationName: string;
  qualifications: string;
  registrationNumber: string;
  experienceYears: number;
  clinicId: string;
  clinicName: string;
  clinicAddress: string;
  district: string;
  pinCode: string;
  latitude: number;
  longitude: number;
  consultationFee: number;
  consultationDuration: number; // in minutes (e.g., 15, 20, 30)
  profilePhoto: string;
  clinicPhoto?: string;
  verificationStatus: VerificationStatus;
  bio?: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  district: string;
  pinCode: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  timezone: string; // e.g. "Asia/Kolkata"
  createdAt: string;
}

export interface Specialization {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface ConsultationSession {
  name: string; // "Morning", "Afternoon", "Evening"
  startTime: string; // "09:00"
  endTime: string;   // "13:00"
}

export interface ScheduleBreak {
  name: string; // "Lunch Break"
  startTime: string; // "13:00"
  endTime: string;   // "14:00"
}

export interface DoctorWeeklySchedule {
  id: string;
  doctorId: string;
  workingDays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  openingTime: string;   // "09:00"
  closingTime: string;   // "17:00"
  sessions: ConsultationSession[];
  breaks: ScheduleBreak[];
  consultationDurationMinutes: number; // e.g., 15
  bufferDurationMinutes: number;       // e.g., 5
  maxAppointmentsPerSession?: number;
  minAdvanceBookingHours: number;      // e.g., 2
  maxBookingHorizonDays: number;       // e.g., 30
  cancellationDeadlineHours: number;   // e.g., 4
  autoConfirm: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorDateOverride {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  isWorking: boolean;
  sessions?: ConsultationSession[];
  breaks?: ScheduleBreak[];
  notes?: string;
  createdAt: string;
}

export interface ClinicHoliday {
  id: string;
  doctorId: string;
  clinicId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isFullDay: boolean;
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  reason: string;
  affectedAppointmentIds: string[];
  createdAt: string;
}

export type SlotReservationStatus = 'RESERVED' | 'BOOKED' | 'RELEASED';

export interface SlotReservation {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  status: SlotReservationStatus;
  appointmentId?: string;
  patientId?: string;
  expiresAt?: string;
  createdAt: string;
}

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'NO_SHOW'
  | 'REJECTED';

export interface ReschedulingRecord {
  previousDate: string;
  previousStartTime: string;
  previousEndTime: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  rescheduledBy: 'PATIENT' | 'DOCTOR';
  reason?: string;
  timestamp: string;
}

export interface Appointment {
  id: string;
  appointmentId: string; // human readable like APPT-20261014-XXXX
  patientId: string;
  doctorId: string;
  clinicId: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  timezone: string;  // "Asia/Kolkata"
  status: AppointmentStatus;
  consultationFee: number;
  paymentStatus: 'UNPAID' | 'PAID';
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  doctorName: string;
  specializationName: string;
  clinicName: string;
  clinicAddress: string;
  notes?: string;
  idempotencyKey?: string;
  cancellationReason?: string;
  cancelledBy?: 'PATIENT' | 'DOCTOR' | 'SYSTEM';
  cancelledAt?: string;
  reschedulingHistory?: ReschedulingRecord[];
  requiresResolution?: boolean; // Flagged when clinic holiday overlaps
  resolutionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentHistory {
  id: string;
  appointmentId: string;
  previousStatus: AppointmentStatus;
  newStatus: AppointmentStatus;
  changedBy: string; // user ID or SYSTEM
  reason?: string;
  timestamp: string;
}

export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_REQUEST'
  | 'BOOKING_REJECTED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'CLINIC_HOLIDAY_ALERT'
  | 'SCHEDULE_CHANGED'
  | 'APPOINTMENT_REMINDER';

export interface NotificationItem {
  id: string;
  userId: string;
  role: UserRole;
  title: string;
  message: string;
  type: NotificationType;
  appointmentId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface DoctorVerificationRecord {
  id: string;
  doctorId: string;
  doctorName: string;
  registrationNumber: string;
  status: VerificationStatus;
  reviewedBy: string;
  notes?: string;
  verifiedAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  role?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  timestamp: string;
}

export interface TimeSlot {
  startTime: string; // "09:00"
  endTime: string;   // "09:15"
  isAvailable: boolean;
  reason?: string;
}
