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
                signOutBtn.textContent = 'Signing out...';
            }
            
            await this.auth.signOut();
            console.log('✅ Sign-out successful');
            
            // Force reload to clear any cached state
            setTimeout(() => {
                window.location.reload();
            }, 500);
            
        } catch (error) {
            console.error('❌ Sign-out error:', error);
            this.showError('Failed to sign out: ' + error.message);
            
            // Re-enable sign out button
            const signOutBtn = document.getElementById('signOutBtn');
            if (signOutBtn) {
                signOutBtn.disabled = false;
                signOutBtn.textContent = 'Sign Out';
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
        `;
        
        const authMethod = user.isAnonymous ? '👤 Anonymous' : '📧 Email';
        const shortUid = user.uid.slice(0, 8);
        
        statusElement.innerHTML = `
            <span style="font-weight: 600;">${authMethod}</span>
            <span style="color: var(--text-muted); margin-left: 5px;">(${shortUid}...)</span>
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
        
        if (requestBtn) requestBtn.disabled = false;
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = true;
        if (locationPermission) locationPermission.style.display = 'block';
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-title">${type === 'success' ? '✅ Success' : type === 'error' ? '❌ Error' : 'ℹ️ Info'}</div>
            <div class="toast-message">${message}</div>
        `;
        
        toastContainer.appendChild(toast);
        
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
    window.authManager = new AuthManager();
});
