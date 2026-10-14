import { db, acquireSlotLock } from '../db/database.ts';
import {
  TimeSlot,
  DoctorWeeklySchedule,
  DoctorDateOverride,
  ClinicHoliday,
  ConsultationSession,
} from '../db/schema.ts';

// Helper to convert "HH:MM" to minutes from midnight
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

// Helper to convert minutes from midnight back to "HH:MM"
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export interface DayAvailability {
  date: string;
  isWorkingDay: boolean;
  statusReason?: string;
  totalSlots: number;
  availableSlotsCount: number;
  slots: TimeSlot[];
  sessions: ConsultationSession[];
}

export class SlotService {
  /**
   * Generates all slots for a doctor on a specific date, checking weekly schedules,
   * date overrides, clinic holidays, existing bookings, and current time restrictions.
   */
  public async getDoctorAvailability(
    doctorId: string,
    targetDateStr: string
  ): Promise<DayAvailability> {
    const doctor = db.doctorProfiles.find((d) => d.id === doctorId);
    if (!doctor) {
      throw new Error(`Doctor not found with ID ${doctorId}`);
    }

    const schedule = db.doctorWeeklySchedules.find((s) => s.doctorId === doctorId);
    if (!schedule) {
      return {
        date: targetDateStr,
        isWorkingDay: false,
        statusReason: 'Doctor has not configured consultation schedule yet.',
        totalSlots: 0,
        availableSlotsCount: 0,
        slots: [],
        sessions: [],
      };
    }

    const targetDate = new Date(targetDateStr + 'T00:00:00');
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Check past date
    if (targetDateStr < todayStr) {
      return {
        date: targetDateStr,
        isWorkingDay: false,
        statusReason: 'Cannot view or book appointments for past dates.',
        totalSlots: 0,
        availableSlotsCount: 0,
        slots: [],
        sessions: [],
      };
    }

    // Check maximum booking horizon
    const maxHorizonDate = new Date(now);
    maxHorizonDate.setDate(maxHorizonDate.getDate() + (schedule.maxBookingHorizonDays || 30));
    const maxHorizonStr = maxHorizonDate.toISOString().split('T')[0];

    if (targetDateStr > maxHorizonStr) {
      return {
        date: targetDateStr,
        isWorkingDay: false,
        statusReason: `Booking is only available up to ${schedule.maxBookingHorizonDays} days in advance (until ${maxHorizonStr}).`,
        totalSlots: 0,
        availableSlotsCount: 0,
        slots: [],
        sessions: [],
      };
    }

    // Check Date Override for this specific day
    const override = db.doctorDateOverrides.find(
      (o) => o.doctorId === doctorId && o.date === targetDateStr
    );

    if (override && !override.isWorking) {
      return {
        date: targetDateStr,
        isWorkingDay: false,
        statusReason: override.notes || 'Doctor is off duty on this date (Date Override).',
        totalSlots: 0,
        availableSlotsCount: 0,
        slots: [],
        sessions: [],
      };
    }

    // Check Clinic Holidays
    const holidays = db.clinicHolidays.filter(
      (h) =>
        h.doctorId === doctorId &&
        targetDateStr >= h.startDate &&
        targetDateStr <= h.endDate
    );

    const fullDayHoliday = holidays.find((h) => h.isFullDay);
    if (fullDayHoliday) {
      return {
        date: targetDateStr,
        isWorkingDay: false,
        statusReason: `Clinic closed: ${fullDayHoliday.reason}`,
        totalSlots: 0,
        availableSlotsCount: 0,
        slots: [],
        sessions: [],
      };
    }

    // Check day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = targetDate.getDay();
    const isRegularWorkingDay = schedule.workingDays.includes(dayOfWeek);

    if (!isRegularWorkingDay && !override) {
      return {
        date: targetDateStr,
        isWorkingDay: false,
        statusReason: 'Doctor does not practice on this day of the week.',
        totalSlots: 0,
        availableSlotsCount: 0,
        slots: [],
        sessions: [],
      };
    }

    // Determine sessions and breaks
    const sessions = override?.sessions && override.sessions.length > 0
      ? override.sessions
      : schedule.sessions;

    const breaks = override?.breaks && override.breaks.length > 0
      ? override.breaks
      : schedule.breaks;

    const slotDuration = schedule.consultationDurationMinutes || doctor.consultationDuration || 15;
    const bufferDuration = schedule.bufferDurationMinutes || 0;
    const stepDuration = slotDuration + bufferDuration;

    // Fetch existing appointments on this date
    const dayAppointments = db.appointments.filter(
      (a) =>
        a.doctorId === doctorId &&
        a.appointmentDate === targetDateStr &&
        ['PENDING', 'CONFIRMED'].includes(a.status)
    );

    // Fetch active slot reservations (not expired)
    const activeReservations = db.slotReservations.filter(
      (r) =>
        r.doctorId === doctorId &&
        r.date === targetDateStr &&
        r.status === 'RESERVED' &&
        (!r.expiresAt || new Date(r.expiresAt).getTime() > Date.now())
    );

    // Current time in Asia/Kolkata or local
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const minAdvanceMins = (schedule.minAdvanceBookingHours || 1) * 60;

    const slots: TimeSlot[] = [];

    for (const session of sessions) {
      const sessionStart = timeToMinutes(session.startTime);
      const sessionEnd = timeToMinutes(session.endTime);

      let currentSlotStart = sessionStart;

      while (currentSlotStart + slotDuration <= sessionEnd) {
        const currentSlotEnd = currentSlotStart + slotDuration;
        const startStr = minutesToTime(currentSlotStart);
        const endStr = minutesToTime(currentSlotEnd);

        // Check if overlaps any break
        const isInBreak = breaks.some((brk) => {
          const brkStart = timeToMinutes(brk.startTime);
          const brkEnd = timeToMinutes(brk.endTime);
          return (
            (currentSlotStart >= brkStart && currentSlotStart < brkEnd) ||
            (currentSlotEnd > brkStart && currentSlotEnd <= brkEnd) ||
            (currentSlotStart <= brkStart && currentSlotEnd >= brkEnd)
          );
        });

        // Check if overlaps partial day holiday
        const isHolidayBlocked = holidays.some((h) => {
          if (h.isFullDay || !h.startTime || !h.endTime) return false;
          const hStart = timeToMinutes(h.startTime);
          const hEnd = timeToMinutes(h.endTime);
          return (
            (currentSlotStart >= hStart && currentSlotStart < hEnd) ||
            (currentSlotEnd > hStart && currentSlotEnd <= hEnd)
          );
        });

        // Check if time has already passed today (including advance booking buffer)
        let isPastTime = false;
        if (targetDateStr === todayStr) {
          if (currentSlotStart <= currentMins + minAdvanceMins) {
            isPastTime = true;
          }
        }

        // Check if booked by appointment
        const existingAppt = dayAppointments.find((a) => {
          const aStart = timeToMinutes(a.startTime);
          const aEnd = timeToMinutes(a.endTime);
          return (
            (currentSlotStart >= aStart && currentSlotStart < aEnd) ||
            (currentSlotEnd > aStart && currentSlotEnd <= aEnd) ||
            (currentSlotStart <= aStart && currentSlotEnd >= aEnd)
          );
        });

        // Check if currently reserved
        const isReserved = activeReservations.some((r) => {
          const rStart = timeToMinutes(r.startTime);
          const rEnd = timeToMinutes(r.endTime);
          return (
            (currentSlotStart >= rStart && currentSlotStart < rEnd) ||
            (currentSlotEnd > rStart && currentSlotEnd <= rEnd)
          );
        });

        let isAvailable = true;
        let reason: string | undefined;

        if (isInBreak) {
          isAvailable = false;
          reason = 'Break Time';
        } else if (isHolidayBlocked) {
          isAvailable = false;
          reason = 'Doctor Unavailable (Partial Leave)';
        } else if (isPastTime) {
          isAvailable = false;
          reason = 'Time Passed / Past Booking Window';
        } else if (existingAppt) {
          isAvailable = false;
          reason = 'Booked';
        } else if (isReserved) {
          isAvailable = false;
          reason = 'Temporarily Reserved';
        }

        // Only add non-break slots to the schedule list, or mark reason
        if (!isInBreak) {
          slots.push({
            startTime: startStr,
            endTime: endStr,
            isAvailable,
            reason,
          });
        }

        currentSlotStart += stepDuration;
      }
    }

    const availableSlotsCount = slots.filter((s) => s.isAvailable).length;

    return {
      date: targetDateStr,
      isWorkingDay: true,
      totalSlots: slots.length,
      availableSlotsCount,
      slots,
      sessions,
    };
  }

  /**
   * Concurrency-safe atomic slot reservation.
   * Uses lock manager to guarantee that two simultaneous booking requests
   * for the exact same slot result in ONE winner and ONE 409 conflict error.
   */
  public async reserveAndValidateSlot(
    doctorId: string,
    date: string,
    startTime: string,
    patientId: string
  ): Promise<{ endTime: string; duration: number }> {
    const lockKey = `${doctorId}_${date}_${startTime}`;

    return await acquireSlotLock(lockKey, async () => {
      // Re-fetch availability strictly within the locked mutex
      const availability = await this.getDoctorAvailability(doctorId, date);

      if (!availability.isWorkingDay) {
        throw {
          status: 400,
          message: availability.statusReason || 'Doctor is not available on this date.',
        };
      }

      const matchingSlot = availability.slots.find((s) => s.startTime === startTime);
      if (!matchingSlot) {
        throw {
          status: 404,
          message: `Slot at ${startTime} on ${date} does not exist in doctor's consultation hours.`,
        };
      }

      if (!matchingSlot.isAvailable) {
        throw {
          status: 409,
          message: `Slot at ${startTime} on ${date} is no longer available (${matchingSlot.reason || 'occupied'}).`,
        };
      }

      // Check double-booking again against slotReservations
      const existingRes = db.slotReservations.find(
        (r) =>
          r.doctorId === doctorId &&
          r.date === date &&
          r.startTime === startTime &&
          ['RESERVED', 'BOOKED'].includes(r.status)
      );

      if (existingRes) {
        throw {
          status: 409,
          message: `Slot at ${startTime} on ${date} was just reserved by another patient.`,
        };
      }

      // Create an atomic reservation record
      const doctor = db.doctorProfiles.find((d) => d.id === doctorId);
      const duration = doctor?.consultationDuration || 15;
      const endTime = matchingSlot.endTime;

      const reservationId = 'RES-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      db.slotReservations.push({
        id: reservationId,
        doctorId,
        date,
        startTime,
        endTime,
        status: 'RESERVED',
        patientId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minute reservation window
        createdAt: new Date().toISOString(),
      });
      db.persist();

      return {
        endTime,
        duration,
      };
    });
  }
}

export const slotService = new SlotService();
