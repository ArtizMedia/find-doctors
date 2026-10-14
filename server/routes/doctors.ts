import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.ts';
import { DoctorProfile, User } from '../db/schema.ts';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
  generateToken,
} from '../middleware/auth.ts';

const router = Router();

// Haversine formula to compute great-circle distance in kilometers
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// POST /api/v1/doctors/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email,
      password,
      fullName,
      mobile,
      specializationId,
      qualifications,
      registrationNumber,
      experienceYears,
      clinicName,
      clinicAddress,
      district,
      pinCode,
      latitude,
      longitude,
      consultationFee,
      consultationDuration,
      bio,
    } = req.body;

    if (!email || !password || !fullName || !mobile || !specializationId) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'email, password, fullName, mobile, and specializationId are required.',
      });
      return;
    }

    const emailNormalized = email.toLowerCase().trim();
    if (db.users.some((u) => u.email === emailNormalized)) {
      res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email already exists.',
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = 'USR-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const doctorId = 'DOC-' + Date.now();

    const newUser: User = {
      id: userId,
      email: emailNormalized,
      passwordHash,
      role: 'DOCTOR',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = db.specializations.find((s) => s.id === specializationId);
    const specName = spec?.name || 'General Medicine';

    const doctorProfile: DoctorProfile = {
      id: doctorId,
      userId,
      fullName: fullName.trim().startsWith('Dr.') ? fullName.trim() : `Dr. ${fullName.trim()}`,
      email: emailNormalized,
      mobile: mobile.trim(),
      specializationId,
      specializationName: specName,
      qualifications: qualifications || 'MBBS',
      registrationNumber: registrationNumber || 'KMC-' + Math.floor(10000 + Math.random() * 90000),
      experienceYears: Number(experienceYears) || 3,
      clinicId: 'clinic-' + doctorId,
      clinicName: clinicName || 'Speciality Clinic',
      clinicAddress: clinicAddress || 'Kerala, India',
      district: district || 'Ernakulam',
      pinCode: pinCode || '682001',
      latitude: Number(latitude) || 9.9816,
      longitude: Number(longitude) || 76.2798,
      consultationFee: Number(consultationFee) || 500,
      consultationDuration: Number(consultationDuration) || 15,
      profilePhoto: 'https://images.unsplash.com/photo-1594824813689-53e87cb32448?w=400&auto=format&fit=crop&q=80',
      verificationStatus: 'PENDING', // STRICT: Starts as PENDING
      bio: bio || 'Qualified healthcare specialist committed to exceptional patient care.',
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    db.doctorProfiles.push(doctorProfile);

    // Initial schedule
    db.doctorWeeklySchedules.push({
      id: `sched-${doctorId}`,
      doctorId,
      workingDays: [1, 2, 3, 4, 5, 6],
      openingTime: '09:00',
      closingTime: '17:00',
      sessions: [
        { name: 'Morning', startTime: '09:00', endTime: '13:00' },
        { name: 'Afternoon', startTime: '14:00', endTime: '17:00' },
      ],
      breaks: [{ name: 'Lunch', startTime: '13:00', endTime: '14:00' }],
      consultationDurationMinutes: doctorProfile.consultationDuration,
      bufferDurationMinutes: 5,
      maxAppointmentsPerSession: 16,
      minAdvanceBookingHours: 1,
      maxBookingHorizonDays: 30,
      cancellationDeadlineHours: 4,
      autoConfirm: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.persist();

    db.logAudit({
      userId,
      role: 'DOCTOR',
      action: 'DOCTOR_REGISTERED',
      resource: 'doctorProfiles',
      resourceId: doctorId,
      details: { email: emailNormalized, verificationStatus: 'PENDING' },
      ip: req.ip,
    });

    const token = generateToken({
      id: userId,
      email: emailNormalized,
      role: 'DOCTOR',
      profileId: doctorId,
      fullName: doctorProfile.fullName,
    });

    res.status(201).json({
      message: 'Doctor account registered successfully. Verification is pending administrative review.',
      token,
      doctor: doctorProfile,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /api/v1/doctors/me
router.get(
  '/me',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor profile not found' });
      return;
    }
    const schedule = db.doctorWeeklySchedules.find((s) => s.doctorId === doctor.id);
    const clinic = db.clinics.find((c) => c.id === doctor.clinicId);

    res.json({
      doctor,
      schedule,
      clinic,
    });
  }
);

// PATCH /api/v1/doctors/me
router.patch(
  '/me',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor profile not found' });
      return;
    }

    const {
      fullName,
      mobile,
      qualifications,
      consultationFee,
      consultationDuration,
      clinicName,
      clinicAddress,
      district,
      pinCode,
      latitude,
      longitude,
      bio,
      profilePhoto,
      isAvailable,
    } = req.body;

    if (fullName) doctor.fullName = fullName.trim();
    if (mobile) doctor.mobile = mobile.trim();
    if (qualifications) doctor.qualifications = qualifications.trim();
    if (consultationFee !== undefined) doctor.consultationFee = Number(consultationFee);
    if (consultationDuration !== undefined) doctor.consultationDuration = Number(consultationDuration);
    if (clinicName) doctor.clinicName = clinicName.trim();
    if (clinicAddress) doctor.clinicAddress = clinicAddress.trim();
    if (district) doctor.district = district.trim();
    if (pinCode) doctor.pinCode = pinCode.trim();
    if (latitude !== undefined) doctor.latitude = Number(latitude);
    if (longitude !== undefined) doctor.longitude = Number(longitude);
    if (bio !== undefined) doctor.bio = bio.trim();
    if (profilePhoto) doctor.profilePhoto = profilePhoto;
    if (isAvailable !== undefined) doctor.isAvailable = Boolean(isAvailable);
    doctor.updatedAt = new Date().toISOString();

    db.persist();

    db.logAudit({
      userId: req.user?.id,
      role: 'DOCTOR',
      action: 'DOCTOR_PROFILE_UPDATED',
      resource: 'doctorProfiles',
      resourceId: doctor.id,
      ip: req.ip,
    });

    res.json({
      message: 'Doctor profile updated successfully',
      doctor,
    });
  }
);

// GET /api/v1/doctors/nearby
router.get('/nearby', (req: Request, res: Response): void => {
  const {
    latitude,
    longitude,
    radiusKm = '50',
    specializationId,
    availableOnly = 'false',
    limit = '20',
    includeUnverified = 'false',
  } = req.query;

  const lat = parseFloat(latitude as string);
  const lon = parseFloat(longitude as string);
  const radius = parseFloat(radiusKm as string);
  const maxResults = parseInt(limit as string, 10) || 20;

  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Valid numeric latitude and longitude query parameters are required for nearby search.',
    });
    return;
  }

  let list = db.doctorProfiles.filter((d) => {
    // Only verified doctors in public discovery unless requested
    if (includeUnverified !== 'true' && d.verificationStatus !== 'VERIFIED') {
      return false;
    }
    if (specializationId && d.specializationId !== specializationId) {
      return false;
    }
    if (availableOnly === 'true' && !d.isAvailable) {
      return false;
    }
    return true;
  });

  const withDistances = list
    .map((doctor) => {
      const distance = calculateDistanceKm(lat, lon, doctor.latitude, doctor.longitude);
      return {
        ...doctor,
        distanceKm: distance,
      };
    })
    .filter((d) => d.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, maxResults);

  res.json({
    total: withDistances.length,
    radiusKm: radius,
    center: { latitude: lat, longitude: lon },
    doctors: withDistances,
  });
});

// GET /api/v1/doctors (General discovery & search)
router.get('/', (req: Request, res: Response): void => {
  const {
    search,
    specializationId,
    district,
    maxFee,
    minExp,
    availableOnly,
    includeUnverified = 'false',
    page = '1',
    limit = '10',
  } = req.query;

  const pageNum = parseInt(page as string, 10) || 1;
  const pageSize = parseInt(limit as string, 10) || 10;

  let filtered = db.doctorProfiles.filter((d) => {
    if (includeUnverified !== 'true' && d.verificationStatus !== 'VERIFIED') {
      return false;
    }
    if (specializationId && d.specializationId !== specializationId) {
      return false;
    }
    if (district && d.district.toLowerCase() !== (district as string).toLowerCase()) {
      return false;
    }
    if (maxFee && d.consultationFee > Number(maxFee)) {
      return false;
    }
    if (minExp && d.experienceYears < Number(minExp)) {
      return false;
    }
    if (availableOnly === 'true' && !d.isAvailable) {
      return false;
    }
    if (search) {
      const q = (search as string).toLowerCase();
      const matchName = d.fullName.toLowerCase().includes(q);
      const matchSpec = d.specializationName.toLowerCase().includes(q);
      const matchClinic = d.clinicName.toLowerCase().includes(q);
      const matchDist = d.district.toLowerCase().includes(q);
      if (!matchName && !matchSpec && !matchClinic && !matchDist) {
        return false;
      }
    }
    return true;
  });

  const total = filtered.length;
  const startIdx = (pageNum - 1) * pageSize;
  const paginated = filtered.slice(startIdx, startIdx + pageSize);

  res.json({
    total,
    page: pageNum,
    limit: pageSize,
    totalPages: Math.ceil(total / pageSize),
    doctors: paginated,
  });
});

// GET /api/v1/doctors/:doctorId
router.get('/:doctorId', (req: Request, res: Response): void => {
  const { doctorId } = req.params;
  const doctor = db.doctorProfiles.find((d) => d.id === doctorId);

  if (!doctor) {
    res.status(404).json({ error: 'Doctor not found' });
    return;
  }

  const clinic = db.clinics.find((c) => c.id === doctor.clinicId);
  const schedule = db.doctorWeeklySchedules.find((s) => s.doctorId === doctor.id);

  res.json({
    doctor,
    clinic,
    schedule: schedule
      ? {
          workingDays: schedule.workingDays,
          openingTime: schedule.openingTime,
          closingTime: schedule.closingTime,
          sessions: schedule.sessions,
          consultationDurationMinutes: schedule.consultationDurationMinutes,
          autoConfirm: schedule.autoConfirm,
        }
      : null,
  });
});

export default router;
