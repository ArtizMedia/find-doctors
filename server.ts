import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './server/db/database.ts';

// Routes
import authRoutes from './server/routes/auth.ts';
import patientRoutes from './server/routes/patients.ts';
import doctorRoutes from './server/routes/doctors.ts';
import scheduleRoutes from './server/routes/schedules.ts';
import appointmentRoutes from './server/routes/appointments.ts';
import holidayRoutes from './server/routes/holidays.ts';
import notificationRoutes from './server/routes/notifications.ts';
import specializationRoutes from './server/routes/specializations.ts';
import adminRoutes from './server/routes/admin.ts';
import reportRoutes from './server/routes/reports.ts';
import openApiRoutes from './server/routes/openapi.ts';
import { runAllTests } from './server/tests/booking.test.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body Parsers & Security Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS headers for API
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Idempotency-Key');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Initialize Database & Seed
await db.init();

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/doctor/holidays', holidayRoutes);
app.use('/api/v1/doctor/reports', reportRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/specializations', specializationRoutes);
app.use('/api/v1/clinics', specializationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', scheduleRoutes);
app.use('/api/v1', openApiRoutes);
app.use('/api', openApiRoutes); // Provides /api/docs Swagger UI

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    version: '1.0.0',
    system: 'CuraLink Doctor Appointment Booking System',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Automated Test Runner Endpoint
app.get('/api/v1/tests/run', async (_req: Request, res: Response) => {
  try {
    const testSummary = await runAllTests();
    res.json(testSummary);
  } catch (err: any) {
    res.status(500).json({ error: 'Test execution failed', message: err.message });
  }
});

// Catch-all for undefined API routes
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'API Endpoint Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

// Vite Middleware for Frontend Serving in Dev / Static Dist in Prod
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CuraLink Server running at http://0.0.0.0:${PORT}`);
    console.log(`📖 API Documentation available at http://localhost:${PORT}/api/docs`);
    console.log(`🩺 Automated Tests available at http://localhost:${PORT}/api/v1/tests/run`);
  });
}

startServer();
