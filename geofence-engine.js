class GeofenceEngine {
    constructor() {
        this.geofences = [];
        this.loadGeofences();
    }

    async loadGeofences() {
        try {
            // Load geofences from Firestore if authenticated
            if (authManager.currentUser) {
                const db = firebaseServices.db;
                const snapshot = await db.collection('geofences')
                    .where('userId', '==', authManager.currentUser.uid)
                    .get();
                
                this.geofences = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }
        } catch (error) {
            console.error('Failed to load geofences:', error);
            // Load default geofences as fallback
            this.loadDefaultGeofences();
        }
    }

    loadDefaultGeofences() {
        this.geofences = [
            {
                id: 'home',
                name: 'Home',
                lat: 40.7128,
                lng: -74.0060,
                radius: 100, // meters
                type: 'circle'
            },
            {
                id: 'work',
                name: 'Work',
                lat: 40.7580,
                lng: -73.9855,
                radius: 200,
                type: 'circle'
            }
        ];
    }

    checkGeofences(location) {
        const alerts = [];
        
        for (const fence of this.geofences) {
            const distance = this.calculateDistance(
                fence.lat, fence.lng,
                location.lat, location.lng
            );

            const previousDistance = this.getPreviousDistance(fence.id, location);

            // Check for entry
            if (distance <= fence.radius && previousDistance > fence.radius) {
                alerts.push({
                    type: 'entry',
                    fence: fence.name,
                    message: `Entered ${fence.name}`,
                    location,
                    timestamp: Date.now()
                });
            }

            // Check for exit
            if (distance > fence.radius && previousDistance <= fence.radius) {
                alerts.push({
                    type: 'exit',
                    fence: fence.name,
                    message: `Exited ${fence.name}`,
                    location,
                    timestamp: Date.now()
                });
            }

            // Save current distance for next check
            this.saveDistance(fence.id, location, distance);
        }

        return alerts;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = this.toRadians(lat1);
        const φ2 = this.toRadians(lat2);
        const Δφ = this.toRadians(lat2 - lat1);
        const Δλ = this.toRadians(lon2 - lon1);

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    getPreviousDistance(fenceId, location) {
        const key = `geofence_${fenceId}`;
        const data = localStorage.getItem(key);
        
        if (data) {
            try {
                const { distance, timestamp } = JSON.parse(data);
                // Only use data from last 5 minutes
                if (Date.now() - timestamp < 300000) {
                    return distance;
                }
            } catch (e) {
                console.error('Failed to parse previous distance:', e);
            }
        }
        
        return Infinity; // Assume outside if no recent data
    }

    saveDistance(fenceId, location, distance) {
        const key = `geofence_${fenceId}`;
        const data = {
            distance,
            timestamp: Date.now(),
            location: {
                lat: location.lat,
                lng: location.lng
            }
        };
        
        localStorage.setItem(key, JSON.stringify(data));
    }

    async addGeofence(name, lat, lng, radius, type = 'circle') {
        const fence = {
            name,
            lat,
            lng,
            radius,
            type,
            userId: authManager.currentUser?.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (authManager.currentUser) {
                const db = firebaseServices.db;
                const docRef = await db.collection('geofences').add(fence);
                fence.id = docRef.id;
            } else {
                fence.id = `local_${Date.now()}`;
            }

            this.geofences.push(fence);
            return fence;
        } catch (error) {
            console.error('Failed to add geofence:', error);
            throw error;
        }
    }

    async removeGeofence(fenceId) {
        try {
            if (authManager.currentUser && !fenceId.startsWith('local_')) {
                const db = firebaseServices.db;
                await db.collection('geofences').doc(fenceId).delete();
            }

            this.geofences = this.geofences.filter(f => f.id !== fenceId);
        } catch (error) {
            console.error('Failed to remove geofence:', error);
            throw error;
        }
    }
}
