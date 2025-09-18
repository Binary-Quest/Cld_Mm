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
        this.setupEventListeners();
        this.waitForFirebaseAndSetupAuth();
    }

    showSplashScreen() {
        console.log('✨ Showing splash screen');
        setTimeout(() => {
            console.log('⏰ Transitioning to auth...');
            this.transitionToAuth();
        }, 3000);
    }

    transitionToAuth() {
        console.log('🔄 Transitioning from splash to auth...');
        
        const splash = document.getElementById('splash-screen');
        const authScreen = document.getElementById('auth-screen');
        
        if (!splash || !authScreen) {
            console.error('❌ Required elements not found');
            alert('Error: Missing HTML elements. Check your index.html file.');
            return;
        }
        
        splash.style.animation = 'fadeOut 0.8s ease-out forwards';
        
        setTimeout(() => {
            splash.classList.add('hidden');
            authScreen.classList.remove('hidden');
            console.log('✅ Auth screen shown');
        }, 800);
    }

    waitForFirebaseAndSetupAuth() {
        console.log('🔥 Checking for Firebase...');
        
        // Check if Firebase is properly loaded
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.log('⏳ Firebase not ready, retrying in 1 second...');
            setTimeout(() => this.waitForFirebaseAndSetupAuth(), 1000);
            return;
        }
        
        console.log('✅ Firebase detected, setting up auth...');
        this.setupAuthListener();
    }

    setupAuthListener() {
        console.log('👂 Setting up Firebase auth listener...');
        
        try {
            // FIXED: Use correct Firebase v8 syntax
            firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => {
                    console.log('✅ Auth persistence set to LOCAL');
                    
                    // Set up auth state listener
                    firebase.auth().onAuthStateChanged((user) => {
                        console.log('🔄 Auth state changed:', user ? `User: ${user.email}` : 'No user');
                        
                        this.authInitialized = true;
                        
                        if (user) {
                            this.currentUser = user;
                            this.showMainApp();
                            this.showNotification(`Welcome back, ${user.displayName || user.email}!`, 'success');
                        } else {
                            this.currentUser = null;
                            console.log('👤 No user logged in - showing auth screen');
                        }
                    });
                })
                .catch((error) => {
                    console.error('❌ Error setting auth persistence:', error);
                    this.showNotification('Error setting up authentication', 'error');
                });
                
        } catch (error) {
            console.error('❌ Critical error setting up auth:', error);
            this.showNotification('Failed to initialize Firebase Auth', 'error');
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

        // Login form - FIXED
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('📝 Login form submitted');
                this.handleLogin();
            });
        } else {
            console.warn('⚠️ Login form not found');
        }

        // Register form - FIXED
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('📝 Register form submitted');
                this.handleRegister();
            });
        } else {
            console.warn('⚠️ Register form not found');
        }

        // Google login - FIXED
        const googleBtn = document.getElementById('google-login');
        if (googleBtn) {
            googleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔍 Google login clicked');
                this.handleGoogleLogin();
            });
        } else {
            console.warn('⚠️ Google login button not found');
        }

        console.log('✅ Event listeners setup complete');
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

    // FIXED LOGIN METHOD
    async handleLogin() {
        console.log('🔐 Handling login...');
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const btn = document.querySelector('#login-form .auth-btn');
        
        if (!emailInput || !passwordInput) {
            console.error('❌ Login inputs not found');
            this.showNotification('Login form elements not found', 'error');
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
            
            // FIXED: Use correct Firebase auth method
            await firebase.auth().signInWithEmailAndPassword(email, password);
            
            console.log('✅ Login successful');
            
            // Clear form
            emailInput.value = '';
            passwordInput.value = '';
            
        } catch (error) {
            console.error('❌ Login error:', error);
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    // FIXED REGISTER METHOD
    async handleRegister() {
        console.log('📝 Handling registration...');
        
        const nameInput = document.getElementById('register-name');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        const confirmInput = document.getElementById('register-confirm');
        const btn = document.querySelector('#register-form .auth-btn');
        
        if (!nameInput || !emailInput || !passwordInput || !confirmInput) {
            console.error('❌ Register inputs not found');
            this.showNotification('Registration form elements not found', 'error');
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
            console.log('📋 Creating account for:', email);
            
            // FIXED: Use correct Firebase auth method
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            
            // Update user profile
            await userCredential.user.updateProfile({
                displayName: name
            });
            
            console.log('✅ Registration successful');
            this.showNotification('Account created successfully!', 'success');
            
            // Clear form
            nameInput.value = '';
            emailInput.value = '';
            passwordInput.value = '';
            confirmInput.value = '';
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            this.showNotification(this.getFirebaseErrorMessage(error), 'error');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    // FIXED GOOGLE LOGIN METHOD
    async handleGoogleLogin() {
        console.log('🔍 Handling Google login...');
        
        const btn = document.getElementById('google-login');
        
        try {
            this.setButtonLoading(btn, true);
            
            // FIXED: Use correct Firebase auth method
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            await firebase.auth().signInWithPopup(provider);
            
            console.log('✅ Google login successful');
            
        } catch (error) {
            console.error('❌ Google login error:', error);
            if (error.code !== 'auth/popup-closed-by-user' && 
                error.code !== 'auth/cancelled-popup-request') {
                this.showNotification(this.getFirebaseErrorMessage(error), 'error');
            }
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    setButtonLoading(button, loading) {
        if (!button) {
            console.warn('⚠️ Button not found for loading state');
            return;
        }
        
        if (loading) {
            console.log('⏳ Setting button loading state');
            button.disabled = true;
            button.style.opacity = '0.7';
            button.style.pointerEvents = 'none';
            
            // Store original content
            if (!button.dataset.originalContent) {
                button.dataset.originalContent = button.innerHTML;
            }
            
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        } else {
            console.log('✅ Clearing button loading state');
            button.disabled = false;
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';
            
            // Restore original content
            if (button.dataset.originalContent) {
                button.innerHTML = button.dataset.originalContent;
            }
        }
    }

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
            'auth/popup-closed-by-user': 'Sign-in cancelled by user.',
            'auth/cancelled-popup-request': 'Sign-in cancelled.',
            'auth/popup-blocked': 'Popup blocked. Please allow popups for this site.',
            'auth/internal-error': 'Internal error. Please try again.',
            'auth/invalid-api-key': 'Invalid Firebase configuration.',
            'auth/app-deleted': 'Firebase app has been deleted.'
        };
        
        return errorMessages[error.code] || error.message || 'An unexpected error occurred. Please try again.';
    }

    showNotification(message, type = 'info') {
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        // Create notification element
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
            max-width: 350px;
            font-family: 'Inter', sans-serif;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }
}

// Add essential CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    .hidden { 
        display: none !important; 
    }
    
    .fa-spinner {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Initialize app with proper error handling
console.log('🌟 Starting StudySpend Pro...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM Content Loaded');
    
    // Check if required elements exist
    const requiredElements = ['splash-screen', 'auth-screen', 'main-app'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('❌ Missing HTML elements:', missingElements);
        alert(`Missing required HTML elements: ${missingElements.join(', ')}\n\nPlease check your index.html file.`);
        return;
    }
    
    setTimeout(() => {
        try {
            window.app = new StudySpendPro();
            console.log('✅ App initialized successfully');
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            alert('App failed to initialize. Check console for details.');
        }
    }, 500);
});

// Global error handlers
window.addEventListener('error', (event) => {
    console.error('🚨 Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
});
