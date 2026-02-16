class AuthManager {
    constructor() {
        // Wait for firebaseServices to be available
        this.init();
    }

    init() {
        if (!window.firebaseServices) {
            console.error('❌ firebaseServices not available yet, retrying in 100ms...');
            setTimeout(() => this.init(), 100);
            return;
        }

        this.auth = window.firebaseServices.auth;
        this.currentUser = null;
        this.initAuthListeners();
        console.log('✅ AuthManager initialized');
    }

    initAuthListeners() {
        this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            
            // Update UI based on auth state
            const authSection = document.getElementById('authSection');
            const trackingSection = document.getElementById('trackingSection');
            const signOutBtn = document.getElementById('signOutBtn');
            
            if (user) {
                console.log('✅ User signed in:', user.uid);
                
                if (authSection) authSection.classList.add('hidden');
                if (trackingSection) trackingSection.classList.remove('hidden');
                if (signOutBtn) signOutBtn.classList.remove('hidden');
                
                this.updateUIForUser(user);
                this.showToast('✅ Signed in successfully', 'success');
            } else {
                console.log('👤 User signed out');
                
                if (authSection) authSection.classList.remove('hidden');
                if (trackingSection) trackingSection.classList.add('hidden');
                if (signOutBtn) signOutBtn.classList.add('hidden');
                
                // Clear user-specific UI
                this.clearUserUI();
                
                // Stop tracking if active
                if (window.locationEngine && window.locationEngine.isTracking) {
                    window.locationEngine.stopTracking();
                }
            }
        });
    }

    async signInAnonymously() {
        try {
            const result = await this.auth.signInAnonymously();
            console.log('✅ Anonymous sign-in successful');
            return result.user;
        } catch (error) {
            console.error('❌ Anonymous sign-in error:', error);
            this.showError('Failed to sign in anonymously: ' + error.message);
            throw error;
        }
    }

    async signInWithEmail(email, password) {
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Email sign-in successful');
            return result.user;
        } catch (error) {
            console.error('❌ Email sign-in error:', error);
            this.showError('Failed to sign in: ' + error.message);
            throw error;
        }
    }

    async signOut() {
        try {
            // Show loading state
            const signOutBtn = document.getElementById('signOutBtn');
            if (signOutBtn) {
                signOutBtn.disabled = true;
                signOutBtn.innerHTML = '<span class="spinner-small"></span> Signing out...';
            }
            
            await this.auth.signOut();
            console.log('✅ Sign-out successful');
            this.showToast('👋 Signed out successfully', 'info');
            
            // Force reload to clear any cached state
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Sign-out error:', error);
            this.showError('Failed to sign out: ' + error.message);
            
            // Re-enable sign out button
            const signOutBtn = document.getElementById('signOutBtn');
            if (signOutBtn) {
                signOutBtn.disabled = false;
                signOutBtn.innerHTML = 'Sign Out';
            }
        }
    }

    updateUIForUser(user) {
        // Remove existing status if any
        const existingStatus = document.querySelector('.user-status');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        // Create modern user status badge
        const statusElement = document.createElement('div');
        statusElement.className = 'user-status';
        statusElement.style.cssText = `
            background: var(--glass-bg);
            backdrop-filter: blur(5px);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            border: 1px solid var(--glass-border);
            margin-left: 10px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        `;
        
        const authMethod = user.isAnonymous ? '👤 Anonymous' : '📧 Email';
        const shortUid = user.uid.slice(0, 8);
        
        statusElement.innerHTML = `
            <span style="font-weight: 600;">${authMethod}</span>
            <span style="color: var(--text-muted);">${shortUid}...</span>
        `;
        
        const header = document.querySelector('.header-actions');
        if (header) {
            header.insertBefore(statusElement, document.getElementById('signOutBtn'));
        }
    }

    clearUserUI() {
        const userStatus = document.querySelector('.user-status');
        if (userStatus) {
            userStatus.remove();
        }
        
        // Reset tracking UI
        const requestBtn = document.getElementById('requestLocationBtn');
        const startBtn = document.getElementById('startTrackingBtn');
        const stopBtn = document.getElementById('stopTrackingBtn');
        const locationPermission = document.getElementById('locationPermission');
        
        if (requestBtn) {
            requestBtn.disabled = false;
            requestBtn.innerHTML = 'Enable Location Tracking';
        }
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '▶ Start Tracking';
        }
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.innerHTML = '⏹ Stop Tracking';
        }
        if (locationPermission) {
            locationPermission.style.display = 'block';
        }
        
        // Clear location display
        const locationStatus = document.getElementById('locationStatus');
        const coordinates = document.getElementById('coordinates');
        const accuracy = document.getElementById('accuracy');
        const altitude = document.getElementById('altitude');
        const speed = document.getElementById('speed');
        const timestamp = document.getElementById('timestamp');
        
        if (locationStatus) {
            locationStatus.innerHTML = '⏳ Waiting for GPS signal...';
            locationStatus.className = 'status-warning';
        }
        if (coordinates) coordinates.innerHTML = '🌐 Latitude: --, Longitude: --';
        if (accuracy) accuracy.innerHTML = '🎯 Accuracy: -- meters';
        if (altitude) altitude.innerHTML = '⛰ Altitude: -- meters';
        if (speed) speed.innerHTML = '⚡ Speed: -- m/s';
        if (timestamp) timestamp.innerHTML = '🕐 Last update: --';
    }

    showToast(message, type = 'info') {
        // Check if app has toast method
        if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast(message, type);
            return;
        }
        
        // Fallback toast implementation
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <div class="toast-title">${icons[type] || '📢'} ${type.charAt(0).toUpperCase() + type.slice(1)}</div>
            <div class="toast-message">${message}</div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Add slide-in animation
        toast.style.animation = 'slideInRight 0.3s ease';
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    showError(message) {
        this.showToast(message, 'error');
        
        // Also show in auth section if visible
        const authError = document.getElementById('authError');
        if (authError) {
            authError.textContent = message;
            authError.classList.remove('hidden');
            setTimeout(() => authError.classList.add('hidden'), 5000);
        }
    }
}

// Initialize auth manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Ensure toast container exists
    if (!document.getElementById('toastContainer')) {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    window.authManager = new AuthManager();
});

// Add CSS for toast animations if not already present
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .spinner-small {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s ease-in-out infinite;
        margin-right: 8px;
        vertical-align: middle;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
