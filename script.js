class StudySpendPro {
    constructor() {
        this.currentUser = null;
        this.authInitialized = false;
        console.log('🚀 StudySpendPro initialized');
        this.init();
    }

    init() {
        console.log('📱 Starting app initialization...');
        this.showSplashScreen();
        
        // Add debugging to check DOM elements
        setTimeout(() => {
            console.log('🔍 Checking DOM elements...');
            console.log('Splash screen:', document.getElementById('splash-screen'));
            console.log('Auth screen:', document.getElementById('auth-screen'));
            console.log('Main app:', document.getElementById('main-app'));
            
            this.setupEventListeners();
            this.waitForFirebaseAndSetupAuth();
        }, 100);
    }

    showSplashScreen() {
        console.log('✨ Showing splash screen');
        // Splash screen should already be visible by default
        
        // Force transition after 3 seconds regardless of Firebase
        setTimeout(() => {
            console.log('⏰ 3 seconds passed, forcing transition...');
            this.transitionToAuth();
        }, 3000);
    }

    transitionToAuth() {
        console.log('🔄 Transitioning from splash to auth...');
        
        const splash = document.getElementById('splash-screen');
        const authScreen = document.getElementById('auth-screen');
        
        if (!splash) {
            console.error('❌ Splash screen element not found!');
            return;
        }
        
        if (!authScreen) {
            console.error('❌ Auth screen element not found!');
            return;
        }
        
        // Hide splash screen
        splash.style.animation = 'fadeOut 0.8s ease-out forwards';
        
        setTimeout(() => {
            splash.classList.add('hidden');
            authScreen.classList.remove('hidden');
            console.log('✅ Transitioned to auth screen');
        }, 800);
    }

    waitForFirebaseAndSetupAuth() {
        console.log('🔥 Checking for Firebase...');
        
        // Check if Firebase is available
        if (typeof window.firebase === 'undefined') {
            console.log('⏳ Firebase not ready yet, retrying in 1 second...');
            setTimeout(() => this.waitForFirebaseAndSetupAuth(), 1000);
            return;
        }
        
        console.log('✅ Firebase detected, setting up auth...');
        this.setupAuthListener();
    }

    setupAuthListener() {
        console.log('👂 Setting up auth listener...');
        
        try {
            // Set persistence
            window.firebase.auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL)
                .then(() => {
                    console.log('✅ Auth persistence set');
                    
                    // Set up auth state listener
                    window.firebase.onAuthStateChanged(window.firebase.auth, (user) => {
                        console.log('🔄 Auth state changed:', user ? `User: ${user.email}` : 'No user');
                        
                        this.authInitialized = true;
                        
                        if (user) {
                            this.currentUser = user;
                            this.showMainApp();
                            this.showNotification(`Welcome back, ${user.displayName || user.email}!`, 'success');
                        } else {
                            this.currentUser = null;
                            // Auth screen should already be showing
                            console.log('👤 No user logged in');
                        }
                    });
                })
                .catch((error) => {
                    console.error('❌ Error setting auth persistence:', error);
                    this.showNotification('Error initializing authentication', 'error');
                });
                
        } catch (error) {
            console.error('❌ Error setting up auth listener:', error);
            this.showNotification('Failed to initialize authentication', 'error');
        }
    }

    showMainApp() {
        console.log('🏠 Showing main app...');
        
        const splash = document.getElementById('splash-screen');
        const authScreen = document.getElementById('auth-screen');
        const mainApp = document.getElementById('main-app');
        
        if (splash) splash.classList.add('hidden');
        if (authScreen) authScreen.classList.add('hidden');
        if (mainApp) mainApp.classList.remove('hidden');
        
        console.log('✅ Main app displayed');
    }

    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        
        // Auth tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchAuthTab(tab);
            });
        });

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('📝 Login form submitted');
                this.handleLogin();
            });
        }

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('📝 Register form submitted');
                this.handleRegister();
            });
        }

        // Google login
        const googleBtn = document.getElementById('google-login');
        if (googleBtn) {
            googleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔍 Google login clicked');
                this.handleGoogleLogin();
            });
        }

        console.log('✅ Event listeners set up');
    }

    switchAuthTab(tab) {
        console.log('📑 Switching to tab:', tab);
        
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        const tabBtn = document.querySelector(`[data-tab="${tab}"]`);
        const form = document.getElementById(`${tab}-form`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (form) form.classList.add('active');
    }

    async handleLogin() {
        console.log('🔐 Handling login...');
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const btn = document.querySelector('#login-form .auth-btn');
        
        if (!emailInput || !passwordInput) {
            console.error('❌ Login inputs not found');
            this.showNotification('Login form not found', 'error');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            this.showNotification('Please enter both email and password', 'error');
            return;
        }
        
        try {
            this.setButtonLoading(btn, true);
            console.log('🔑 Attempting login for:', email);
            
            await window.firebase.signInWithEmailAndPassword(window.firebase.auth, email, password);
            console.log('✅ Login successful');
            
        } catch (error) {
            console.error('❌ Login error:', error);
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async handleRegister() {
        console.log('📝 Handling registration...');
        
        const nameInput = document.getElementById('register-name');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        const confirmInput = document.getElementById('register-confirm');
        const btn = document.querySelector('#register-form .auth-btn');
        
        if (!nameInput || !emailInput || !passwordInput || !confirmInput) {
            console.error('❌ Register inputs not found');
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
        
        try {
            this.setButtonLoading(btn, true);
            console.log('📋 Attempting registration for:', email);
            
            const userCredential = await window.firebase.createUserWithEmailAndPassword(window.firebase.auth, email, password);
            
            await window.firebase.updateProfile(userCredential.user, {
                displayName: name
            });
            
            console.log('✅ Registration successful');
            this.showNotification('Account created successfully!', 'success');
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async handleGoogleLogin() {
        console.log('🔍 Handling Google login...');
        
        const btn = document.getElementById('google-login');
        
        try {
            this.setButtonLoading(btn, true);
            
            const provider = new window.firebase.GoogleAuthProvider();
            await window.firebase.signInWithPopup(window.firebase.auth, provider);
            
            console.log('✅ Google login successful');
            
        } catch (error) {
            console.error('❌ Google login error:', error);
            if (error.code !== 'auth/popup-closed-by-user') {
                this.showNotification(this.getFirebaseErrorMessage(error), 'error');
            }
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    setButtonLoading(button, loading) {
        if (!button) return;
        
        if (loading) {
            button.disabled = true;
            button.style.opacity = '0.7';
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        } else {
            button.disabled = false;
            button.style.opacity = '1';
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    getFirebaseErrorMessage(error) {
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/email-already-in-use': 'Email already registered.',
            'auth/weak-password': 'Password too weak.',
            'auth/invalid-email': 'Invalid email address.',
            'auth/network-request-failed': 'Network error. Check connection.',
            'auth/popup-blocked': 'Popup blocked. Allow popups for this site.'
        };
        
        return errorMessages[error.code] || error.message || 'An error occurred. Please try again.';
    }

    showNotification(message, type = 'info') {
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        // Simple notification - you can enhance this
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#339af0'};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }
}

// Add CSS for fadeOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    .hidden { 
        display: none !important; 
    }
`;
document.head.appendChild(style);

// Initialize app with extensive debugging
console.log('🌟 Starting StudySpend Pro...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded');
    
    // Check if required elements exist
    const requiredElements = ['splash-screen', 'auth-screen', 'main-app'];
    const missingElements = [];
    
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            missingElements.push(id);
        } else {
            console.log(`✅ Found element: ${id}`);
        }
    });
    
    if (missingElements.length > 0) {
        console.error('❌ Missing required elements:', missingElements);
        alert(`Missing required HTML elements: ${missingElements.join(', ')}\n\nPlease check your index.html file.`);
        return;
    }
    
    // Initialize app with delay to ensure everything is loaded
    setTimeout(() => {
        try {
            window.app = new StudySpendPro();
            console.log('✅ App initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            alert('Failed to initialize app. Check console for details.');
        }
    }, 100);
});

// Global error handlers
window.addEventListener('error', (event) => {
    console.error('🚨 Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
});
