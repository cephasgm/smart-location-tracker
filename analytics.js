// analytics.js - Comprehensive analytics and error tracking - v2.1.0
// FIXED: Removed duplicate declaration and added proper initialization check

// Check if analytics already exists to prevent double initialization
if (!window.AnalyticsInstance) {
    
    class Analytics {
        constructor() {
            this.initialized = false;
            this.sentryInitialized = false;
            this.sessionId = this.generateSessionId();
            this.events = [];
            this.performanceMetrics = {};
            this.userProperties = {};
            this.isDevelopment = window.location.hostname === 'localhost';
            
            this.init();
            console.log('📊 Analytics v2.1.0 initialized');
        }

        init() {
            try {
                // Initialize Firebase Analytics
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

                // Initialize Sentry for error tracking (only in production)
                if (!this.isDevelopment && typeof Sentry !== 'undefined') {
                    this.initSentry();
                }

                // Start performance monitoring
                this.initPerformanceMonitoring();

                // Track page views
                this.trackPageView();

                // Track user engagement
                this.trackEngagement();

                // Load offline events
                this.loadOfflineEvents();

            } catch (error) {
                console.warn('Analytics initialization warning:', error);
            }
        }

        initSentry() {
            try {
                Sentry.init({
                    dsn: 'YOUR_SENTRY_DSN', // Replace with your Sentry DSN
                    environment: 'production',
                    release: '3.0.0',
                    integrations: [
                        new Sentry.BrowserTracing(),
                        new Sentry.Replay()
                    ],
                    tracesSampleRate: 0.1,
                    replaysSessionSampleRate: 0.1,
                    replaysOnErrorSampleRate: 1.0,
                    beforeSend(event) {
                        // Don't send events in development
                        if (window.location.hostname === 'localhost') {
                            return null;
                        }
                        return event;
                    }
                });

                this.sentryInitialized = true;
                console.log('✅ Sentry initialized');
            } catch (error) {
                console.warn('Sentry initialization failed:', error);
            }
        }

        initPerformanceMonitoring() {
            if (!('performance' in window)) {
                return;
            }

            try {
                // First Contentful Paint
                const paintEntries = performance.getEntriesByType('paint');
                paintEntries.forEach(entry => {
                    if (entry.name === 'first-contentful-paint') {
                        this.performanceMetrics.fcp = entry.startTime;
                    }
                });

                // Largest Contentful Paint
                if ('PerformanceObserver' in window) {
                    new PerformanceObserver((entryList) => {
                        const entries = entryList.getEntries();
                        const lastEntry = entries[entries.length - 1];
                        this.performanceMetrics.lcp = lastEntry.startTime;
                    }).observe({ type: 'largest-contentful-paint', buffered: true });

                    // First Input Delay
                    new PerformanceObserver((entryList) => {
                        const entries = entryList.getEntries();
                        entries.forEach(entry => {
                            this.performanceMetrics.fid = entry.processingStart - entry.startTime;
                        });
                    }).observe({ type: 'first-input', buffered: true });

                    // Cumulative Layout Shift
                    let clsValue = 0;
                    new PerformanceObserver((entryList) => {
                        const entries = entryList.getEntries();
                        entries.forEach(entry => {
                            if (!entry.hadRecentInput) {
                                clsValue += entry.value;
                            }
                        });
                        this.performanceMetrics.cls = clsValue;
                    }).observe({ type: 'layout-shift', buffered: true });
                }
            } catch (error) {
                console.warn('Performance monitoring failed:', error);
            }
        }

        trackPageView() {
            const path = window.location.pathname;
            const title = document.title;

            this.trackEvent('page_view', {
                page_path: path,
                page_title: title,
                page_location: window.location.href
            });
        }

        trackEvent(eventName, params = {}) {
            // Add common parameters
            const enrichedParams = {
                ...params,
                timestamp: Date.now(),
                session_id: this.sessionId,
                url: window.location.href
            };

            const event = {
                name: eventName,
                params: enrichedParams,
                timestamp: Date.now()
            };

            this.events.push(event);

            // Limit events array size
            if (this.events.length > 1000) {
                this.events = this.events.slice(-1000);
            }

            // Send to Firebase Analytics if available
            if (this.initialized && this.analytics) {
                try {
                    this.analytics.logEvent(eventName, enrichedParams);
                } catch (error) {
                    // Silently fail - analytics not critical
                }
            }

            // Log in development
            if (this.isDevelopment) {
                console.log('📊 Analytics Event:', eventName, enrichedParams);
            }
        }

        setUserProperties(properties) {
            this.userProperties = { ...this.userProperties, ...properties };

            if (this.initialized && this.analytics) {
                try {
                    this.analytics.setUserProperties(properties);
                } catch (error) {
                    // Silently fail
                }
            }
        }

        setUserId(userId) {
            if (this.initialized && this.analytics) {
                try {
                    this.analytics.setUserId(userId);
                } catch (error) {
                    // Silently fail
                }
            }
        }

        trackEngagement() {
            let startTime = Date.now();
            
            // Track session duration
            const interval = setInterval(() => {
                const duration = Math.round((Date.now() - startTime) / 1000);
                if (duration > 0 && duration % 30 === 0) {
                    this.trackEvent('session_duration', {
                        seconds: duration
                    });
                }
            }, 30000);

            // Clean up interval on page unload
            window.addEventListener('beforeunload', () => {
                clearInterval(interval);
                const duration = Math.round((Date.now() - startTime) / 1000);
                this.trackEvent('session_end', {
                    duration_seconds: duration
                });
            });
        }

        trackError(error, context = {}) {
            console.error('Tracked error:', error);

            this.trackEvent('error', {
                message: error?.message || 'Unknown error',
                stack: error?.stack || '',
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

        async loadOfflineEvents() {
            // Optional: Implement if you need offline event storage
        }
    }

    // Create single instance
    window.AnalyticsInstance = new Analytics();
    window.analytics = window.AnalyticsInstance;

    // Track uncaught errors (with debounce to prevent loops)
    let errorCount = 0;
    window.addEventListener('error', (event) => {
        errorCount++;
        if (errorCount < 10) { // Limit to prevent loops
            window.analytics.trackError(event.error || new Error(event.message), {
                type: 'uncaught',
                filename: event.filename,
                lineno: event.lineno
            });
        }
    });

    window.addEventListener('unhandledrejection', (event) => {
        errorCount++;
        if (errorCount < 10) {
            window.analytics.trackError(event.reason, {
                type: 'unhandled_promise'
            });
        }
    });
} else {
    console.log('📊 Analytics already initialized, skipping duplicate');
}
