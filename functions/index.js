const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Set admin claims for specific email
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
    // Check if request is from authenticated user
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Only allow existing admins to set new admins
    const callerUid = context.auth.uid;
    const callerClaims = (await admin.auth().getUser(callerUid)).customClaims;
    
    if (!callerClaims || !callerClaims.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const { email } = data;
    
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        return { result: `Admin claim set for ${email}` };
    } catch (error) {
        throw new functions.https.HttpsError('not-found', 'User not found');
    }
});

// Clean up old location data
exports.cleanupOldLocations = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        const db = admin.firestore();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days of data

        const oldLocations = await db.collection('locations')
            .where('timestamp', '<', cutoffDate)
            .get();

        const batch = db.batch();
        oldLocations.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Cleaned up ${oldLocations.size} old location records`);
        return null;
    });

// Generate user activity report
exports.generateUserReport = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, startDate, endDate } = data;
    const db = admin.firestore();

    const locations = await db.collection('locations')
        .where('userId', '==', userId)
        .where('timestamp', '>=', new Date(startDate))
        .where('timestamp', '<=', new Date(endDate))
        .orderBy('timestamp')
        .get();

    const report = {
        userId,
        period: { startDate, endDate },
        totalLocations: locations.size,
        firstLocation: locations.docs[0]?.data(),
        lastLocation: locations.docs[locations.size - 1]?.data(),
        distance: calculateTotalDistance(locations.docs.map(d => d.data()))
    };

    return report;
});

function calculateTotalDistance(locations) {
    if (locations.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < locations.length; i++) {
        total += calculateDistance(
            locations[i-1].lat, locations[i-1].lng,
            locations[i].lat, locations[i].lng
        );
    }
    return total;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}
