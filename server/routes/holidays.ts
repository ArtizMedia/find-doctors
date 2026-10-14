import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { notificationService } from '../services/notificationService.ts';
import { timeToMinutes } from '../services/slotService.ts';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from '../middleware/auth.ts';
import { ClinicHoliday } from '../db/schema.ts';

const router = Router();

// GET /api/v1/doctor/holidays
router.get(
  '/',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor profile not found' });
      return;
    }

    const holidays = db.clinicHolidays.filter((h) => h.doctorId === doctor.id);
    res.json({ holidays });
  }
);

// POST /api/v1/doctor/holidays
router.post(
  '/',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor profile not found' });
      return;
    }

    const { startDate, endDate, isFullDay = true, startTime, endTime, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), and reason are required',
      });
      return;
    }

    if (!isFullDay && (!startTime || !endTime)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Partial-day holiday requires startTime (HH:MM) and endTime (HH:MM)',
      });
      return;
    }

    // Identify all existing appointments affected by this closure
    const affectedAppointments = db.appointments.filter((a) => {
      if (a.doctorId !== doctor.id) return false;
      if (!['PENDING', 'CONFIRMED'].includes(a.status)) return false;
      if (a.appointmentDate < startDate || a.appointmentDate > endDate) return false;

      if (isFullDay) return true;

      // Partial day time check
      const aStart = timeToMinutes(a.startTime);
      const aEnd = timeToMinutes(a.endTime);
      const hStart = timeToMinutes(startTime);
      const hEnd = timeToMinutes(endTime);

      return (aStart >= hStart && aStart < hEnd) || (aEnd > hStart && aEnd <= hEnd);
    });

    // Mark affected appointments as requiring resolution (DO NOT silently cancel)
    for (const appt of affectedAppointments) {
      appt.requiresResolution = true;
      appt.resolutionReason = `Clinic Closure (${reason}) on ${appt.appointmentDate}`;
      appt.updatedAt = new Date().toISOString();

      // Notify the patient about the impending schedule disruption
      const patient = db.patientProfiles.find((p) => p.id === appt.patientId);
      if (patient) {
        notificationService.notifyUser(
          patient.userId,
          'PATIENT',
          'Clinic Holiday Notice - Action Required',
          `Dr. ${doctor.fullName} has announced a clinic closure for ${appt.appointmentDate} (${reason}). The clinic will contact you or propose a rescheduled slot shortly.`,
          'CLINIC_HOLIDAY_ALERT',
          appt.id
        );
      }
    }

    const holidayId = 'HOL-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newHoliday: ClinicHoliday = {
      id: holidayId,
      doctorId: doctor.id,
      clinicId: doctor.clinicId,
      startDate,
      endDate,
      isFullDay: Boolean(isFullDay),
      startTime: isFullDay ? undefined : startTime,
      endTime: isFullDay ? undefined : endTime,
      reason: reason.trim(),
      affectedAppointmentIds: affectedAppointments.map((a) => a.id),
      createdAt: new Date().toISOString(),
    };

    db.clinicHolidays.push(newHoliday);
    db.persist();

    db.logAudit({
      userId: req.user?.id,
      role: 'DOCTOR',
      action: 'CLINIC_HOLIDAY_CREATED',
      resource: 'clinicHolidays',
      resourceId: holidayId,
      details: {
        startDate,
        endDate,
        isFullDay,
        affectedCount: affectedAppointments.length,
      },
      ip: req.ip,
    });

    res.status(201).json({
      message: 'Clinic holiday declared successfully',
      holiday: newHoliday,
      affectedAppointmentsCount: affectedAppointments.length,
      affectedAppointments,
    });
  }
);

// DELETE /api/v1/doctor/holidays/:holidayId
router.delete(
  '/:holidayId',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const { holidayId } = req.params;
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);

    const idx = db.clinicHolidays.findIndex(
      (h) => h.id === holidayId && h.doctorId === doctor?.id
    );

    if (idx === -1) {
      res.status(404).json({ error: 'Holiday not found or unauthorized' });
      return;
    }

    const removed = db.clinicHolidays.splice(idx, 1)[0];
    db.persist();

    res.json({ message: 'Holiday deleted successfully', holiday: removed });
  }
);

export default router;
