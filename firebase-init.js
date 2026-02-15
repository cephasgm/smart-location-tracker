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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence for Firestore
db.enablePersistence()
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Multiple tabs open, persistence enabled in first tab only');
        } else if (err.code === 'unimplemented') {
            console.warn('Browser doesn\'t support persistence');
        }
    });

// Export for use in other files
window.firebaseServices = {
    auth,
    db
};
