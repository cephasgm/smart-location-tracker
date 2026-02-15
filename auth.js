class AuthManager {
    constructor() {
        this.auth = firebaseServices.auth;
        this.currentUser = null;
        this.initAuthListeners();
    }

    initAuthListeners() {
        this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                console.log('User signed in:', user.uid);
                document.getElementById('authSection').classList.add('hidden');
                document.getElementById('trackingSection').classList.remove('hidden');
                this.updateUIForUser(user);
            } else {
                console.log('User signed out');
                document.getElementById('authSection').classList.remove('hidden');
                document.getElementById('trackingSection').classList.add('hidden');
            }
        });
    }

    async signInAnonymously() {
        try {
            const result = await this.auth.signInAnonymously();
            return result.user;
        } catch (error) {
            console.error('Anonymous sign-in error:', error);
            this.showError('Failed to sign in anonymously: ' + error.message);
            throw error;
        }
    }

    async signInWithEmail(email, password) {
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            return result.user;
        } catch (error) {
            console.error('Email sign-in error:', error);
            this.showError('Failed to sign in: ' + error.message);
            throw error;
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();
        } catch (error) {
            console.error('Sign-out error:', error);
            this.showError('Failed to sign out: ' + error.message);
        }
    }

    updateUIForUser(user) {
        // Update UI based on user authentication status
        const authMethod = user.isAnonymous ? 'Anonymous' : 'Email';
        const statusElement = document.createElement('div');
        statusElement.className = 'user-status';
        statusElement.textContent = `Signed in: ${authMethod} (${user.uid.slice(0, 8)}...)`;
        
        const existingStatus = document.querySelector('.user-status');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        document.querySelector('header').appendChild(statusElement);
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
            background: var(--danger-color);
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

// Initialize auth manager
const authManager = new AuthManager();
