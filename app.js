class App {
    constructor() {
        this.initElements();
        this.initEventListeners();
        this.initServiceWorker();
        this.initConnectionMonitoring();
        this.initNotificationPermission();
        this.checkInitialPermissions();
        this.initToasts();
        this.initInstallPrompt();
        this.initFeatureInitialization();
    }

    initElements() {
        this.anonymousSignInBtn = document.getElementById('anonymousSignIn');
        this.emailSignInForm = document.getElementById('emailSignInForm');
        this.requestLocationBtn = document.getElementById('requestLocationBtn');
        this.startTrackingBtn = document.getElementById('startTrackingBtn');
        this.stopTrackingBtn = document.getElementById('stopTrackingBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.signOutBtn = document.getElementById('signOutBtn');
        this.installBtn = document.getElementById('installBtn');
        this.searchContainer = document.getElementById('searchContainer');
    }

    initEventListeners() {
        // Auth events
        if (this.anonymousSignInBtn) {
            this.anonymousSignInBtn.addEventListener('click', () => {
                if (window.authManager) {
                    this.showLoading(this.anonymousSignInBtn, 'Signing in...');
                    window.authManager.signInAnonymously()
                        .then(() => {
                            this.showToast('✅ Signed in anonymously', 'success');
                        })
                        .catch((error) => {
                            this.showToast(error.message, 'error');
                        })
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
                        .then(() => {
                            this.showToast('✅ Signed in successfully', 'success');
                        })
                        .catch((error) => {
                            this.showToast(error.message, 'error');
                        })
                        .finally(() => this.hideLoading(submitBtn, 'Sign In with Email'));
                }
            });
        }

        // Sign out button
        if (this.signOutBtn) {
            this.signOutBtn.addEventListener('click', () => {
                if (window.authManager) {
                    this.showLoading(this.signOutBtn, 'Signing out...');
                    window.authManager.signOut()
                        .then(() => {
                            this.showToast('👋 Signed out', 'info');
                        })
                        .catch((error) => {
                            this.showToast(error.message, 'error');
                        })
                        .finally(() => {
                            this.hideLoading(this.signOutBtn, 'Sign Out');
                        });
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
                                
                                // Track in analytics
                                if (window.analytics) {
                                    window.analytics.trackEvent('permission_granted', {
                                        type: 'location'
                                    });
                                }
                            },
                            (error) => {
                                this.showToast('❌ Location permission denied', 'error');
                                console.error('Geolocation error:', error);
                            }
                        );
                    }
                } catch (error) {
                    console.error('Permission error:', error);
                    this.showToast('❌ Failed to get location permission', 'error');
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
                    
                    // Track in analytics
                    if (window.analytics) {
                        window.analytics.trackEvent('tracking_started');
                    }
                }
            });
        }

        if (this.stopTrackingBtn) {
            this.stopTrackingBtn.addEventListener('click', () => {
                if (window.locationEngine) {
                    window.locationEngine.stopTracking();
                    this.showToast('⏹️ Tracking stopped', 'info');
                    
                    // Track in analytics
                    if (window.analytics) {
                        window.analytics.trackEvent('tracking_stopped');
                    }
                }
            });
        }

        // Network events
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));

        // Before unload
        window.addEventListener('beforeunload', () => {
            if (window.locationEngine && window.locationEngine.isTracking) {
                // Save state before closing
                localStorage.setItem('trackingActive', 'true');
            }
        });
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
        
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info'
        };
        
        toast.innerHTML = `
            <div class="toast-title">${icons[type] || '📢'} ${titles[type] || 'Info'}</div>
            <div class="toast-message">${message}</div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after 5 seconds
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

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('🔄 New service worker installing');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showToast('🔄 Update available - refresh to update', 'info');
                        }
                    });
                });

                // Track in analytics
                if (window.analytics) {
                    window.analytics.trackEvent('service_worker_registered');
                }

            } catch (error) {
                console.error('❌ ServiceWorker registration failed:', error);
                this.showToast('⚠️ Offline mode unavailable', 'warning');
                
                if (window.analytics) {
                    window.analytics.trackError(error, { context: 'service_worker' });
                }
            }
        }
    }

    initConnectionMonitoring() {
        this.updateConnectionStatus();
    }

    handleOnline() {
        this.updateConnectionStatus();
        this.showToast('🟢 Back online', 'success');
        
        // Sync offline data
        if (window.authManager?.currentUser && window.offlineQueue) {
            window.offlineQueue.syncWithFirestore(window.authManager.currentUser.uid)
                .then(() => {
                    console.log('✅ Offline data synced');
                })
                .catch(error => {
                    console.error('❌ Sync failed:', error);
                });
        }

        // Track in analytics
        if (window.analytics) {
            window.analytics.trackEvent('connection_online');
        }
    }

    handleOffline() {
        this.updateConnectionStatus();
        this.showToast('🔴 You are offline - tracking will resume when online', 'warning');
        
        // Track in analytics
        if (window.analytics) {
            window.analytics.trackEvent('connection_offline');
        }
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
                
                // Track in analytics
                if (window.analytics) {
                    window.analytics.trackEvent('notifications_enabled');
                }
            }
        }
    }

    initToasts() {
        if (!document.getElementById('toastContainer')) {
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    }

    initInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            window.deferredPrompt = e;
            
            // Show install button if not already present
            if (!this.installBtn) {
                this.installBtn = document.createElement('button');
                this.installBtn.id = 'installBtn';
                this.installBtn.className = 'btn';
                this.installBtn.innerHTML = '📱 Install App';
                
                this.installBtn.addEventListener('click', async () => {
                    if (!window.deferredPrompt) return;
                    
                    window.deferredPrompt.prompt();
                    const { outcome } = await window.deferredPrompt.userChoice;
                    
                    if (outcome === 'accepted') {
                        this.showToast('✅ Thank you for installing!', 'success');
                        
                        // Track in analytics
                        if (window.analytics) {
                            window.analytics.trackEvent('app_installed');
                        }
                    }
                    
                    window.deferredPrompt = null;
                    this.installBtn.remove();
                });
                
                document.querySelector('.header-actions').appendChild(this.installBtn);
            }
        });

        // App installed
        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA installed');
            this.showToast('🎉 App installed successfully!', 'success');
            
            if (this.installBtn) {
                this.installBtn.remove();
            }
            
            // Track in analytics
            if (window.analytics) {
                window.analytics.trackEvent('app_installed');
            }
        });
    }

    initFeatureInitialization() {
        // Watch for tracking section becoming visible
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.id === 'trackingSection' && 
                    !mutation.target.classList.contains('hidden')) {
                    this.initializeFeatures();
                    observer.disconnect();
                }
            });
        });

        const trackingSection = document.getElementById('trackingSection');
        if (trackingSection) {
            observer.observe(trackingSection, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    initializeFeatures() {
        console.log('🚀 Initializing advanced features...');
        
        // Initialize navigation engine if map exists
        if (window.locationEngine && window.locationEngine.map && window.navigationEngine) {
            setTimeout(() => {
                window.navigationEngine.setupRouting(window.locationEngine.map);
                console.log('🗺️ Navigation engine initialized');
            }, 1000);
        }
        
        // Load trips for history
        if (window.locationHistory) {
            window.locationHistory.loadTrips().then(trips => {
                console.log(`📜 Loaded ${trips.length} trips`);
            });
        }
        
        // Initialize user profile if logged in
        if (window.userProfile && window.authManager?.currentUser) {
            window.userProfile.loadUserProfile();
        }
        
        // Set user in analytics
        if (window.analytics && window.authManager?.currentUser) {
            window.analytics.setUserId(window.authManager.currentUser.uid);
            window.analytics.setUserProperties({
                email: window.authManager.currentUser.email,
                isAnonymous: window.authManager.currentUser.isAnonymous
            });
        }
        
        // Track feature initialization
        if (window.analytics) {
            window.analytics.trackEvent('features_initialized', {
                navigation: !!window.navigationEngine,
                history: !!window.locationHistory,
                sharing: !!window.socialSharing,
                profile: !!window.userProfile,
                analytics: !!window.analytics
            });
        }
        
        this.showToast('✨ All features ready!', 'success');
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
                        
                        // Check if tracking was active before
                        const trackingActive = localStorage.getItem('trackingActive') === 'true';
                        if (trackingActive && window.locationEngine) {
                            setTimeout(() => {
                                window.locationEngine.startTracking();
                            }, 2000);
                        }
                    }
                })
                .catch(error => {
                    console.warn('Permission check failed:', error);
                });
        }
    }

    // Helper method to show/hide search container
    toggleSearch(show) {
        if (this.searchContainer) {
            this.searchContainer.style.display = show ? 'block' : 'none';
        }
    }

    // Helper method to update tracking stats
    updateTrackingStats(points, queue, geofences, duration) {
        const pointsEl = document.getElementById('totalPoints');
        const queueEl = document.getElementById('offlineQueue');
        const geofenceEl = document.getElementById('geofenceCount');
        const durationEl = document.getElementById('trackingDuration');
        
        if (pointsEl) pointsEl.innerHTML = `📍 Points tracked: ${points}`;
        if (queueEl) queueEl.innerHTML = `📱 Offline queue: ${queue}`;
        if (geofenceEl) geofenceEl.innerHTML = `🚧 Active geofences: ${geofences}`;
        if (durationEl) durationEl.innerHTML = `⏱ Tracking duration: ${duration}`;
    }

    // Helper method to format duration
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Clean up on page unload
    destroy() {
        // Save tracking state
        if (window.locationEngine && window.locationEngine.isTracking) {
            localStorage.setItem('trackingActive', 'true');
        } else {
            localStorage.removeItem('trackingActive');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create global app instance
    window.app = new App();
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (window.app) {
            window.app.destroy();
        }
    });

    // Log startup
    console.log('🚀 Smart Location Tracker v3.0.0 initialized');
    console.log('📱 PWA features enabled');
    console.log('📍 Location tracking ready');
    console.log('🗺️ Navigation features available');
    console.log('📤 Sharing capabilities active');
    console.log('👤 User profile system loaded');
    
    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('share')) {
        // Handle shared location
        setTimeout(() => {
            if (window.socialSharing) {
                window.socialSharing.handleSharedLink(urlParams);
            }
        }, 2000);
    }
});

// Error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error || event.message);
    
    if (window.analytics) {
        window.analytics.trackError(event.error || new Error(event.message), {
            type: 'global',
            filename: event.filename,
            lineno: event.lineno
        });
    }
    
    if (window.app) {
        window.app.showToast('⚠️ An error occurred', 'error');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (window.analytics) {
        window.analytics.trackError(event.reason, {
            type: 'unhandled_promise'
        });
    }
});
