import { Router, Request, Response } from 'express';
import { db } from '../db/database.ts';

const router = Router();

// GET /api/v1/specializations
router.get('/', (_req: Request, res: Response): void => {
  res.json({
    total: db.specializations.length,
    specializations: db.specializations,
  });
});

// GET /api/v1/clinics/:clinicId
router.get('/:clinicId', (req: Request, res: Response): void => {
  const { clinicId } = req.params;
  const clinic = db.clinics.find((c) => c.id === clinicId);

  if (!clinic) {
    res.status(404).json({ error: 'Clinic not found' });
    return;
  }

  res.json({ clinic });
});

export default router;
