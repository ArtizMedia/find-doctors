import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  ShieldCheck,
  Search,
  Bell,
  User,
  LogOut,
  Building2,
  CalendarDays,
  FileSpreadsheet,
  Settings,
  AlertTriangle,
  Play,
  FileText,
  HeartPulse,
  Sparkles,
  Baby,
  Bone,
  Brain,
  Activity,
  Ear,
  RotateCcw,
  Ban,
  Check,
  Award,
} from 'lucide-react';
import { api, ApiError } from './api/client.ts';

// Available Specialization Icons Map
const SPEC_ICONS: Record<string, React.ReactNode> = {
  Cardiology: <HeartPulse className="w-5 h-5 text-rose-500" />,
  Dermatology: <Sparkles className="w-5 h-5 text-purple-500" />,
  Pediatrics: <Baby className="w-5 h-5 text-amber-500" />,
  'General Medicine': <Stethoscope className="w-5 h-5 text-teal-600" />,
  Orthopedics: <Bone className="w-5 h-5 text-blue-500" />,
  Neurology: <Brain className="w-5 h-5 text-indigo-500" />,
  'ENT Specialist': <Ear className="w-5 h-5 text-emerald-600" />,
  'Gynecology & Obstetrics': <Activity className="w-5 h-5 text-pink-500" />,
};

// Preset Locations in Kerala for Instant Proximity Testing
const KERALA_PRESETS = [
  { name: 'Kochi (Ernakulam)', lat: 9.9816, lng: 76.2798 },
  { name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366 },
  { name: 'Kozhikode', lat: 11.2588, lng: 75.7804 },
  { name: 'Thrissur', lat: 10.5276, lng: 76.2144 },
];

export default function App() {
  // Navigation & Role State
  const [activePortal, setActivePortal] = useState<'PATIENT' | 'DOCTOR' | 'ADMIN' | 'API_DOCS'>('PATIENT');
  const [patientTab, setPatientTab] = useState<'DISCOVER' | 'MY_APPOINTMENTS' | 'NOTIFICATIONS' | 'PROFILE'>('DISCOVER');
  const [doctorTab, setDoctorTab] = useState<'OVERVIEW' | 'DAILY' | 'SCHEDULE' | 'HOLIDAYS' | 'REPORTS'>('OVERVIEW');

  // Auth State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authRole, setAuthRole] = useState<'PATIENT' | 'DOCTOR'>('PATIENT');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authMobile, setAuthMobile] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Patient Location & Filter State
  const [userLocation, setUserLocation] = useState({
    name: 'Kochi (Ernakulam)',
    lat: 9.9816,
    lng: 76.2798,
  });
  const [radiusKm, setRadiusKm] = useState(25);
  const [selectedSpec, setSelectedSpec] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Booking Flow State
  const [bookingDoctor, setBookingDoctor] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [availability, setAvailability] = useState<any | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccessAppt, setBookingSuccessAppt] = useState<any | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Patient Appointments State
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const [apptFilter, setApptFilter] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [loadingPatientAppts, setLoadingPatientAppts] = useState(false);

  // Reschedule & Cancel Modal States
  const [actionAppt, setActionAppt] = useState<any | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [rescheduleAvailability, setRescheduleAvailability] = useState<any | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; body: string } | null>(null);

  // Doctor Dashboard State
  const [doctorAppts, setDoctorAppts] = useState<any[]>([]);
  const [doctorSelectedDate, setDoctorSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [doctorReports, setDoctorReports] = useState<any | null>(null);
  const [doctorSchedule, setDoctorSchedule] = useState<any | null>(null);
  const [doctorHolidays, setDoctorHolidays] = useState<any[]>([]);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [newHolidayStart, setNewHolidayStart] = useState('');
  const [newHolidayEnd, setNewHolidayEnd] = useState('');
  const [newHolidayReason, setNewHolidayReason] = useState('');
  const [newHolidayFullDay, setNewHolidayFullDay] = useState(true);
  const [newHolidayStartTime, setNewHolidayStartTime] = useState('09:00');
  const [newHolidayEndTime, setNewHolidayEndTime] = useState('13:00');
  const [scheduleConflicts, setScheduleConflicts] = useState<any[] | null>(null);

  // Admin Verification State
  const [adminDoctors, setAdminDoctors] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any | null>(null);
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Automated Tests State
  const [testResults, setTestResults] = useState<any | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  // Initial Load: check session & fetch data
  const checkSession = useCallback(async () => {
    try {
      const data = await api.getMe();
      if (data && data.user) {
        setCurrentUser(data.user);
        setCurrentProfile(data.profile);
      }
    } catch {
      // Not logged in or expired
      setCurrentUser(null);
      setCurrentProfile(null);
    }
  }, []);

  const fetchSpecializations = useCallback(async () => {
    try {
      const res = await api.getSpecializations();
      setSpecializations(res.specializations || []);
    } catch (err) {
      console.error('Failed to load specializations:', err);
    }
  }, []);

  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    try {
      const res = await api.getNearbyDoctors({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        radiusKm,
        specializationId: selectedSpec || undefined,
      });
      setDoctors(res.doctors || []);
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoadingDoctors(false);
    }
  }, [userLocation, radiusKm, selectedSpec]);

  const fetchPatientAppointments = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'PATIENT') return;
    setLoadingPatientAppts(true);
    try {
      const res = await api.getMyPatientAppointments(apptFilter);
      setPatientAppointments(res.appointments || []);
    } catch (err) {
      console.error('Failed to fetch patient appointments:', err);
    } finally {
      setLoadingPatientAppts(false);
    }
  }, [currentUser, apptFilter]);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadNotifCount(res.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [currentUser]);

  // Doctor Portal Data Fetchers
  const fetchDoctorDashboardData = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'DOCTOR') return;
    try {
      const [apptsRes, schedRes, holRes, repRes] = await Promise.all([
        api.getDoctorAppointments({ date: doctorSelectedDate }),
        api.getDoctorSchedule(),
        api.getDoctorHolidays(),
        api.getDoctorReports(),
      ]);
      setDoctorAppts(apptsRes.appointments || []);
      setDoctorSchedule(schedRes.schedule);
      setDoctorHolidays(holRes.holidays || []);
      setDoctorReports(repRes);
    } catch (err) {
      console.error('Failed to fetch doctor dashboard data:', err);
    }
  }, [currentUser, doctorSelectedDate]);

  // Admin Portal Data Fetchers
  const fetchAdminData = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    setAdminLoading(true);
    try {
      const [statsRes, docsRes, logsRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminDoctors(),
        api.getAuditLogs(),
      ]);
      setAdminStats(statsRes);
      setAdminDoctors(docsRes.doctors || []);
      setAdminAuditLogs(logsRes.logs || []);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setAdminLoading(false);
    }
  }, [currentUser]);

  // Subscribe to Real-Time Server-Sent Events (SSE)
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = api.subscribeToNotifications(currentUser.id, (payload) => {
      if (payload.type === 'NOTIFICATION' || payload.event === 'NOTIFICATION') {
        const notif = payload.data;
        setToastMessage({ title: notif.title, body: notif.message });
        setNotifications((prev) => [notif, ...prev]);
        setUnreadNotifCount((prev) => prev + 1);

        // Refresh relevant lists in real-time
        if (currentUser.role === 'PATIENT') fetchPatientAppointments();
        if (currentUser.role === 'DOCTOR') fetchDoctorDashboardData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser, fetchPatientAppointments, fetchDoctorDashboardData]);

  useEffect(() => {
    checkSession();
    fetchSpecializations();
  }, [checkSession, fetchSpecializations]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    if (currentUser?.role === 'PATIENT') {
      fetchPatientAppointments();
    }
  }, [currentUser, fetchPatientAppointments]);

  useEffect(() => {
    fetchNotifications();
  }, [currentUser, fetchNotifications]);

  useEffect(() => {
    if (activePortal === 'DOCTOR' && currentUser?.role === 'DOCTOR') {
      fetchDoctorDashboardData();
    }
  }, [activePortal, currentUser, fetchDoctorDashboardData]);

  useEffect(() => {
    if (activePortal === 'ADMIN' && currentUser?.role === 'ADMIN') {
      fetchAdminData();
    }
  }, [activePortal, currentUser, fetchAdminData]);

  // Fetch slot availability for booking modal
  useEffect(() => {
    if (!bookingDoctor || !bookingDate) return;
    let isCancelled = false;
    setLoadingAvailability(true);
    setSelectedSlot(null);
    setBookingError(null);

    api
      .getDoctorAvailability(bookingDoctor.id, bookingDate)
      .then((res) => {
        if (!isCancelled) {
          setAvailability(res);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setBookingError(err.message || 'Failed to calculate available slots');
        }
      })
      .finally(() => {
        if (!isCancelled) setLoadingAvailability(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [bookingDoctor, bookingDate]);

  // Fetch slot availability for reschedule modal
  useEffect(() => {
    if (!actionAppt || !rescheduleDate) return;
    let isCancelled = false;
    api
      .getDoctorAvailability(actionAppt.doctorId, rescheduleDate)
      .then((res) => {
        if (!isCancelled) setRescheduleAvailability(res);
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [actionAppt, rescheduleDate]);

  // Handle Quick Login
  const handleQuickLogin = async (email: string, pass: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await api.login(email, pass);
      api.setToken(res.token);
      setCurrentUser(res.user);
      setCurrentProfile(res.profile);
      setAuthModalOpen(false);

      if (res.user.role === 'DOCTOR') {
        setActivePortal('DOCTOR');
      } else if (res.user.role === 'ADMIN') {
        setActivePortal('ADMIN');
      } else {
        setActivePortal('PATIENT');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Auth Form Submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'LOGIN') {
        const res = await api.login(authEmail, authPassword);
        api.setToken(res.token);
        setCurrentUser(res.user);
        setCurrentProfile(res.profile);
        setAuthModalOpen(false);
        if (res.user.role === 'DOCTOR') setActivePortal('DOCTOR');
        else if (res.user.role === 'ADMIN') setActivePortal('ADMIN');
        else setActivePortal('PATIENT');
      } else {
        const res = await api.register({
          email: authEmail,
          password: authPassword,
          fullName: authFullName,
          mobile: authMobile,
          role: authRole,
          preferredLocation: userLocation.name,
        });
        api.setToken(res.token);
        setCurrentUser(res.user);
        setAuthModalOpen(false);
        if (authRole === 'DOCTOR') {
          setActivePortal('DOCTOR');
          alert('Doctor account registered! Verification is currently PENDING administrative review.');
        } else {
          setActivePortal('PATIENT');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setCurrentProfile(null);
    setActivePortal('PATIENT');
  };

  // GPS Location Trigger
  const handleGetGPSLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          name: 'My Current Location (GPS)',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        alert(`Location permission denied or unavailable: ${err.message}. Please select your location manually.`);
      }
    );
  };

  // Handle Appointment Booking Submission
  const handleConfirmBooking = async () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!bookingDoctor || !bookingDate || !selectedSlot) return;

    setBookingSubmitting(true);
    setBookingError(null);

    // Concurrency safe & idempotent booking request
    const idempotencyKey = 'REQ-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    try {
      const res = await api.bookAppointment({
        doctorId: bookingDoctor.id,
        appointmentDate: bookingDate,
        startTime: selectedSlot,
        notes: bookingNotes,
        idempotencyKey,
      });

      setBookingSuccessAppt(res.appointment);
      fetchPatientAppointments();
      fetchNotifications();
    } catch (err: any) {
      setBookingError(err.message || 'Booking conflict or server error');
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Handle Cancellation
  const handleConfirmCancel = async () => {
    if (!actionAppt) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.cancelAppointment(actionAppt.id, cancelReason);
      setCancelModalOpen(false);
      setActionAppt(null);
      setCancelReason('');
      fetchPatientAppointments();
      fetchDoctorDashboardData();
      fetchNotifications();
    } catch (err: any) {
      setActionError(err.message || 'Cancellation failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Rescheduling
  const handleConfirmReschedule = async () => {
    if (!actionAppt || !rescheduleDate || !rescheduleSlot) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.rescheduleAppointment(actionAppt.id, rescheduleDate, rescheduleSlot, rescheduleReason);
      setRescheduleModalOpen(false);
      setActionAppt(null);
      setRescheduleDate('');
      setRescheduleSlot(null);
      fetchPatientAppointments();
      fetchDoctorDashboardData();
      fetchNotifications();
    } catch (err: any) {
      setActionError(err.message || 'Rescheduling failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Run Automated Backend Tests
  const handleRunTests = async () => {
    setRunningTests(true);
    try {
      const res = await api.runTests();
      setTestResults(res);
    } catch (err: any) {
      alert(`Test run failed: ${err.message}`);
    } finally {
      setRunningTests(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-teal-900 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 border border-teal-700 animate-slide-up max-w-md">
          <Bell className="w-5 h-5 text-teal-300 mt-0.5 shrink-0 animate-bounce" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{toastMessage.title}</h4>
            <p className="text-xs text-teal-100 mt-0.5">{toastMessage.body}</p>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-teal-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-teal-600 text-white p-2 rounded-xl shadow-sm">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  Cura<span className="text-teal-600">Link</span>
                </span>
                <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 rounded-full uppercase">
                  Production Healthcare System
                </span>
              </div>
            </div>

            {/* Portal Switcher Tabs */}
            <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActivePortal('PATIENT')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activePortal === 'PATIENT' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Patient Portal
              </button>
              <button
                onClick={() => {
                  if (!currentUser || currentUser.role !== 'DOCTOR') {
                    // Prompt quick login or auth
                    handleQuickLogin('dr.menon@curalink.com', 'Password@123');
                  }
                  setActivePortal('DOCTOR');
                }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activePortal === 'DOCTOR' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Doctor Dashboard</span>
                {currentUser?.role === 'DOCTOR' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </button>
              <button
                onClick={() => {
                  if (!currentUser || currentUser.role !== 'ADMIN') {
                    handleQuickLogin('admin@curalink.com', 'Password@123');
                  }
                  setActivePortal('ADMIN');
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activePortal === 'ADMIN' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin Console
              </button>
              <button
                onClick={() => setActivePortal('API_DOCS')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  activePortal === 'API_DOCS' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>API Docs & Tests</span>
              </button>
            </div>

            {/* Right Controls: Notifications & Auth Profile */}
            <div className="flex items-center gap-3">
              {/* Notifications Bell */}
              <div className="relative">
                <button
                  onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                  className="p-2 text-slate-500 hover:text-slate-700 relative rounded-lg hover:bg-slate-100 transition-colors"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notifDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900">Notifications</h4>
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full font-medium text-slate-600">
                          {notifications.length}
                        </span>
                      </div>
                      {unreadNotifCount > 0 && (
                        <button
                          onClick={async () => {
                            await api.markAllNotificationsRead();
                            fetchNotifications();
                          }}
                          className="text-xs text-teal-600 hover:text-teal-700 font-semibold"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="mt-2 max-h-72 overflow-y-auto space-y-2 divide-y divide-slate-50">
                      {notifications.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">No notifications yet.</div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`pt-2 text-xs cursor-pointer p-2 rounded-lg transition-colors ${
                              n.isRead ? 'bg-white opacity-75' : 'bg-teal-50/60 font-medium'
                            }`}
                            onClick={async () => {
                              if (!n.isRead) {
                                await api.markNotificationRead(n.id);
                                fetchNotifications();
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800">{n.title}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile / Login Button */}
              {currentUser ? (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                    {currentUser.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="hidden lg:block text-left text-xs">
                    <p className="font-bold text-slate-900 truncate max-w-[120px]">
                      {currentUser.fullName || currentUser.email.split('@')[0]}
                    </p>
                    <span className="text-[10px] text-teal-600 font-medium capitalize">
                      {currentUser.role.toLowerCase()}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setAuthModalOpen(true);
                  }}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Portal Navigation */}
        <div className="flex md:hidden border-t border-slate-100 px-4 py-2 bg-slate-50 gap-2 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActivePortal('PATIENT')}
            className={`px-3 py-1 rounded-lg ${activePortal === 'PATIENT' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}
          >
            Patient
          </button>
          <button
            onClick={() => {
              if (currentUser?.role !== 'DOCTOR') handleQuickLogin('dr.menon@curalink.com', 'Password@123');
              setActivePortal('DOCTOR');
            }}
            className={`px-3 py-1 rounded-lg ${activePortal === 'DOCTOR' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}
          >
            Doctor
          </button>
          <button
            onClick={() => {
              if (currentUser?.role !== 'ADMIN') handleQuickLogin('admin@curalink.com', 'Password@123');
              setActivePortal('ADMIN');
            }}
            className={`px-3 py-1 rounded-lg ${activePortal === 'ADMIN' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}
          >
            Admin
          </button>
          <button
            onClick={() => setActivePortal('API_DOCS')}
            className={`px-3 py-1 rounded-lg ${activePortal === 'API_DOCS' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}
          >
            API & Tests
          </button>
        </div>
      </header>

      {/* Quick Demo Switcher Bar */}
      <div className="bg-slate-100 border-b border-slate-200 py-1.5 px-4 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Quick Test Accounts:</span>
          <button
            onClick={() => handleQuickLogin('dr.menon@curalink.com', 'Password@123')}
            className="bg-white hover:bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-md font-medium text-teal-700"
          >
            Dr. Vineth Menon (Doctor)
          </button>
          <button
            onClick={() => handleQuickLogin('patient@curalink.com', 'Password@123')}
            className="bg-white hover:bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-md font-medium text-blue-700"
          >
            Rahul Sharma (Patient)
          </button>
          <button
            onClick={() => handleQuickLogin('admin@curalink.com', 'Password@123')}
            className="bg-white hover:bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-md font-medium text-purple-700"
          >
            Administrator
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500">Deployment Region: <b>Kerala, India (Asia/Kolkata)</b></span>
          <button
            onClick={handleRunTests}
            disabled={runningTests}
            className="bg-teal-600 text-white hover:bg-teal-700 px-2.5 py-0.5 rounded-md font-semibold flex items-center gap-1 shadow-2xs"
          >
            <Play className="w-3 h-3" />
            <span>{runningTests ? 'Running Suite...' : 'Run Automated Tests'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ========================================================
            1. PATIENT PORTAL
           ======================================================== */}
        {activePortal === 'PATIENT' && (
          <div>
            {/* Patient Sub Navigation */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
              <div className="flex gap-4">
                <button
                  onClick={() => setPatientTab('DISCOVER')}
                  className={`text-sm font-semibold pb-3 -mb-3 border-b-2 transition-all ${
                    patientTab === 'DISCOVER'
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Find Doctors & Clinics
                </button>
                <button
                  onClick={() => {
                    if (!currentUser) setAuthModalOpen(true);
                    else setPatientTab('MY_APPOINTMENTS');
                  }}
                  className={`text-sm font-semibold pb-3 -mb-3 border-b-2 transition-all flex items-center gap-1.5 ${
                    patientTab === 'MY_APPOINTMENTS'
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>My Appointments</span>
                  {patientAppointments.length > 0 && (
                    <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {patientAppointments.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Location Badge & Selector */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs text-xs">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="font-semibold text-slate-700 max-w-[150px] truncate">{userLocation.name}</span>
                <select
                  aria-label="Preset Location"
                  className="bg-transparent text-slate-500 font-medium focus:outline-hidden cursor-pointer"
                  value={userLocation.name}
                  onChange={(e) => {
                    const preset = KERALA_PRESETS.find((p) => p.name === e.target.value);
                    if (preset) {
                      setUserLocation(preset);
                    }
                  }}
                >
                  {KERALA_PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleGetGPSLocation}
                  className="text-teal-600 hover:text-teal-700 font-semibold pl-1 border-l border-slate-200"
                  title="Use my device GPS"
                >
                  GPS
                </button>
              </div>
            </div>

            {/* TAB: FIND DOCTORS */}
            {patientTab === 'DISCOVER' && (
              <div className="space-y-6">
                {/* Search & Proximity Filters */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-6 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="Search doctor name, clinic, or condition..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <select
                        aria-label="Filter by Medical Specialization"
                        value={selectedSpec}
                        onChange={(e) => setSelectedSpec(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-white text-slate-700"
                      >
                        <option value="">All Specializations</option>
                        {specializations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3 flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500 shrink-0">Radius:</span>
                      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold w-full">
                        {[5, 10, 25, 50].map((r) => (
                          <button
                            key={r}
                            onClick={() => setRadiusKm(r)}
                            className={`flex-1 py-1 rounded-lg transition-colors ${
                              radiusKm === r ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {r}km
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Specialization Icon Quick Filters */}
                  <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                    <button
                      onClick={() => setSelectedSpec('')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                        selectedSpec === '' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All ({doctors.length})
                    </button>
                    {specializations.map((spec) => (
                      <button
                        key={spec.id}
                        onClick={() => setSelectedSpec(spec.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
                          selectedSpec === spec.id
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {SPEC_ICONS[spec.name] || <Stethoscope className="w-3.5 h-3.5" />}
                        <span>{spec.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Doctor Listing */}
                {loadingDoctors ? (
                  <div className="py-20 text-center text-slate-400 space-y-2">
                    <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm font-medium">Calculating proximity and available doctors...</p>
                  </div>
                ) : doctors.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">No doctors found within {radiusKm} km</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Try expanding your search radius to 50 km or choose another district from the location picker above.
                    </p>
                    <button
                      onClick={() => setRadiusKm(50)}
                      className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700"
                    >
                      Expand to 50 km
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {doctors
                      .filter((d) => {
                        if (!searchQuery) return true;
                        const q = searchQuery.toLowerCase();
                        return (
                          d.fullName.toLowerCase().includes(q) ||
                          d.specializationName.toLowerCase().includes(q) ||
                          d.clinicName.toLowerCase().includes(q) ||
                          d.district.toLowerCase().includes(q)
                        );
                      })
                      .map((doc) => (
                        <div
                          key={doc.id}
                          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                        >
                          <div>
                            {/* Doctor Header */}
                            <div className="flex items-start gap-4">
                              <img
                                src={doc.profilePhoto}
                                alt={doc.fullName}
                                className="w-16 h-16 rounded-2xl object-cover border border-slate-100 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="font-bold text-base text-slate-900 truncate">{doc.fullName}</h3>
                                  {doc.verificationStatus === 'VERIFIED' && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      title="Verified Medical Practitioner (Kerala Medical Council)"
                                    >
                                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                      <span>Verified</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-semibold text-teal-700">{doc.specializationName}</p>
                                <p className="text-[11px] text-slate-500 truncate">{doc.qualifications}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Reg: <b>{doc.registrationNumber}</b> • {doc.experienceYears} yrs exp.
                                </p>
                              </div>
                            </div>

                            {/* Clinic & Distance */}
                            <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                              <div className="flex items-center gap-2 text-slate-700">
                                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="font-medium truncate">{doc.clinicName}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                <span className="truncate max-w-[180px]">{doc.clinicAddress}</span>
                                <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md shrink-0">
                                  {doc.distanceKm !== undefined ? `${doc.distanceKm} km away` : 'Kerala'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Fee & Action Button */}
                          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-[11px] text-slate-400 block">Consultation Fee</span>
                              <span className="text-base font-bold text-slate-900">₹{doc.consultationFee}</span>
                              <span className="text-[10px] text-slate-400 ml-1">/ {doc.consultationDuration} min</span>
                            </div>
                            <button
                              onClick={() => {
                                setBookingDoctor(doc);
                                setBookingSuccessAppt(null);
                              }}
                              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Book Slot</span>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: MY APPOINTMENTS */}
            {patientTab === 'MY_APPOINTMENTS' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs">
                    {(['upcoming', 'past', 'cancelled'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setApptFilter(tab)}
                        className={`px-4 py-1.5 rounded-lg capitalize transition-all ${
                          apptFilter === tab ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={fetchPatientAppointments}
                    className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                {loadingPatientAppts ? (
                  <div className="py-20 text-center text-slate-400">Loading your appointments...</div>
                ) : patientAppointments.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="font-bold text-slate-700 text-sm">No {apptFilter} appointments found</h4>
                    <p className="text-xs text-slate-400">You don't have any appointments in this category.</p>
                    <button
                      onClick={() => setPatientTab('DISCOVER')}
                      className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700"
                    >
                      Find a Doctor Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {patientAppointments.map((appt) => (
                      <div
                        key={appt.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {appt.appointmentId}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                appt.status === 'CONFIRMED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : appt.status === 'RESCHEDULED'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : appt.status === 'CANCELLED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : appt.status === 'COMPLETED'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {appt.status}
                            </span>
                            {appt.requiresResolution && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Clinic Closed: Needs Reschedule</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-baseline gap-2">
                            <h4 className="font-bold text-base text-slate-900">{appt.doctorName}</h4>
                            <span className="text-xs text-teal-600 font-medium">({appt.specializationName})</span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                            <span className="flex items-center gap-1 font-semibold text-slate-800">
                              <Calendar className="w-3.5 h-3.5 text-teal-600" />
                              {appt.appointmentDate}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-slate-800">
                              <Clock className="w-3.5 h-3.5 text-teal-600" />
                              {appt.startTime} - {appt.endTime} ({appt.timezone})
                            </span>
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              {appt.clinicName}, {appt.clinicAddress}
                            </span>
                          </div>

                          {appt.cancellationReason && (
                            <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">
                              <b>Cancellation Reason:</b> {appt.cancellationReason} (by {appt.cancelledBy})
                            </p>
                          )}
                        </div>

                        {/* Actions for upcoming appointments */}
                        {['CONFIRMED', 'PENDING', 'RESCHEDULED'].includes(appt.status) && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => {
                                setActionAppt(appt);
                                setRescheduleDate(appt.appointmentDate);
                                setRescheduleModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reschedule</span>
                            </button>
                            <button
                              onClick={() => {
                                setActionAppt(appt);
                                setCancelModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            2. DOCTOR APPLICATION & DASHBOARD
           ======================================================== */}
        {activePortal === 'DOCTOR' && (
          <div className="space-y-6">
            {/* Doctor Navigation Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
              <div className="flex gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setDoctorTab('OVERVIEW')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    doctorTab === 'OVERVIEW' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setDoctorTab('DAILY')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    doctorTab === 'DAILY' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Daily Appointments
                </button>
                <button
                  onClick={() => setDoctorTab('SCHEDULE')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    doctorTab === 'SCHEDULE' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Schedule Hours
                </button>
                <button
                  onClick={() => setDoctorTab('HOLIDAYS')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    doctorTab === 'HOLIDAYS' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Clinic Holidays & Closures
                </button>
                <button
                  onClick={() => setDoctorTab('REPORTS')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    doctorTab === 'REPORTS' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Reports & CSV</span>
                </button>
              </div>

              {/* Working Status Badge */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Clinic Open & Receiving Bookings</span>
                </span>
              </div>
            </div>

            {/* TAB: DOCTOR OVERVIEW */}
            {doctorTab === 'OVERVIEW' && (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs text-slate-400 font-medium">Total Bookings</span>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{doctorReports?.summary?.total || 0}</h3>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs text-emerald-600 font-medium">Confirmed</span>
                    <h3 className="text-2xl font-bold text-emerald-700 mt-1">{doctorReports?.summary?.confirmed || 0}</h3>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs text-purple-600 font-medium">Completed</span>
                    <h3 className="text-2xl font-bold text-purple-700 mt-1">{doctorReports?.summary?.completed || 0}</h3>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs text-rose-500 font-medium">Cancelled</span>
                    <h3 className="text-2xl font-bold text-rose-600 mt-1">{doctorReports?.summary?.cancelled || 0}</h3>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs text-amber-600 font-medium">No-Show</span>
                    <h3 className="text-2xl font-bold text-amber-700 mt-1">{doctorReports?.summary?.noShow || 0}</h3>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs text-teal-600 font-medium">Est. Revenue</span>
                    <h3 className="text-xl font-bold text-teal-700 mt-1">₹{doctorReports?.summary?.projectedConfirmedFeeTotal || 0}</h3>
                  </div>
                </div>

                {/* Today's Appointments Quick View */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Today's Schedule Overview</h3>
                      <p className="text-xs text-slate-400">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={() => setDoctorTab('DAILY')}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                    >
                      <span>Manage Daily Patients</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {doctorAppts.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No appointments booked for today yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {doctorAppts.slice(0, 5).map((appt) => (
                        <div key={appt.id} className="py-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md">
                              {appt.startTime}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900">{appt.patientName}</p>
                              <p className="text-slate-400 text-[11px]">{appt.patientPhone}</p>
                            </div>
                          </div>
                          <span className="font-medium text-slate-600 uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">
                            {appt.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: DAILY APPOINTMENT MANAGEMENT */}
            {doctorTab === 'DAILY' && (
              <div className="space-y-6">
                {/* Date Navigation Header */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const d = new Date(doctorSelectedDate);
                        d.setDate(d.getDate() - 1);
                        setDoctorSelectedDate(d.toISOString().split('T')[0]);
                      }}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50"
                    >
                      ← Previous Day
                    </button>
                    <button
                      onClick={() => setDoctorSelectedDate(new Date().toISOString().split('T')[0])}
                      className="px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg text-xs font-semibold"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date(doctorSelectedDate);
                        d.setDate(d.getDate() + 1);
                        setDoctorSelectedDate(d.toISOString().split('T')[0]);
                      }}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50"
                    >
                      Next Day →
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Pick Date:</span>
                    <input
                      type="date"
                      value={doctorSelectedDate}
                      onChange={(e) => setDoctorSelectedDate(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Appointment Cards List */}
                {doctorAppts.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
                    <CalendarDays className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="font-bold text-slate-700 text-sm">No Appointments on {doctorSelectedDate}</h4>
                    <p className="text-xs text-slate-400">Slots remain bookable for patients.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {doctorAppts.map((appt) => (
                      <div
                        key={appt.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md text-xs font-mono">
                              {appt.startTime} - {appt.endTime}
                            </span>
                            <span className="font-mono text-xs text-slate-500">{appt.appointmentId}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                appt.status === 'COMPLETED'
                                  ? 'bg-purple-50 text-purple-700'
                                  : appt.status === 'CANCELLED'
                                  ? 'bg-rose-50 text-rose-700'
                                  : appt.status === 'NO_SHOW'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {appt.status}
                            </span>
                          </div>

                          <h4 className="font-bold text-base text-slate-900">{appt.patientName}</h4>
                          <p className="text-xs text-slate-500">Contact: {appt.patientPhone}</p>
                          {appt.notes && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg italic mt-1">
                              "{appt.notes}"
                            </p>
                          )}
                        </div>

                        {/* Status Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {['CONFIRMED', 'PENDING', 'RESCHEDULED'].includes(appt.status) && (
                            <>
                              <button
                                onClick={async () => {
                                  await api.completeAppointment(appt.id);
                                  fetchDoctorDashboardData();
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1 shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Complete</span>
                              </button>
                              <button
                                onClick={async () => {
                                  await api.noShowAppointment(appt.id);
                                  fetchDoctorDashboardData();
                                }}
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-xl"
                              >
                                No-Show
                              </button>
                              <button
                                onClick={() => {
                                  setActionAppt(appt);
                                  setCancelModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: SCHEDULE MANAGEMENT */}
            {doctorTab === 'SCHEDULE' && doctorSchedule && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Weekly Consultation Schedule</h3>
                  <p className="text-xs text-slate-500">
                    Configure regular practicing days, session timings, lunch breaks, and consultation slot duration.
                  </p>
                </div>

                {scheduleConflicts && scheduleConflicts.length > 0 && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Schedule Conflicts Detected!</span>
                    </div>
                    <p className="text-xs text-rose-600">
                      Modifying this schedule impacts {scheduleConflicts.length} existing confirmed bookings. Please reschedule these patients before applying these changes.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Working Days */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 block">Working Days of Week</label>
                    <div className="grid grid-cols-7 gap-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                        const isSelected = doctorSchedule.workingDays.includes(idx);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const nextDays = isSelected
                                ? doctorSchedule.workingDays.filter((d: number) => d !== idx)
                                : [...doctorSchedule.workingDays, idx];
                              setDoctorSchedule({ ...doctorSchedule, workingDays: nextDays });
                            }}
                            className={`py-2 rounded-xl text-xs font-bold transition-all ${
                              isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Consultation Duration */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 block">Consultation Duration</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[15, 20, 30, 45].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setDoctorSchedule({ ...doctorSchedule, consultationDurationMinutes: mins })}
                          className={`py-2 rounded-xl text-xs font-bold transition-all ${
                            doctorSchedule.consultationDurationMinutes === mins
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {mins} mins
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Session Hours */}
                <div className="border-t border-slate-100 pt-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-800">Consultation Sessions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {doctorSchedule.sessions.map((sess: any, sIdx: number) => (
                      <div key={sess.name} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <span className="text-xs font-bold text-teal-800">{sess.name}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="time"
                            value={sess.startTime}
                            onChange={(e) => {
                              const updated = [...doctorSchedule.sessions];
                              updated[sIdx].startTime = e.target.value;
                              setDoctorSchedule({ ...doctorSchedule, sessions: updated });
                            }}
                            className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={sess.endTime}
                            onChange={(e) => {
                              const updated = [...doctorSchedule.sessions];
                              updated[sIdx].endTime = e.target.value;
                              setDoctorSchedule({ ...doctorSchedule, sessions: updated });
                            }}
                            className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={async () => {
                      try {
                        await api.updateWeeklySchedule(doctorSchedule);
                        alert('Weekly schedule saved successfully.');
                        setScheduleConflicts(null);
                        fetchDoctorDashboardData();
                      } catch (err: any) {
                        if (err.data?.conflicts) {
                          setScheduleConflicts(err.data.conflicts);
                        } else {
                          alert(`Error saving schedule: ${err.message}`);
                        }
                      }
                    }}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs"
                  >
                    Save Consultation Schedule
                  </button>
                </div>
              </div>
            )}

            {/* TAB: CLINIC HOLIDAYS */}
            {doctorTab === 'HOLIDAYS' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Clinic Closures & Leave Management</h3>
                    <p className="text-xs text-slate-500">
                      Declare holidays or partial-day leaves. The system automatically prevents bookings and flags any affected appointments.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 2);
                      const s = d.toISOString().split('T')[0];
                      setNewHolidayStart(s);
                      setNewHolidayEnd(s);
                      setNewHolidayReason('');
                      setHolidayModalOpen(true);
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Declare Holiday / Closure</span>
                  </button>
                </div>

                {/* Holiday List */}
                <div className="space-y-3">
                  {doctorHolidays.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                      No holidays currently scheduled.
                    </div>
                  ) : (
                    doctorHolidays.map((hol) => (
                      <div
                        key={hol.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{hol.reason}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                              {hol.isFullDay ? 'Full Day Closure' : `${hol.startTime} - ${hol.endTime}`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Dates: <b>{hol.startDate}</b> {hol.startDate !== hol.endDate ? `to ${hol.endDate}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm('Delete this clinic holiday? Slots will become available again.')) {
                              await api.deleteDoctorHoliday(hol.id);
                              fetchDoctorDashboardData();
                            }
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: REPORTS & CSV */}
            {doctorTab === 'REPORTS' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Practice Reporting & CSV Export</h3>
                    <p className="text-xs text-slate-500">
                      Export appointment logs, consultation fee receipts, and patient attendance records to spreadsheet format.
                    </p>
                  </div>
                  <a
                    href={api.getCsvExportUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Download CSV Report</span>
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-400">Total Consultations</span>
                    <h4 className="text-xl font-bold text-slate-800 mt-1">{doctorReports?.summary?.total || 0}</h4>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-400">Completed Sessions</span>
                    <h4 className="text-xl font-bold text-purple-700 mt-1">{doctorReports?.summary?.completed || 0}</h4>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-400">Earned Revenue (Completed)</span>
                    <h4 className="text-xl font-bold text-emerald-700 mt-1">₹{doctorReports?.summary?.completedFeeTotal || 0}</h4>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            3. ADMINISTRATOR VERIFICATION MODULE
           ======================================================== */}
        {activePortal === 'ADMIN' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Medical Council Credential Verification Console</h2>
              <p className="text-xs text-slate-500">
                Review doctor registrations, verify state medical council license numbers, and manage provider status.
              </p>
            </div>

            {/* Admin Stats */}
            {adminStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-medium">Pending Verifications</span>
                  <h3 className="text-2xl font-bold text-amber-600 mt-1">{adminStats.pendingDoctors}</h3>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-medium">Verified Doctors</span>
                  <h3 className="text-2xl font-bold text-emerald-700 mt-1">{adminStats.verifiedDoctors}</h3>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-medium">Registered Patients</span>
                  <h3 className="text-2xl font-bold text-blue-700 mt-1">{adminStats.totalPatients}</h3>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-medium">Total Bookings</span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">{adminStats.totalAppointments}</h3>
                </div>
              </div>
            )}

            {/* Doctor Verification Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800">Medical Practitioners Directory</h4>
                <button
                  onClick={fetchAdminData}
                  className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Doctor Name</th>
                      <th className="py-3 px-4">Specialization</th>
                      <th className="py-3 px-4">Council Reg. No</th>
                      <th className="py-3 px-4">Clinic / Hospital</th>
                      <th className="py-3 px-4">Verification Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminDoctors.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{doc.fullName}</td>
                        <td className="py-3.5 px-4 text-teal-700 font-medium">{doc.specializationName}</td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">{doc.registrationNumber}</td>
                        <td className="py-3.5 px-4 text-slate-600">{doc.clinicName} ({doc.district})</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              doc.verificationStatus === 'VERIFIED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : doc.verificationStatus === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {doc.verificationStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {doc.verificationStatus !== 'VERIFIED' && (
                            <button
                              onClick={async () => {
                                await api.verifyDoctor(doc.id, 'VERIFIED', 'Verified against State Medical Council');
                                fetchAdminData();
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[11px]"
                            >
                              Approve
                            </button>
                          )}
                          {doc.verificationStatus !== 'REJECTED' && (
                            <button
                              onClick={async () => {
                                await api.verifyDoctor(doc.id, 'REJECTED', 'Credentials failed verification');
                                fetchAdminData();
                              }}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-[11px]"
                            >
                              Reject
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h4 className="font-bold text-sm text-slate-800">Security & Audit Trails</h4>
              <div className="max-h-60 overflow-y-auto space-y-2 text-xs font-mono">
                {adminAuditLogs.slice(0, 15).map((log) => (
                  <div key={log.id} className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-slate-600">
                    <span>
                      <b>[{log.action}]</b> {log.resource} ({log.resourceId || 'N/A'}) - Role: {log.role || 'GUEST'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            4. API DOCS & AUTOMATED TEST RUNNER
           ======================================================== */}
        {activePortal === 'API_DOCS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">API Documentation & Concurrency Test Engine</h2>
                <p className="text-xs text-slate-500">
                  Interactive OpenAPI 3.1 specification and verification test runner for double-booking concurrency.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 border border-teal-200 bg-teal-50 text-teal-700 rounded-xl text-xs font-semibold hover:bg-teal-100 flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Swagger UI</span>
                </a>
                <button
                  onClick={handleRunTests}
                  disabled={runningTests}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{runningTests ? 'Running...' : 'Run Automated Tests'}</span>
                </button>
              </div>
            </div>

            {/* Test Results Display */}
            {testResults && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">Automated Test Results</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      testResults.passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {testResults.passed ? 'ALL TESTS PASSED (100%)' : 'SOME TESTS FAILED'}
                  </span>
                </div>

                <div className="space-y-2">
                  {testResults.results.map((r: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs flex items-start gap-3 ${
                        r.passed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                      }`}
                    >
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-bold text-slate-900">{r.name}</p>
                        <p className="text-slate-600 mt-0.5">{r.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Embedded Swagger / Redoc iframe */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs h-[650px]">
              <iframe
                src="/api/docs"
                title="CuraLink OpenAPI Documentation"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          BOOKING MODAL (PATIENT)
         ======================================================== */}
      {bookingDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-teal-50/50">
              <div className="flex items-center gap-3">
                <img
                  src={bookingDoctor.profilePhoto}
                  alt={bookingDoctor.fullName}
                  className="w-12 h-12 rounded-xl object-cover border border-teal-200"
                />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{bookingDoctor.fullName}</h3>
                  <p className="text-xs text-teal-700 font-semibold">{bookingDoctor.specializationName}</p>
                  <p className="text-[11px] text-slate-500">₹{bookingDoctor.consultationFee} • {bookingDoctor.consultationDuration} mins</p>
                </div>
              </div>
              <button
                onClick={() => setBookingDoctor(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {bookingSuccessAppt ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">Booking Confirmed!</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Your appointment has been safely reserved in the database.
                    </p>
                    <div className="mt-3 inline-block bg-slate-100 px-3 py-1.5 rounded-lg font-mono text-xs font-bold text-slate-800">
                      Ref: {bookingSuccessAppt.appointmentId}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl text-left space-y-1">
                    <p><b>Date:</b> {bookingSuccessAppt.appointmentDate}</p>
                    <p><b>Time:</b> {bookingSuccessAppt.startTime} - {bookingSuccessAppt.endTime}</p>
                    <p><b>Clinic:</b> {bookingSuccessAppt.clinicName}</p>
                  </div>
                  <button
                    onClick={() => {
                      setBookingDoctor(null);
                      setBookingSuccessAppt(null);
                      setPatientTab('MY_APPOINTMENTS');
                    }}
                    className="w-full py-2.5 bg-teal-600 text-white font-semibold text-xs rounded-xl hover:bg-teal-700"
                  >
                    View in My Appointments
                  </button>
                </div>
              ) : (
                <>
                  {bookingError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{bookingError}</span>
                    </div>
                  )}

                  {/* Date Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">Select Consultation Date</label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* Slots Grid */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Available Time Slots ({bookingDate})</span>
                      {availability && (
                        <span className="text-[11px] font-normal text-slate-400">
                          {availability.availableSlotsCount} available
                        </span>
                      )}
                    </label>

                    {loadingAvailability ? (
                      <div className="py-8 text-center text-xs text-slate-400">Loading doctor's availability...</div>
                    ) : availability && !availability.isWorkingDay ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-center">
                        {availability.statusReason || 'Doctor is not available on this date.'}
                      </div>
                    ) : availability && availability.slots.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {availability.slots.map((slot: any) => (
                          <button
                            key={slot.startTime}
                            type="button"
                            disabled={!slot.isAvailable}
                            onClick={() => setSelectedSlot(slot.startTime)}
                            className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all text-center ${
                              selectedSlot === slot.startTime
                                ? 'bg-teal-600 text-white shadow-xs'
                                : slot.isAvailable
                                ? 'bg-teal-50/70 text-teal-900 hover:bg-teal-100 border border-teal-200/50'
                                : 'bg-slate-100 text-slate-400 line-through cursor-not-allowed'
                            }`}
                            title={slot.reason || (slot.isAvailable ? 'Available' : 'Unavailable')}
                          >
                            {slot.startTime}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-400">No slots available on this date.</div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Symptoms / Booking Notes (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Briefly describe your symptoms or visit purpose..."
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setBookingDoctor(null)}
                      className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedSlot || bookingSubmitting}
                      onClick={handleConfirmBooking}
                      className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      {bookingSubmitting ? (
                        <span>Reserving Slot...</span>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm Booking</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          CANCELLATION CONFIRMATION MODAL
         ======================================================== */}
      {cancelModalOpen && actionAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-base">Cancel Appointment?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to cancel appointment <b>{actionAppt.appointmentId}</b>? The reserved slot will be released back to the availability schedule.
              </p>
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl">{actionError}</div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Cancellation</label>
              <input
                type="text"
                placeholder="e.g. Schedule conflict, feeling better..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setCancelModalOpen(false);
                  setActionAppt(null);
                }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Keep Booking
              </button>
              <button
                disabled={actionLoading}
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          RESCHEDULE MODAL
         ======================================================== */}
      {rescheduleModalOpen && actionAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Reschedule Appointment</h3>
              <button onClick={() => setRescheduleModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl">{actionError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">New Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setRescheduleSlot(null);
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Available Slots on {rescheduleDate}</label>
                {rescheduleAvailability && rescheduleAvailability.slots?.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                    {rescheduleAvailability.slots.map((s: any) => (
                      <button
                        key={s.startTime}
                        disabled={!s.isAvailable}
                        onClick={() => setRescheduleSlot(s.startTime)}
                        className={`py-1.5 rounded-lg text-xs font-semibold ${
                          rescheduleSlot === s.startTime
                            ? 'bg-blue-600 text-white'
                            : s.isAvailable
                            ? 'bg-blue-50 text-blue-900 hover:bg-blue-100'
                            : 'bg-slate-100 text-slate-400 line-through'
                        }`}
                      >
                        {s.startTime}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Select a date with open consultation hours.</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Rescheduling</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule adjustment..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                onClick={() => setRescheduleModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={!rescheduleSlot || actionLoading}
                onClick={handleConfirmReschedule}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:bg-slate-300"
              >
                {actionLoading ? 'Reserving...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          CLINIC HOLIDAY DECLARATION MODAL
         ======================================================== */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <Ban className="w-5 h-5" />
                <span>Declare Clinic Holiday / Leave</span>
              </div>
              <button onClick={() => setHolidayModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={newHolidayStart}
                    onChange={(e) => setNewHolidayStart(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    min={newHolidayStart}
                    value={newHolidayEnd}
                    onChange={(e) => setNewHolidayEnd(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Closure</label>
                <input
                  type="text"
                  placeholder="e.g. Attending Conference, Personal Leave..."
                  value={newHolidayReason}
                  onChange={(e) => setNewHolidayReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="fullDay"
                  checked={newHolidayFullDay}
                  onChange={(e) => setNewHolidayFullDay(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="fullDay" className="text-xs text-slate-700 font-medium">
                  Full Day Closure (All slots blocked)
                </label>
              </div>

              {!newHolidayFullDay && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">From Time</label>
                    <input
                      type="time"
                      value={newHolidayStartTime}
                      onChange={(e) => setNewHolidayStartTime(e.target.value)}
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">To Time</label>
                    <input
                      type="time"
                      value={newHolidayEndTime}
                      onChange={(e) => setNewHolidayEndTime(e.target.value)}
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-3">
              <button
                onClick={() => setHolidayModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newHolidayStart || !newHolidayEnd || !newHolidayReason) {
                    alert('Please enter all dates and reason.');
                    return;
                  }
                  try {
                    const res = await api.createDoctorHoliday({
                      startDate: newHolidayStart,
                      endDate: newHolidayEnd,
                      isFullDay: newHolidayFullDay,
                      startTime: newHolidayFullDay ? undefined : newHolidayStartTime,
                      endTime: newHolidayFullDay ? undefined : newHolidayEndTime,
                      reason: newHolidayReason,
                    });
                    setHolidayModalOpen(false);
                    alert(
                      `Holiday declared! ${res.affectedAppointmentsCount} existing appointment(s) were flagged for resolution.`
                    );
                    fetchDoctorDashboardData();
                  } catch (err: any) {
                    alert(`Error creating holiday: ${err.message}`);
                  }
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
              >
                Confirm Closure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          AUTH MODAL (LOGIN / REGISTER)
         ======================================================== */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-200 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {authMode === 'LOGIN' ? 'Welcome Back' : 'Create CuraLink Account'}
                </h3>
                <p className="text-xs text-slate-400">
                  {authMode === 'LOGIN' ? 'Sign in to access your appointments' : 'Register as a patient or medical doctor'}
                </p>
              </div>
              <button onClick={() => setAuthModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'REGISTER' && (
                <>
                  <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setAuthRole('PATIENT')}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        authRole === 'PATIENT' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Patient
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthRole('DOCTOR')}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        authRole === 'DOCTOR' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Doctor
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98470 12345"
                      value={authMobile}
                      onChange={(e) => setAuthMobile(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="your.email@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
              >
                {authLoading ? 'Authenticating...' : authMode === 'LOGIN' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
              {authMode === 'LOGIN' ? (
                <span>
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setAuthMode('REGISTER');
                      setAuthError(null);
                    }}
                    className="text-teal-600 font-bold hover:underline"
                  >
                    Register here
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setAuthMode('LOGIN');
                      setAuthError(null);
                    }}
                    className="text-teal-600 font-bold hover:underline"
                  >
                    Sign in here
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <Stethoscope className="w-4 h-4 text-teal-600" />
            <span>CuraLink Healthcare Systems</span>
          </div>
          <p className="text-slate-400">
            Compliant with Medical Council of India guidelines • Concurrency-Safe Transaction Engine
          </p>
          <div className="flex items-center gap-3 font-semibold text-teal-700">
            <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="hover:underline">
              OpenAPI Docs
            </a>
            <span>•</span>
            <button onClick={handleRunTests} className="hover:underline">
              Run Test Suite
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
