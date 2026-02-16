// analytics.js - Simplified analytics without Sentry dependency

class Analytics {
    constructor() {
        this.initialized = false;
        this.sessionId = this.generateSessionId();
        this.events = [];
        this.userProperties = {};
        this.isDevelopment = window.location.hostname === 'localhost';
        
        this.init();
        console.log('📊 Analytics initialized');
    }

    init() {
        try {
            // Initialize Firebase Analytics if available
            if (firebase.analytics && window.firebaseServices?.analytics) {
                this.analytics = window.firebaseServices.analytics;
                this.initialized = true;
                
                // Set default parameters
                this.analytics.setDefaultEventParameters({
                    app_name: 'Smart Location Tracker',
                    app_version: '3.0.0',
                    platform: 'web',
                    session_id: this.sessionId,
                    environment: this.isDevelopment ? 'development' : 'production'
                });

                console.log('✅ Firebase Analytics initialized');
            } else {
                console.log('ℹ️ Firebase Analytics not available');
            }
        } catch (error) {
            console.error('Failed to initialize analytics:', error);
        }

        // Track page view
        this.trackPageView();
    }

    trackPageView() {
        this.trackEvent('page_view', {
            page_path: window.location.pathname,
            page_title: document.title,
            page_location: window.location.href
        });
    }

    trackEvent(eventName, params = {}) {
        const event = {
            name: eventName,
            params: {
                ...params,
                timestamp: Date.now(),
                session_id: this.sessionId,
                url: window.location.href
            }
        };

        this.events.push(event);

        // Send to Firebase Analytics
        if (this.initialized) {
            try {
                this.analytics.logEvent(eventName, event.params);
            } catch (error) {
                console.debug('Analytics event failed:', error);
            }
        }

        // Log in development
        if (this.isDevelopment) {
            console.log('📊 Event:', eventName, params);
        }
    }

    setUserProperties(properties) {
        this.userProperties = { ...this.userProperties, ...properties };

        if (this.initialized) {
            this.analytics.setUserProperties(properties);
        }
    }

    setUserId(userId) {
        if (this.initialized) {
            this.analytics.setUserId(userId);
        }
    }

    trackError(error, context = {}) {
        console.error('Error:', error);
        
        this.trackEvent('error', {
            message: error?.message || 'Unknown error',
            ...context
        });
    }

    trackFeatureUsage(feature, action, details = {}) {
        this.trackEvent('feature_usage', {
            feature,
            action,
            ...details
        });
    }

    trackLocationUpdate(location) {
        if (!location) return;
        this.trackEvent('location_update', {
            accuracy: location.accuracy,
            speed: location.speed
        });
    }

    trackTripStart(tripId, destination) {
        this.trackEvent('trip_start', {
            trip_id: tripId,
            destination: destination || 'unknown'
        });
    }

    trackTripEnd(tripId, distance, duration) {
        this.trackEvent('trip_end', {
            trip_id: tripId,
            distance_km: distance / 1000,
            duration_minutes: duration / 60
        });
    }

    trackGeofenceEvent(eventType, geofenceName) {
        this.trackEvent('geofence', {
            type: eventType,
            geofence: geofenceName
        });
    }

    trackShare(platform, contentType) {
        this.trackEvent('share', {
            platform,
            content_type: contentType
        });
    }

    generateSessionId() {
        const existing = localStorage.getItem('analytics_session_id');
        if (existing) {
            return existing;
        }
        const newId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('analytics_session_id', newId);
        return newId;
    }
}

// Initialize analytics
let analytics;
try {
    analytics = new Analytics();
} catch (error) {
    console.error('Failed to create Analytics:', error);
    analytics = {
        trackEvent: () => {},
        trackError: () => {},
        trackFeatureUsage: () => {},
        setUserId: () => {},
        setUserProperties: () => {}
    };
}

window.analytics = analytics;

// Track uncaught errors
window.addEventListener('error', (event) => {
    if (window.analytics) {
        window.analytics.trackError(event.error || new Error(event.message), {
            type: 'uncaught',
            filename: event.filename,
            lineno: event.lineno
        });
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (window.analytics) {
        window.analytics.trackError(event.reason, {
            type: 'unhandled_promise'
        });
    }
});

console.log('✅ Analytics loaded and available globally');
