// Main application controller - v3.0.0
class App {
    constructor() {
        this.initialized = false;
        this.initElements();
        this.initEventListeners();
        this.initServiceWorker();
        this.initConnectionMonitoring();
        this.initNotificationPermission();
        this.checkInitialPermissions();
        this.initToasts();
        this.initInstallPrompt();
        this.initFeatureInitialization();
        
        this.initialized = true;
        console.log('✅ App initialized');
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
        this.featureButtons = document.querySelectorAll('.feature-buttons .btn');
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
                        .finally(() => {
                            this.hideLoading(this.anonymousSignInBtn, 'Continue Anonymously');
                        });
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
                        .finally(() => {
                            this.hideLoading(submitBtn, 'Sign In with Email');
                        });
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
                        throw new Error('LocationEngine not initialized');
                    }
                    
                    this.showLoading(this.requestLocationBtn, 'Requesting...');
                    
                    const permission = await window.locationEngine.requestLocationPermission();
                    
                    if (permission === 'granted' || permission === 'prompt') {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                this.requestLocationBtn.disabled = true;
                                this.startTrackingBtn.disabled = false;
                                const locationPermission = document.getElementById('locationPermission');
                                if (locationPermission) {
                                    locationPermission.style.display = 'none';
                                }
                                this.showToast('📍 Location permission granted', 'success');
                                
                                if (window.analytics) {
                                    window.analytics.trackEvent('permission_granted', {
                                        type: 'location'
                                    });
                                }
                            },
                            (error) => {
                                let message = 'Location permission denied';
                                if (error.code === 1) {
                                    message = 'Permission denied. Please enable location access.';
                                } else if (error.code === 2) {
                                    message = 'Location unavailable. Please try again.';
                                } else if (error.code === 3) {
                                    message = 'Location request timed out.';
                                }
                                this.showToast('❌ ' + message, 'error');
                                console.error('Geolocation error:', error);
                            },
                            {
                                enableHighAccuracy: true,
                                timeout: 10000,
                                maximumAge: 0
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
                    
                    if (window.analytics) {
                        window.analytics.trackEvent('tracking_stopped');
                    }
                }
            });
        }

        // Feature buttons
        this.featureButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.textContent.trim();
                if (window.analytics) {
                    window.analytics.trackEvent('feature_click', { feature: action });
                }
            });
        });

        // Network events
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));

        // Before unload
        window.addEventListener('beforeunload', () => {
            if (window.locationEngine && window.locationEngine.isTracking) {
                localStorage.setItem('trackingActive', 'true');
            } else {
                localStorage.removeItem('trackingActive');
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
        if (!toastContainer) {
            console.warn('Toast container not found');
            return;
        }
        
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
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
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
                    console.log('🔄 New service worker installing');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showToast('🔄 Update available - refresh to update', 'info');
                        }
                    });
                });

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
        
        if (window.authManager?.currentUser && window.offlineQueue) {
            window.offlineQueue.syncWithFirestore(window.authManager.currentUser.uid)
                .then(() => {
                    console.log('✅ Offline data synced');
                })
                .catch(error => {
                    console.error('❌ Sync failed:', error);
                });
        }

        if (window.analytics) {
            window.analytics.trackEvent('connection_online');
        }
    }

    handleOffline() {
        this.updateConnectionStatus();
        this.showToast('🔴 You are offline - tracking will resume when online', 'warning');
        
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
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    console.log('✅ Notifications enabled');
                    
                    if (window.analytics) {
                        window.analytics.trackEvent('notifications_enabled');
                    }
                }
            } catch (error) {
                console.error('Failed to request notification permission:', error);
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
            
            if (!this.installBtn) {
                this.installBtn = document.createElement('button');
                this.installBtn.id = 'installBtn';
                this.installBtn.className = 'btn';
                this.installBtn.innerHTML = '📱 Install App';
                
                this.installBtn.addEventListener('click', async () => {
                    if (!window.deferredPrompt) return;
                    
                    try {
                        window.deferredPrompt.prompt();
                        const { outcome } = await window.deferredPrompt.userChoice;
                        
                        if (outcome === 'accepted') {
                            this.showToast('✅ Thank you for installing!', 'success');
                            
                            if (window.analytics) {
                                window.analytics.trackEvent('app_installed');
                            }
                        }
                    } catch (error) {
                        console.error('Install prompt failed:', error);
                    }
                    
                    window.deferredPrompt = null;
                    if (this.installBtn) {
                        this.installBtn.remove();
                        this.installBtn = null;
                    }
                });
                
                const headerActions = document.querySelector('.header-actions');
                if (headerActions) {
                    headerActions.appendChild(this.installBtn);
                }
            }
        });

        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA installed');
            this.showToast('🎉 App installed successfully!', 'success');
            
            if (this.installBtn) {
                this.installBtn.remove();
                this.installBtn = null;
            }
            
            if (window.analytics) {
                window.analytics.trackEvent('app_installed');
            }
        });
    }

    initFeatureInitialization() {
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
        
        setTimeout(() => {
            try {
                if (window.locationEngine && window.locationEngine.map && window.navigationEngine) {
                    window.navigationEngine.setupRouting(window.locationEngine.map);
                    console.log('🗺️ Navigation engine initialized');
                }
            } catch (error) {
                console.error('Failed to initialize navigation:', error);
            }
        }, 1000);
        
        if (window.locationHistory) {
            window.locationHistory.loadTrips()
                .then(trips => {
                    console.log(`📜 Loaded ${trips.length} trips`);
                })
                .catch(error => {
                    console.error('Failed to load trips:', error);
                });
        }
        
        if (window.userProfile && window.authManager?.currentUser) {
            window.userProfile.loadUserProfile().catch(error => {
                console.error('Failed to load user profile:', error);
            });
        }
        
        if (window.analytics && window.authManager?.currentUser) {
            window.analytics.setUserId(window.authManager.currentUser.uid);
            window.analytics.setUserProperties({
                email: window.authManager.currentUser.email,
                isAnonymous: window.authManager.currentUser.isAnonymous
            });
            
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
                        if (this.requestLocationBtn) {
                            this.requestLocationBtn.disabled = true;
                        }
                        if (this.startTrackingBtn) {
                            this.startTrackingBtn.disabled = false;
                        }
                        const locationPermission = document.getElementById('locationPermission');
                        if (locationPermission) {
                            locationPermission.style.display = 'none';
                        }
                        
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

    toggleSearch(show) {
        if (this.searchContainer) {
            this.searchContainer.style.display = show ? 'block' : 'none';
        }
    }

    updateTrackingStats(points, queue, geofences, duration) {
        const pointsEl = document.getElementById('totalPoints');
        const queueEl = document.getElementById('offlineQueue');
        const geofenceEl = document.getElementById('geofenceCount');
        const durationEl = document.getElementById('trackingDuration');
        
        if (pointsEl) {
            pointsEl.innerHTML = `📍 Points tracked: ${points}`;
        }
        if (queueEl) {
            queueEl.innerHTML = `📱 Offline queue: ${queue}`;
        }
        if (geofenceEl) {
            geofenceEl.innerHTML = `🚧 Active geofences: ${geofences}`;
        }
        if (durationEl) {
            durationEl.innerHTML = `⏱ Tracking duration: ${this.formatDuration(duration)}`;
        }
    }

    formatDuration(seconds) {
        if (!seconds && seconds !== 0) return '00:00:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    destroy() {
        if (window.locationEngine && window.locationEngine.isTracking) {
            localStorage.setItem('trackingActive', 'true');
        } else {
            localStorage.removeItem('trackingActive');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new App();
        
        window.addEventListener('beforeunload', () => {
            if (window.app) {
                window.app.destroy();
            }
        });

        console.log('🚀 Smart Location Tracker v3.0.0 initialized');
        console.log('📱 PWA features enabled');
        console.log('📍 Location tracking ready');
        console.log('🗺️ Navigation features available');
        console.log('📤 Sharing capabilities active');
        console.log('👤 User profile system loaded');
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('share') && window.socialSharing) {
            setTimeout(() => {
                window.socialSharing.handleSharedLink(urlParams).catch(error => {
                    console.error('Failed to handle shared link:', error);
                });
            }, 2000);
        }
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
});

// Global error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error || event.message);
    
    if (window.analytics) {
        window.analytics.trackError(event.error || new Error(event.message), {
            type: 'global',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    }
    
    if (window.app && window.app.showToast) {
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
