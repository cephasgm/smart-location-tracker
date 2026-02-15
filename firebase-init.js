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
try {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization failed:', error);
}

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Configure Firestore settings
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    ignoreUndefinedProperties: true
});

// Enable offline persistence with tab synchronization (fixes deprecation warning)
db.enablePersistence({
    synchronizeTabs: true,
    experimentalForceOwningTab: true
})
    .then(() => {
        console.log('Firestore persistence enabled with tab sync');
    })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a time.
            console.warn('Firestore persistence failed: Multiple tabs open - persistence enabled in first tab only');
        } else if (err.code === 'unimplemented') {
            // The current browser does not support all of the features required for persistence
            console.warn('Firestore persistence not supported by this browser');
        } else {
            console.error('Firestore persistence error:', err);
        }
    });

// Handle auth state persistence
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log('Auth persistence set to LOCAL');
    })
    .catch((error) => {
        console.error('Auth persistence error:', error);
    });

// Monitor connection state
db.enableNetwork()
    .then(() => {
        console.log('Firestore network enabled');
    })
    .catch((error) => {
        console.error('Firestore network error:', error);
    });

// Add connection state listener
firebase.firestore().enableNetwork().catch(console.error);

// Export for use in other files with enhanced services
window.firebaseServices = {
    auth,
    db,
    // Helper method to check if Firestore is ready
    isReady: () => {
        return db && auth ? true : false;
    },
    // Method to handle offline/online transitions
    handleConnectionChange: (isOnline) => {
        if (isOnline) {
            db.enableNetwork().catch(console.error);
        } else {
            db.disableNetwork().catch(console.error);
        }
    }
};

// Listen for online/offline events
window.addEventListener('online', () => {
    console.log('App is online - enabling Firestore network');
    window.firebaseServices.handleConnectionChange(true);
});

window.addEventListener('offline', () => {
    console.log('App is offline - disabling Firestore network');
    window.firebaseServices.handleConnectionChange(false);
});

// Log successful initialization
console.log('Firebase services initialized:', {
    auth: !!auth,
    db: !!db,
    persistence: 'enabled with tab sync',
    timestamp: new Date().toISOString()
});
