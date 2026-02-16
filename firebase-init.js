// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBJLk9mSf-8ar1Mi6k_P0pkXyemdUnX7Lg",
    authDomain: "smart-location-tracker-56653.firebaseapp.com",
    projectId: "smart-location-tracker-56653",
    storageBucket: "smart-location-tracker-56653.firebasestorage.app",
    messagingSenderId: "587750518401",
    appId: "1:587750518401:web:8ed63ecc4d3711b6ad6780",
    measurementId: "G-HDKF5K5RJM"
};

// Initialize Firebase with error handling
let firebaseInitialized = false;
let auth = null;
let db = null;
let storage = null;
let analytics = null;

try {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // Get services
    auth = firebase.auth();
    db = firebase.firestore();
    
    // Set settings BEFORE any other operations
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        ignoreUndefinedProperties: true,
        merge: true
    });
    
    // Enable persistence AFTER settings
    db.enablePersistence({
        synchronizeTabs: true,
        experimentalForceOwningTab: false
    })
    .then(() => {
        console.log('✅ Offline persistence enabled');
    })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('⚠️ Multiple tabs open - persistence in first tab only');
        } else if (err.code === 'unimplemented') {
            console.warn('⚠️ Browser does not support persistence');
        } else {
            console.warn('⚠️ Persistence error:', err.message);
        }
    });
    
    // Initialize Storage if available
    if (firebase.storage) {
        storage = firebase.storage();
    }
    
    // Initialize Analytics if available
    if (firebase.analytics) {
        try {
            analytics = firebase.analytics();
            // FIXED: Test analytics and handle ad-blockers gracefully
            analytics.logEvent('test_event', { test: true })
                .then(() => {
                    console.log('✅ Firebase Analytics initialized');
                })
                .catch((e) => {
                    console.log('📊 Analytics unavailable (likely ad-blocker)');
                    analytics = null;
                });
        } catch (e) {
            console.log('📊 Analytics initialization failed (ad-blocker detected)');
            analytics = null;
        }
    } else {
        console.log('📊 Firebase Analytics not available');
    }
    
    firebaseInitialized = true;
    console.log('✅ Firebase initialized successfully');
    
} catch (error) {
    console.error('❌ Firebase initialization failed:', error);
}

// Create global services object
const firebaseServices = {
    auth,
    db,
    storage,
    analytics,
    isInitialized: firebaseInitialized
};

// Make it globally available
window.firebaseServices = firebaseServices;

// Log status
console.log('📊 Firebase Services Status:', {
    auth: !!auth,
    db: !!db,
    storage: !!storage,
    analytics: !!analytics,
    initialized: firebaseInitialized
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseServices;
}
