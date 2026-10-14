import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.ts';
import { User, PatientProfile, DoctorProfile } from '../db/schema.ts';
import {
  generateToken,
  authenticateToken,
  AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email,
      password,
      confirmPassword,
      role = 'PATIENT',
      fullName,
      mobile,
      preferredLocation,
      address,
      latitude,
      longitude,
      // Doctor specific fields if registering as doctor
      specializationId,
      qualifications,
      registrationNumber,
      experienceYears,
      clinicName,
      clinicAddress,
      district,
      pinCode,
      consultationFee,
      consultationDuration,
    } = req.body;

    // Validation
    if (!email || !password || !fullName || !mobile) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'email, password, fullName, and mobile are required',
      });
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Passwords do not match',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 6 characters long',
      });
      return;
    }

    // Role protection: Cannot self-assign ADMIN
    if (role === 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Administrator accounts cannot be registered publicly.',
      });
      return;
    }

    const emailNormalized = email.toLowerCase().trim();

    // Check duplicate
    const existing = db.users.find((u) => u.email === emailNormalized);
    if (existing) {
      res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email address already exists.',
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = 'USR-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const newUser: User = {
      id: userId,
      email: emailNormalized,
      passwordHash,
      role: role as 'PATIENT' | 'DOCTOR',
      emailVerified: true, // Default to verified in local development
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.users.push(newUser);

    let profileId = '';

    if (role === 'PATIENT') {
      profileId = 'PAT-' + Date.now();
      const patientProfile: PatientProfile = {
        id: profileId,
        userId,
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        preferredLocation: preferredLocation || 'Kochi, Kerala',
        address: address || preferredLocation || 'Kerala, India',
        latitude: Number(latitude) || 9.9816,
        longitude: Number(longitude) || 76.2798,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.patientProfiles.push(patientProfile);
    } else if (role === 'DOCTOR') {
      profileId = 'DOC-' + Date.now();
      const spec = db.specializations.find((s) => s.id === specializationId);
      const specName = spec?.name || 'General Medicine';

      const doctorProfile: DoctorProfile = {
        id: profileId,
        userId,
        fullName: fullName.trim().startsWith('Dr.') ? fullName.trim() : `Dr. ${fullName.trim()}`,
        email: emailNormalized,
        mobile: mobile.trim(),
        specializationId: specializationId || 'spec-genmed',
        specializationName: specName,
        qualifications: qualifications || 'MBBS',
        registrationNumber: registrationNumber || 'KMC-' + Math.floor(10000 + Math.random() * 90000),
        experienceYears: Number(experienceYears) || 5,
        clinicId: 'clinic-custom-' + profileId,
        clinicName: clinicName || 'Health Center',
        clinicAddress: clinicAddress || 'Kerala, India',
        district: district || 'Ernakulam',
        pinCode: pinCode || '682001',
        latitude: Number(latitude) || 9.9816,
        longitude: Number(longitude) || 76.2798,
        consultationFee: Number(consultationFee) || 500,
        consultationDuration: Number(consultationDuration) || 15,
        profilePhoto: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80',
        verificationStatus: 'PENDING', // All doctor registrations start as PENDING verification
        bio: 'Dedicated medical specialist.',
        isAvailable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.doctorProfiles.push(doctorProfile);

      // Create default weekly schedule
      db.doctorWeeklySchedules.push({
        id: `sched-${profileId}`,
        doctorId: profileId,
        workingDays: [1, 2, 3, 4, 5, 6],
        openingTime: '09:00',
        closingTime: '17:00',
        sessions: [
          { name: 'Morning', startTime: '09:00', endTime: '13:00' },
          { name: 'Afternoon', startTime: '14:00', endTime: '17:00' },
        ],
        breaks: [
          { name: 'Lunch', startTime: '13:00', endTime: '14:00' },
        ],
        consultationDurationMinutes: doctorProfile.consultationDuration,
        bufferDurationMinutes: 5,
        maxAppointmentsPerSession: 15,
        minAdvanceBookingHours: 1,
        maxBookingHorizonDays: 30,
        cancellationDeadlineHours: 4,
        autoConfirm: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    db.persist();

    db.logAudit({
      userId,
      role: newUser.role,
      action: 'USER_REGISTERED',
      resource: 'users',
      resourceId: userId,
      details: { email: newUser.email, role: newUser.role },
      ip: req.ip,
    });

    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      profileId,
      fullName,
    });

    res.status(201).json({
      message: 'Account registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        profileId,
        fullName,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'email and password are required',
      });
      return;
    }

    const emailNormalized = email.toLowerCase().trim();
    const user = db.users.find((u) => u.email === emailNormalized);

    if (!user) {
      res.status(401).json({
        error: 'Invalid Credentials',
        message: 'No account found with this email address',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        error: 'Invalid Credentials',
        message: 'Incorrect password',
      });
      return;
    }

    let profileId = '';
    let profileData: any = null;
    let fullName = user.email.split('@')[0];

    if (user.role === 'PATIENT') {
      const p = db.patientProfiles.find((pat) => pat.userId === user.id);
      if (p) {
        profileId = p.id;
        profileData = p;
        fullName = p.fullName;
      }
    } else if (user.role === 'DOCTOR') {
      const d = db.doctorProfiles.find((doc) => doc.userId === user.id);
      if (d) {
        profileId = d.id;
        profileData = d;
        fullName = d.fullName;
      }
    } else if (user.role === 'ADMIN') {
      fullName = 'Administrator';
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      profileId,
      fullName,
    });

    db.logAudit({
      userId: user.id,
      role: user.role,
      action: 'USER_LOGIN',
      resource: 'auth',
      details: { email: user.email },
      ip: req.ip,
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profileId,
        fullName,
      },
      profile: profileData,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    db.logAudit({
      userId: req.user.id,
      role: req.user.role,
      action: 'USER_LOGOUT',
      resource: 'auth',
      ip: req.ip,
    });
  }
  res.json({ message: 'Logged out successfully' });
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Validation Error', message: 'Email is required' });
    return;
  }
  // In production, would send real email via sendgrid/resend
  res.json({
    message: 'If an account exists with this email, password reset instructions have been dispatched.',
  });
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.find((u) => u.id === req.user?.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  let profile: any = null;
  if (user.role === 'PATIENT') {
    profile = db.patientProfiles.find((p) => p.userId === user.id);
  } else if (user.role === 'DOCTOR') {
    profile = db.doctorProfiles.find((d) => d.userId === user.id);
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
    profile,
  });
});

export default router;
