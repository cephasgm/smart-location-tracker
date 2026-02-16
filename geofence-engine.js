// geofence-engine.js - Professional geofencing system

class GeofenceEngine {
    constructor() {
        this.geofences = [];
        this.watchId = null;
        this.initialized = false;
        console.log('🚧 GeofenceEngine initialized');
        this.init();
    }

    async init() {
        // Wait for auth
        await this.waitForAuth();
        await this.loadGeofences();
        this.initialized = true;
    }

    waitForAuth() {
        return new Promise((resolve) => {
            if (window.authManager && window.authManager.currentUser) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.authManager && window.authManager.currentUser) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve();
                }, 5000);
            }
        });
    }

    async loadGeofences() {
        try {
            if (window.authManager?.currentUser && window.firebaseServices?.db) {
                const db = window.firebaseServices.db;
                const snapshot = await db.collection('geofences')
                    .where('userId', '==', window.authManager.currentUser.uid)
                    .get();
                
                this.geofences = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log(`✅ Loaded ${this.geofences.length} geofences`);
            } else {
                this.loadDefaultGeofences();
            }
        } catch (error) {
            console.error('❌ Failed to load geofences:', error);
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
                radius: 100,
                type: 'circle',
                color: '#4caf50'
            },
            {
                id: 'work',
                name: 'Work',
                lat: 40.7580,
                lng: -73.9855,
                radius: 200,
                type: 'circle',
                color: '#2196f3'
            }
        ];
        console.log('📦 Loaded default geofences');
    }

    checkGeofences(location) {
        if (!location || !this.geofences.length) return [];
        
        const alerts = [];
        
        for (const fence of this.geofences) {
            const distance = this.calculateDistance(
                fence.lat, fence.lng,
                location.lat, location.lng
            );

            const previousDistance = this.getPreviousDistance(fence.id);

            // Check for entry
            if (distance <= fence.radius && previousDistance > fence.radius) {
                alerts.push({
                    type: 'entry',
                    fence: fence.name,
                    message: `📍 Entered ${fence.name}`,
                    location,
                    timestamp: Date.now()
                });
            }

            // Check for exit
            if (distance > fence.radius && previousDistance <= fence.radius) {
                alerts.push({
                    type: 'exit',
                    fence: fence.name,
                    message: `🚪 Exited ${fence.name}`,
                    location,
                    timestamp: Date.now()
                });
            }

            // Save current distance
            this.saveDistance(fence.id, distance);
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

    getPreviousDistance(fenceId) {
        const key = `geofence_dist_${fenceId}`;
        const data = localStorage.getItem(key);
        if (data) {
            try {
                const { distance, timestamp } = JSON.parse(data);
                if (Date.now() - timestamp < 300000) {
                    return distance;
                }
            } catch (e) {}
        }
        return Infinity;
    }

    saveDistance(fenceId, distance) {
        const key = `geofence_dist_${fenceId}`;
        localStorage.setItem(key, JSON.stringify({
            distance,
            timestamp: Date.now()
        }));
    }

    async addGeofence(name, lat, lng, radius, color = '#2196f3') {
        const fence = {
            name,
            lat,
            lng,
            radius,
            color,
            userId: window.authManager?.currentUser?.uid,
            createdAt: new Date().toISOString()
        };

        try {
            if (window.authManager?.currentUser && window.firebaseServices?.db) {
                const db = window.firebaseServices.db;
                const docRef = await db.collection('geofences').add(fence);
                fence.id = docRef.id;
            } else {
                fence.id = `local_${Date.now()}`;
            }

            this.geofences.push(fence);
            console.log(`✅ Added geofence: ${name}`);
            return fence;
        } catch (error) {
            console.error('❌ Failed to add geofence:', error);
            throw error;
        }
    }

    async removeGeofence(fenceId) {
        try {
            if (window.authManager?.currentUser && !fenceId.startsWith('local_') && window.firebaseServices?.db) {
                const db = window.firebaseServices.db;
                await db.collection('geofences').doc(fenceId).delete();
            }

            this.geofences = this.geofences.filter(f => f.id !== fenceId);
            console.log(`✅ Removed geofence: ${fenceId}`);
        } catch (error) {
            console.error('❌ Failed to remove geofence:', error);
            throw error;
        }
    }

    drawOnMap(map) {
        if (!map) return;
        
        this.geofences.forEach(fence => {
            L.circle([fence.lat, fence.lng], {
                radius: fence.radius,
                color: fence.color || '#2196f3',
                fillColor: fence.color || '#2196f3',
                fillOpacity: 0.2,
                weight: 2
            }).addTo(map).bindPopup(`
                <b>${fence.name}</b><br>
                Radius: ${fence.radius}m<br>
                Lat: ${fence.lat.toFixed(6)}<br>
                Lng: ${fence.lng.toFixed(6)}
            `);
        });
    }

    clearGeofences() {
        this.geofences = [];
        localStorage.removeItem('geofences');
        console.log('🗑️ Cleared all geofences');
    }
}

// Make it globally available
window.GeofenceEngine = GeofenceEngine;

// Create instance
const geofenceEngine = new GeofenceEngine();
window.geofenceEngine = geofenceEngine;

console.log('✅ GeofenceEngine loaded and available globally');
