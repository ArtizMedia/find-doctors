/**
 * CuraLink API Client Module
 * Provides typed, error-handled access to the versioned backend REST endpoints (/api/v1).
 * Supports automatic token injection, session handling, and real-time SSE stream subscription.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('curalink_auth_token');
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem('curalink_auth_token', token);
    } else {
      localStorage.removeItem('curalink_auth_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 204) {
        return {} as T;
      }

      const contentType = response.headers.get('content-type');
      let data: any;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || `Request failed with status ${response.status}`;
        throw new ApiError(response.status, errorMsg, data);
      }

      return data as T;
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(500, err.message || 'Network error occurred while contacting the server.');
    }
  }

  // --- Auth APIs ---
  public async register(payload: any) {
    return this.request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async login(email: string, password: string) {
    return this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  public async logout() {
    try {
      await this.request<any>('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  public async getMe() {
    return this.request<any>('/auth/me');
  }

  public async forgotPassword(email: string) {
    return this.request<any>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // --- Patient APIs ---
  public async getPatientProfile() {
    return this.request<any>('/patients/me');
  }

  public async updatePatientProfile(payload: any) {
    return this.request<any>('/patients/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // --- Doctor Discovery APIs ---
  public async getDoctors(params: Record<string, any> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    });
    return this.request<any>(`/doctors?${query.toString()}`);
  }

  public async getNearbyDoctors(params: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    specializationId?: string;
    availableOnly?: boolean;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        query.append(key, String(val));
      }
    });
    return this.request<any>(`/doctors/nearby?${query.toString()}`);
  }

  public async getDoctorById(doctorId: string) {
    return this.request<any>(`/doctors/${doctorId}`);
  }

  public async getSpecializations() {
    return this.request<any>('/specializations');
  }

  // --- Schedules & Availability ---
  public async getDoctorAvailability(doctorId: string, date: string) {
    return this.request<any>(`/doctors/${doctorId}/availability?date=${date}`);
  }

  public async getDoctorSchedule() {
    return this.request<any>('/doctor/schedule');
  }

  public async updateWeeklySchedule(payload: any) {
    return this.request<any>('/doctor/schedule/weekly', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public async saveDateOverride(payload: any) {
    return this.request<any>('/doctor/schedule/date-overrides', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // --- Doctor Profile Management ---
  public async getDoctorMe() {
    return this.request<any>('/doctors/me');
  }

  public async updateDoctorProfile(payload: any) {
    return this.request<any>('/doctors/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // --- Appointments APIs ---
  public async bookAppointment(payload: {
    doctorId: string;
    appointmentDate: string;
    startTime: string;
    notes?: string;
    idempotencyKey?: string;
  }) {
    return this.request<any>('/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getMyPatientAppointments(type?: 'upcoming' | 'past' | 'cancelled') {
    const query = type ? `?type=${type}` : '';
    return this.request<any>(`/appointments/me${query}`);
  }

  public async getDoctorAppointments(params: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  } = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val) query.append(key, String(val));
    });
    return this.request<any>(`/appointments/doctor?${query.toString()}`);
  }

  public async getAppointmentDetails(appointmentId: string) {
    return this.request<any>(`/appointments/${appointmentId}`);
  }

  public async cancelAppointment(appointmentId: string, reason?: string) {
    return this.request<any>(`/appointments/${appointmentId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public async rescheduleAppointment(
    appointmentId: string,
    newDate: string,
    newStartTime: string,
    reason?: string
  ) {
    return this.request<any>(`/appointments/${appointmentId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ newDate, newStartTime, reason }),
    });
  }

  public async completeAppointment(appointmentId: string) {
    return this.request<any>(`/appointments/${appointmentId}/complete`, {
      method: 'POST',
    });
  }

  public async noShowAppointment(appointmentId: string) {
    return this.request<any>(`/appointments/${appointmentId}/no-show`, {
      method: 'POST',
    });
  }

  // --- Clinic Holidays ---
  public async getDoctorHolidays() {
    return this.request<any>('/doctor/holidays');
  }

  public async createDoctorHoliday(payload: {
    startDate: string;
    endDate: string;
    isFullDay?: boolean;
    startTime?: string;
    endTime?: string;
    reason: string;
  }) {
    return this.request<any>('/doctor/holidays', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async deleteDoctorHoliday(holidayId: string) {
    return this.request<any>(`/doctor/holidays/${holidayId}`, {
      method: 'DELETE',
    });
  }

  // --- Reports & CSV ---
  public async getDoctorReports(params: { dateFrom?: string; dateTo?: string } = {}) {
    const query = new URLSearchParams();
    if (params.dateFrom) query.append('dateFrom', params.dateFrom);
    if (params.dateTo) query.append('dateTo', params.dateTo);
    return this.request<any>(`/doctor/reports?${query.toString()}`);
  }

  public getCsvExportUrl(): string {
    return `${API_BASE_URL}/doctor/reports/csv`;
  }

  // --- Notifications ---
  public async getNotifications() {
    return this.request<any>('/notifications');
  }

  public async markNotificationRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  public async markAllNotificationsRead() {
    return this.request<any>('/notifications/read-all', { method: 'POST' });
  }

  public subscribeToNotifications(
    userId: string,
    onMessage: (data: any) => void
  ): () => void {
    const eventSource = new EventSource(`${API_BASE_URL}/notifications/stream?userId=${userId}`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.addEventListener('NOTIFICATION', (event: any) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage({ type: 'NOTIFICATION', data: parsed });
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    });

    return () => {
      eventSource.close();
    };
  }

  // --- Admin APIs ---
  public async getAdminStats() {
    return this.request<any>('/admin/stats');
  }

  public async getAdminDoctors(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request<any>(`/admin/doctors${query}`);
  }

  public async verifyDoctor(doctorId: string, status: string, notes?: string) {
    return this.request<any>(`/admin/doctors/${doctorId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    });
  }

  public async getAuditLogs() {
    return this.request<any>('/admin/audit-logs');
  }

  // --- Automated Tests ---
  public async runTests() {
    return this.request<any>('/tests/run');
  }
}

export const api = new ApiClient();
