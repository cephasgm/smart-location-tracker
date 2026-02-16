// analytics.js - Comprehensive analytics and error tracking

class Analytics {
    constructor() {
        this.initialized = false;
        this.sentryInitialized = false;
        this.sessionId = this.generateSessionId();
        this.events = [];
        this.performanceMetrics = {};
        this.userProperties = {};
        
        this.init();
        console.log('📊 Analytics initialized');
    }

    init() {
        // Initialize Firebase Analytics
        if (firebase.analytics) {
            this.analytics = firebase.analytics();
            this.initialized = true;
            
            // Set default parameters
            this.analytics.setDefaultEventParameters({
                app_name: 'Smart Location Tracker',
                app_version: '1.0.0',
                platform: 'web',
                session_id: this.sessionId
            });
        }

        // Initialize Sentry for error tracking
        this.initSentry();

        // Start performance monitoring
        this.initPerformanceMonitoring();

        // Track page views
        this.trackPageView();

        // Track user engagement
        this.trackEngagement();
    }

    initSentry() {
        if (typeof Sentry !== 'undefined') {
            Sentry.init({
                dsn: 'YOUR_SENTRY_DSN', // Replace with your Sentry DSN
                environment: 'production',
                release: '1.0.0',
                integrations: [
                    new Sentry.BrowserTracing(),
                    new Sentry.Replay()
                ],
                tracesSampleRate: 1.0,
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
        } else {
            console.warn('Sentry not loaded');
        }
    }

    initPerformanceMonitoring() {
        // Track Core Web Vitals
        if ('performance' in window) {
            // First Contentful Paint
            const paintEntries = performance.getEntriesByType('paint');
            paintEntries.forEach(entry => {
                if (entry.name === 'first-contentful-paint') {
                    this.performanceMetrics.fcp = entry.startTime;
                }
            });

            // Largest Contentful Paint
            new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.performanceMetrics.lcp = lastEntry.startTime;
                this.trackEvent('performance', {
                    metric: 'LCP',
                    value: lastEntry.startTime
                });
            }).observe({ type: 'largest-contentful-paint', buffered: true });

            // First Input Delay
            new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                entries.forEach(entry => {
                    this.performanceMetrics.fid = entry.processingStart - entry.startTime;
                    this.trackEvent('performance', {
                        metric: 'FID',
                        value: this.performanceMetrics.fid
                    });
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

            // Navigation Timing
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const navigationEntries = performance.getEntriesByType('navigation');
                    if (navigationEntries.length > 0) {
                        const nav = navigationEntries[0];
                        this.trackEvent('performance', {
                            metric: 'page_load',
                            domInteractive: nav.domInteractive,
                            domContentLoaded: nav.domContentLoadedEventEnd,
                            loadComplete: nav.loadEventEnd
                        });
                    }
                }, 0);
            });
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

        if (this.initialized) {
            this.analytics.logEvent('page_view', {
                page_title: title,
                page_location: window.location.href,
                page_path: path
            });
        }
    }

    trackEvent(eventName, params = {}) {
        const event = {
            name: eventName,
            params: {
                ...params,
                timestamp: Date.now(),
                session_id: this.sessionId
            }
        };

        this.events.push(event);

        // Send to Firebase Analytics
        if (this.initialized) {
            try {
                this.analytics.logEvent(eventName, event.params);
            } catch (error) {
                console.error('Failed to send analytics event:', error);
            }
        }

        // Store for offline sync
        this.storeEvent(event);

        // Log in development
        if (window.location.hostname === 'localhost') {
            console.log('📊 Analytics:', event);
        }
    }

    async storeEvent(event) {
        try {
            const db = await this.openEventDB();
            const transaction = db.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');
            await store.add(event);
        } catch (error) {
            console.error('Failed to store event:', error);
        }
    }

    openEventDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AnalyticsDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('events')) {
                    db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    setUserProperties(properties) {
        this.userProperties = { ...this.userProperties, ...properties };

        if (this.initialized) {
            this.analytics.setUserProperties(properties);
        }

        if (this.sentryInitialized) {
            Sentry.setUser(properties);
        }
    }

    setUserId(userId) {
        if (this.initialized) {
            this.analytics.setUserId(userId);
        }

        if (this.sentryInitialized) {
            Sentry.setUser({ id: userId });
        }
    }

    trackEngagement() {
        let startTime = Date.now();
        let lastActivity = startTime;

        // Track user activity
        ['mousemove', 'keydown', 'scroll', 'click'].forEach(eventType => {
            window.addEventListener(eventType, () => {
                lastActivity = Date.now();
            });
        });

        // Track session duration
        setInterval(() => {
            const duration = Math.round((lastActivity - startTime) / 1000);
            if (duration > 0 && duration % 30 === 0) { // Every 30 seconds
                this.trackEvent('session_duration', {
                    seconds: duration
                });
            }
        }, 30000);

        // Track when user leaves
        window.addEventListener('beforeunload', () => {
            const duration = Math.round((Date.now() - startTime) / 1000);
            this.trackEvent('session_end', {
                duration_seconds: duration
            });
        });
    }

    trackError(error, context = {}) {
        console.error('Tracked error:', error);

        this.trackEvent('error', {
            message: error.message,
            stack: error.stack,
            ...context
        });

        if (this.sentryInitialized) {
            Sentry.captureException(error, {
                extra: context
            });
        }
    }

    trackFeatureUsage(feature, action, details = {}) {
        this.trackEvent('feature_usage', {
            feature,
            action,
            ...details
        });
    }

    trackNavigation(from, to, method = 'click') {
        this.trackEvent('navigation', {
            from,
            to,
            method
        });
    }

    trackLocationUpdate(location) {
        this.trackEvent('location_update', {
            accuracy: location.accuracy,
            speed: location.speed,
            timestamp: location.timestamp
        });
    }

    trackTripStart(tripId, destination) {
        this.trackEvent('trip_start', {
            trip_id: tripId,
            destination
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

    getAnalyticsSummary() {
        return {
            sessionId: this.sessionId,
            eventsCount: this.events.length,
            performance: this.performanceMetrics,
            userProperties: this.userProperties
        };
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9);
    }

    async syncEvents() {
        if (!navigator.onLine || !this.initialized) return;

        try {
            const db = await this.openEventDB();
            const transaction = db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const events = await store.getAll();

            for (const event of events) {
                try {
                    await this.analytics.logEvent(event.name, event.params);
                    
                    // Delete synced event
                    const deleteTx = db.transaction(['events'], 'readwrite');
                    const deleteStore = deleteTx.objectStore('events');
                    await deleteStore.delete(event.id);
                } catch (error) {
                    console.error('Failed to sync event:', error);
                }
            }
        } catch (error) {
            console.error('Failed to sync events:', error);
        }
    }
}

// Initialize analytics
const analytics = new Analytics();
window.analytics = analytics;

// Track uncaught errors
window.addEventListener('error', (event) => {
    analytics.trackError(event.error || event, {
        type: 'uncaught',
        filename: event.filename,
        lineno: event.lineno
    });
});

window.addEventListener('unhandledrejection', (event) => {
    analytics.trackError(event.reason, {
        type: 'unhandled_promise'
    });
});
