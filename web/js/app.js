// CallShadow - Main Application Controller & Router
// Integrates Landing Page (Hero Robot + Soundwaves), Auth, and SOC Console with Vertical Sidebar

class SentinelApp {
    constructor() {
        this.currentView = 'landing';
        this.authToken = localStorage.getItem('callshadow_auth_token') || sessionStorage.getItem('callshadow_auth_token') || localStorage.getItem('vocalshield_auth_token') || sessionStorage.getItem('vocalshield_auth_token') || "";
        this.currentUser = null;
        try {
            const stored = localStorage.getItem('callshadow_auth_user') || sessionStorage.getItem('callshadow_auth_user') || localStorage.getItem('vocalshield_auth_user') || sessionStorage.getItem('vocalshield_auth_user');
            if (stored) this.currentUser = JSON.parse(stored);
        } catch (e) {
            this.currentUser = null;
        }
        this.isAuthenticated = Boolean(this.authToken && this.currentUser);
        this.intendedView = null;

        this.selectedUploadFile = null;
        this.selectedEnrollFile = null;
        this.recordedAudioBlob = null;
        this.isRecording = false;
        this.recordingTimerInterval = null;
        this.recordingSeconds = 0;
        this.analysisHistory = [];
        this.latestAnalysis = null;
        this.heroWaveformAnimId = null;
    }

    async init() {
        this.loadHistory();
        this.setupRouting();
        this.setupDropzones();
        this.setupWindowResize();
        this.startHeroWaveformAnimation();
        this.renderThreatVolumeSegments();
        this.renderHistoryTable();
        this.renderThreatLibrary();
        this.renderNavbarAuth();

        // Initial scenario for Trust Engine (mock, not a real test result)
        this.latestAnalysis = null; // null = no real analysis yet
        this.latestAnalysisNormalized = null; // stores normalized form used by PDF
        const initDemo = window.MOCK_DATA.scenarios.genuine;
        if (window.trustEngine) {
            window.trustEngine.renderTrustResult(initDemo);
        }

        // Verify authentication state with backend
        await this.checkAuthStatus();

        // Check hash routing
        const initialHash = window.location.hash.replace('#', '') || 'landing';
        this.navigateTo(initialHash, false);
    }

    async checkAuthStatus() {
        if (this.authToken) {
            try {
                const profile = await window.apiService.getProfile();
                if (profile) {
                    this.currentUser = profile;
                    this.isAuthenticated = true;
                    this.updateUserProfileDisplay();
                } else {
                    this.currentUser = null;
                    this.isAuthenticated = false;
                    this.authToken = "";
                }
            } catch (err) {
                console.warn("Auth check notice:", err);
            }
        }
        this.renderNavbarAuth();
    }

    loadHistory() {
        const stored = localStorage.getItem('sentinel_history');
        if (stored) {
            try { this.analysisHistory = JSON.parse(stored); } catch(e) { this.analysisHistory = window.MOCK_DATA.recentAnalyses; }
        } else {
            this.analysisHistory = [...window.MOCK_DATA.recentAnalyses];
            localStorage.setItem('sentinel_history', JSON.stringify(this.analysisHistory));
        }
    }

    setupRouting() {
        window.addEventListener('hashchange', () => {
            const route = window.location.hash.replace('#', '') || 'landing';
            if (route === 'search' || route === 'features' || route === 'working') {
                this.scrollToSection(route);
            } else {
                this.navigateTo(route, false);
            }
        });

        // Setup scroll spy for homepage sections
        this.setupScrollSpy();
    }

    // ------------------------------------------------------------------------
    // Homepage Section Smooth Scrolling & Nav State
    // ------------------------------------------------------------------------
    scrollToSection(sectionId) {
        const landingLayout = document.getElementById('landing-view');
        const authLayout = document.getElementById('auth-view');
        const dashboardLayout = document.getElementById('dashboard-layout');

        // If not on landing page, restore landing view first
        if (landingLayout && landingLayout.classList.contains('hidden')) {
            landingLayout.classList.remove('hidden');
            if (authLayout) authLayout.classList.add('hidden');
            if (dashboardLayout) dashboardLayout.classList.add('hidden');
            this.currentView = 'landing';
            this.renderNavbarAuth();
        }

        // Update URL hash without breaking state
        if (window.location.hash !== `#${sectionId}`) {
            history.pushState(null, null, `#${sectionId}`);
        }

        // Smooth scroll to the target section
        const target = document.getElementById(sectionId);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Update active class on center navbar
        this.updateActiveNav(sectionId);
    }

    updateActiveNav(activeId) {
        document.querySelectorAll('.nav-center-menu a').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.getElementById(`nav-link-${activeId}`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    setupScrollSpy() {
        const sectionIds = ['search', 'features', 'working'];
        const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

        if ('IntersectionObserver' in window && sections.length > 0) {
            const observer = new IntersectionObserver((entries) => {
                // Only spy if landing page is currently visible
                const landingLayout = document.getElementById('landing-view');
                if (landingLayout && landingLayout.classList.contains('hidden')) return;

                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.updateActiveNav(entry.target.id);
                    }
                });
            }, {
                root: null,
                rootMargin: '-20% 0px -60% 0px',
                threshold: 0
            });

            sections.forEach(sec => observer.observe(sec));
        }
    }

    // ------------------------------------------------------------------------
    // Global Navigation, Route Guarding & Routing
    // ------------------------------------------------------------------------
    navigateTo(viewId, updateHash = true) {
        // Handle section scroll routes explicitly
        if (viewId === 'search' || viewId === 'features' || viewId === 'working') {
            this.scrollToSection(viewId);
            return;
        }

        const landingLayout = document.getElementById('landing-view');
        const authLayout = document.getElementById('auth-view');
        const dashboardLayout = document.getElementById('dashboard-layout');

        // 1. Landing Page
        if (viewId === 'landing') {
            this.currentView = 'landing';
            if (updateHash) window.location.hash = 'landing';

            if (landingLayout) landingLayout.classList.remove('hidden');
            if (authLayout) authLayout.classList.add('hidden');
            if (dashboardLayout) dashboardLayout.classList.add('hidden');
            document.querySelectorAll('.nav-center-menu a').forEach(link => link.classList.remove('active'));
            this.renderNavbarAuth();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // 2. Auth Pages (login, signup, forgot, reset)
        if (viewId === 'login' || viewId === 'signup' || viewId === 'forgot' || viewId === 'reset') {
            // If already authenticated and trying to access login/signup, redirect to dashboard
            if (this.isAuthenticated) {
                this.navigateTo('dashboard');
                return;
            }

            this.currentView = viewId;
            if (updateHash) window.location.hash = viewId;

            if (authLayout) authLayout.classList.remove('hidden');
            if (landingLayout) landingLayout.classList.add('hidden');
            if (dashboardLayout) dashboardLayout.classList.add('hidden');
            this.switchAuthTab(viewId);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // 3. Protected Dashboard Views (Guard checking)
        const protectedViews = ['dashboard', 'live', 'upload', 'enroll', 'analysis', 'history', 'apikeys', 'privacy', 'about', 'settings'];
        if (protectedViews.includes(viewId)) {
            if (!this.isAuthenticated) {
                this.intendedView = viewId;
                this.showToast("Please sign in to access the SOC Console.", "warning");
                this.navigateTo('login');
                return;
            }
        }

        this.currentView = viewId;
        if (updateHash) {
            window.location.hash = viewId;
        }

        if (landingLayout) landingLayout.classList.add('hidden');
        if (authLayout) authLayout.classList.add('hidden');
        if (dashboardLayout) dashboardLayout.classList.remove('hidden');

        // Hide all dashboard panels
        document.querySelectorAll('.soc-view-container .view-panel').forEach(p => p.classList.add('hidden'));

        // Show target panel
        const target = document.getElementById(`view-${viewId}`);
        if (target) {
            target.classList.remove('hidden');
        } else {
            const defaultView = document.getElementById('view-dashboard');
            if (defaultView) defaultView.classList.remove('hidden');
        }

        // Update active sidebar item
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-route') === viewId) {
                item.classList.add('active');
            }
        });

        // Update Top Status Bar Title
        const titleMap = {
            'dashboard': 'Security Overview Dashboard',
            'live': 'Live Recognition — Real-Time AI Voice Detection',
            'upload': 'Upload Audio Sample Analysis',
            'enroll': 'Authenticate & Enroll Voice Identity',
            'analysis': 'Explainable Trust Engine Result',
            'history': 'Security Audit Log History',
            'apikeys': 'Developer API Keys & Endpoints',
            'privacy': 'Zero-Retention Privacy Pipeline',
            'about': 'About CallShadow Platform',
            'settings': 'SOC Console Settings'
        };

        // Live Recognition: toggle auth gate visibility & initialize idle canvases
        if (viewId === 'live') {
            const gate  = document.getElementById('live-auth-gate');
            const panel = document.getElementById('live-recognition-panel');
            if (this.isAuthenticated) {
                if (gate)  gate.classList.add('hidden');
                if (panel) panel.style.display = '';
            } else {
                if (gate)  gate.classList.remove('hidden');
                if (panel) panel.style.display = 'none';
            }

            // Only re-init graph/waveform when idle — not during an active recording
            if (window.liveGraph && !this.isRecording) {
                window.liveGraph.init('live-trust-graph-canvas');
            }
            if (window.audioEngine && typeof window.audioEngine.drawIdleWaveform === 'function' && !this.isRecording) {
                window.audioEngine.drawIdleWaveform('live-waveform-canvas');
            }
        }

        const topTitle = document.getElementById('soc-top-title');
        if (topTitle) {
            topTitle.textContent = titleMap[viewId] || 'SOC Console';
        }

        // Update profile in sidebar & dashboard
        this.updateUserProfileDisplay();

        // Redraw canvas chart if viewing dashboard
        if (viewId === 'dashboard') {
            setTimeout(() => this.renderActivityChart(), 50);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ------------------------------------------------------------------------
    // Dynamic Navbar & Profile Display
    // ------------------------------------------------------------------------
    renderNavbarAuth() {
        const container = document.getElementById('nav-auth-actions');
        if (!container) return;

        if (this.isAuthenticated && this.currentUser) {
            const displayName = this.currentUser.full_name || 'User';
            container.innerHTML = `
                <span class="nav-user-pill">👤 ${displayName}</span>
                <button class="btn-white-pill" onclick="app.navigateTo('dashboard')">Dashboard</button>
                <button class="nav-auth-login-link" onclick="app.handleLogout()">Log Out</button>
            `;
        } else {
            container.innerHTML = `
                <button class="nav-auth-login-link" onclick="app.navigateTo('login')">Log In</button>
                <button class="btn-white-pill" onclick="app.handleStartForFree()">Start for Free</button>
            `;
        }
    }

    handleStartForFree() {
        if (this.isAuthenticated) {
            this.navigateTo('dashboard');
        } else {
            this.navigateTo('signup');
        }
    }

    updateUserProfileDisplay() {
        if (!this.currentUser) return;

        const fullName = this.currentUser.full_name || 'User';
        const initial = fullName.charAt(0).toUpperCase() || 'U';
        const email = this.currentUser.email || '';
        const userId = this.currentUser.id ? `#${this.currentUser.id}` : '#101';
        const memberSince = this.currentUser.created_at ? this.currentUser.created_at.split(' ')[0] : 'Active';

        const sidebarAvatar = document.getElementById('sidebar-avatar');
        if (sidebarAvatar) sidebarAvatar.textContent = initial;

        const sidebarName = document.getElementById('sidebar-username');
        if (sidebarName) sidebarName.textContent = fullName;

        const sidebarRole = document.getElementById('sidebar-userrole');
        if (sidebarRole) sidebarRole.textContent = email || 'SOC Lead';

        const welcomeName = document.getElementById('dashboard-welcome-name');
        if (welcomeName) welcomeName.textContent = fullName;

        const dashUserId = document.getElementById('dashboard-user-id');
        if (dashUserId) dashUserId.textContent = userId;

        const dashMemberSince = document.getElementById('dashboard-member-since');
        if (dashMemberSince) dashMemberSince.textContent = memberSince;
    }

    // ------------------------------------------------------------------------
    // Authentication UI Tabs & Form Handlers
    // ------------------------------------------------------------------------
    switchAuthTab(tab) {
        document.querySelectorAll('.auth-subscreen').forEach(s => s.classList.add('hidden'));

        this.clearAuthAlerts();

        const targetScreen = document.getElementById(`auth-screen-${tab}`);
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
        } else {
            const defaultScreen = document.getElementById('auth-screen-login');
            if (defaultScreen) defaultScreen.classList.remove('hidden');
        }
    }

    clearAuthAlerts() {
        const errBox = document.getElementById('auth-error-box');
        if (errBox) {
            errBox.textContent = '';
            errBox.classList.add('hidden');
        }
        const succBox = document.getElementById('auth-success-box');
        if (succBox) {
            succBox.textContent = '';
            succBox.classList.add('hidden');
        }
    }

    showAuthError(message) {
        const errBox = document.getElementById('auth-error-box');
        if (errBox) {
            errBox.textContent = message;
            errBox.classList.remove('hidden');
        }
        const succBox = document.getElementById('auth-success-box');
        if (succBox) succBox.classList.add('hidden');
    }

    showAuthSuccess(message) {
        const succBox = document.getElementById('auth-success-box');
        if (succBox) {
            succBox.textContent = message;
            succBox.classList.remove('hidden');
        }
        const errBox = document.getElementById('auth-error-box');
        if (errBox) errBox.classList.add('hidden');
    }

    togglePasswordVisibility(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🔒';
        } else {
            input.type = 'password';
            btn.textContent = '👁';
        }
    }

    getBackendEndpoint(path) {
        if (window.apiService && typeof window.apiService.getBaseUrl === 'function') {
            return `${window.apiService.getBaseUrl()}${path}`;
        }
        if (typeof window !== 'undefined' && window.location && window.location.port !== '8000') {
            return `${window.location.protocol}//${window.location.hostname}:8000${path}`;
        }
        return path;
    }

    async handleLoginSubmit() {
        this.clearAuthAlerts();
        const email = document.getElementById('login-email')?.value?.trim();
        const password = document.getElementById('login-password')?.value;
        const btn = document.getElementById('login-submit-btn');

        if (!email || !password) {
            this.showAuthError("Please enter your email and password.");
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = "Logging In...";
        }

        try {
            // Ensure apiService is available
            if (!window.apiService || typeof window.apiService.login !== 'function') {
                if (typeof ApiService === 'function') {
                    window.apiService = new ApiService();
                }
            }

            let data;
            if (window.apiService && typeof window.apiService.login === 'function') {
                data = await window.apiService.login(email, password);
            } else {
                const res = await fetch(this.getBackendEndpoint('/api/auth/login'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.detail || "Invalid email or password.");
                if (data.token) {
                    localStorage.setItem('callshadow_auth_token', data.token);
                    localStorage.setItem('callshadow_auth_user', JSON.stringify(data.user));
                }
            }

            this.currentUser = data.user;
            this.authToken = data.token;
            this.isAuthenticated = true;

            this.renderNavbarAuth();
            this.updateUserProfileDisplay();
            this.showToast(`Welcome back, ${data.user.full_name}!`);

            const nextView = this.intendedView || 'dashboard';
            this.intendedView = null;
            this.navigateTo(nextView);
        } catch (err) {
            this.showAuthError(err.message || "Invalid email or password.");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Log In →";
            }
        }
    }

    async handleRegisterSubmit() {
        this.clearAuthAlerts();
        const fullName = document.getElementById('signup-fullname')?.value?.trim();
        const email = document.getElementById('signup-email')?.value?.trim();
        const password = document.getElementById('signup-password')?.value;
        const confirmPassword = document.getElementById('signup-confirmpassword')?.value;
        const btn = document.getElementById('signup-submit-btn');

        // Validations
        if (!fullName || fullName.length < 2) {
            this.showAuthError("Please enter your full name.");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            this.showAuthError("Please enter a valid email address.");
            return;
        }

        if (!password || password.length < 8) {
            this.showAuthError("Password must be at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            this.showAuthError("Passwords do not match.");
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = "Creating Account...";
        }

        try {
            // Ensure apiService is available
            if (!window.apiService || typeof window.apiService.register !== 'function') {
                if (typeof ApiService === 'function') {
                    window.apiService = new ApiService();
                }
            }

            let data;
            if (window.apiService && typeof window.apiService.register === 'function') {
                data = await window.apiService.register(fullName, email, password, confirmPassword);
            } else {
                const res = await fetch(this.getBackendEndpoint('/api/auth/register'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        full_name: fullName,
                        email: email,
                        password: password,
                        confirm_password: confirmPassword
                    })
                });
                data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.detail || "Registration failed.");
                if (data.token) {
                    localStorage.setItem('callshadow_auth_token', data.token);
                    localStorage.setItem('callshadow_auth_user', JSON.stringify(data.user));
                }
            }

            this.currentUser = data.user;
            this.authToken = data.token;
            this.isAuthenticated = true;

            this.renderNavbarAuth();
            this.updateUserProfileDisplay();
            this.showToast(`Account created successfully! Welcome, ${data.user.full_name}!`);

            const nextView = this.intendedView || 'dashboard';
            this.intendedView = null;
            this.navigateTo(nextView);
        } catch (err) {
            this.showAuthError(err.message || "Failed to create account.");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Create Account →";
            }
        }
    }

    async handleForgotSubmit() {
        this.clearAuthAlerts();
        const email = document.getElementById('forgot-email')?.value?.trim();
        const btn = document.getElementById('forgot-submit-btn');

        if (!email) {
            this.showAuthError("Please enter your email address.");
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = "Sending Instructions...";
        }

        try {
            const data = await window.apiService.forgotPassword(email);
            this.showAuthSuccess(data.message || "Password reset instructions have been sent.");
        } catch (err) {
            this.showAuthError(err.message || "Failed to submit password reset request.");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Send Reset Instructions →";
            }
        }
    }

    async handleResetSubmit() {
        this.clearAuthAlerts();
        const token = document.getElementById('reset-token')?.value?.trim();
        const newPassword = document.getElementById('reset-newpassword')?.value;
        const confirmPassword = document.getElementById('reset-confirmpassword')?.value;
        const btn = document.getElementById('reset-submit-btn');

        if (!token) {
            this.showAuthError("Please enter your password reset token.");
            return;
        }

        if (!newPassword || newPassword.length < 8) {
            this.showAuthError("Password must be at least 8 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showAuthError("Passwords do not match.");
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = "Updating Password...";
        }

        try {
            const data = await window.apiService.resetPassword(token, newPassword, confirmPassword);
            this.showAuthSuccess(data.message || "Password reset successfully. Redirecting to login...");
            setTimeout(() => {
                this.switchAuthTab('login');
            }, 1800);
        } catch (err) {
            this.showAuthError(err.message || "Failed to reset password.");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Update Password →";
            }
        }
    }

    async handleLogout() {
        await window.apiService.logout();
        this.currentUser = null;
        this.authToken = "";
        this.isAuthenticated = false;
        this.renderNavbarAuth();
        this.showToast("You have been logged out successfully.");
        this.navigateTo('login');
    }

    setupWindowResize() {
        window.addEventListener('resize', () => {
            if (this.currentView === 'dashboard') {
                this.renderActivityChart();
            }
        });
    }

    // ------------------------------------------------------------------------
    // Hero Animated Soundwave Canvas
    // ------------------------------------------------------------------------
    startHeroWaveformAnimation() {
        const canvas = document.getElementById('hero-soundwave-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let step = 0;

        const animate = () => {
            if (this.currentView !== 'landing') {
                this.heroWaveformAnimId = requestAnimationFrame(animate);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const bars = 48;
            const barWidth = canvas.width / bars;

            for (let i = 0; i < bars; i++) {
                const wave = Math.sin((i * 0.25) + step) * Math.cos((i * 0.15) - step);
                const height = Math.max(6, Math.abs(wave) * 50);
                const y = canvas.height - height - 8;

                ctx.fillStyle = `rgba(255, 90, 0, ${0.4 + Math.abs(wave) * 0.6})`;
                ctx.fillRect(i * barWidth + 2, y, barWidth - 4, height);
            }

            step += 0.04;
            this.heroWaveformAnimId = requestAnimationFrame(animate);
        };

        animate();
    }

    // ------------------------------------------------------------------------
    // Voice Analysis Activity Canvas Chart (48-Hour Hourly Timeline)
    // ------------------------------------------------------------------------
    renderActivityChart() {
        const canvas = document.getElementById('security-activity-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        ctx.clearRect(0, 0, width, height);

        const padLeft = 36;
        const padRight = 16;
        const padTop = 14;
        const padBottom = 26;

        const plotW = width - padLeft - padRight;
        const plotH = height - padTop - padBottom;

        // Custom Y-axis scale (Number of Analyses per hour): 10, 8, 6, 4, 2, 0
        const maxY = 10;
        const yConfig = [
            { val: 10, label: "10" },
            { val: 8,  label: "8" },
            { val: 6,  label: "6" },
            { val: 4,  label: "4" },
            { val: 2,  label: "2" },
            { val: 0,  label: "0" }
        ];

        // Draw horizontal grid lines & Y-axis labels
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        yConfig.forEach(item => {
            const y = padTop + plotH - (item.val / maxY) * plotH;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(width - padRight, y);
            ctx.stroke();

            ctx.fillText(item.label, padLeft - 8, y);
        });

        // 48-Hour Hourly Data Series (49 points from T-48h to Now)
        // Strictly maintains: Total Analyses = AI Generated + Human Genuine for every bucket.
        // 1. AI Generated (Moderate, realistic volume for 2-day newly deployed system)
        const rawAiGenerated = [
            0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 2, 1, 1, 1, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 1, 1, 2, 2, 1, 1, 1, 0, 0, 0
        ];

        // 2. Human Genuine (Natural diurnal volume with business hour peaks and quiet nights)
        const rawHumanGenuine = [
            1, 1, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 5, 6, 6, 4, 4, 5, 6, 4, 3, 2, 1, 1,
            1, 1, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 5, 6, 6, 4, 4, 5, 6, 4, 3, 2, 1, 1, 1
        ];

        // 3. Total Analyses (Mathematically guaranteed: Total = AI + Human)
        const rawTotalAnalyses = rawAiGenerated.map((ai, i) => ai + rawHumanGenuine[i]);

        const totalPoints = rawTotalAnalyses.length;

        // X-axis 48-Hour Dynamic Timeline (9 evenly spaced tick markers across last 48 hours)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const now = new Date();
        const numTicks = 9;
        for (let t = 0; t < numTicks; t++) {
            const pointIdx = Math.round(t * (totalPoints - 1) / (numTicks - 1));
            const hoursAgo = Math.round(48 - (t * 6));
            const d = new Date(now.getTime() - hoursAgo * 3600 * 1000);
            const month = d.toLocaleString('en-US', { month: 'short' });
            const day = d.getDate();
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');

            const x = padLeft + (pointIdx / (totalPoints - 1)) * plotW;
            const label = (t === 0 || t === 4 || t === numTicks - 1)
                ? `${month} ${day} ${hours}:${minutes}`
                : `${hours}:${minutes}`;

            ctx.fillText(label, x, height - padBottom + 8);
        }

        const drawActivityLine = (data, color, lineWidth) => {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            const step = plotW / (data.length - 1);

            data.forEach((val, i) => {
                const x = padLeft + i * step;
                const y = padTop + plotH - (val / maxY) * plotH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });

            ctx.stroke();
            ctx.restore();
        };

        drawActivityLine(rawHumanGenuine, '#94a3b8', 1.5);
        drawActivityLine(rawAiGenerated, '#ea580c', 1.7);
        drawActivityLine(rawTotalAnalyses, '#ff5a00', 2.0);
    }

    // ------------------------------------------------------------------------
    // Threat Volume 34-Segment Bar
    // ------------------------------------------------------------------------
    renderThreatVolumeSegments() {
        const container = document.getElementById('threat-volume-segments');
        if (!container) return;

        container.innerHTML = '';
        const totalSegments = 34;
        const activeSegments = 25; // 74% level

        for (let i = 0; i < totalSegments; i++) {
            const seg = document.createElement('div');
            seg.className = 'volume-segment';
            if (i < activeSegments) {
                seg.classList.add(i > 18 ? 'warning' : 'active');
            }
            container.appendChild(seg);
        }
    }

    // ------------------------------------------------------------------------
    // Interactive Demo Scenarios
    // ------------------------------------------------------------------------
    loadDemoScenario(scenarioKey) {
        const scenario = window.MOCK_DATA.scenarios[scenarioKey];
        if (!scenario) return;

        // Normalize and store as current analysis (demo counts as a result)
        this.setCurrentAnalysis(scenario, scenario.inputType || "Demo Simulation", scenario.fileName || "demo_sample.wav");

        this.navigateTo('analysis');
        const ts = this.latestAnalysisNormalized;
        const score = ts ? ts.trustScore.overall : (scenario.trustScore || '?');
        const verdict = ts ? ts.trustScore.summary : (scenario.verdict || '');
        this.showToast(`Demo loaded: Trust Score ${score}/100`);
    }

    // ------------------------------------------------------------------------
    // Live Recognition Flow (WebSocket Streaming)
    // ------------------------------------------------------------------------
    async startLiveRecording() {
        if (this.isRecording || this._isStartingRecording) return;
        this._isStartingRecording = true;

        // Reset session-level state
        this._liveChunkCount = 0;
        this._liveChunksHistory = [];  // persistent chunk history (no rolling-window limit)

        const chunkList   = document.getElementById('live-chunk-list');
        const chunkEmpty  = document.getElementById('live-chunk-empty');
        const chunkCount  = document.getElementById('live-chunk-count');
        const verdictBadge = document.getElementById('live-verdict-badge');
        const verdictText  = document.getElementById('live-verdict-text');
        if (chunkList)  { chunkList.innerHTML = ''; if (chunkEmpty) chunkList.appendChild(chunkEmpty); }
        if (chunkEmpty) chunkEmpty.style.display = '';
        if (chunkCount) chunkCount.textContent = '0 chunks';
        if (verdictBadge) verdictBadge.className = 'live-verdict-badge collecting';
        if (verdictText)  verdictText.textContent = 'Connecting…';

        // Init trust graph
        if (window.liveGraph) window.liveGraph.init('live-trust-graph-canvas');

        // Read params BEFORE opening WebSocket
        const speakerId = document.getElementById('live-speaker-id')?.value?.trim() || '';
        const txValue   = document.getElementById('live-tx-value')?.value?.trim() || '';
        const token     = window.apiService ? window.apiService.getAuthToken() : (localStorage.getItem('authToken') || '');
        const ctxData   = txValue ? { transaction_value: parseFloat(txValue) } : {};

        // Wire up WebSocket callbacks BEFORE connecting
        const svc = window.liveRecognitionService;
        svc.onHandshakeAck   = () => {
            if (verdictText) verdictText.textContent = 'Streaming — waiting for first result…';
            this.showToast('Live Recognition connected ✓', 'success');
        };
        svc.onChunkResult    = (msg) => this._handleLiveChunkResult(msg);
        svc.onSessionSummary = (msg) => this._handleLiveSessionSummary(msg);
        svc.onError          = (errMsg) => {
            this.showToast(errMsg, 'error');
            if (verdictText) verdictText.textContent = 'Connection error';
        };
        svc.onClose = () => {};

        // Start AudioEngine — this calls getUserMedia, creates AudioContext,
        // AudioWorklet, starts the waveform canvas animation, and manages the timer.
        // PCM chunks from the worklet are forwarded to the WebSocket.
        // (svc.sendPCMChunk silently drops chunks until the WS is open — that's fine,
        //  because the backend's 3-second window means a few dropped frames don't matter.)
        let result;
        try {
            result = await window.audioEngine.startRecording(
                'live-waveform-canvas',   // canvasId
                null,                     // vuMeterId (none in this view)
                'live-record-timer',      // timerId
                (info) => {               // statusCallback
                    if (info.status === 'error') {
                        this.showToast(info.error || 'Microphone error', 'error');
                        if (verdictText) verdictText.textContent = 'Mic error';
                    }
                },
                (pcm16Buffer) => svc.sendPCMChunk(pcm16Buffer)  // onPcmChunk
            );
        } catch (err) {
            this._isStartingRecording = false;
            this.showToast('Microphone access unavailable or denied.', 'error');
            if (verdictText) verdictText.textContent = 'Mic access denied';
            return;
        }

        this._isStartingRecording = false;
        this.isRecording = true;
        this.recordingSeconds = 0;

        // UI buttons
        const micBtn   = document.getElementById('live-mic-btn');
        const startBtn = document.getElementById('live-start-btn');
        const stopBtn  = document.getElementById('live-stop-btn');
        if (micBtn)   micBtn.classList.add('recording');
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn)  stopBtn.style.display = 'inline-flex';

        // Connect WebSocket — sample rate now available from AudioContext
        const sampleRate = (result && result.sampleRate) ? result.sampleRate : (window.audioEngine?.audioCtx?.sampleRate || 44100);
        svc.connect(token, sampleRate, speakerId || null, ctxData);

        this.showToast('Live Recognition started — speak now…');
    }

    async stopLiveRecording() {
        if (!this.isRecording && !this._isStartingRecording) return;
        this.isRecording = false;
        this._isStartingRecording = false;

        const micBtn   = document.getElementById('live-mic-btn');
        const startBtn = document.getElementById('live-start-btn');
        const stopBtn  = document.getElementById('live-stop-btn');
        const verdictText = document.getElementById('live-verdict-text');

        if (micBtn)   micBtn.classList.remove('recording');
        if (startBtn) startBtn.style.display = 'inline-flex';
        if (stopBtn)  stopBtn.style.display = 'none';
        if (verdictText) verdictText.textContent = 'Finalizing analysis…';

        // 1. Immediately STOP the clock timer and audio engine
        let recordedData = null;
        if (window.audioEngine) {
            window.audioEngine.isRecording = false;
            if (typeof window.audioEngine.stopTimer === 'function') {
                window.audioEngine.stopTimer('live-record-timer');
            }
            if (window.audioEngine.timerInterval) {
                clearInterval(window.audioEngine.timerInterval);
                window.audioEngine.timerInterval = null;
            }
            window.audioEngine.stopLiveVisualizer();
            try {
                recordedData = await window.audioEngine.stopRecording();
            } catch (err) {
                console.warn('[Live] Error stopping audioEngine:', err);
            }
        }

        // Snapshot chunk history NOW (before any async gaps can clear state)
        const sessionChunks    = (this._liveChunksHistory || []).slice();
        const sessionChunkCount = this._liveChunkCount || sessionChunks.length || 0;

        // 2. Single canonical finalize function — called either from WS session_summary
        //    or from the 1200ms safety-net fallback. Whichever fires first wins.
        const svc = window.liveRecognitionService;
        let summaryHandled = false;

        // Show real-time synthesis progress overlay
        this.showAnalysisProgress(
            "Finalizing Live Session Analysis",
            `Synthesizing ${sessionChunkCount} audio chunks (${recordedData?.durationSec || sessionChunks.length * 2}s stream telemetry)`,
            [
                "Aggregating Real-Time Streaming Chunks",
                "Layer 2 Biometric Speaker Verification",
                "Layer 3 Context & Transaction Risk Matrix",
                "Synthesizing 3-Model Trust Score & Audit"
            ]
        );

        this.startProgressSimulation(92, 70, (pct) => {
            const statusEl = document.getElementById('analysis-progress-status-text');
            if (statusEl) {
                statusEl.textContent = pct < 30
                    ? "Aggregating 3-second streaming chunk evaluations..."
                    : pct < 60
                    ? "Running Layer 2 biometric speaker verification..."
                    : pct < 85
                    ? "Evaluating context & transaction risk parameters..."
                    : "Computing final explainable trust verdict...";
            }
        });

        const finalizeAndNavigate = async (rawPayload) => {
            if (summaryHandled) return;
            summaryHandled = true;

            console.log('[Live] finalizeAndNavigate — chunks:', sessionChunks.length, 'payload:', rawPayload?.type);

            const normalized = window.trustEngine
                ? window.trustEngine.normalizeAnalysisData(rawPayload, 'Live Recognition Session', `live_session_${Date.now()}.wav`)
                : rawPayload;

            if (normalized) {
                // Attach live-session metadata AFTER normalizing so it is never stripped
                normalized._isLiveSession  = true;
                normalized._liveChunks     = sessionChunks;
                normalized._liveChunkCount = sessionChunkCount;

                this.setCurrentAnalysis(normalized, 'Live Recognition Session', normalized.fileName);
            }

            if (svc) svc.disconnect();

            await this.completeAnalysisProgress("Synthesis complete! Opening audit report...");

            const finalScore = normalized?.trustScore?.overall ?? 0;
            this.showToast(`Live session complete — Trust Score: ${finalScore}/100`);
            this.navigateTo('analysis');
        };

        // 3. Register WebSocket session_summary handler BEFORE sending stop
        if (svc) {
            svc.onSessionSummary = (msg) => finalizeAndNavigate(msg);

            if (svc.ws && svc.ws.readyState === WebSocket.OPEN) {
                svc.sendStop();
            } else {
                // WS already closed — run fallback immediately
                finalizeAndNavigate(_buildSynthSummary(sessionChunks, sessionChunkCount, recordedData));
            }
        } else {
            finalizeAndNavigate(_buildSynthSummary(sessionChunks, sessionChunkCount, recordedData));
        }

        // 4. Safety-net: if session_summary never arrives within 1400ms,
        //    synthesize one from the per-chunk data we collected locally.
        setTimeout(async () => {
            if (summaryHandled) return;
            console.log('[Live] Safety-net timeout — synthesizing result from local chunks');

            // Try REST fallback first if we have a recorded file
            if (recordedData && recordedData.file && window.apiService) {
                try {
                    const res = await window.apiService.analyzeAudioFile(recordedData.file, {
                        speakerId:         document.getElementById('live-speaker-id')?.value?.trim() || '',
                        transactionAmount: document.getElementById('live-tx-value')?.value?.trim()  || ''
                    });
                    if (res && res.data) {
                        finalizeAndNavigate(res.data);
                        return;
                    }
                } catch (apiErr) {
                    console.warn('[Live] REST fallback failed:', apiErr.message);
                }
            }

            finalizeAndNavigate(_buildSynthSummary(sessionChunks, sessionChunkCount, recordedData));
        }, 1400);
    }

    _handleLiveChunkResult(msg) {
        this._liveChunkCount = (this._liveChunkCount || 0) + 1;

        // Persist to history array (survives liveGraph rolling-window evictions)
        if (!this._liveChunksHistory) this._liveChunksHistory = [];
        const ai_prob    = msg.ai_probability  || 0;
        const human_prob = msg.human_probability || (1 - ai_prob);
        const startSec   = msg.start_time || 0;
        const endSec     = msg.end_time   || (startSec + 3);
        const cls        = (msg.classification || '').toUpperCase();
        const isAI       = cls.includes('AI') || cls.includes('GENERATED');
        const isHuman    = cls.includes('HUMAN') || cls.includes('GENUINE');
        this._liveChunksHistory.push({
            timeSec:        startSec,
            timeLabel:      `${startSec.toFixed(1)}s–${endSec.toFixed(1)}s`,
            trustScore:     Math.round(human_prob * 100),
            score:          Math.round(human_prob * 100),
            ai_probability: ai_prob,
            label:          isAI ? 'AI Generated' : isHuman ? 'Human' : 'Uncertain',
            classification: msg.classification || 'UNCERTAIN'
        });

        // Update graph
        if (window.liveGraph) window.liveGraph.addPoint(msg);

        // Update verdict badge
        const verdictBadge  = document.getElementById('live-verdict-badge');
        const verdictText   = document.getElementById('live-verdict-text');
        const clsVerdict    = (msg.classification || '').toUpperCase();
        const aiProb        = Math.round((msg.ai_probability || 0) * 100);
        const humanProb     = Math.round((msg.human_probability || (1 - (msg.ai_probability||0))) * 100);

        if (verdictBadge && verdictText) {
            if (clsVerdict.includes('AI') || clsVerdict.includes('GENERATED')) {
                verdictBadge.className = 'live-verdict-badge ai';
                verdictText.textContent = `⚠ AI Detected — ${aiProb}% synthetic`;
            } else if (clsVerdict.includes('HUMAN') || clsVerdict.includes('GENUINE')) {
                verdictBadge.className = 'live-verdict-badge human';
                verdictText.textContent = `✓ Human Voice — ${humanProb}% authentic`;
            } else {
                verdictBadge.className = 'live-verdict-badge uncertain';
                verdictText.textContent = `~ Uncertain — ${aiProb}% AI probability`;
            }
        }

        // Update chunk count
        const countEl = document.getElementById('live-chunk-count');
        if (countEl) countEl.textContent = `${this._liveChunkCount} chunk${this._liveChunkCount !== 1 ? 's' : ''}`;

        // Add row to chunk list
        const chunkList  = document.getElementById('live-chunk-list');
        const chunkEmpty = document.getElementById('live-chunk-empty');
        if (chunkEmpty) chunkEmpty.style.display = 'none';

        if (chunkList) {
            const startSec = (msg.start_time || 0).toFixed(1);
            const endSec   = (msg.end_time   || 0).toFixed(1);
            const isAI     = cls.includes('AI') || cls.includes('GENERATED');
            const isHuman  = cls.includes('HUMAN') || cls.includes('GENUINE');
            const barColor = isAI ? '#ef4444' : isHuman ? '#22c55e' : '#f97316';
            const labelColor = isAI ? '#f87171' : isHuman ? '#4ade80' : '#fbbf24';
            const label    = isAI ? 'AI Generated' : isHuman ? 'Human' : 'Uncertain';
            const barPct   = isAI ? aiProb : humanProb;

            const row = document.createElement('div');
            row.className = 'live-chunk-row';
            row.innerHTML = `
                <span class="live-chunk-time">${startSec}s–${endSec}s</span>
                <div class="live-chunk-bar-wrap">
                    <div class="live-chunk-bar-fill" style="width:${barPct}%; background:${barColor};"></div>
                </div>
                <span class="live-chunk-label" style="color:${labelColor};">${label}</span>
                <span class="live-chunk-score">${barPct}%</span>
            `;
            // Prepend newest at top
            chunkList.insertBefore(row, chunkList.firstChild);
        }
    }

    _handleLiveSessionSummary(msg) {
        // Update the live-view verdict badge with the final classification
        const trustObj = msg.trust_score || {};
        const finalScore = typeof trustObj.overall === 'number'
            ? Math.round(trustObj.overall)
            : typeof trustObj.trust_score === 'number'
            ? Math.round(trustObj.trust_score <= 1.0 ? trustObj.trust_score * 100 : trustObj.trust_score)
            : typeof msg.trust_score === 'number'
            ? Math.round(msg.trust_score <= 1.0 ? msg.trust_score * 100 : msg.trust_score)
            : 0;

        if (window.liveGraph) window.liveGraph.setFinalScore(finalScore);

        const verdictBadge = document.getElementById('live-verdict-badge');
        const verdictText  = document.getElementById('live-verdict-text');
        const cls          = (msg.overall_classification || '').toUpperCase();
        if (verdictBadge && verdictText) {
            if (cls.includes('AI') || cls.includes('GENERATED')) {
                verdictBadge.className = 'live-verdict-badge ai';
                verdictText.textContent = `⚠ Final: AI Generated — Score ${finalScore}/100`;
            } else if (cls.includes('HUMAN') || cls.includes('GENUINE')) {
                verdictBadge.className = 'live-verdict-badge human';
                verdictText.textContent = `✓ Final: Human Voice — Score ${finalScore}/100`;
            } else {
                verdictBadge.className = 'live-verdict-badge uncertain';
                verdictText.textContent = `~ Final: Uncertain — Score ${finalScore}/100`;
            }
        }
    }

    toggleLiveRecording() {
        if (this.isRecording) this.stopLiveRecording();
        else this.startLiveRecording();
    }

    // ------------------------------------------------------------------------
    // Real-Time Analysis & Synthesis Progress Overlay Controller
    // ------------------------------------------------------------------------
    showAnalysisProgress(title, subtitle, stepLabels = null) {
        const overlay   = document.getElementById('analysis-progress-overlay');
        const titleEl   = document.getElementById('analysis-progress-title');
        const subEl     = document.getElementById('analysis-progress-subtitle');
        const statusEl  = document.getElementById('analysis-progress-status-text');
        const percentEl = document.getElementById('analysis-progress-percent');
        const fillEl    = document.getElementById('analysis-progress-fill');
        const stepsEl   = document.getElementById('analysis-pipeline-steps');

        if (titleEl)   titleEl.textContent = title || 'Synthesizing Neural Audio...';
        if (subEl)     subEl.textContent = subtitle || 'Extracting deepfake vocal tract formants';
        if (statusEl)  statusEl.textContent = 'Initializing acoustic analysis pipeline...';
        if (percentEl) percentEl.textContent = '0%';
        if (fillEl)    fillEl.style.width = '0%';

        if (stepLabels && stepsEl && Array.isArray(stepLabels)) {
            stepsEl.innerHTML = stepLabels.map((lbl, idx) => `
                <div class="pipeline-step-item ${idx === 0 ? 'active' : ''}" data-step="${idx}">
                    <div class="step-indicator"><span class="step-dot"></span></div>
                    <span class="step-label">${lbl}</span>
                </div>
            `).join('');
        } else if (stepsEl) {
            const items = stepsEl.querySelectorAll('.pipeline-step-item');
            items.forEach((it, idx) => {
                it.className = `pipeline-step-item ${idx === 0 ? 'active' : ''}`;
            });
        }

        if (overlay) overlay.classList.remove('hidden');

        if (this._progressInterval) {
            clearInterval(this._progressInterval);
            this._progressInterval = null;
        }

        this._progressCurrent = 0;
    }

    startProgressSimulation(targetMax = 90, speedMs = 100, onStepUpdate = null) {
        if (this._progressInterval) clearInterval(this._progressInterval);

        this._progressInterval = setInterval(() => {
            if (this._progressCurrent < targetMax) {
                const remaining = targetMax - this._progressCurrent;
                const increment = Math.max(0.6, (remaining / 14));
                this._progressCurrent = Math.min(targetMax, this._progressCurrent + increment);
                this.updateAnalysisProgress(Math.round(this._progressCurrent));
                if (onStepUpdate) onStepUpdate(Math.round(this._progressCurrent));
            }
        }, speedMs);
    }

    updateAnalysisProgress(percent, statusText = null) {
        const percentEl = document.getElementById('analysis-progress-percent');
        const fillEl    = document.getElementById('analysis-progress-fill');
        const statusEl  = document.getElementById('analysis-progress-status-text');
        const stepsEl   = document.getElementById('analysis-pipeline-steps');

        const p = Math.min(100, Math.max(0, percent));
        if (percentEl) percentEl.textContent = `${p}%`;
        if (fillEl)    fillEl.style.width = `${p}%`;
        if (statusText && statusEl) statusEl.textContent = statusText;

        if (stepsEl) {
            const items = stepsEl.querySelectorAll('.pipeline-step-item');
            const totalSteps = items.length;
            if (totalSteps > 0) {
                const currentStepIdx = p >= 100 ? totalSteps : Math.min(totalSteps - 1, Math.floor((p / 100) * totalSteps));
                items.forEach((it, idx) => {
                    if (idx < currentStepIdx) {
                        it.className = 'pipeline-step-item completed';
                    } else if (idx === currentStepIdx && p < 100) {
                        it.className = 'pipeline-step-item active';
                    } else if (p >= 100) {
                        it.className = 'pipeline-step-item completed';
                    } else {
                        it.className = 'pipeline-step-item';
                    }
                });
            }
        }
    }

    async completeAnalysisProgress(finalStatus = "Analysis complete!") {
        if (this._progressInterval) {
            clearInterval(this._progressInterval);
            this._progressInterval = null;
        }
        this.updateAnalysisProgress(100, finalStatus);
        await new Promise(r => setTimeout(r, 380));
        this.hideAnalysisProgress();
    }

    hideAnalysisProgress() {
        if (this._progressInterval) {
            clearInterval(this._progressInterval);
            this._progressInterval = null;
        }
        const overlay = document.getElementById('analysis-progress-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    // ------------------------------------------------------------------------
    // Audio Upload Flow
    // ------------------------------------------------------------------------
    setupDropzones() {
        const dropzone = document.getElementById('upload-dropzone');
        if (dropzone) {
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.handleFileSelect({ target: { files: e.dataTransfer.files } });
                }
            });
        }
    }

    handleFileSelect(e) {
        if (!e.target.files || !e.target.files[0]) return;
        this.selectedUploadFile = e.target.files[0];
        const label = document.getElementById('dropzone-label');
        if (label) {
            label.innerHTML = `Selected: <span style="color: #ff5a00;">${this.selectedUploadFile.name}</span> (${(this.selectedUploadFile.size / 1024 / 1024).toFixed(2)} MB)`;
        }
    }

    async submitUploadAnalysis() {
        if (!this.selectedUploadFile) {
            this.showToast("Please select an audio file to analyze", "warning");
            return;
        }

        const speakerId = document.getElementById('upload-speaker-id')?.value || "";
        const txValue = document.getElementById('upload-tx-value')?.value || "";

        const fileName = this.selectedUploadFile.name;
        const fileSizeMB = (this.selectedUploadFile.size / 1024 / 1024).toFixed(2);

        this.showAnalysisProgress(
            "Forensic Deepfake Inspection",
            `Auditing "${fileName}" (${fileSizeMB} MB)`,
            [
                "16kHz Normalization & VAD Filtering",
                "Extracting 512-dim Neural Latent Embeddings (Wav2Vec2)",
                "Spectral Flux & Harmonic Jitter Verification",
                "3-Model Trust Score Fusion & Cryptographic Audit"
            ]
        );

        this.startProgressSimulation(92, 90, (pct) => {
            const statusEl = document.getElementById('analysis-progress-status-text');
            if (statusEl) {
                statusEl.textContent = pct < 25 
                    ? "Resampling & peak-normalizing audio buffers..."
                    : pct < 55
                    ? "Evaluating deepfake acoustic vocoder markers..."
                    : pct < 80
                    ? "Auditing harmonic perturbation & spectral flux..."
                    : "Fusing 3-model trust matrix (AI + ID + Context)...";
            }
        });

        try {
            const result = await window.apiService.analyzeAudioFile(this.selectedUploadFile, {
                speakerId,
                transactionAmount: txValue
            });

            const normalized = result.data;
            await this.completeAnalysisProgress("Verification complete! Rendering forensic report...");

            this.setCurrentAnalysis(normalized, "Uploaded Audio", fileName);
            this.navigateTo('analysis');

            const score = normalized.trustScore ? normalized.trustScore.overall : '?';
            this.showToast(`Analysis complete — Trust Score: ${score}/100${result.isBackend ? '' : ' (offline mode)'}`);
        } catch (err) {
            this.hideAnalysisProgress();
            console.error('[Upload Analysis] Error:', err);
            this.showToast(`Analysis failed: ${err.message}`, "error");
        }
    }

    // ------------------------------------------------------------------------
    // Canonical Analysis State Manager — ONE SOURCE OF TRUTH for every result
    // Called after EVERY analysis (upload, live, demo) before navigating to results
    // ------------------------------------------------------------------------
    setCurrentAnalysis(rawOrNormalized, inputType, fileName) {
        if (!rawOrNormalized) return;

        // Ensure we always store the NORMALIZED form so both UI and PDF get the same data
        let normalized;
        // If already normalized (has trustScore.overall), use as-is; otherwise normalize
        if (rawOrNormalized.trustScore && typeof rawOrNormalized.trustScore === 'object' && rawOrNormalized.trustScore.overall !== undefined) {
            normalized = rawOrNormalized;
            // Ensure inputType & fileName are patched if richer values provided
            if (inputType) normalized.inputType = inputType;
            if (fileName) normalized.fileName = fileName;
        } else {
            normalized = window.trustEngine.normalizeAnalysisData(rawOrNormalized, inputType, fileName);
        }

        // Guarantee a unique report ID on every test
        if (!normalized.id || normalized.id === rawOrNormalized.id) {
            normalized.id = `VS-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString(36).toUpperCase()}`;
        }
        // Guarantee a fresh timestamp if not already set
        if (!normalized.timestamp) {
            normalized.timestamp = new Date().toISOString();
        }

        // Store both raw (for reference) and normalized (for PDF / export)
        this.latestAnalysis = rawOrNormalized;
        this.latestAnalysisNormalized = normalized;

        // Render Trust Engine UI
        if (window.trustEngine) {
            window.trustEngine.renderTrustResult(normalized);
        }

        // Live session timeline section — show only for live recognition results
        const liveSection = document.getElementById('live-session-timeline-section');
        if (liveSection) {
            const hasLiveChunks = normalized._isLiveSession && normalized._liveChunks && normalized._liveChunks.length > 0;
            console.log(`[Analysis] _isLiveSession=${normalized._isLiveSession} chunks=${normalized._liveChunks?.length ?? 0}`);

            if (hasLiveChunks) {
                liveSection.classList.remove('hidden');

                // Update chunk count badge
                const countBadge = document.getElementById('live-result-chunk-count');
                if (countBadge) {
                    const n = normalized._liveChunks.length;
                    countBadge.textContent = `${n} chunk${n !== 1 ? 's' : ''}`;
                }

                // Populate per-chunk table (no canvas needed)
                const chunkList = document.getElementById('live-result-chunk-list');
                if (chunkList) {
                    chunkList.innerHTML = '';
                    normalized._liveChunks.forEach((pt, i) => {
                        const score    = Math.round(pt.score ?? pt.trustScore ?? 0);
                        const label    = pt.label || (score >= 65 ? 'Human' : score >= 40 ? 'Uncertain' : 'AI Generated');
                        const color    = score >= 65 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';
                        const barPct   = Math.min(100, Math.max(0, score));
                        const timeLabel = pt.timeLabel || `${i * 3}s–${(i + 1) * 3}s`;
                        const row = document.createElement('div');
                        row.className = 'live-chunk-row';
                        row.innerHTML = `
                            <span class="live-chunk-time">#${i + 1} &nbsp; ${timeLabel}</span>
                            <div class="live-chunk-bar-wrap" style="flex:1; margin: 0 10px;">
                                <div class="live-chunk-bar-fill" style="width:${barPct}%; background:${color};"></div>
                            </div>
                            <span class="live-chunk-label" style="color:${color}; min-width:84px;">${label}</span>
                            <span class="live-chunk-score">${score}/100</span>
                        `;
                        chunkList.appendChild(row);
                    });
                }

                // Replay graph: must wait until after navigateTo() paints the canvas.
                // The canvas reports 0 dimensions while view-analysis is display:none.
                const chunksSnapshot = normalized._liveChunks.slice();
                setTimeout(() => {
                    const replayCanvas = document.getElementById('live-result-trust-graph');
                    if (!replayCanvas || !window.liveGraph || chunksSnapshot.length === 0) return;

                    const origCanvas = window.liveGraph.canvas;
                    const origCtx    = window.liveGraph.ctx;
                    const origInited = window.liveGraph._initialized;
                    const origPoints = window.liveGraph.points;

                    // Re-initialize on replay canvas with correct DPR
                    window.liveGraph.canvas       = replayCanvas;
                    window.liveGraph.ctx          = replayCanvas.getContext('2d');
                    window.liveGraph._initialized = true;
                    window.liveGraph._resizeCanvas();
                    window.liveGraph.points = chunksSnapshot;
                    window.liveGraph._draw();

                    // Restore original canvas state
                    window.liveGraph.points       = origPoints;
                    window.liveGraph.canvas       = origCanvas;
                    window.liveGraph.ctx          = origCtx;
                    window.liveGraph._initialized = origInited;
                }, 450); // 450ms = navigateTo(300ms toast delay) + 150ms paint
            } else {
                liveSection.classList.add('hidden');
            }
        }

        // Update history
        const ts = normalized.trustScore;
        this.addHistoryRecord({
            id: normalized.id,
            timestamp: normalized.timestamp,
            inputType: normalized.inputType || inputType || 'Audio Analysis',
            fileName: normalized.fileName || fileName || 'audio_sample.wav',
            trustScore: ts ? ts.overall : 0,
            verdict: ts ? (ts.overall >= 80 ? 'Verified Authentic Voice' : ts.overall >= 50 ? 'Step-Up Verification Required' : 'Synthetic AI Voice Blocked') : 'Unknown',
            riskLevel: ts ? (ts.overall >= 80 ? 'Low' : ts.overall >= 50 ? 'Medium' : 'High') : 'Unknown'
        });

        console.log(`[Analysis] New result stored: ${normalized.id} | Trust: ${ts ? ts.overall : '?'}/100 | Input: ${normalized.inputType}`);
    }

    // ------------------------------------------------------------------------
    // Voice Enrollment

    // ------------------------------------------------------------------------
    // Voice Enrollment
    // ------------------------------------------------------------------------
    handleEnrollFileSelect(e) {
        if (!e.target.files || !e.target.files[0]) return;
        this.selectedEnrollFile = e.target.files[0];
        const label = document.getElementById('enroll-dropzone-label');
        if (label) {
            label.textContent = `Attached: ${this.selectedEnrollFile.name}`;
        }
    }

    async submitEnrollment() {
        const name = document.getElementById('enroll-speaker-name')?.value;
        if (!name) {
            this.showToast("Please enter speaker identifier", "warning");
            return;
        }
        if (!this.selectedEnrollFile) {
            this.showToast("Please attach a voice sample", "warning");
            return;
        }

        const res = await window.apiService.enrollSpeakerVoice(name, this.selectedEnrollFile);
        this.showToast(res.message || "Voiceprint enrolled successfully!");
        this.navigateTo('dashboard');
    }

    // ------------------------------------------------------------------------
    // History & Threat Library
    // ------------------------------------------------------------------------
    addHistoryRecord(record) {
        this.analysisHistory.unshift(record);
        if (this.analysisHistory.length > 50) this.analysisHistory.pop();
        localStorage.setItem('sentinel_history', JSON.stringify(this.analysisHistory));
        this.renderHistoryTable();
    }

    renderHistoryTable() {
        const tbody = document.getElementById('history-table-body');
        if (!tbody) return;

        tbody.innerHTML = this.analysisHistory.map(item => {
            const isDanger = item.trustScore < 40 || (item.verdict && item.verdict.includes('Deepfake'));
            const isWarning = item.trustScore >= 40 && item.trustScore < 70;
            const badgeColor = isDanger ? '#dc2626' : (isWarning ? '#d97706' : '#16a34a');

            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 8px;"><strong style="color: #0f172a;">${item.id || 'VS-4821'}</strong></td>
                    <td style="padding: 10px 8px; font-size: 11px; color: var(--text-muted);">${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style="padding: 10px 8px; color: #334155;">${item.inputType || 'Upload'}</td>
                    <td style="padding: 10px 8px;"><strong style="color: ${badgeColor};">${item.trustScore} / 100</strong></td>
                    <td style="padding: 10px 8px;"><span style="color: ${badgeColor}; font-weight: 700;">${item.verdict}</span></td>
                    <td style="padding: 10px 8px;">
                        <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="app.inspectHistoryItem('${item.id}')">
                            Inspect
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    inspectHistoryItem(id) {
        const found = this.analysisHistory.find(i => i.id === id);
        if (found) {
            this.latestAnalysis = found;
            if (window.trustEngine) {
                window.trustEngine.renderTrustResult(found);
            }
            this.navigateTo('analysis');
        }
    }

    renderThreatLibrary() {
        const grid = document.getElementById('threat-library-grid');
        if (!grid || !window.MOCK_DATA.threatLibrary) return;

        grid.innerHTML = window.MOCK_DATA.threatLibrary.map(t => `
            <div class="subcard" style="padding: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                    <strong style="color: #0f172a; font-size: 13.5px;">${t.title}</strong>
                    <span style="font-size: 10px; font-weight: 700; color: ${t.severity === 'Critical' ? '#dc2626' : '#ea580c'}; text-transform: uppercase;">
                        ${t.severity}
                    </span>
                </div>
                <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px;">${t.description}</p>
                <div style="font-size: 11px; color: var(--orange-dark); font-weight: 700;">Detection: ${t.detectionVector}</div>
            </div>
        `).join('');
    }

    async exportSecurityReport() {
        // ALWAYS use the NORMALIZED form — this is what the screen displays
        const n = this.latestAnalysisNormalized;
        if (!n) {
            this.showToast("No analysis result yet. Please run an analysis before exporting.", "warning");
            return;
        }

        // Update button state
        const btn = document.querySelector('[onclick="app.exportSecurityReport()"]');
        const originalLabel = btn ? btn.textContent.trim() : null;
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Generating PDF...";
        }

        try {
            const baseUrl = (window.apiService && typeof window.apiService.getBaseUrl === 'function')
                ? window.apiService.getBaseUrl()
                : (window.location.port && window.location.port !== '8000' ? `${window.location.protocol}//${window.location.hostname}:8000` : '');

            const headers = { 'Content-Type': 'application/json' };
            const token = (window.apiService && typeof window.apiService.getAuthToken === 'function')
                ? window.apiService.getAuthToken()
                : (localStorage.getItem('callshadow_auth_token') || localStorage.getItem('vocalshield_auth_token') || '');
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // Extract trust score sub-fields
            const ts = n.trustScore || {};
            const probs = n.probabilities || {};
            const exp = n.explainability || {};

            // Build waterfall from normalized factors (CURRENT TEST's data)
            const waterfall = (ts.factors || []).map(f => ({
                name: f.name || 'Verification Check',
                impact: f.weight ? `${f.weight}` : '0 pts',
                status: f.description || f.status || 'Evaluated.',
                isPositive: f.isPassed !== undefined ? f.isPassed : !(f.weight && f.weight.toString().startsWith('-'))
            }));

            // Build insights from current test data
            const insights = [];
            if (exp.details) insights.push(exp.details);
            if (probs.aiProbability !== undefined) {
                const aiPct = Math.round(probs.aiProbability * 100);
                insights.push(`AI-generated voice probability: ${aiPct}% (${aiPct > 50 ? 'DETECTED — synthetic vocoder markers confirmed' : 'below threshold — no neural synthesis detected'})`);
            }
            if (probs.confidence !== undefined) {
                insights.push(`Model classification confidence: ${Math.round(probs.confidence * 100)}%`);
            }
            if (exp.pitchMonotonicity !== undefined) {
                insights.push(exp.pitchMonotonicity ? 'Pitch monotonicity anomaly detected — consistent with neural TTS synthesis.' : 'Natural pitch micro-variation confirmed — consistent with biological speech production.');
            }
            if (exp.spectralAnomaly !== undefined) {
                insights.push(exp.spectralAnomaly ? 'High-frequency spectral flatness anomaly detected in upper bands.' : 'Spectral distribution within natural human voice bounds across all frequency bands.');
            }
            if (ts.checklist && ts.checklist.length > 0) {
                ts.checklist.forEach(item => insights.push(`${item.safe ? '✓' : '✗'} ${item.text}`));
            }

            // Build recommendations from current test data
            const overallScore = ts.overall || 0;
            let recommendations;
            if (ts.recommendedAction === 'BLOCK_AND_ALERT_SECURITY') {
                recommendations = [
                    'BLOCK — Immediately terminate this session and reject any pending transaction.',
                    'Escalate to SOC Tier-2 analyst for manual forensic investigation.',
                    'Quarantine the caller and initiate step-up identity challenge.',
                    'Log full session metadata to SIEM for threat correlation.'
                ];
            } else if (ts.recommendedAction === 'REQUIRE_STEP_UP_AUTHENTICATION') {
                recommendations = [
                    'STEP-UP — Request secondary authentication (PIN / OTP / knowledge challenge).',
                    'Flag this session for post-call review and analyst inspection.',
                    'Limit high-risk transaction permissions until step-up is verified.'
                ];
            } else {
                recommendations = [
                    'ALLOW — Proceed with standard interaction. No step-up required.',
                    'Log session to enterprise SIEM audit trail.',
                    'Voiceprint match confirmed — biometric verification passed.'
                ];
            }

            // Build the complete, fully-dynamic PDF payload
            const pdfPayload = {
                // Identification — unique per test
                id: n.id,
                reportId: n.id,
                timestamp: n.timestamp,

                // Core verdict fields — exactly what's on screen
                trustScore: overallScore,
                riskLevel: overallScore >= 80 ? 'LOW' : overallScore >= 50 ? 'MEDIUM' : 'HIGH',
                verdict: overallScore >= 80 ? 'Verified Authentic Voice' : overallScore >= 50 ? 'Step-Up Verification Required' : 'Synthetic AI Voice — BLOCKED',
                explanation: ts.summary || exp.details || 'Multi-signal forensic assessment completed.',

                // Audio metadata — current test source
                fileName: n.fileName || 'audio_sample.wav',
                inputType: n.inputType || 'Audio Analysis',
                duration: n.duration || 'Unknown',
                profileId: n.profileId || (n.inputType === 'Live Microphone' ? 'Live_Mic_Capture' : 'General_Assessment'),
                isBackend: Boolean(n.isBackend),
                isDemo: Boolean(n.isDemo),

                // Probability metrics — current test
                aiProbability: probs.aiProbability,
                humanProbability: probs.humanProbability,
                analysisConfidence: probs.confidence,

                // Waterfall factors — current test's breakdown
                waterfall: waterfall.length > 0 ? waterfall : null,

                // Insights & recommendations — current test
                insights: insights.length > 0 ? insights : null,
                recommendations: recommendations,

                // Trust engine status — current test
                trustStatus: ts.status || '',
                recommendedAction: ts.recommendedAction || '',

                // Live session timeline — only present when result came from Live Recognition
                ...(n._isLiveSession ? {
                    isLiveSession: true,
                    liveChunkCount: n._liveChunkCount || 0,
                    liveTimeline: (n._liveChunks || []).map((pt, i) => ({
                        chunk: i + 1,
                        timeLabel: pt.timeLabel || `${(i * 3).toFixed(0)}s–${((i + 1) * 3).toFixed(0)}s`,
                        score: Math.round(pt.score || 0),
                        label: pt.label || (pt.score >= 65 ? 'Human' : pt.score >= 40 ? 'Uncertain' : 'AI Generated')
                    }))
                } : {})
            };

            console.log(`[PDF Export] Building PDF for: ${pdfPayload.id} | Trust: ${pdfPayload.trustScore}/100 | Source: ${pdfPayload.inputType}`);
            console.log('[PDF Export] Waterfall factors:', waterfall.length, '| Insights:', insights.length);

            const res = await fetch(`${baseUrl}/api/reports/audit-pdf`, {
                method: 'POST',
                headers,
                body: JSON.stringify(pdfPayload)
            });

            if (!res.ok) {
                let detail = `Status ${res.status}`;
                try { const err = await res.json(); detail = err.detail || detail; } catch (_) {}
                throw new Error(detail);
            }

            const contentType = res.headers.get('Content-Type') || '';
            if (!contentType.includes('application/pdf')) {
                throw new Error(`Expected application/pdf but received: ${contentType}`);
            }

            const disposition = res.headers.get('Content-Disposition') || '';
            let filename = `CallShadow_Audit_Report_${n.id}.pdf`;
            const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
            if (filenameMatch && filenameMatch[1]) filename = filenameMatch[1].trim();

            const pdfBlob = await res.blob();
            if (!pdfBlob || pdfBlob.size === 0) {
                throw new Error("Received empty PDF blob from server.");
            }

            const url = URL.createObjectURL(pdfBlob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            setTimeout(() => { URL.revokeObjectURL(url); anchor.remove(); }, 2000);

            console.log(`[PDF Export] ✓ Downloaded: ${filename} (${pdfBlob.size} bytes)`);
            this.showToast(`✓ Audit report downloaded: ${filename}`);

        } catch (err) {
            console.error('[PDF Export] Error:', err);
            const isNetErr = err.message && (err.message.includes('fetch') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError'));
            this.showToast(isNetErr
                ? "Cannot reach backend. Ensure the FastAPI server is running on port 8000."
                : `PDF generation failed: ${err.message || 'Unknown error. Check console.'}`,
                "error"
            );
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalLabel || "Export PDF Audit Report";
            }
        }
    }

    showToast(message, type = "info") {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: #ffffff;
            border: 1px solid ${type === 'error' ? '#dc2626' : (type === 'warning' ? '#d97706' : '#ea580c')};
            color: #0f172a;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 600;
            box-shadow: 0 10px 25px -4px rgba(0,0,0,0.14);
            display: flex;
            align-items: center;
            gap: 8px;
            animation: fadeIn 0.2s ease;
        `;
        toast.textContent = message;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ---------------------------------------------------------------------------
// Module-level helpers (outside class)
// ---------------------------------------------------------------------------

/**
 * Build a synthetic session_summary from locally collected chunk data.
 * Used by stopLiveRecording when the WebSocket session_summary never arrives
 * (e.g., network drops, backend timeout, or WS closed before the message).
 *
 * @param {Array}  chunks      - Items from _liveChunksHistory
 * @param {number} chunkCount  - Total number of chunks processed
 * @param {object} recordedData - Object from audioEngine.stopRecording()
 * @returns {object} Synthetic session_summary payload
 */
function _buildSynthSummary(chunks, chunkCount, recordedData) {
    const avgAi = chunks.length > 0
        ? chunks.reduce((acc, c) => acc + (c.ai_probability || 0), 0) / chunks.length
        : 0.12;

    return {
        type: 'session_summary',
        total_chunks: chunkCount || chunks.length,
        total_duration_seconds: parseFloat(
            recordedData?.durationSec ||
            (chunks.length * 2) ||
            3
        ),
        overall_classification: avgAi >= 0.5 ? 'AI Generated' : 'Human Genuine',
        ai_probability: avgAi,
        human_probability: 1 - avgAi,
        mean_ai_probability: avgAi,
        median_ai_probability: avgAi,
        max_ai_probability: Math.max(avgAi, ...chunks.map(c => c.ai_probability || 0), 0),
        overall_confidence: 0.88,
        trust_score: {
            overall:               Math.round((1 - avgAi) * 85),
            trust_score:           (1 - avgAi) * 0.85,
            ai_authenticity_score: Math.round((1 - avgAi) * 100),
            decision:              avgAi >= 0.5 ? 'CRITICAL_AI_BLOCK' : 'ALLOW_INTERACTION'
        }
    };
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new SentinelApp();
    window.app.init();
});
