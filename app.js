// Main application controller
class App {
    constructor() {
        this.initElements();
        this.initEventListeners();
        this.initServiceWorker();
        this.initConnectionMonitoring();
        this.initNotificationPermission();
        this.checkInitialPermissions();
    }

    initElements() {
        this.anonymousSignInBtn = document.getElementById('anonymousSignIn');
        this.emailSignInForm = document.getElementById('emailSignInForm');
        this.requestLocationBtn = document.getElementById('requestLocationBtn');
        this.startTrackingBtn = document.getElementById('startTrackingBtn');
        this.stopTrackingBtn = document.getElementById('stopTrackingBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
    }

    initEventListeners() {
        // Auth events
        this.anonymousSignInBtn.addEventListener('click', () => {
            authManager.signInAnonymously();
        });

        this.emailSignInForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            authManager.signInWithEmail(email, password);
        });

        // Location events
        this.requestLocationBtn.addEventListener('click', async () => {
            try {
                const permission = await locationEngine.requestLocationPermission();
                if (permission === 'granted') {
                    this.requestLocationBtn.disabled = true;
                    this.startTrackingBtn.disabled = false;
                    document.getElementById('locationPermission').style.display = 'none';
                }
            } catch (error) {
                console.error('Permission error:', error);
            }
        });

        this.startTrackingBtn.addEventListener('click', () => {
            locationEngine.startTracking();
        });

        this.stopTrackingBtn.addEventListener('click', () => {
            locationEngine.stopTracking();
        });

        // Network events
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
    }

    async initServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('ServiceWorker registered:', registration);

                // Check for background sync support
                if ('SyncManager' in window) {
                    // Register periodic sync for offline data
                    const status = await navigator.permissions.query({
                        name: 'periodic-background-sync',
                    });
                    
                    if (status.state === 'granted') {
                        await registration.periodicSync.register('sync-locations', {
                            minInterval: 60 * 60 * 1000, // 1 hour
                        });
                    }
                }
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
            }
        }
    }

    initConnectionMonitoring() {
        this.updateConnectionStatus();
    }

    handleOnline() {
        this.updateConnectionStatus();
        
        // Try to sync offline data
        if (authManager.currentUser) {
            offlineQueue.syncWithFirestore(authManager.currentUser.uid);
        }
    }

    handleOffline() {
        this.updateConnectionStatus();
    }

    updateConnectionStatus() {
        if (navigator.onLine) {
            this.connectionStatus.innerHTML = '🟢 Online';
            this.connectionStatus.style.color = '#4caf50';
        } else {
            this.connectionStatus.innerHTML = '🔴 Offline';
            this.connectionStatus.style.color = '#f44336';
        }
    }

    async initNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);
        }
    }

    checkInitialPermissions() {
        // Check if geolocation permission already granted
        navigator.permissions.query({ name: 'geolocation' })
            .then(permission => {
                if (permission.state === 'granted') {
                    this.requestLocationBtn.disabled = true;
                    this.startTrackingBtn.disabled = false;
                    document.getElementById('locationPermission').style.display = 'none';
                }
            })
            .catch(error => {
                console.warn('Permission check failed:', error);
            });
    }

    // Feature impossibility notes (as required by constraints)
    noteImpossibleFeatures() {
        console.log(`
            === TECHNICAL LIMITATIONS (Web Standards Only) ===
            
            1. Background Tracking: Limited to when browser is open.
               Alternative: Use Service Worker + Push API for periodic updates.
            
            2. True Background GPS: Not possible in web apps.
               Alternative: Prompt user to keep tab active or convert to Android app.
            
            3. IMEI/Device ID Access: Not possible in web apps.
               Alternative: Use Firebase anonymous authentication with device fingerprinting.
            
            4. Battery Optimization: Cannot control GPS power states.
               Alternative: Implement adaptive tracking based on movement.
            
            5. Offline Geofencing: Limited to last known location.
               Alternative: Cache geofences locally and check against location updates.
            
            These limitations are by design to protect user privacy.
        `);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    app.noteImpossibleFeatures(); // Document limitations
});
