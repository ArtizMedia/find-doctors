import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

// GET /api/v1/doctor/reports
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

    const { dateFrom, dateTo } = req.query;
    let list = db.appointments.filter((a) => a.doctorId === doctor.id);

    if (dateFrom) {
      list = list.filter((a) => a.appointmentDate >= (dateFrom as string));
    }
    if (dateTo) {
      list = list.filter((a) => a.appointmentDate <= (dateTo as string));
    }

    const total = list.length;
    const confirmed = list.filter((a) => a.status === 'CONFIRMED').length;
    const completed = list.filter((a) => a.status === 'COMPLETED').length;
    const cancelled = list.filter((a) => a.status === 'CANCELLED').length;
    const noShow = list.filter((a) => a.status === 'NO_SHOW').length;
    const rescheduled = list.filter((a) => a.status === 'RESCHEDULED').length;

    // Financial reporting: Only calculate earned consultation fees for completed or confirmed (excluding cancelled/no-show)
    const completedFeeTotal = list
      .filter((a) => a.status === 'COMPLETED')
      .reduce((sum, a) => sum + (a.consultationFee || 0), 0);

    const projectedConfirmedFeeTotal = list
      .filter((a) => ['CONFIRMED', 'COMPLETED'].includes(a.status))
      .reduce((sum, a) => sum + (a.consultationFee || 0), 0);

    // Grouping by Date
    const byDateMap: Record<string, number> = {};
    for (const a of list) {
      byDateMap[a.appointmentDate] = (byDateMap[a.appointmentDate] || 0) + 1;
    }

    res.json({
      summary: {
        total,
        confirmed,
        completed,
        cancelled,
        noShow,
        rescheduled,
        completedFeeTotal,
        projectedConfirmedFeeTotal,
      },
      appointmentsByDate: byDateMap,
      recentRecords: list.slice(0, 50),
    });
  }
);

// GET /api/v1/doctor/reports/csv (CSV Export)
router.get(
  '/csv',
  authenticateToken,
  requireRole('DOCTOR'),
  (req: AuthenticatedRequest, res: Response): void => {
    const doctor = db.doctorProfiles.find((d) => d.userId === req.user?.id);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor profile not found' });
      return;
    }

    const list = db.appointments.filter((a) => a.doctorId === doctor.id);

    const headers = [
      'Appointment ID',
      'Date',
      'Start Time',
      'End Time',
      'Patient Name',
      'Patient Contact',
      'Status',
      'Fee (INR)',
      'Payment Status',
      'Created At',
      'Notes',
    ];

    const rows = list.map((a) => [
      `"${a.appointmentId}"`,
      `"${a.appointmentDate}"`,
      `"${a.startTime}"`,
      `"${a.endTime}"`,
      `"${a.patientName.replace(/"/g, '""')}"`,
      `"${a.patientPhone}"`,
      `"${a.status}"`,
      `"${a.consultationFee}"`,
      `"${a.paymentStatus}"`,
      `"${a.createdAt}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="appointments-report-${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  }
);

export default router;
