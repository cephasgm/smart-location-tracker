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

try {
    // Check if Firebase is already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app(); // Use existing app
    }
    firebaseInitialized = true;
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization failed:', error);
}

// Initialize services
let auth = null;
let db = null;
let storage = null;
let analytics = null;

if (firebaseInitialized) {
    try {
        auth = firebase.auth();
        db = firebase.firestore();
        
        // Initialize Storage if available
        if (firebase.storage) {
            storage = firebase.storage();
        }
        
        // Initialize Analytics if available
        if (firebase.analytics) {
            analytics = firebase.analytics();
        }

        // Enable offline persistence with modern settings
        db.enablePersistence({
            synchronizeTabs: true,
            experimentalForceOwningTab: false
        })
            .then(() => {
                console.log('✅ Offline persistence enabled');
            })
            .catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('⚠️ Multiple tabs open - persistence enabled in first tab only');
                } else if (err.code === 'unimplemented') {
                    console.warn('⚠️ Browser does not support persistence');
                } else {
                    console.error('❌ Persistence error:', err);
                }
            });

        // Set up Firestore settings
        db.settings({
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
            ignoreUndefinedProperties: true,
            merge: true
        });

        // Enable logging in development
        if (window.location.hostname === 'localhost') {
            firebase.firestore.setLogLevel('debug');
        }

    } catch (error) {
        console.error('❌ Firebase services initialization failed:', error);
    }
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

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseServices;
}

// Log status
console.log('📊 Firebase Services Status:', {
    auth: !!auth,
    db: !!db,
    storage: !!storage,
    analytics: !!analytics,
    initialized: firebaseInitialized
});
