import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { notificationService } from '../services/notificationService.ts';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from '../middleware/auth.ts';
import { VerificationStatus, DoctorVerificationRecord } from '../db/schema.ts';

const router = Router();

// Require ADMIN role for all routes in this router
router.use(authenticateToken, requireRole('ADMIN'));

// GET /api/v1/admin/stats
router.get('/stats', (_req: AuthenticatedRequest, res: Response): void => {
  const totalPatients = db.patientProfiles.length;
  const totalDoctors = db.doctorProfiles.length;
  const verifiedDoctors = db.doctorProfiles.filter((d) => d.verificationStatus === 'VERIFIED').length;
  const pendingDoctors = db.doctorProfiles.filter((d) => d.verificationStatus === 'PENDING').length;
  const totalAppointments = db.appointments.length;
  const confirmedAppointments = db.appointments.filter((a) => a.status === 'CONFIRMED').length;
  const completedAppointments = db.appointments.filter((a) => a.status === 'COMPLETED').length;
  const cancelledAppointments = db.appointments.filter((a) => a.status === 'CANCELLED').length;

  res.json({
    totalPatients,
    totalDoctors,
    verifiedDoctors,
    pendingDoctors,
    totalAppointments,
    confirmedAppointments,
    completedAppointments,
    cancelledAppointments,
  });
});

// GET /api/v1/admin/doctors
router.get('/doctors', (req: AuthenticatedRequest, res: Response): void => {
  const { status } = req.query;
  let list = db.doctorProfiles;

  if (status) {
    list = list.filter((d) => d.verificationStatus === status);
  }

  res.json({
    total: list.length,
    doctors: list,
  });
});

// POST /api/v1/admin/doctors/:doctorId/verify
router.post(
  '/doctors/:doctorId/verify',
  (req: AuthenticatedRequest, res: Response): void => {
    const { doctorId } = req.params;
    const { status, notes } = req.body; // status: 'VERIFIED' | 'REJECTED' | 'SUSPENDED'

    if (!['VERIFIED', 'REJECTED', 'SUSPENDED', 'PENDING'].includes(status)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Status must be one of: VERIFIED, REJECTED, SUSPENDED, PENDING',
      });
      return;
    }

    const doctor = db.doctorProfiles.find((d) => d.id === doctorId);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    const previousStatus = doctor.verificationStatus;
    doctor.verificationStatus = status as VerificationStatus;
    doctor.updatedAt = new Date().toISOString();

    const record: DoctorVerificationRecord = {
      id: 'VERIF-' + Date.now(),
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      registrationNumber: doctor.registrationNumber,
      status: doctor.verificationStatus,
      reviewedBy: req.user?.id || 'ADMIN',
      notes: notes || `Verification status updated from ${previousStatus} to ${status}.`,
      verifiedAt: new Date().toISOString(),
    };

    db.doctorVerificationRecords.unshift(record);
    db.persist();

    // Notify doctor
    notificationService.notifyUser(
      doctor.userId,
      'DOCTOR',
      `Profile Credentials ${status === 'VERIFIED' ? 'Approved' : 'Status Updated'}`,
      status === 'VERIFIED'
        ? `Congratulations! Your professional registration (${doctor.registrationNumber}) has been verified. Your profile is now visible for patient bookings.`
        : `Your profile verification status has been updated to ${status}. Note: ${notes || 'Contact administrator for details.'}`,
      'SCHEDULE_CHANGED'
    );

    db.logAudit({
      userId: req.user?.id,
      role: 'ADMIN',
      action: 'DOCTOR_VERIFIED',
      resource: 'doctorProfiles',
      resourceId: doctor.id,
      details: { previousStatus, newStatus: status, notes },
      ip: req.ip,
    });

    res.json({
      message: `Doctor verification status successfully updated to ${status}.`,
      doctor,
      verificationRecord: record,
    });
  }
);

// GET /api/v1/admin/audit-logs
router.get('/audit-logs', (_req: AuthenticatedRequest, res: Response): void => {
  res.json({
    total: db.auditLogs.length,
    logs: db.auditLogs.slice(0, 100),
  });
});

export default router;
