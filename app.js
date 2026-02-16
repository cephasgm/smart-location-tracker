class App {
    constructor() {
        this.initElements();
        this.initEventListeners();
        this.initServiceWorker();
        this.initConnectionMonitoring();
        this.initNotificationPermission();
        this.checkInitialPermissions();
        this.initToasts();
    }

    initElements() {
        this.anonymousSignInBtn = document.getElementById('anonymousSignIn');
        this.emailSignInForm = document.getElementById('emailSignInForm');
        this.requestLocationBtn = document.getElementById('requestLocationBtn');
        this.startTrackingBtn = document.getElementById('startTrackingBtn');
        this.stopTrackingBtn = document.getElementById('stopTrackingBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        
        // Sign out button should already be in HTML now
        this.signOutBtn = document.getElementById('signOutBtn');
    }

    initEventListeners() {
        // Auth events
        if (this.anonymousSignInBtn) {
            this.anonymousSignInBtn.addEventListener('click', () => {
                if (window.authManager) {
                    this.showLoading(this.anonymousSignInBtn, 'Signing in...');
                    window.authManager.signInAnonymously()
                        .finally(() => this.hideLoading(this.anonymousSignInBtn, 'Continue Anonymously'));
                }
            });
        }

        if (this.emailSignInForm) {
            this.emailSignInForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email')?.value;
                const password = document.getElementById('password')?.value;
                const submitBtn = this.emailSignInForm.querySelector('button[type="submit"]');
                
                if (window.authManager && email && password) {
                    this.showLoading(submitBtn, 'Signing in...');
                    window.authManager.signInWithEmail(email, password)
                        .finally(() => this.hideLoading(submitBtn, 'Sign In with Email'));
                }
            });
        }

        // Sign out button
        if (this.signOutBtn) {
            this.signOutBtn.addEventListener('click', () => {
                if (window.authManager) {
                    window.authManager.signOut();
                }
            });
        }

        // Location events
        if (this.requestLocationBtn) {
            this.requestLocationBtn.addEventListener('click', async () => {
                try {
                    if (!window.locationEngine) {
                        console.error('LocationEngine not initialized');
                        return;
                    }
                    
                    this.showLoading(this.requestLocationBtn, 'Requesting...');
                    
                    const permission = await window.locationEngine.requestLocationPermission();
                    if (permission === 'granted' || permission === 'prompt') {
                        navigator.geolocation.getCurrentPosition(
                            () => {
                                this.requestLocationBtn.disabled = true;
                                this.startTrackingBtn.disabled = false;
                                const locationPermission = document.getElementById('locationPermission');
                                if (locationPermission) {
                                    locationPermission.style.display = 'none';
                                }
                                this.showToast('📍 Location permission granted', 'success');
                            },
                            (error) => {
                                this.showToast('❌ Location permission denied', 'error');
                            }
                        );
                    }
                } catch (error) {
                    console.error('Permission error:', error);
                } finally {
                    this.hideLoading(this.requestLocationBtn, 'Enable Location Tracking');
                }
            });
        }

        if (this.startTrackingBtn) {
            this.startTrackingBtn.addEventListener('click', () => {
                if (window.locationEngine) {
                    window.locationEngine.startTracking();
                    this.showToast('📍 Tracking started', 'success');
                }
            });
        }

        if (this.stopTrackingBtn) {
            this.stopTrackingBtn.addEventListener('click', () => {
                if (window.locationEngine) {
                    window.locationEngine.stopTracking();
                    this.showToast('⏹️ Tracking stopped', 'info');
                }
            });
        }

        // Network events
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
    }

    showLoading(button, text) {
        if (!button) return;
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.innerHTML = `<span class="spinner-small"></span> ${text}`;
    }

    hideLoading(button, text) {
        if (!button) return;
        button.disabled = false;
        button.innerHTML = text || button.dataset.originalText || 'Button';
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;
        
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
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    async initServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/smart-location-tracker/service-worker.js', {
                    scope: '/smart-location-tracker/'
                });
                
                console.log('✅ ServiceWorker registered successfully:', registration.scope);
                this.showToast('📱 App ready for offline use', 'success');

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    this.showToast('🔄 App update available', 'info');
                });

            } catch (error) {
                console.error('❌ ServiceWorker registration failed:', error);
                this.showToast('⚠️ Offline mode unavailable', 'warning');
            }
        }
    }

    initConnectionMonitoring() {
        this.updateConnectionStatus();
    }

    handleOnline() {
        this.updateConnectionStatus();
        this.showToast('🟢 Back online', 'success');
        
        if (window.authManager?.currentUser && window.offlineQueue) {
            window.offlineQueue.syncWithFirestore(window.authManager.currentUser.uid);
        }
    }

    handleOffline() {
        this.updateConnectionStatus();
        this.showToast('🔴 You are offline - tracking will resume when online', 'warning');
    }

    updateConnectionStatus() {
        if (this.connectionStatus) {
            if (navigator.onLine) {
                this.connectionStatus.innerHTML = '🟢 Online';
                this.connectionStatus.className = 'connection-status online';
            } else {
                this.connectionStatus.innerHTML = '🔴 Offline';
                this.connectionStatus.className = 'connection-status offline';
            }
        }
    }

    async initNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('✅ Notifications enabled');
            }
        }
    }

    initToasts() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toastContainer')) {
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    }

    checkInitialPermissions() {
        if ('permissions' in navigator) {
            navigator.permissions.query({ name: 'geolocation' })
                .then(permission => {
                    if (permission.state === 'granted') {
                        if (this.requestLocationBtn) this.requestLocationBtn.disabled = true;
                        if (this.startTrackingBtn) this.startTrackingBtn.disabled = false;
                        const locationPermission = document.getElementById('locationPermission');
                        if (locationPermission) {
                            locationPermission.style.display = 'none';
                        }
                    }
                })
                .catch(error => {
                    console.warn('Permission check failed:', error);
                });
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
