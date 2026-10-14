import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

// GET /api/v1/patients/me
router.get(
  '/me',
  authenticateToken,
  requireRole('PATIENT'),
  (req: AuthenticatedRequest, res: Response): void => {
    const profile = db.patientProfiles.find((p) => p.userId === req.user?.id);
    if (!profile) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Patient profile not found for this account.',
      });
      return;
    }
    res.json({ profile });
  }
);

// PATCH /api/v1/patients/me
router.patch(
  '/me',
  authenticateToken,
  requireRole('PATIENT'),
  (req: AuthenticatedRequest, res: Response): void => {
    const profile = db.patientProfiles.find((p) => p.userId === req.user?.id);
    if (!profile) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Patient profile not found for this account.',
      });
      return;
    }

    const {
      fullName,
      mobile,
      preferredLocation,
      address,
      latitude,
      longitude,
      dateOfBirth,
      gender,
      emergencyContact,
    } = req.body;

    if (fullName) profile.fullName = fullName.trim();
    if (mobile) profile.mobile = mobile.trim();
    if (preferredLocation) profile.preferredLocation = preferredLocation.trim();
    if (address) profile.address = address.trim();
    if (latitude !== undefined) profile.latitude = Number(latitude);
    if (longitude !== undefined) profile.longitude = Number(longitude);
    if (dateOfBirth) profile.dateOfBirth = dateOfBirth;
    if (gender) profile.gender = gender;
    if (emergencyContact) profile.emergencyContact = emergencyContact.trim();
    profile.updatedAt = new Date().toISOString();

    db.persist();

    db.logAudit({
      userId: req.user?.id,
      role: 'PATIENT',
      action: 'PATIENT_PROFILE_UPDATED',
      resource: 'patientProfiles',
      resourceId: profile.id,
      ip: req.ip,
    });

    res.json({
      message: 'Profile updated successfully',
      profile,
    });
  }
);

export default router;
