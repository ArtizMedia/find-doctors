import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  PatientProfile,
  DoctorProfile,
  Clinic,
  Specialization,
  DoctorWeeklySchedule,
  DoctorDateOverride,
  ClinicHoliday,
  SlotReservation,
  Appointment,
  AppointmentHistory,
  NotificationItem,
  DoctorVerificationRecord,
  AuditLog,
} from './schema.ts';

interface DatabaseData {
  users: User[];
  patientProfiles: PatientProfile[];
  doctorProfiles: DoctorProfile[];
  clinics: Clinic[];
  specializations: Specialization[];
  doctorWeeklySchedules: DoctorWeeklySchedule[];
  doctorDateOverrides: DoctorDateOverride[];
  clinicHolidays: ClinicHoliday[];
  slotReservations: SlotReservation[];
  appointments: Appointment[];
  appointmentHistory: AppointmentHistory[];
  notifications: NotificationItem[];
  doctorVerificationRecords: DoctorVerificationRecord[];
  auditLogs: AuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

// Concurrency Locks: Mutex Map for Doctor Slot Operations
const slotLocks = new Map<string, Promise<void>>();

export async function acquireSlotLock<T>(
  lockKey: string,
  operation: () => Promise<T>
): Promise<T> {
  while (slotLocks.has(lockKey)) {
    await slotLocks.get(lockKey);
  }

  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  slotLocks.set(lockKey, lockPromise);

  try {
    return await operation();
  } finally {
    slotLocks.delete(lockKey);
    releaseLock!();
  }
}

class Database {
  private data: DatabaseData = {
    users: [],
    patientProfiles: [],
    doctorProfiles: [],
    clinics: [],
    specializations: [],
    doctorWeeklySchedules: [],
    doctorDateOverrides: [],
    clinicHolidays: [],
    slotReservations: [],
    appointments: [],
    appointmentHistory: [],
    notifications: [],
    doctorVerificationRecords: [],
    auditLogs: [],
  };

  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        this.initialized = true;
        return;
      } catch (err) {
        console.warn('Failed to read db.json, re-seeding default data:', err);
      }
    }

    await this.seed();
    this.persist();
    this.initialized = true;
  }

  public persist(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  // Getters
  public get users() { return this.data.users; }
  public get patientProfiles() { return this.data.patientProfiles; }
  public get doctorProfiles() { return this.data.doctorProfiles; }
  public get clinics() { return this.data.clinics; }
  public get specializations() { return this.data.specializations; }
  public get doctorWeeklySchedules() { return this.data.doctorWeeklySchedules; }
  public get doctorDateOverrides() { return this.data.doctorDateOverrides; }
  public get clinicHolidays() { return this.data.clinicHolidays; }
  public get slotReservations() { return this.data.slotReservations; }
  public get appointments() { return this.data.appointments; }
  public get appointmentHistory() { return this.data.appointmentHistory; }
  public get notifications() { return this.data.notifications; }
  public get doctorVerificationRecords() { return this.data.doctorVerificationRecords; }
  public get auditLogs() { return this.data.auditLogs; }

  public logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>) {
    const entry: AuditLog = {
      id: 'AUDIT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.data.auditLogs.unshift(entry);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs.pop();
    }
    this.persist();
  }

  private async seed(): Promise<void> {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password@123', salt);

    // 1. Specializations
    this.data.specializations = [
      { id: 'spec-cardio', name: 'Cardiology', description: 'Heart, circulation, and vascular health disorders', icon: 'HeartPulse' },
      { id: 'spec-derma', name: 'Dermatology', description: 'Skin, hair, nails, and cosmetic wellness', icon: 'Sparkles' },
      { id: 'spec-pedia', name: 'Pediatrics', description: 'Infant, child, and adolescent healthcare', icon: 'Baby' },
      { id: 'spec-genmed', name: 'General Medicine', description: 'Comprehensive primary care, chronic illnesses & diagnostics', icon: 'Stethoscope' },
      { id: 'spec-ortho', name: 'Orthopedics', description: 'Bones, joints, ligaments, spine, and musculoskeletal care', icon: 'Bone' },
      { id: 'spec-neuro', name: 'Neurology', description: 'Brain, spinal cord, nerves, and neurological disorders', icon: 'Brain' },
      { id: 'spec-ent', name: 'ENT Specialist', description: 'Ear, nose, throat, and sinus conditions', icon: 'Ear' },
      { id: 'spec-gynec', name: 'Gynecology & Obstetrics', description: "Women's reproductive health, prenatal & maternity care", icon: 'Activity' },
    ];

    // 2. Clinics in Kerala
    this.data.clinics = [
      {
        id: 'clinic-1',
        name: 'Apex Heart & Wellness Center',
        address: 'MG Road, Marine Drive, Ernakulam',
        district: 'Ernakulam',
        pinCode: '682011',
        latitude: 9.9816,
        longitude: 76.2798,
        phone: '+91 484 2345678',
        email: 'info@apexheartwellness.com',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'clinic-2',
        name: 'DermaCare Skin & Aesthetic Clinic',
        address: 'Pattom Palace Junction, Kowdiar Road',
        district: 'Thiruvananthapuram',
        pinCode: '695004',
        latitude: 8.5241,
        longitude: 76.9366,
        phone: '+91 471 2548900',
        email: 'care@dermacarekerala.com',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'clinic-3',
        name: 'Little Stars Pediatric Care',
        address: 'Mavoor Road, Near Cyberpark',
        district: 'Kozhikode',
        pinCode: '673004',
        latitude: 11.2588,
        longitude: 75.7804,
        phone: '+91 495 2721100',
        email: 'appointments@littlestarsclinic.in',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'clinic-4',
        name: 'City Care Polyclinic & Ortho Center',
        address: 'Round North, Swaraj Round',
        district: 'Thrissur',
        pinCode: '680001',
        latitude: 10.5276,
        longitude: 76.2144,
        phone: '+91 487 2420088',
        email: 'contact@citycarethrissur.org',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'clinic-5',
        name: 'Lakeside Family Clinic',
        address: 'Vyttila Mobility Hub Road, Janatha',
        district: 'Ernakulam',
        pinCode: '682019',
        latitude: 9.9654,
        longitude: 76.3212,
        phone: '+91 484 2789123',
        email: 'reception@lakesideclinic.in',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString(),
      },
    ];

    // 3. Admin User
    const adminId = 'usr-admin-1';
    this.data.users.push({
      id: adminId,
      email: 'admin@curalink.com',
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 4. Patient User
    const patientUserId = 'usr-patient-1';
    const patientProfileId = 'pat-1';
    this.data.users.push({
      id: patientUserId,
      email: 'patient@curalink.com',
      passwordHash,
      role: 'PATIENT',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.data.patientProfiles.push({
      id: patientProfileId,
      userId: patientUserId,
      fullName: 'Rahul Sharma',
      mobile: '+91 98470 12345',
      preferredLocation: 'Kochi, Kerala',
      address: 'Panampilly Nagar, Ernakulam, Kerala',
      latitude: 9.9602,
      longitude: 76.2941,
      dateOfBirth: '1992-05-14',
      gender: 'MALE',
      emergencyContact: '+91 98470 54321',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 5. Doctors
    const doctorsConfig = [
      {
        userId: 'usr-doc-1',
        docId: 'doc-1',
        email: 'dr.menon@curalink.com',
        fullName: 'Dr. Vineth Menon',
        mobile: '+91 94471 00111',
        specializationId: 'spec-cardio',
        specializationName: 'Cardiology',
        qualifications: 'MBBS, MD (Gen Med), DM (Cardiology), FACC',
        registrationNumber: 'KMC-48291',
        experienceYears: 16,
        clinicId: 'clinic-1',
        clinicName: 'Apex Heart & Wellness Center',
        clinicAddress: 'MG Road, Marine Drive, Ernakulam',
        district: 'Ernakulam',
        pinCode: '682011',
        latitude: 9.9816,
        longitude: 76.2798,
        consultationFee: 700,
        consultationDuration: 15,
        profilePhoto: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80',
        verificationStatus: 'VERIFIED' as const,
        bio: 'Senior Consultant Interventional Cardiologist specializing in preventive cardiology, hypertension, coronary interventions, and cardiac rehabilitation.',
      },
      {
        userId: 'usr-doc-2',
        docId: 'doc-2',
        email: 'dr.anita@curalink.com',
        fullName: 'Dr. Anita Nair',
        mobile: '+91 94472 00222',
        specializationId: 'spec-derma',
        specializationName: 'Dermatology',
        qualifications: 'MBBS, MD (Dermatology, Venereology & Leprosy), DNB',
        registrationNumber: 'TMC-31902',
        experienceYears: 11,
        clinicId: 'clinic-2',
        clinicName: 'DermaCare Skin & Aesthetic Clinic',
        clinicAddress: 'Pattom Palace Junction, Kowdiar Road',
        district: 'Thiruvananthapuram',
        pinCode: '695004',
        latitude: 8.5241,
        longitude: 76.9366,
        consultationFee: 600,
        consultationDuration: 20,
        profilePhoto: 'https://images.unsplash.com/photo-1594824813689-53e87cb32448?w=400&auto=format&fit=crop&q=80',
        verificationStatus: 'VERIFIED' as const,
        bio: 'Expert dermatologist with specialized interest in pediatric dermatology, acne scar therapies, laser dermatology, and chronic dermatological conditions.',
      },
      {
        userId: 'usr-doc-3',
        docId: 'doc-3',
        email: 'dr.rahul@curalink.com',
        fullName: 'Dr. Rahul Pillai',
        mobile: '+91 94473 00333',
        specializationId: 'spec-pedia',
        specializationName: 'Pediatrics',
        qualifications: 'MBBS, DCH, DNB (Pediatrics), MRCPCH (UK)',
        registrationNumber: 'KMC-52110',
        experienceYears: 14,
        clinicId: 'clinic-3',
        clinicName: 'Little Stars Pediatric Care',
        clinicAddress: 'Mavoor Road, Near Cyberpark',
        district: 'Kozhikode',
        pinCode: '673004',
        latitude: 11.2588,
        longitude: 75.7804,
        consultationFee: 500,
        consultationDuration: 15,
        profilePhoto: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&auto=format&fit=crop&q=80',
        verificationStatus: 'VERIFIED' as const,
        bio: 'Dedicated pediatrician focused on newborn care, developmental assessment, childhood vaccinations, and pediatric asthma management.',
      },
      {
        userId: 'usr-doc-4',
        docId: 'doc-4',
        email: 'dr.suresh@curalink.com',
        fullName: 'Dr. Suresh Varma',
        mobile: '+91 94474 00444',
        specializationId: 'spec-ortho',
        specializationName: 'Orthopedics',
        qualifications: 'MBBS, MS (Orthopedics), MCh (Ortho)',
        registrationNumber: 'KMC-61084',
        experienceYears: 19,
        clinicId: 'clinic-4',
        clinicName: 'City Care Polyclinic & Ortho Center',
        clinicAddress: 'Round North, Swaraj Round',
        district: 'Thrissur',
        pinCode: '680001',
        latitude: 10.5276,
        longitude: 76.2144,
        consultationFee: 650,
        consultationDuration: 20,
        profilePhoto: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&auto=format&fit=crop&q=80',
        verificationStatus: 'VERIFIED' as const,
        bio: 'Consultant Orthopedic Surgeon offering specialized management in joint replacement, sports injury arthroscopy, and spine rehabilitation.',
      },
      {
        userId: 'usr-doc-5',
        docId: 'doc-5',
        email: 'dr.lakshmi@curalink.com',
        fullName: 'Dr. Lakshmi Nambiar',
        mobile: '+91 94475 00555',
        specializationId: 'spec-genmed',
        specializationName: 'General Medicine',
        qualifications: 'MBBS, MD (General Medicine)',
        registrationNumber: 'KMC-73412',
        experienceYears: 8,
        clinicId: 'clinic-5',
        clinicName: 'Lakeside Family Clinic',
        clinicAddress: 'Vyttila Mobility Hub Road, Janatha',
        district: 'Ernakulam',
        pinCode: '682019',
        latitude: 9.9654,
        longitude: 76.3212,
        consultationFee: 450,
        consultationDuration: 15,
        profilePhoto: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&auto=format&fit=crop&q=80',
        verificationStatus: 'PENDING' as const, // For admin review testing!
        bio: 'Primary care physician committed to patient-first preventive healthcare, geriatric wellness, diabetes, and lifestyle disease management.',
      },
    ];

    for (const doc of doctorsConfig) {
      this.data.users.push({
        id: doc.userId,
        email: doc.email,
        passwordHash,
        role: 'DOCTOR',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      this.data.doctorProfiles.push({
        id: doc.docId,
        userId: doc.userId,
        fullName: doc.fullName,
        email: doc.email,
        mobile: doc.mobile,
        specializationId: doc.specializationId,
        specializationName: doc.specializationName,
        qualifications: doc.qualifications,
        registrationNumber: doc.registrationNumber,
        experienceYears: doc.experienceYears,
        clinicId: doc.clinicId,
        clinicName: doc.clinicName,
        clinicAddress: doc.clinicAddress,
        district: doc.district,
        pinCode: doc.pinCode,
        latitude: doc.latitude,
        longitude: doc.longitude,
        consultationFee: doc.consultationFee,
        consultationDuration: doc.consultationDuration,
        profilePhoto: doc.profilePhoto,
        verificationStatus: doc.verificationStatus,
        bio: doc.bio,
        isAvailable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Weekly Schedule for each doctor: Mon-Sat, Morning (09:00-13:00) & Afternoon (14:00-17:00)
      this.data.doctorWeeklySchedules.push({
        id: `sched-${doc.docId}`,
        doctorId: doc.docId,
        workingDays: [1, 2, 3, 4, 5, 6], // Mon - Sat
        openingTime: '09:00',
        closingTime: '17:00',
        sessions: [
          { name: 'Morning Session', startTime: '09:00', endTime: '13:00' },
          { name: 'Afternoon Session', startTime: '14:00', endTime: '17:00' },
        ],
        breaks: [
          { name: 'Lunch & Rest Break', startTime: '13:00', endTime: '14:00' },
        ],
        consultationDurationMinutes: doc.consultationDuration,
        bufferDurationMinutes: 5,
        maxAppointmentsPerSession: 16,
        minAdvanceBookingHours: 1,
        maxBookingHorizonDays: 30,
        cancellationDeadlineHours: 4,
        autoConfirm: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (doc.verificationStatus === 'VERIFIED') {
        this.data.doctorVerificationRecords.push({
          id: `verif-${doc.docId}`,
          doctorId: doc.docId,
          doctorName: doc.fullName,
          registrationNumber: doc.registrationNumber,
          status: 'VERIFIED',
          reviewedBy: 'usr-admin-1',
          notes: 'Credentials verified against Kerala State Medical Council registry.',
          verifiedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        });
      }
    }

    // 6. Seed Sample Appointments for testing
    // Tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];

    // Seed an appointment for Dr. Vineth Menon
    const appt1: Appointment = {
      id: 'appt-1',
      appointmentId: 'APPT-' + tomorrowStr.replace(/-/g, '') + '-0101',
      patientId: 'pat-1',
      doctorId: 'doc-1',
      clinicId: 'clinic-1',
      appointmentDate: tomorrowStr,
      startTime: '10:00',
      endTime: '10:15',
      timezone: 'Asia/Kolkata',
      status: 'CONFIRMED',
      consultationFee: 700,
      paymentStatus: 'UNPAID',
      patientName: 'Rahul Sharma',
      patientPhone: '+91 98470 12345',
      patientEmail: 'patient@curalink.com',
      doctorName: 'Dr. Vineth Menon',
      specializationName: 'Cardiology',
      clinicName: 'Apex Heart & Wellness Center',
      clinicAddress: 'MG Road, Marine Drive, Ernakulam',
      notes: 'Routine cardiac follow-up and ECG review.',
      idempotencyKey: 'seed-idemp-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.appointments.push(appt1);

    this.data.slotReservations.push({
      id: 'res-1',
      doctorId: 'doc-1',
      date: tomorrowStr,
      startTime: '10:00',
      endTime: '10:15',
      status: 'BOOKED',
      appointmentId: appt1.id,
      patientId: 'pat-1',
      createdAt: new Date().toISOString(),
    });

    // Seed an upcoming clinic holiday for Dr. Anita (to showcase holiday conflict detection)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);
    const holidayDateStr = nextWeek.toISOString().split('T')[0];

    this.data.clinicHolidays.push({
      id: 'hol-1',
      doctorId: 'doc-2',
      clinicId: 'clinic-2',
      startDate: holidayDateStr,
      endDate: holidayDateStr,
      isFullDay: true,
      reason: 'Attending National Dermatology Conference (DERMACON 2026)',
      affectedAppointmentIds: [],
      createdAt: new Date().toISOString(),
    });

    // Notifications
    this.data.notifications.push(
      {
        id: 'notif-1',
        userId: patientUserId,
        role: 'PATIENT',
        title: 'Appointment Confirmed',
        message: `Your appointment with Dr. Vineth Menon is scheduled for ${tomorrowStr} at 10:00 AM at Apex Heart & Wellness Center.`,
        type: 'BOOKING_CONFIRMED',
        appointmentId: appt1.id,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        userId: 'usr-doc-1',
        role: 'DOCTOR',
        title: 'New Booking',
        message: `Rahul Sharma booked an appointment for ${tomorrowStr} at 10:00 AM.`,
        type: 'BOOKING_REQUEST',
        appointmentId: appt1.id,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
    );
  }
}

export const db = new Database();
