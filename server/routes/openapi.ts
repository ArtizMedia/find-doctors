import { Router, Request, Response } from 'express';

const router = Router();

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'CuraLink Doctor Appointment Booking System API',
    version: '1.0.0',
    description:
      'Production-oriented REST API for Patient and Doctor applications with atomic concurrency-safe booking, schedule management, clinic closures, and role-based access control.',
    contact: {
      name: 'CuraLink Healthcare Platform Engineering',
      email: 'engineering@curalink.com',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current Environment API Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT token obtained from /api/v1/auth/login or /api/v1/auth/register',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'USR-1697200000' },
          email: { type: 'string', format: 'email', example: 'patient@curalink.com' },
          role: { type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'], example: 'PATIENT' },
          emailVerified: { type: 'boolean', example: true },
        },
      },
      PatientProfile: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'PAT-1' },
          userId: { type: 'string', example: 'USR-1' },
          fullName: { type: 'string', example: 'Rahul Sharma' },
          mobile: { type: 'string', example: '+91 98470 12345' },
          preferredLocation: { type: 'string', example: 'Kochi, Kerala' },
          address: { type: 'string', example: 'MG Road, Ernakulam' },
          latitude: { type: 'number', example: 9.9816 },
          longitude: { type: 'number', example: 76.2798 },
        },
      },
      DoctorProfile: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'doc-1' },
          fullName: { type: 'string', example: 'Dr. Vineth Menon' },
          specializationName: { type: 'string', example: 'Cardiology' },
          qualifications: { type: 'string', example: 'MBBS, MD, DM' },
          registrationNumber: { type: 'string', example: 'KMC-48291' },
          experienceYears: { type: 'number', example: 16 },
          clinicName: { type: 'string', example: 'Apex Heart & Wellness Center' },
          clinicAddress: { type: 'string', example: 'MG Road, Marine Drive, Ernakulam' },
          district: { type: 'string', example: 'Ernakulam' },
          consultationFee: { type: 'number', example: 700 },
          consultationDuration: { type: 'number', example: 15 },
          verificationStatus: { type: 'string', enum: ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'], example: 'VERIFIED' },
        },
      },
      Appointment: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'APPT-1' },
          appointmentId: { type: 'string', example: 'APPT-20261015-4921' },
          patientId: { type: 'string', example: 'pat-1' },
          doctorId: { type: 'string', example: 'doc-1' },
          appointmentDate: { type: 'string', format: 'date', example: '2026-10-15' },
          startTime: { type: 'string', example: '10:00' },
          endTime: { type: 'string', example: '10:15' },
          status: {
            type: 'string',
            enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'],
            example: 'CONFIRMED',
          },
          consultationFee: { type: 'number', example: 700 },
          patientName: { type: 'string', example: 'Rahul Sharma' },
          doctorName: { type: 'string', example: 'Dr. Vineth Menon' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Booking Conflict' },
          message: { type: 'string', example: 'Slot at 10:00 on 2026-10-15 is no longer available.' },
        },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new patient or doctor account',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'fullName', 'mobile'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                  fullName: { type: 'string' },
                  mobile: { type: 'string' },
                  role: { type: 'string', enum: ['PATIENT', 'DOCTOR'], default: 'PATIENT' },
                  preferredLocation: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User registered successfully' },
          '400': { description: 'Validation error' },
          '409': { description: 'Email already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate and retrieve JWT token',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login successful with token and profile' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/doctors/nearby': {
      get: {
        summary: 'Find doctors within radius using geospatial coordinates',
        tags: ['Doctor Discovery'],
        parameters: [
          { name: 'latitude', in: 'query', required: true, schema: { type: 'number' } },
          { name: 'longitude', in: 'query', required: true, schema: { type: 'number' } },
          { name: 'radiusKm', in: 'query', schema: { type: 'number', default: 50 } },
          { name: 'specializationId', in: 'query', schema: { type: 'string' } },
          { name: 'availableOnly', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: {
          '200': { description: 'List of doctors sorted by distance in kilometers' },
          '400': { description: 'Invalid coordinates' },
        },
      },
    },
    '/doctors/{doctorId}/availability': {
      get: {
        summary: 'Calculate real-time bookable slots for a doctor on a specific date',
        tags: ['Doctor Discovery', 'Schedules'],
        parameters: [
          { name: 'doctorId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': { description: 'Bookable slots, breaks, sessions, and closure reason if closed' },
          '404': { description: 'Doctor not found' },
        },
      },
    },
    '/appointments': {
      post: {
        summary: 'Atomically reserve and book a consultation slot (Patient)',
        tags: ['Appointments'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['doctorId', 'appointmentDate', 'startTime'],
                properties: {
                  doctorId: { type: 'string' },
                  appointmentDate: { type: 'string', format: 'date' },
                  startTime: { type: 'string', example: '10:00' },
                  notes: { type: 'string' },
                  idempotencyKey: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Appointment confirmed' },
          '409': { description: 'Slot conflict or already reserved' },
        },
      },
    },
    '/appointments/{appointmentId}/cancel': {
      post: {
        summary: 'Cancel an appointment and release reserved slot',
        tags: ['Appointments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'appointmentId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Appointment cancelled and slot released' },
          '403': { description: 'Unauthorized' },
        },
      },
    },
    '/appointments/{appointmentId}/reschedule': {
      post: {
        summary: 'Reschedule appointment to a new date and time atomically',
        tags: ['Appointments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'appointmentId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newDate', 'newStartTime'],
                properties: {
                  newDate: { type: 'string', format: 'date' },
                  newStartTime: { type: 'string', example: '11:00' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Appointment rescheduled successfully' },
          '409': { description: 'New slot unavailable or occupied' },
        },
      },
    },
    '/doctor/holidays': {
      post: {
        summary: 'Declare clinic holiday or closure with affected booking detection',
        tags: ['Doctor Holidays'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['startDate', 'endDate', 'reason'],
                properties: {
                  startDate: { type: 'string', format: 'date' },
                  endDate: { type: 'string', format: 'date' },
                  isFullDay: { type: 'boolean', default: true },
                  startTime: { type: 'string' },
                  endTime: { type: 'string' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Holiday saved and affected bookings marked for resolution' },
        },
      },
    },
  },
};

// GET /api/v1/openapi.json
router.get('/openapi.json', (_req: Request, res: Response): void => {
  res.json(openApiSpec);
});

// GET /api/docs (Interactive Swagger UI via CDN)
router.get('/docs', (_req: Request, res: Response): void => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CuraLink REST API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { background-color: #0f766e !important; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
  `);
});

export default router;
