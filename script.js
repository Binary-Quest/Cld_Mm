// MINIMAL WORKING StudySpend Pro - No Complex Features
class StudySpendPro {
    constructor() {
        this.currentUser = null;
        console.log('🚀 StudySpendPro constructor called');
        this.init();
    }

    init() {
        console.log('📱 Initializing app...');
        
        // Show splash for 3 seconds, then transition
        setTimeout(() => {
            console.log('⏰ 3 seconds passed - transitioning');
            this.transitionToAuth();
        }, 3000);
        
        // Setup basic event listeners
        setTimeout(() => {
            this.setupEventListeners();
        }, 100);
        
        // Wait for Firebase and setup auth
        setTimeout(() => {
            this.waitForFirebaseAndSetupAuth();
        }, 1000);
    }

    transitionToAuth() {
        console.log('🔄 Starting transition to auth...');
        
        const splash = document.getElementById('splash-screen');
        const authScreen = document.getElementById('auth-screen');
        
        if (!splash) {
            console.error('❌ Splash screen element not found!');
            alert('Error: splash-screen element missing from HTML');
            return;
        }
        
        if (!authScreen) {
            console.error('❌ Auth screen element not found!');
            alert('Error: auth-screen element missing from HTML');
            return;
        }
        
        console.log('✅ Elements found - proceeding with transition');
        
        // Hide splash screen
        splash.style.animation = 'fadeOut 0.8s ease-out forwards';
        
        setTimeout(() => {
            splash.classList.add('hidden');
            authScreen.classList.remove('hidden');
            console.log('✅ Transition complete - auth screen should be visible');
        }, 800);
    }

    waitForFirebaseAndSetupAuth() {
        console.log('🔥 Checking for Firebase...');
        
        if (typeof firebase === 'undefined') {
            console.log('⚠️ Firebase not found, retrying in 2 seconds...');
            setTimeout(() => this.waitForFirebaseAndSetupAuth(), 2000);
            return;
        }
        
        if (!firebase.auth) {
            console.log('⚠️ Firebase auth not found, retrying in 2 seconds...');
            setTimeout(() => this.waitForFirebaseAndSetupAuth(), 2000);
            return;
        }
        
        console.log('✅ Firebase detected - setting up auth');
        this.setupAuthListener();
    }

    setupAuthListener() {
        try {
            firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => {
                    console.log('✅ Auth persistence set');
                    
                    firebase.auth().onAuthStateChanged((user) => {
                        console.log('🔄 Auth state:', user ? 'Logged in' : 'Not logged in');
                        
                        if (user) {
                            this.currentUser = user;
                            this.showMainApp();
                        } else {
                            this.currentUser = null;
                            console.log('👤 No user - auth screen should be visible');
                        }
                    });
                })
                .catch((error) => {
                    console.error('❌ Auth persistence error:', error);
                });
        } catch (error) {
            console.error('❌ Firebase setup error:', error);
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
        
        console.log('✅ Main app should now be visible');
    }

    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        
        // Auth tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                console.log('Tab clicked:', btn.dataset.tab);
                this.switchAuthTab(btn.dataset.tab);
            });
        });

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Login form submitted');
                this.handleLogin();
            });
        } else {
            console.warn('⚠️ Login form not found');
        }

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Register form submitted');
                this.handleRegister();
            });
        } else {
            console.warn('⚠️ Register form not found');
        }

        // Google login
        const googleBtn = document.getElementById('google-login');
        if (googleBtn) {
            googleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Google login clicked');
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

    async handleLogin() {
        console.log('🔐 Handling login...');
        
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        
        if (!emailInput || !passwordInput) {
            console.error('❌ Login inputs not found');
            alert('Login form elements not found');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            alert('Please enter both email and password');
            return;
        }
        
        try {
            console.log('🔑 Attempting login...');
            await firebase.auth().signInWithEmailAndPassword(email, password);
            console.log('✅ Login successful');
        } catch (error) {
            console.error('❌ Login error:', error);
            alert('Login failed: ' + error.message);
        }
    }

    async handleRegister() {
        console.log('📝 Handling registration...');
        
        const nameInput = document.getElementById('register-name');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        const confirmInput = document.getElementById('register-confirm');
        
        if (!nameInput || !emailInput || !passwordInput || !confirmInput) {
            console.error('❌ Register inputs not found');
            alert('Registration form elements not found');
            return;
        }

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;
        
        if (!name || !email || !password || !confirmPassword) {
            alert('Please fill in all fields');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        if (password.length < 6) {
            alert('Password must be at least 6 characters!');
            return;
        }
        
        try {
            console.log('📋 Creating account...');
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            
            await userCredential.user.updateProfile({
                displayName: name
            });
            
            console.log('✅ Registration successful');
            alert('Account created successfully!');
        } catch (error) {
            console.error('❌ Registration error:', error);
            alert('Registration failed: ' + error.message);
        }
    }

    async handleGoogleLogin() {
        console.log('🔍 Handling Google login...');
        
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebase.auth().signInWithPopup(provider);
            console.log('✅ Google login successful');
        } catch (error) {
            console.error('❌ Google login error:', error);
            if (error.code !== 'auth/popup-closed-by-user') {
                alert('Google login failed: ' + error.message);
            }
        }
    }
}

// Add essential CSS for animations
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
console.log('🌟 Script starting...');

// Test if script even loads
window.addEventListener('load', () => {
    console.log('🌍 Window loaded');
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded - initializing app in 1 second...');
    
    // Check for required elements immediately
    const requiredElements = ['splash-screen', 'auth-screen', 'main-app'];
    const missingElements = [];
    
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            missingElements.push(id);
            console.error(`❌ Missing element: ${id}`);
        } else {
            console.log(`✅ Found element: ${id}`);
        }
    });
    
    if (missingElements.length > 0) {
        alert(`Missing HTML elements: ${missingElements.join(', ')}\n\nCheck your index.html file!`);
        return;
    }
    
    // Initialize app with delay
    setTimeout(() => {
        try {
            console.log('🚀 Creating StudySpendPro instance...');
            window.app = new StudySpendPro();
            console.log('✅ App instance created successfully');
        } catch (error) {
            console.error('❌ Failed to create app instance:', error);
            alert('Failed to initialize app. Check console for details.');
        }
    }, 1000);
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('🚨 Global JavaScript error:', event.error);
    console.error('Error message:', event.message);
    console.error('Error source:', event.filename, 'Line:', event.lineno);
});

console.log('✅ Script file loaded completely');
