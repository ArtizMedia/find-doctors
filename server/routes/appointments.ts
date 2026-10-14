import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { slotService } from '../services/slotService.ts';
import { notificationService } from '../services/notificationService.ts';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from '../middleware/auth.ts';
import {
  Appointment,
  AppointmentStatus,
  ReschedulingRecord,
} from '../db/schema.ts';

const router = Router();

// Helper to generate human-readable appointment ID
function generateAppointmentReference(date: string): string {
  const cleanDate = date.replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `APPT-${cleanDate}-${rand}`;
}

// POST /api/v1/appointments (Book appointment - Patient)
router.post(
  '/',
  authenticateToken,
  requireRole('PATIENT'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const patient = db.patientProfiles.find((p) => p.userId === req.user?.id);
      if (!patient) {
        res.status(404).json({ error: 'Patient profile not found.' });
        return;
      }

      const {
        doctorId,
        appointmentDate,
        startTime,
        notes,
        idempotencyKey,
      } = req.body;

      if (!doctorId || !appointmentDate || !startTime) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'doctorId, appointmentDate (YYYY-MM-DD), and startTime (HH:MM) are required.',
        });
        return;
      }

      // Idempotency check: prevent duplicate submissions on retry
      if (idempotencyKey) {
        const existing = db.appointments.find((a) => a.idempotencyKey === idempotencyKey);
        if (existing) {
          res.status(200).json({
            message: 'Appointment retrieved from existing request (Idempotent)',
            appointment: existing,
          });
          return;
        }
      }

      // Validate Doctor
      const doctor = db.doctorProfiles.find((d) => d.id === doctorId);
      if (!doctor) {
        res.status(404).json({ error: 'Doctor not found.' });
        return;
      }

      if (doctor.verificationStatus !== 'VERIFIED') {
        res.status(400).json({
          error: 'Doctor Unavailable',
          message: 'This doctor profile is currently undergoing credential verification and cannot accept bookings yet.',
        });
        return;
      }

      // Atomic Concurrency-Safe Slot Reservation
      const { endTime } = await slotService.reserveAndValidateSlot(
        doctorId,
        appointmentDate,
        startTime,
        patient.id
      );

      const clinic = db.clinics.find((c) => c.id === doctor.clinicId);
      const schedule = db.doctorWeeklySchedules.find((s) => s.doctorId === doctorId);

      const status: AppointmentStatus = schedule?.autoConfirm === false ? 'PENDING' : 'CONFIRMED';
      const referenceId = generateAppointmentReference(appointmentDate);
      const apptInternalId = 'APPT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

      const newAppointment: Appointment = {
        id: apptInternalId,
        appointmentId: referenceId,
        patientId: patient.id,
        doctorId: doctor.id,
        clinicId: doctor.clinicId,
        appointmentDate,
        startTime,
        endTime,
        timezone: clinic?.timezone || 'Asia/Kolkata',
        status,
        consultationFee: doctor.consultationFee,
        paymentStatus: 'UNPAID',
        patientName: patient.fullName,
        patientPhone: patient.mobile,
        patientEmail: req.user?.email,
        doctorName: doctor.fullName,
        specializationName: doctor.specializationName,
        clinicName: doctor.clinicName,
        clinicAddress: doctor.clinicAddress,
        notes: notes || '',
        idempotencyKey,
        reschedulingHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.appointments.unshift(newAppointment);

      // Link slot reservation
      const slotRes = db.slotReservations.find(
        (r) =>
          r.doctorId === doctorId &&
          r.date === appointmentDate &&
          r.startTime === startTime &&
          r.status === 'RESERVED'
      );
      if (slotRes) {
        slotRes.status = 'BOOKED';
        slotRes.appointmentId = newAppointment.id;
      }

      db.persist();

      // In-app & real-time notification
      notificationService.notifyUser(
        patient.userId,
        'PATIENT',
        'Appointment Confirmed',
        `Your appointment (${referenceId}) with ${doctor.fullName} on ${appointmentDate} at ${startTime} is confirmed.`,
        'BOOKING_CONFIRMED',
        newAppointment.id
      );

      notificationService.notifyUser(
        doctor.userId,
        'DOCTOR',
        'New Appointment Booking',
        `${patient.fullName} has booked an appointment for ${appointmentDate} at ${startTime}.`,
        'BOOKING_REQUEST',
        newAppointment.id
      );

      db.logAudit({
        userId: req.user?.id,
        role: 'PATIENT',
        action: 'APPOINTMENT_BOOKED',
        resource: 'appointments',
        resourceId: newAppointment.id,
        details: { appointmentId: referenceId, doctorId, date: appointmentDate, time: startTime },
        ip: req.ip,
      });

      res.status(201).json({
        message: 'Appointment successfully booked!',
        appointment: newAppointment,
      });
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: 'Booking Conflict', message: err.message });
      } else {
        res.status(500).json({ error: 'Server Error', message: err.message });
      }
    }
  }
);

// GET /api/v1/appointments/me (Patient's appointments)
router.get(
  '/me',
  authenticateToken,
  requireRole('PATIENT'),
  (req: AuthenticatedRequest, res: Response): void => {
    const patient = db.patientProfiles.find((p) => p.userId === req.user?.id);
    if (!patient) {
      res.status(404).json({ error: 'Patient profile not found.' });
      return;
    }

    const { status, type } = req.query;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let list = db.appointments.filter((a) => a.patientId === patient.id);

    if (status) {
      list = list.filter((a) => a.status === status);
    }

    if (type === 'upcoming') {
      list = list.filter((a) => {
        if (!['PENDING', 'CONFIRMED'].includes(a.status)) return false;
        if (a.appointmentDate > todayStr) return true;
        if (a.appointmentDate === todayStr) {
          const [h, m] = a.startTime.split(':').map(Number);
          return h * 60 + m >= currentMins;
        }
        return false;
      });
    } else if (type === 'past') {
      list = list.filter((a) => {
        if (['COMPLETED', 'NO_SHOW'].includes(a.status)) return true;
        if (a.appointmentDate < todayStr && a.status !== 'CANCELLED') return true;
        return false;
      });
    } else if (type === 'cancelled') {
      list = list.filter((a) => a.status === 'CANCELLED');
    }

    // Sort by date/time
    list.sort((a, b) => {
      const aKey = `${a.appointmentDate}T${a.startTime}`;
      const bKey = `${b.appointmentDate}T${b.startTime}`;
      return bKey.localeCompare(aKey);
    });

    res.json({
      total: list.length,
      appointments: list,
    });
  }
);

// GET /api/v1/doctor/appointments (Doctor Dashboard)
router.get(
  '/doctor',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor profile not found.' });
      return;
    }

    const { date, dateFrom, dateTo, status } = req.query;
    let list = db.appointments.filter((a) => a.doctorId === doctor.id);

    if (date) {
      list = list.filter((a) => a.appointmentDate === date);
    }
    if (dateFrom) {
      list = list.filter((a) => a.appointmentDate >= (dateFrom as string));
    }
    if (dateTo) {
      list = list.filter((a) => a.appointmentDate <= (dateTo as string));
    }
    if (status) {
      list = list.filter((a) => a.status === status);
    }

    list.sort((a, b) => {
      const aKey = `${a.appointmentDate}T${a.startTime}`;
      const bKey = `${b.appointmentDate}T${b.startTime}`;
      return aKey.localeCompare(bKey);
    });

    res.json({
      total: list.length,
      appointments: list,
    });
  }
);

// GET /api/v1/appointments/:appointmentId
router.get(
  '/:appointmentId',
  authenticateToken,
  (req: AuthenticatedRequest, res: Response): void => {
    const { appointmentId } = req.params;
    const appt = db.appointments.find(
      (a) => a.id === appointmentId || a.appointmentId === appointmentId
    );

    if (!appt) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    // IDOR Protection: Patient can only view their own; Doctor can only view their own; Admin can view all
    if (req.user?.role === 'PATIENT') {
      const patient = db.patientProfiles.find((p) => p.userId === req.user?.id);
      if (appt.patientId !== patient?.id) {
        res.status(403).json({ error: 'Forbidden', message: 'You cannot view another patient’s appointment.' });
        return;
      }
    } else if (req.user?.role === 'DOCTOR') {
      const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
      if (appt.doctorId !== doctor?.id) {
        res.status(403).json({ error: 'Forbidden', message: 'You cannot view another doctor’s appointment.' });
        return;
      }
    }

    res.json({ appointment: appt });
  }
);

// POST /api/v1/appointments/:appointmentId/cancel
router.post(
  '/:appointmentId/cancel',
  authenticateToken,
  (req: AuthenticatedRequest, res: Response): void => {
    const { appointmentId } = req.params;
    const { reason } = req.body;

    const appt = db.appointments.find(
      (a) => a.id === appointmentId || a.appointmentId === appointmentId
    );

    if (!appt) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    if (appt.status === 'CANCELLED') {
      res.status(400).json({ error: 'Appointment is already cancelled.' });
      return;
    }

    if (['COMPLETED', 'NO_SHOW'].includes(appt.status)) {
      res.status(400).json({
        error: 'Invalid Operation',
        message: `Cannot cancel an appointment that has status ${appt.status}.`,
      });
      return;
    }

    let cancelledBy: 'PATIENT' | 'DOCTOR' | 'SYSTEM' = 'SYSTEM';

    if (req.user?.role === 'PATIENT') {
      const patient = db.patientProfiles.find((p) => p.userId === req.user?.id);
      if (appt.patientId !== patient?.id) {
        res.status(403).json({ error: 'Forbidden', message: 'You cannot cancel another patient’s booking.' });
        return;
      }
      cancelledBy = 'PATIENT';
    } else if (req.user?.role === 'DOCTOR') {
      const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
      if (appt.doctorId !== doctor?.id) {
        res.status(403).json({ error: 'Forbidden', message: 'You cannot cancel another doctor’s booking.' });
        return;
      }
      cancelledBy = 'DOCTOR';
    } else if (req.user?.role === 'ADMIN') {
      cancelledBy = 'SYSTEM';
    }

    // Release slot reservation atomically
    const slotRes = db.slotReservations.find(
      (r) =>
        r.doctorId === appt.doctorId &&
        r.date === appt.appointmentDate &&
        r.startTime === appt.startTime &&
        r.status === 'BOOKED'
    );
    if (slotRes) {
      slotRes.status = 'RELEASED';
    }

    appt.status = 'CANCELLED';
    appt.cancellationReason = reason || (cancelledBy === 'PATIENT' ? 'Cancelled by patient' : 'Cancelled by doctor');
    appt.cancelledBy = cancelledBy;
    appt.cancelledAt = new Date().toISOString();
    appt.updatedAt = new Date().toISOString();

    db.persist();

    // Notify parties
    const doctor = db.doctorProfiles.find((d) => d.id === appt.doctorId);
    const patient = db.patientProfiles.find((p) => p.id === appt.patientId);

    if (cancelledBy === 'PATIENT' && doctor) {
      notificationService.notifyUser(
        doctor.userId,
        'DOCTOR',
        'Appointment Cancelled',
        `Patient ${appt.patientName} cancelled their appointment for ${appt.appointmentDate} at ${appt.startTime}. Reason: ${appt.cancellationReason}`,
        'APPOINTMENT_CANCELLED',
        appt.id
      );
    } else if (cancelledBy === 'DOCTOR' && patient) {
      notificationService.notifyUser(
        patient.userId,
        'PATIENT',
        'Appointment Cancelled by Doctor',
        `Dr. ${doctor?.fullName || appt.doctorName} had to cancel your appointment for ${appt.appointmentDate} at ${appt.startTime}. Reason: ${appt.cancellationReason}`,
        'APPOINTMENT_CANCELLED',
        appt.id
      );
    }

    db.logAudit({
      userId: req.user?.id,
      role: req.user?.role,
      action: 'APPOINTMENT_CANCELLED',
      resource: 'appointments',
      resourceId: appt.id,
      details: { cancelledBy, reason: appt.cancellationReason },
      ip: req.ip,
    });

    res.json({
      message: 'Appointment cancelled successfully. Slot has been released.',
      appointment: appt,
    });
  }
);

// POST /api/v1/appointments/:appointmentId/reschedule
router.post(
  '/:appointmentId/reschedule',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { appointmentId } = req.params;
      const { newDate, newStartTime, reason } = req.body;

      if (!newDate || !newStartTime) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'newDate (YYYY-MM-DD) and newStartTime (HH:MM) are required.',
        });
        return;
      }

      const appt = db.appointments.find(
        (a) => a.id === appointmentId || a.appointmentId === appointmentId
      );

      if (!appt) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
      }

      if (['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(appt.status)) {
        res.status(400).json({
          error: 'Invalid Operation',
          message: `Cannot reschedule an appointment with status ${appt.status}.`,
        });
        return;
      }

      let rescheduledBy: 'PATIENT' | 'DOCTOR' = 'PATIENT';

      if (req.user?.role === 'PATIENT') {
        const patient = db.patientProfiles.find((p) => p.userId === req.user?.id);
        if (appt.patientId !== patient?.id) {
          res.status(403).json({ error: 'Forbidden', message: 'You cannot reschedule another patient’s appointment.' });
          return;
        }
        rescheduledBy = 'PATIENT';
      } else if (req.user?.role === 'DOCTOR') {
        const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
        if (appt.doctorId !== doctor?.id) {
          res.status(403).json({ error: 'Forbidden', message: 'You cannot reschedule another doctor’s appointment.' });
          return;
        }
        rescheduledBy = 'DOCTOR';
      }

      // Concurrency-safe reservation of the NEW slot
      const { endTime: newEndTime } = await slotService.reserveAndValidateSlot(
        appt.doctorId,
        newDate,
        newStartTime,
        appt.patientId
      );

      // Successfully reserved new slot -> Release old slot
      const oldSlotRes = db.slotReservations.find(
        (r) =>
          r.doctorId === appt.doctorId &&
          r.date === appt.appointmentDate &&
          r.startTime === appt.startTime &&
          r.status === 'BOOKED'
      );
      if (oldSlotRes) {
        oldSlotRes.status = 'RELEASED';
      }

      // Mark new slot as booked
      const newSlotRes = db.slotReservations.find(
        (r) =>
          r.doctorId === appt.doctorId &&
          r.date === newDate &&
          r.startTime === newStartTime &&
          r.status === 'RESERVED'
      );
      if (newSlotRes) {
        newSlotRes.status = 'BOOKED';
        newSlotRes.appointmentId = appt.id;
      }

      const historyRecord: ReschedulingRecord = {
        previousDate: appt.appointmentDate,
        previousStartTime: appt.startTime,
        previousEndTime: appt.endTime,
        newDate,
        newStartTime,
        newEndTime,
        rescheduledBy,
        reason: reason || 'Schedule adjusted',
        timestamp: new Date().toISOString(),
      };

      appt.appointmentDate = newDate;
      appt.startTime = newStartTime;
      appt.endTime = newEndTime;
      appt.status = 'RESCHEDULED';
      appt.requiresResolution = false;
      appt.resolutionReason = undefined;
      appt.reschedulingHistory = appt.reschedulingHistory || [];
      appt.reschedulingHistory.push(historyRecord);
      appt.updatedAt = new Date().toISOString();

      db.persist();

      const doctor = db.doctorProfiles.find((d) => d.id === appt.doctorId);
      const patient = db.patientProfiles.find((p) => p.id === appt.patientId);

      if (rescheduledBy === 'PATIENT' && doctor) {
        notificationService.notifyUser(
          doctor.userId,
          'DOCTOR',
          'Appointment Rescheduled',
          `Patient ${appt.patientName} rescheduled appointment to ${newDate} at ${newStartTime}.`,
          'APPOINTMENT_RESCHEDULED',
          appt.id
        );
      } else if (rescheduledBy === 'DOCTOR' && patient) {
        notificationService.notifyUser(
          patient.userId,
          'PATIENT',
          'Appointment Rescheduled by Doctor',
          `Dr. ${appt.doctorName} rescheduled your appointment to ${newDate} at ${newStartTime}. Reason: ${reason || 'Doctor availability adjustment'}`,
          'APPOINTMENT_RESCHEDULED',
          appt.id
        );
      }

      db.logAudit({
        userId: req.user?.id,
        role: req.user?.role,
        action: 'APPOINTMENT_RESCHEDULED',
        resource: 'appointments',
        resourceId: appt.id,
        details: historyRecord as any,
        ip: req.ip,
      });

      res.json({
        message: 'Appointment successfully rescheduled.',
        appointment: appt,
      });
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: 'Rescheduling Conflict', message: err.message });
      } else {
        res.status(500).json({ error: 'Server Error', message: err.message });
      }
    }
  }
);

// POST /api/v1/appointments/:appointmentId/complete (Doctor)
router.post(
  '/:appointmentId/complete',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const { appointmentId } = req.params;
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    const appt = db.appointments.find(
      (a) => a.id === appointmentId || a.appointmentId === appointmentId
    );

    if (!appt) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    if (appt.doctorId !== doctor?.id) {
      res.status(403).json({ error: 'Forbidden', message: 'You cannot manage another doctor’s appointment.' });
      return;
    }

    appt.status = 'COMPLETED';
    appt.updatedAt = new Date().toISOString();
    db.persist();

    res.json({ message: 'Appointment marked as completed.', appointment: appt });
  }
);

// POST /api/v1/appointments/:appointmentId/no-show (Doctor)
router.post(
  '/:appointmentId/no-show',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const { appointmentId } = req.params;
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    const appt = db.appointments.find(
      (a) => a.id === appointmentId || a.appointmentId === appointmentId
    );

    if (!appt) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    if (appt.doctorId !== doctor?.id) {
      res.status(403).json({ error: 'Forbidden', message: 'You cannot manage another doctor’s appointment.' });
      return;
    }

    appt.status = 'NO_SHOW';
    appt.updatedAt = new Date().toISOString();
    db.persist();

    res.json({ message: 'Appointment marked as no-show.', appointment: appt });
  }
);

export default router;
