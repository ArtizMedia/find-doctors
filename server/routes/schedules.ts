import { Router, Request, Response } from 'express';
import { db } from '../db/database.ts';
import { slotService, timeToMinutes } from '../services/slotService.ts';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from '../middleware/auth.ts';
import { DoctorWeeklySchedule, DoctorDateOverride } from '../db/schema.ts';

const router = Router();

// GET /api/v1/doctors/:doctorId/schedule (Public)
router.get('/doctors/:doctorId/schedule', (req: Request, res: Response): void => {
  const { doctorId } = req.params;
  const schedule = db.doctorWeeklySchedules.find((s) => s.doctorId === doctorId);

  if (!schedule) {
    res.status(404).json({ error: 'Schedule not found for this doctor' });
    return;
  }

  res.json({ schedule });
});

// GET /api/v1/doctors/:doctorId/availability (Public / Patient slot selection)
router.get('/doctors/:doctorId/availability', async (req: Request, res: Response): Promise<void> => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Query parameter `date` is required in format YYYY-MM-DD',
      });
      return;
    }

    const availability = await slotService.getDoctorAvailability(doctorId, date);
    res.json(availability);
  } catch (err: any) {
    res.status(500).json({ error: 'Availability Calculation Error', message: err.message });
  }
});

// GET /api/v1/doctor/schedule (Doctor Dashboard)
router.get(
  '/doctor/schedule',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor profile not found' });
      return;
    }

    const schedule = db.doctorWeeklySchedules.find((s) => s.doctorId === doctor.id);
    const overrides = db.doctorDateOverrides.filter((o) => o.doctorId === doctor.id);

    res.json({
      schedule,
      overrides,
    });
  }
);

// PUT /api/v1/doctor/schedule/weekly (Update Weekly Schedule with Conflict Detection)
router.put(
  '/doctor/schedule/weekly',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor profile not found' });
      return;
    }

    const {
      workingDays,
      openingTime,
      closingTime,
      sessions,
      breaks,
      consultationDurationMinutes,
      bufferDurationMinutes,
      maxAppointmentsPerSession,
      minAdvanceBookingHours,
      maxBookingHorizonDays,
      cancellationDeadlineHours,
      autoConfirm,
      force, // if true, doctor has reviewed conflicts
    } = req.body;

    if (!workingDays || !Array.isArray(workingDays) || !sessions || !Array.isArray(sessions)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'workingDays (array of 0-6) and sessions (array of {name, startTime, endTime}) are required',
      });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Conflict Detection: check all future confirmed or pending appointments
    const futureAppts = db.appointments.filter(
      (a) =>
        a.doctorId === doctor.id &&
        a.appointmentDate >= todayStr &&
        ['PENDING', 'CONFIRMED'].includes(a.status)
    );

    const conflictingAppointments: any[] = [];

    for (const appt of futureAppts) {
      const apptDate = new Date(appt.appointmentDate + 'T00:00:00');
      const dayOfWeek = apptDate.getDay();

      // If day is no longer in workingDays
      if (!workingDays.includes(dayOfWeek)) {
        conflictingAppointments.push({
          ...appt,
          conflictReason: `Day of week (${dayOfWeek}) removed from working days`,
        });
        continue;
      }

      // Check if time slot falls within any of the new sessions
      const aStart = timeToMinutes(appt.startTime);
      const aEnd = timeToMinutes(appt.endTime);

      const fallsInSession = sessions.some((s: any) => {
        const sStart = timeToMinutes(s.startTime);
        const sEnd = timeToMinutes(s.endTime);
        return aStart >= sStart && aEnd <= sEnd;
      });

      if (!fallsInSession) {
        conflictingAppointments.push({
          ...appt,
          conflictReason: `Appointment time ${appt.startTime}-${appt.endTime} falls outside configured sessions`,
        });
        continue;
      }

      // Check if falls inside newly defined breaks
      if (breaks && Array.isArray(breaks)) {
        const fallsInBreak = breaks.some((b: any) => {
          const bStart = timeToMinutes(b.startTime);
          const bEnd = timeToMinutes(b.endTime);
          return (aStart >= bStart && aStart < bEnd) || (aEnd > bStart && aEnd <= bEnd);
        });

        if (fallsInBreak) {
          conflictingAppointments.push({
            ...appt,
            conflictReason: `Appointment time ${appt.startTime}-${appt.endTime} conflicts with break hours`,
          });
        }
      }
    }

    if (conflictingAppointments.length > 0 && !force) {
      res.status(409).json({
        error: 'Schedule Conflict',
        message: `Schedule change conflicts with ${conflictingAppointments.length} existing appointment(s). Please review and resolve or reschedule these bookings first.`,
        conflicts: conflictingAppointments,
      });
      return;
    }

    let schedule = db.doctorWeeklySchedules.find((s) => s.doctorId === doctor.id);
    if (!schedule) {
      schedule = {
        id: `sched-${doctor.id}`,
        doctorId: doctor.id,
        workingDays,
        openingTime: openingTime || '09:00',
        closingTime: closingTime || '17:00',
        sessions,
        breaks: breaks || [],
        consultationDurationMinutes: consultationDurationMinutes || doctor.consultationDuration || 15,
        bufferDurationMinutes: bufferDurationMinutes || 0,
        maxAppointmentsPerSession: maxAppointmentsPerSession || 16,
        minAdvanceBookingHours: minAdvanceBookingHours || 1,
        maxBookingHorizonDays: maxBookingHorizonDays || 30,
        cancellationDeadlineHours: cancellationDeadlineHours || 4,
        autoConfirm: autoConfirm !== undefined ? Boolean(autoConfirm) : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.doctorWeeklySchedules.push(schedule);
    } else {
      schedule.workingDays = workingDays;
      if (openingTime) schedule.openingTime = openingTime;
      if (closingTime) schedule.closingTime = closingTime;
      schedule.sessions = sessions;
      schedule.breaks = breaks || [];
      if (consultationDurationMinutes) {
        schedule.consultationDurationMinutes = consultationDurationMinutes;
        doctor.consultationDuration = consultationDurationMinutes;
      }
      if (bufferDurationMinutes !== undefined) schedule.bufferDurationMinutes = bufferDurationMinutes;
      if (maxAppointmentsPerSession !== undefined) schedule.maxAppointmentsPerSession = maxAppointmentsPerSession;
      if (minAdvanceBookingHours !== undefined) schedule.minAdvanceBookingHours = minAdvanceBookingHours;
      if (maxBookingHorizonDays !== undefined) schedule.maxBookingHorizonDays = maxBookingHorizonDays;
      if (cancellationDeadlineHours !== undefined) schedule.cancellationDeadlineHours = cancellationDeadlineHours;
      if (autoConfirm !== undefined) schedule.autoConfirm = Boolean(autoConfirm);
      schedule.updatedAt = new Date().toISOString();
    }

    db.persist();

    db.logAudit({
      userId: req.user?.id,
      role: 'DOCTOR',
      action: 'WEEKLY_SCHEDULE_UPDATED',
      resource: 'doctorWeeklySchedules',
      resourceId: schedule.id,
      ip: req.ip,
    });

    res.json({
      message: 'Weekly schedule updated successfully',
      schedule,
    });
  }
);

// PUT /api/v1/doctor/schedule/date-overrides (Add or update single date override)
router.put(
  '/doctor/schedule/date-overrides',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor profile not found' });
      return;
    }

    const { date, isWorking, sessions, breaks, notes } = req.body;

    if (!date) {
      res.status(400).json({ error: 'Validation Error', message: 'date (YYYY-MM-DD) is required' });
      return;
    }

    const existingIdx = db.doctorDateOverrides.findIndex(
      (o) => o.doctorId === doctor.id && o.date === date
    );

    const overrideItem: DoctorDateOverride = {
      id: existingIdx >= 0 ? db.doctorDateOverrides[existingIdx].id : 'OVR-' + Date.now(),
      doctorId: doctor.id,
      date,
      isWorking: Boolean(isWorking),
      sessions: sessions || [],
      breaks: breaks || [],
      notes: notes || '',
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      db.doctorDateOverrides[existingIdx] = overrideItem;
    } else {
      db.doctorDateOverrides.push(overrideItem);
    }

    db.persist();

    res.json({
      message: 'Date override saved successfully',
      override: overrideItem,
    });
  }
);

export default router;
