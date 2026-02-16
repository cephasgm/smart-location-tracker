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
        
        // Add sign out button to header
        this.addSignOutButton();
    }

    addSignOutButton() {
        const header = document.querySelector('header');
        if (!header) return;
        
        const signOutBtn = document.createElement('button');
        signOutBtn.id = 'signOutBtn';
        signOutBtn.className = 'btn btn-secondary';
        signOutBtn.textContent = 'Sign Out';
        signOutBtn.style.marginLeft = '10px';
        signOutBtn.style.display = 'none'; // Hidden initially
        header.appendChild(signOutBtn);
        
        signOutBtn.addEventListener('click', () => {
            if (window.authManager) {
                window.authManager.signOut();
                window.location.reload();
            }
        });
        
        this.signOutBtn = signOutBtn;
    }

    initEventListeners() {
        // Auth events
        if (this.anonymousSignInBtn) {
            this.anonymousSignInBtn.addEventListener('click', () => {
                if (window.authManager) {
                    window.authManager.signInAnonymously();
                }
            });
        }

        if (this.emailSignInForm) {
            this.emailSignInForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email')?.value;
                const password = document.getElementById('password')?.value;
                if (window.authManager && email && password) {
                    window.authManager.signInWithEmail(email, password);
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
                    
                    const permission = await window.locationEngine.requestLocationPermission();
                    if (permission === 'granted' || permission === 'prompt') {
                        // Try to get current position to trigger permission prompt
                        navigator.geolocation.getCurrentPosition(
                            () => {
                                if (this.requestLocationBtn) this.requestLocationBtn.disabled = true;
                                if (this.startTrackingBtn) this.startTrackingBtn.disabled = false;
                                const locationPermission = document.getElementById('locationPermission');
                                if (locationPermission) {
                                    locationPermission.style.display = 'none';
                                }
                                console.log('📍 Location permission granted');
                            },
                            (error) => {
                                console.error('Location permission denied:', error);
                            }
                        );
                    }
                } catch (error) {
                    console.error('Permission error:', error);
                }
            });
        }

        if (this.startTrackingBtn) {
            this.startTrackingBtn.addEventListener('click', () => {
                if (window.locationEngine) {
                    window.locationEngine.startTracking();
                }
            });
        }

        if (this.stopTrackingBtn) {
            this.stopTrackingBtn.addEventListener('click', () => {
                if (window.locationEngine) {
                    window.locationEngine.stopTracking();
                }
            });
        }

        // Network events
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
    }

    async initServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // Fix: Use the correct path with /smart-location-tracker/ prefix
                const registration = await navigator.serviceWorker.register('/smart-location-tracker/service-worker.js', {
                    scope: '/smart-location-tracker/'
                });
                console.log('✅ ServiceWorker registered successfully:', registration.scope);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 ServiceWorker update found:', registration.installing);
                });

                // Wait for service worker to be ready
                if (registration.installing) {
                    const worker = registration.installing;
                    worker.addEventListener('statechange', () => {
                        console.log('🔄 ServiceWorker state:', worker.state);
                    });
                }

                // Check for background sync support
                if ('SyncManager' in window) {
                    try {
                        const status = await navigator.permissions.query({
                            name: 'periodic-background-sync',
                        });
                        
                        if (status.state === 'granted') {
                            await registration.periodicSync.register('sync-locations', {
                                minInterval: 60 * 60 * 1000, // 1 hour
                            });
                        }
                    } catch (e) {
                        console.log('Periodic sync not supported');
                    }
                }
            } catch (error) {
                console.error('❌ ServiceWorker registration failed:', error);
                console.log('⚠️ App will work without offline support');
            }
        }
    }

    initConnectionMonitoring() {
        this.updateConnectionStatus();
    }

    handleOnline() {
        this.updateConnectionStatus();
        
        // Try to sync offline data
        if (window.authManager?.currentUser && window.offlineQueue) {
            window.offlineQueue.syncWithFirestore(window.authManager.currentUser.uid);
        }
    }

    handleOffline() {
        this.updateConnectionStatus();
    }

    updateConnectionStatus() {
        if (this.connectionStatus) {
            if (navigator.onLine) {
                this.connectionStatus.innerHTML = '🟢 Online';
                this.connectionStatus.style.color = '#4caf50';
            } else {
                this.connectionStatus.innerHTML = '🔴 Offline';
                this.connectionStatus.style.color = '#f44336';
            }
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

    // Show sign out button when user is authenticated
    showSignOutButton(show) {
        if (this.signOutBtn) {
            this.signOutBtn.style.display = show ? 'inline-block' : 'none';
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    
    // Show technical limitations note
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
});

// Update AuthManager to show/hide sign out button
if (window.authManager) {
    const originalInit = window.authManager.initAuthListeners;
    window.authManager.initAuthListeners = function() {
        originalInit.call(this);
        
        // Override the onAuthStateChanged to also update sign out button
        const originalCallback = this.auth.onAuthStateChanged;
        this.auth.onAuthStateChanged = (user) => {
            if (originalCallback) {
                originalCallback.call(this.auth, user);
            }
            if (window.app) {
                window.app.showSignOutButton(!!user);
            }
        };
    };
    window.authManager.initAuthListeners();
}
