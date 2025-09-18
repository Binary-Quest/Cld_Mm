class StudySpendPro {
    constructor() {
        this.currentUser = null;
        this.expenses = [];
        this.recurringBills = [];
        this.unsubscribeExpenses = null;
        this.currentPeriod = {
            duration: 30,
            startDate: new Date().toISOString().split('T')[0],
            budget: 10000
        };
        this.currentMonth = new Date().toISOString().substring(0, 7);
        this.archivedMonths = [];
        this.charts = {};
        
        // Auto logout timer
        this.idleTimer = null;
        this.lastActivity = Date.now();
        this.IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
        this.hasShownWelcome = false;
        this.authInitialized = false; // Track if auth is initialized
        
        this.init();
    }

    init() {
        this.showSplashScreen();
        this.setupEventListeners();
        this.setupAuthStateListener(); // This is the key method
        this.setupIdleTimer();
        
        // Online/offline detection
        window.addEventListener('online', () => this.updateSyncStatus('synced'));
        window.addEventListener('offline', () => this.updateSyncStatus('offline'));
    }

    showSplashScreen() {
        setTimeout(() => {
            this.transitionToAuth();
        }, 3000);
    }

    transitionToAuth() {
        const splash = document.getElementById('splash-screen');
        splash.style.animation = 'fadeOut 0.8s ease-out forwards';
        
        setTimeout(() => {
            splash.classList.add('hidden');
            // DON'T show auth screen here - let setupAuthStateListener handle it
        }, 800);
    }

    // 🔧 FIXED AUTH STATE LISTENER - This is the key fix
    setupAuthStateListener() {
        console.log('Setting up Firebase auth listener...');
        
        if (!window.firebase || !window.firebase.auth) {
            console.log('Firebase not ready, retrying in 1 second...');
            setTimeout(() => this.setupAuthStateListener(), 1000);
            return;
        }
        
        // Set persistence ONCE
        window.firebase.auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                console.log('✅ Auth persistence set to LOCAL');
                
                // Set up the auth state listener - THIS IS THE ONLY PLACE WE CHECK AUTH STATE
                window.firebase.onAuthStateChanged(window.firebase.auth, async (user) => {
                    console.log('🔄 Auth state changed:', user ? `User: ${user.email}` : 'No user');
                    
                    // Mark auth as initialized after first callback
                    if (!this.authInitialized) {
                        this.authInitialized = true;
                        console.log('✅ Auth initialized');
                    }
                    
                    if (user) {
                        // User is signed in
                        this.currentUser = user;
                        console.log('👤 User logged in:', user.email);
                        
                        try {
                            await this.setupUserProfile();
                            this.showMainApp();
                            this.resetIdleTimer();
                            
                            // Show welcome message only once per session
                            if (!this.hasShownWelcome) {
                                this.showNotification(`Welcome back, ${user.displayName || user.email}!`, 'success');
                                this.hasShownWelcome = true;
                            }
                        } catch (error) {
                            console.error('Error setting up user profile:', error);
                            this.showNotification('Error loading user data', 'error');
                        }
                    } else {
                        // User is signed out
                        this.currentUser = null;
                        console.log('🚪 User signed out');
                        
                        this.clearIdleTimer();
                        this.hasShownWelcome = false;
                        
                        // Only show auth screen if auth is initialized (not during initial load)
                        if (this.authInitialized) {
                            this.showAuthScreen();
                        }
                    }
                });
            })
            .catch((error) => {
                console.error('❌ Error setting auth persistence:', error);
                this.showNotification('Error initializing authentication', 'error');
            });
    }

    showAuthScreen() {
        console.log('📱 Showing auth screen');
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
    }

    showMainApp() {
        console.log('🏠 Showing main app');
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        this.loadUserData();
        this.updateDashboard();
        this.updateCurrentMonthDisplay();
    }

    // 🔧 FIXED LOGIN HANDLING with proper error management
    async handleLogin() {
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const btn = document.getElementById('login-btn') || document.querySelector('#login-form .auth-btn');
        
        if (!emailInput || !passwordInput) {
            console.error('❌ Login form inputs not found');
            this.showNotification('Login form not found', 'error');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            this.showNotification('Please enter both email and password', 'error');
            return;
        }
        
        console.log('🔐 Attempting login for:', email);
        
        try {
            // Set loading state
            this.setButtonLoading(btn, true);
            
            // Attempt sign in
            const userCredential = await window.firebase.signInWithEmailAndPassword(
                window.firebase.auth, 
                email, 
                password
            );
            
            console.log('✅ Login successful:', userCredential.user.uid);
            
            // Clear form
            emailInput.value = '';
            passwordInput.value = '';
            
            // Reset labels
            this.fixInputLabels();
            
            // Success message will be shown by onAuthStateChanged
            
        } catch (error) {
            console.error('❌ Login error:', error.code, error.message);
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            // Always clear loading state
            this.setButtonLoading(btn, false);
        }
    }

    // 🔧 FIXED REGISTRATION HANDLING
    async handleRegister() {
        const nameInput = document.getElementById('register-name');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        const confirmInput = document.getElementById('register-confirm');
        const btn = document.getElementById('register-btn') || document.querySelector('#register-form .auth-btn');
        
        if (!nameInput || !emailInput || !passwordInput || !confirmInput) {
            console.error('❌ Registration form inputs not found');
            this.showNotification('Registration form not found', 'error');
            return;
        }

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;
        
        if (!name || !email || !password || !confirmPassword) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match!', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters!', 'error');
            return;
        }
        
        console.log('📝 Attempting registration for:', email);
        
        try {
            // Set loading state
            this.setButtonLoading(btn, true);
            
            // Create account
            const userCredential = await window.firebase.createUserWithEmailAndPassword(
                window.firebase.auth, 
                email, 
                password
            );
            
            // Update user profile with display name
            await window.firebase.updateProfile(userCredential.user, {
                displayName: name
            });
            
            console.log('✅ Registration successful:', userCredential.user.uid);
            
            // Clear form
            nameInput.value = '';
            emailInput.value = '';
            passwordInput.value = '';
            confirmInput.value = '';
            
            // Reset labels
            this.fixInputLabels();
            
            this.showNotification('Account created successfully!', 'success');
            
        } catch (error) {
            console.error('❌ Registration error:', error.code, error.message);
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            // Always clear loading state
            this.setButtonLoading(btn, false);
        }
    }

    // 🔧 FIXED GOOGLE LOGIN HANDLING
    async handleGoogleLogin() {
        const btn = document.getElementById('google-login');
        
        console.log('🔍 Attempting Google login');
        
        try {
            // Set loading state
            this.setButtonLoading(btn, true);
            
            const provider = new window.firebase.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            // Clear any existing popups
            provider.setCustomParameters({
                'prompt': 'select_account'
            });
            
            const result = await window.firebase.signInWithPopup(window.firebase.auth, provider);
            console.log('✅ Google login successful:', result.user.uid);
            
            // Success message will be shown by onAuthStateChanged
            
        } catch (error) {
            console.error('❌ Google login error:', error.code, error.message);
            
            // Don't show error for user-cancelled actions
            if (error.code !== 'auth/popup-closed-by-user' && 
                error.code !== 'auth/cancelled-popup-request') {
                this.showNotification(this.getFirebaseErrorMessage(error), 'error');
            }
        } finally {
            // Always clear loading state
            this.setButtonLoading(btn, false);
        }
    }

    // 🔧 ENHANCED BUTTON LOADING STATE MANAGEMENT
    setButtonLoading(button, loading) {
        if (!button) {
            console.warn('⚠️ Button not found for loading state');
            return;
        }
        
        if (loading) {
            console.log('⏳ Setting button loading state');
            button.classList.add('loading');
            button.disabled = true;
            
            // Store original content
            if (!button.dataset.originalContent) {
                button.dataset.originalContent = button.innerHTML;
            }
            
            // Set loading content
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            button.style.opacity = '0.8';
            button.style.pointerEvents = 'none';
        } else {
            console.log('✅ Clearing button loading state');
            button.classList.remove('loading');
            button.disabled = false;
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';
            
            // Restore original content
            if (button.dataset.originalContent) {
                button.innerHTML = button.dataset.originalContent;
            }
        }
    }

    // 🔧 ENHANCED ERROR MESSAGES
    getFirebaseErrorMessage(error) {
        console.log('🔍 Firebase error code:', error.code);
        
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email address.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/email-already-in-use': 'An account with this email already exists.',
            'auth/weak-password': 'Password should be at least 6 characters long.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/invalid-credential': 'Invalid email or password.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your internet connection.',
            'auth/popup-closed-by-user': 'Sign-in cancelled.',
            'auth/cancelled-popup-request': 'Sign-in cancelled.',
            'auth/popup-blocked': 'Popup blocked. Please allow popups for this site.',
            'auth/internal-error': 'Internal error. Please try again.',
            'auth/invalid-api-key': 'Invalid API key configuration.',
            'auth/app-deleted': 'Firebase app has been deleted.'
        };
        
        return errorMessages[error.code] || error.message || 'An unexpected error occurred. Please try again.';
    }

    // 🔧 PROPER LOGOUT HANDLING
    async logout() {
        console.log('🚪 Logging out user');
        
        try {
            // Clean up subscriptions
            if (this.unsubscribeExpenses) {
                this.unsubscribeExpenses();
                this.unsubscribeExpenses = null;
            }
            
            // Clear idle timer
            this.clearIdleTimer();
            
            // Clear local data
            this.expenses = [];
            this.recurringBills = [];
            this.currentUser = null;
            
            // Clear charts
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
            this.charts = {};
            
            // Sign out from Firebase
            await window.firebase.signOut(window.firebase.auth);
            
            console.log('✅ Logout successful');
            this.showNotification('Signed out successfully!', 'success');
            
        } catch (error) {
            console.error('❌ Logout error:', error);
            this.showNotification('Error signing out', 'error');
        }
    }

    // AUTO LOGOUT FUNCTIONALITY
    setupIdleTimer() {
        const resetTimer = () => {
            this.lastActivity = Date.now();
            this.resetIdleTimer();
        };

        // Listen for user activity
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        this.resetIdleTimer();
    }

    resetIdleTimer() {
        if (!this.currentUser) return;

        this.clearIdleTimer();
        
        this.idleTimer = setTimeout(() => {
            this.handleIdleTimeout();
        }, this.IDLE_TIMEOUT);
    }

    clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    async handleIdleTimeout() {
        if (this.currentUser) {
            console.log('⏰ User idle timeout - logging out');
            this.showNotification('You have been automatically logged out due to inactivity', 'warning');
            await this.logout();
        }
    }

    // ... (rest of your existing methods remain the same)
    
    showNotification(message, type = 'info') {
        console.log(`📢 Notification (${type}):`, message);
        
        const container = document.getElementById('notifications');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (container.contains(notification)) {
                    container.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // ... (include all your other existing methods here)
}

// Add enhanced CSS for loading states
const enhancedStyle = document.createElement('style');
enhancedStyle.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    /* Enhanced Loading States */
    .auth-btn.loading,
    .premium-btn.loading {
        pointer-events: none !important;
        opacity: 0.8 !important;
        cursor: not-allowed !important;
        position: relative;
    }
    
    .auth-btn.loading *,
    .premium-btn.loading * {
        opacity: 0.3;
    }
    
    /* Modal States */
    .modal.show {
        opacity: 1;
        visibility: visible;
    }
    
    .modal {
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
    }
`;
document.head.appendChild(enhancedStyle);

// Initialize app with error handling
let app;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing app...');
    
    // Add a small delay to ensure Firebase is loaded
    setTimeout(() => {
        try {
            app = new StudySpendPro();
            window.app = app;
            console.log('✅ App initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
        }
    }, 500);
});

// Add global error handler
window.addEventListener('error', (event) => {
    console.error('🚨 Global error:', event.error);
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
});
