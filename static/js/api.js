/**
 * API Service Client for ACM SRMIST Event Management Platform
 */
const API = {
    baseUrl: '',

    getToken() {
        return localStorage.getItem('acm_srm_token');
    },

    setToken(token) {
        if (token) {
            localStorage.setItem('acm_srm_token', token);
        } else {
            localStorage.removeItem('acm_srm_token');
        }
    },

    getCurrentUser() {
        const u = localStorage.getItem('acm_srm_user');
        try {
            return u ? JSON.parse(u) : null;
        } catch {
            return null;
        }
    },

    setCurrentUser(user) {
        if (user) {
            localStorage.setItem('acm_srm_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('acm_srm_user');
        }
    },

    getHeaders(extraHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...extraHeaders
        };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            ...options,
            headers: this.getHeaders(options.headers)
        };

        try {
            const res = await fetch(url, config);
            let data = null;
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await res.json();
            } else if (contentType && contentType.includes("text/csv")) {
                return res; // Return raw response for download
            } else {
                data = await res.text();
            }

            if (!res.ok) {
                const errorMessage = (data && data.detail) || (data && data.message) || `Request failed with status ${res.status}`;
                const err = new Error(errorMessage);
                err.status = res.status;
                err.data = data;
                throw err;
            }

            return data;
        } catch (error) {
            console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, error);
            throw error;
        }
    },

    // Auth endpoints
    login(email, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },

    register(payload) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    getMe() {
        return this.request('/api/auth/me');
    },

    getDemoUsers() {
        return this.request('/api/auth/demo-users');
    },

    // Events endpoints
    getEvents(params = {}) {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') {
                qs.append(k, v);
            }
        });
        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request(`/api/events${query}`);
    },

    getEventDetail(id) {
        return this.request(`/api/events/${id}`);
    },

    getCategories() {
        return this.request('/api/categories');
    },

    createEvent(payload) {
        return this.request('/api/events', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    updateEvent(id, payload) {
        return this.request(`/api/events/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },

    deleteEvent(id) {
        return this.request(`/api/events/${id}`, {
            method: 'DELETE'
        });
    },

    // Registration endpoints
    registerForEvent(eventId) {
        return this.request(`/api/events/${eventId}/register`, {
            method: 'POST'
        });
    },

    cancelRegistration(registrationId) {
        return this.request(`/api/registrations/${registrationId}/cancel`, {
            method: 'POST'
        });
    },

    getMyRegistrations() {
        return this.request('/api/registrations/my');
    },

    getTicket(ticketId) {
        return this.request(`/api/registrations/ticket/${ticketId}`);
    },

    // Admin endpoints
    getAdminOverview() {
        return this.request('/api/admin/overview');
    },

    getEventParticipants(eventId) {
        return this.request(`/api/admin/events/${eventId}/participants`);
    },

    checkInParticipant(ticketId) {
        return this.request('/api/admin/check-in', {
            method: 'POST',
            body: JSON.stringify({ ticket_id: ticketId })
        });
    },

    getAdminAnalytics() {
        return this.request('/api/admin/analytics');
    },

    // Notifications
    getNotifications() {
        return this.request('/api/notifications');
    },

    markNotificationRead(id) {
        return this.request(`/api/notifications/${id}/read`, { method: 'PUT' });
    },

    markAllNotificationsRead() {
        return this.request('/api/notifications/read-all', { method: 'PUT' });
    }
};
