class AuthManager {
    constructor() {
        // Wait for firebaseServices to be available
        this.init();
    }

    init() {
        // Check if firebaseServices is available
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
            if (user) {
                console.log('✅ User signed in:', user.uid);
                const authSection = document.getElementById('authSection');
                const trackingSection = document.getElementById('trackingSection');
                
                if (authSection) authSection.classList.add('hidden');
                if (trackingSection) trackingSection.classList.remove('hidden');
                
                this.updateUIForUser(user);
            } else {
                console.log('👤 User signed out');
                const authSection = document.getElementById('authSection');
                const trackingSection = document.getElementById('trackingSection');
                
                if (authSection) authSection.classList.remove('hidden');
                if (trackingSection) trackingSection.classList.add('hidden');
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
            await this.auth.signOut();
            console.log('✅ Sign-out successful');
        } catch (error) {
            console.error('❌ Sign-out error:', error);
            this.showError('Failed to sign out: ' + error.message);
        }
    }

    updateUIForUser(user) {
        // Update UI based on user authentication status
        const authMethod = user.isAnonymous ? 'Anonymous' : 'Email';
        
        // Remove existing status if any
        const existingStatus = document.querySelector('.user-status');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        // Create new status element
        const statusElement = document.createElement('div');
        statusElement.className = 'user-status';
        statusElement.style.cssText = `
            background: rgba(255,255,255,0.2);
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9rem;
        `;
        statusElement.textContent = `Signed in: ${authMethod} (${user.uid.slice(0, 8)}...)`;
        
        const header = document.querySelector('header');
        if (header) {
            header.appendChild(statusElement);
        }
    }

    showError(message) {
        // Create and show error toast
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Initialize auth manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
