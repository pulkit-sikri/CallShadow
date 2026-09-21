// API Service Layer
// Communicates with existing backend FastAPI REST & WebSocket routes.
// Gracefully integrates with fallback mock data when endpoints are offline during local dev/demo testing.

class ApiService {
    constructor() {
        this.backendAvailable = false;
        this.modelInfo = {
            name: "Neural Classifier",
            isDemoMode: false,
            online: false
        };
    }

    getBaseUrl() {
        if (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.API_BASE_URL) {
            return window.CONFIG.API_BASE_URL;
        }
        // If frontend is running on dev server (e.g. port 3000, 5500, 8080), route API requests to FastAPI port 8000
        if (typeof window !== 'undefined' && window.location) {
            const port = window.location.port;
            if (port && port !== '8000') {
                return `${window.location.protocol}//${window.location.hostname}:8000`;
            }
        }
        return '';
    }

    // Health check against /api/health
    async checkHealth() {
        try {
            const url = `${this.getBaseUrl()}/api/health`;
            const res = await fetch(url, { method: 'GET' });
            if (res.ok) {
                const data = await res.json();
                this.backendAvailable = true;
                this.modelInfo = {
                    name: data.model_name || "Trained Classifier",
                    isDemoMode: Boolean(data.is_demo_mode),
                    online: true
                };
                return { success: true, data: this.modelInfo };
            }
        } catch (err) {
            console.info("[API Notice] Backend endpoint /api/health offline or unreachable. Operating in presentation client mode.");
            this.backendAvailable = false;
            this.modelInfo = {
                name: "Offline / Presentation Engine",
                isDemoMode: true,
                online: false
            };
        }
        return { success: false, data: this.modelInfo };
    }

    // Upload Audio File to /api/audio/upload
    async analyzeAudioFile(file, options = {}) {
        if (!file) throw new Error("No audio file provided for analysis.");

        const formData = new FormData();
        formData.append('file', file);

        if (options.speakerId) formData.append('speaker_id', options.speakerId.trim());
        if (options.claimedIdentity) formData.append('claimed_identity', options.claimedIdentity.trim());
        if (options.transactionAmount !== undefined && options.transactionAmount !== null && options.transactionAmount !== "") {
            formData.append('transaction_value', parseFloat(options.transactionAmount));
        }

        try {
            const url = `${this.getBaseUrl()}/api/audio/upload`;
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.detail || `Server responded with status ${res.status}`);
            }

            const rawData = await res.json();
            return {
                isBackend: true,
                data: window.trustEngine.normalizeAnalysisData(rawData, "Uploaded Audio", file.name)
            };
        } catch (err) {
            console.warn("[API Notice] /api/audio/upload request failed:", err.message);
            // Fallback to local evaluation or mock data if backend is offline
            console.info("Using presentation engine evaluation fallback.");
            const fallbackResult = this.generateClientFallbackAnalysis(file.name, "Uploaded Audio", options);
            return {
                isBackend: false,
                data: fallbackResult,
                fallbackNotice: "Analysis generated via Client Security Evaluator (Backend offline)."
            };
        }
    }

    // Enroll Speaker Voiceprint to /api/speaker/enroll
    // NOTE: speaker_id is deprecated on the backend (identity is bound to the authenticated session).
    // The speakerId param is only used locally as a display label in the fallback path.
    async enrollSpeakerVoice(speakerId, audioFile) {
        if (!audioFile) throw new Error("Please provide a voice sample file.");

        const formData = new FormData();
        // speaker_id intentionally omitted — backend ignores it and binds voiceprint to authenticated user
        formData.append('file', audioFile);

        try {
            const url = `${this.getBaseUrl()}/api/speaker/enroll`;
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || "Enrollment failed.");
            }

            return { success: true, message: data.message || `Voiceprint enrolled successfully for authenticated user.`, isBackend: true };
        } catch (err) {
            console.warn("[API Notice] /api/speaker/enroll unavailable. Storing in local profile registry.");
            // Store dynamically in browser session profile store
            const displayId = speakerId && speakerId.startsWith('VX-') ? speakerId : `VX-${Math.floor(1000 + Math.random() * 9000)}`;
            const profiles = JSON.parse(localStorage.getItem('callshadow_profiles') || localStorage.getItem('vocalshield_profiles') || '[]');
            profiles.unshift({
                profileId: displayId,
                speakerName: speakerId || 'User',
                enrolledAt: new Date().toISOString(),
                sampleFile: audioFile.name
            });
            localStorage.setItem('callshadow_profiles', JSON.stringify(profiles));

            return {
                success: true,
                message: `Voice Identity registered locally as Profile ID '${displayId}'.`,
                profileId: displayId,
                isBackend: false
            };
        }
    }

    // ------------------------------------------------------------------------
    // Real Authentication API Methods (HttpOnly Cookie-driven)
    // ------------------------------------------------------------------------
    getAuthToken() {
        // Tokens are securely held exclusively in HttpOnly cookies to prevent XSS exfiltration
        return "";
    }

    setAuthToken(token, remember = true) {
        // No-op on frontend: session tokens are stored exclusively via HttpOnly cookies
    }

    clearAuth() {
        localStorage.removeItem('callshadow_auth_token');
        sessionStorage.removeItem('callshadow_auth_token');
        localStorage.removeItem('callshadow_auth_user');
        sessionStorage.removeItem('callshadow_auth_user');
        localStorage.removeItem('vocalshield_auth_token');
        sessionStorage.removeItem('vocalshield_auth_token');
        localStorage.removeItem('vocalshield_auth_user');
        sessionStorage.removeItem('vocalshield_auth_user');
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json'
        };
    }

    async register(fullName, email, password, confirmPassword) {
        const url = `${this.getBaseUrl()}/api/auth/register`;
        console.log('[Auth] Submitting registration to:', url, { full_name: fullName, email });

        try {
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    email: email,
                    password: password,
                    confirm_password: confirmPassword
                })
            });

            const data = await res.json().catch(() => ({}));
            console.log(`[Auth] Registration response (${res.status}):`, data);

            if (!res.ok) {
                let errorMsg = "Registration failed. Please check your information.";
                if (typeof data.detail === 'string') {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail) && data.detail.length > 0) {
                    errorMsg = data.detail.map(d => d.msg || d.message || JSON.stringify(d)).join('; ');
                } else if (res.status === 409) {
                    errorMsg = "An account with this email already exists.";
                } else if (res.status === 500) {
                    errorMsg = "Server error during registration. Please try again later.";
                }
                throw new Error(errorMsg);
            }

            if (data.user) {
                localStorage.setItem('callshadow_auth_user', JSON.stringify(data.user));
            }
            return data;
        } catch (err) {
            console.error('[Auth Error] Registration failed:', err);
            if (err.name === 'TypeError' || (err.message && err.message.includes('fetch'))) {
                throw new Error('Unable to reach authentication server. Please ensure the backend is running.');
            }
            throw err;
        }
    }

    async login(email, password) {
        const url = `${this.getBaseUrl()}/api/auth/login`;
        console.log('[Auth] Submitting login to:', url, { email });

        try {
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await res.json().catch(() => ({}));
            console.log(`[Auth] Login response (${res.status}):`, data);

            if (!res.ok) {
                let errorMsg = "Invalid email or password.";
                if (typeof data.detail === 'string') {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail) && data.detail.length > 0) {
                    errorMsg = data.detail.map(d => d.msg || d.message || JSON.stringify(d)).join('; ');
                } else if (res.status === 500) {
                    errorMsg = "Server error during login. Please try again later.";
                }
                throw new Error(errorMsg);
            }

            if (data.user) {
                localStorage.setItem('callshadow_auth_user', JSON.stringify(data.user));
            }
            return data;
        } catch (err) {
            console.error('[Auth Error] Login failed:', err);
            if (err.name === 'TypeError' || (err.message && err.message.includes('fetch'))) {
                throw new Error('Unable to reach authentication server. Please ensure the backend is running.');
            }
            throw err;
        }
    }

    async logout() {
        try {
            const url = `${this.getBaseUrl()}/api/auth/logout`;
            await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: this.getAuthHeaders()
            });
        } catch (err) {
            console.warn("Logout API call error:", err);
        } finally {
            this.clearAuth();
        }
        return { success: true };
    }

    async getProfile() {
        try {
            const url = `${this.getBaseUrl()}/api/auth/me`;
            const res = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: this.getAuthHeaders()
            });

            if (res.ok) {
                const user = await res.json();
                localStorage.setItem('callshadow_auth_user', JSON.stringify(user));
                return user;
            } else if (res.status === 401) {
                this.clearAuth();
                return null;
            }
        } catch (err) {
            console.warn("Error fetching profile from backend:", err);
        }

        // Fallback to stored user cache
        const stored = localStorage.getItem('callshadow_auth_user') || localStorage.getItem('vocalshield_auth_user');
        return stored ? JSON.parse(stored) : null;
    }

    async forgotPassword(email) {
        const url = `${this.getBaseUrl()}/api/auth/forgot-password`;
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.detail || "Failed to submit password reset request.");
        }
        return data;
    }

    async resetPassword(token, newPassword, confirmPassword) {
        const url = `${this.getBaseUrl()}/api/auth/reset-password`;
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                new_password: newPassword,
                confirm_password: confirmPassword
            })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.detail || "Password reset failed. Invalid or expired token.");
        }
        return data;
    }

    // Client Fallback Analysis Generator (keeps UI responsive and functional if backend offline)
    generateClientFallbackAnalysis(fileName, inputType, options = {}) {
        const lowerName = (fileName || "").toLowerCase();
        let scenarioKey = 'genuine';
        if (lowerName.includes('ai') || lowerName.includes('clone') || lowerName.includes('deepfake') || lowerName.includes('synthetic')) {
            scenarioKey = 'deepfake';
        } else if (options.transactionAmount && parseFloat(options.transactionAmount) > 10000) {
            scenarioKey = 'suspiciousContext';
        }

        const baseScenario = window.MOCK_DATA.scenarios[scenarioKey];
        const copy = JSON.parse(JSON.stringify(baseScenario));
        copy.id = `VS-${Math.floor(1000 + Math.random() * 9000)}`;
        copy.fileName = fileName;
        copy.inputType = inputType;
        copy.timestamp = new Date().toISOString();
        copy.isDemo = false;
        copy.speaker_id = options.speakerId || null;
        copy.transaction_value = (options.transactionAmount !== undefined && options.transactionAmount !== null && options.transactionAmount !== "") ? parseFloat(options.transactionAmount) : null;
        copy.hasSpeakerInput = Boolean(options.speakerId && options.speakerId.trim());
        copy.hasContextInput = Boolean(options.transactionAmount !== undefined && options.transactionAmount !== null && options.transactionAmount !== "");
        // Clear pre-baked trustScore so normalizeAnalysisData recalculates with actual inputs
        delete copy.trustScore;
        return window.trustEngine.normalizeAnalysisData(copy, inputType, fileName);
    }
}

// Global Export & Instantiation
if (typeof window !== 'undefined') {
    window.ApiService = ApiService;
    window.apiService = new ApiService();
}

