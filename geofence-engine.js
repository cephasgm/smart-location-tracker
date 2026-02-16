// geofence-engine.js - Professional geofencing system
// Version: 2.0.0

// Ensure the class is properly defined and exported
(function() {
    'use strict';

    class GeofenceEngine {
        constructor() {
            this.geofences = [];
            this.watchId = null;
            this.initialized = false;
            this.init();
            console.log('🚧 GeofenceEngine initialized');
        }

        async init() {
            try {
                await this.waitForAuth();
                await this.loadGeofences();
                this.initialized = true;
                console.log('✅ GeofenceEngine ready with', this.geofences.length, 'geofences');
            } catch (error) {
                console.error('❌ GeofenceEngine init failed:', error);
                // Load default geofences as fallback
                this.loadDefaultGeofences();
                this.initialized = true;
            }
        }

        waitForAuth() {
            return new Promise((resolve) => {
                // Check if auth is already available
                if (window.authManager && window.authManager.currentUser) {
                    resolve();
                    return;
                }

                // Wait for auth to be ready
                let attempts = 0;
                const maxAttempts = 50; // 5 seconds total (50 * 100ms)
                
                const checkInterval = setInterval(() => {
                    attempts++;
                    
                    if (window.authManager && window.authManager.currentUser) {
                        clearInterval(checkInterval);
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        console.log('⏰ Auth timeout, continuing without user');
                        resolve(); // Resolve anyway to continue loading
                    }
                }, 100);
            });
        }

        async loadGeofences() {
            try {
                // Check if Firebase is available and user is authenticated
                if (window.firebaseServices && 
                    window.firebaseServices.db && 
                    window.authManager && 
                    window.authManager.currentUser) {
                    
                    const db = window.firebaseServices.db;
                    const userId = window.authManager.currentUser.uid;
                    
                    const snapshot = await db.collection('geofences')
                        .where('userId', '==', userId)
                        .get();
                    
                    if (!snapshot.empty) {
                        this.geofences = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        console.log(`✅ Loaded ${this.geofences.length} geofences from Firebase`);
                    } else {
                        console.log('📭 No geofences found in Firebase, loading defaults');
                        this.loadDefaultGeofences();
                    }
                } else {
                    console.log('🔌 Firebase not available or user not authenticated, loading default geofences');
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
                    id: 'home_' + Date.now(),
                    name: 'Home',
                    lat: 40.7128,
                    lng: -74.0060,
                    radius: 100,
                    type: 'circle',
                    color: '#4caf50'
                },
                {
                    id: 'work_' + Date.now(),
                    name: 'Work',
                    lat: 40.7580,
                    lng: -73.9855,
                    radius: 200,
                    type: 'circle',
                    color: '#2196f3'
                }
            ];
            console.log('📦 Loaded', this.geofences.length, 'default geofences');
        }

        checkGeofences(location) {
            // Validate input
            if (!location || typeof location !== 'object') {
                console.warn('⚠️ Invalid location for geofence check');
                return [];
            }

            if (!this.geofences || !this.geofences.length) {
                return [];
            }

            const alerts = [];
            
            for (const fence of this.geofences) {
                try {
                    const distance = this.calculateDistance(
                        fence.lat, fence.lng,
                        location.lat, location.lng
                    );

                    const previousDistance = this.getPreviousDistance(fence.id);

                    // Check for entry
                    if (distance <= fence.radius && previousDistance > fence.radius) {
                        alerts.push({
                            type: 'entry',
                            fenceId: fence.id,
                            fenceName: fence.name,
                            message: `📍 Entered ${fence.name}`,
                            distance: distance,
                            timestamp: Date.now()
                        });
                        
                        this.showNotification('🚪 Geofence Alert', `You have entered ${fence.name}`);
                    }

                    // Check for exit
                    if (distance > fence.radius && previousDistance <= fence.radius) {
                        alerts.push({
                            type: 'exit',
                            fenceId: fence.id,
                            fenceName: fence.name,
                            message: `🚪 Exited ${fence.name}`,
                            distance: distance,
                            timestamp: Date.now()
                        });
                        
                        this.showNotification('🚪 Geofence Alert', `You have exited ${fence.name}`);
                    }

                    // Save current distance
                    this.saveDistance(fence.id, distance);

                } catch (error) {
                    console.error('❌ Error checking geofence:', error);
                }
            }

            return alerts;
        }

        calculateDistance(lat1, lon1, lat2, lon2) {
            // Validate inputs
            if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
                return Infinity;
            }

            const R = 6371e3; // Earth's radius in meters
            const φ1 = this.toRadians(lat1);
            const φ2 = this.toRadians(lat2);
            const Δφ = this.toRadians(lat2 - lat1);
            const Δλ = this.toRadians(lon2 - lon1);

            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            return R * c; // Distance in meters
        }

        toRadians(degrees) {
            return degrees * Math.PI / 180;
        }

        getPreviousDistance(fenceId) {
            try {
                const key = `geofence_dist_${fenceId}`;
                const data = localStorage.getItem(key);
                
                if (data) {
                    const parsed = JSON.parse(data);
                    // Only use data from last 5 minutes
                    if (Date.now() - parsed.timestamp < 300000) {
                        return parsed.distance;
                    }
                }
            } catch (e) {
                // Ignore localStorage errors
            }
            return Infinity;
        }

        saveDistance(fenceId, distance) {
            try {
                const key = `geofence_dist_${fenceId}`;
                localStorage.setItem(key, JSON.stringify({
                    distance: distance,
                    timestamp: Date.now()
                }));
            } catch (e) {
                // Ignore localStorage errors
            }
        }

        showNotification(title, message) {
            // Check if notifications are supported and permitted
            if (!('Notification' in window)) {
                return;
            }

            if (Notification.permission === 'granted') {
                try {
                    new Notification(title, {
                        body: message,
                        icon: '/smart-location-tracker/icon-192x192.png',
                        badge: '/smart-location-tracker/icon-72x72.png',
                        vibrate: [200, 100, 200]
                    });
                } catch (e) {
                    console.log('Notification failed:', e);
                }
            }
        }

        async addGeofence(name, lat, lng, radius, color = '#2196f3') {
            // Validate inputs
            if (!name || isNaN(lat) || isNaN(lng) || isNaN(radius) || radius <= 0) {
                throw new Error('Invalid geofence parameters');
            }

            const fence = {
                id: 'geofence_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: name,
                lat: lat,
                lng: lng,
                radius: radius,
                color: color,
                type: 'circle',
                createdAt: new Date().toISOString()
            };

            // Add user ID if authenticated
            if (window.authManager && window.authManager.currentUser) {
                fence.userId = window.authManager.currentUser.uid;
            }

            try {
                // Save to Firebase if available
                if (window.firebaseServices && 
                    window.firebaseServices.db && 
                    window.authManager && 
                    window.authManager.currentUser) {
                    
                    const db = window.firebaseServices.db;
                    const docRef = await db.collection('geofences').add(fence);
                    fence.id = docRef.id;
                    fence.firebaseId = docRef.id;
                }

                // Add to local array
                this.geofences.push(fence);
                
                console.log('✅ Added geofence:', name);
                
                // Track in analytics
                if (window.analytics) {
                    window.analytics.trackFeatureUsage('geofence', 'add', { name });
                }
                
                return fence;
                
            } catch (error) {
                console.error('❌ Failed to add geofence:', error);
                throw error;
            }
        }

        async removeGeofence(fenceId) {
            try {
                // Find the fence
                const fence = this.geofences.find(f => f.id === fenceId);
                
                if (!fence) {
                    throw new Error('Geofence not found');
                }

                // Remove from Firebase if it has a firebaseId
                if (fence.firebaseId && window.firebaseServices && window.firebaseServices.db) {
                    try {
                        const db = window.firebaseServices.db;
                        await db.collection('geofences').doc(fence.firebaseId).delete();
                    } catch (e) {
                        console.warn('Could not delete from Firebase:', e);
                    }
                }

                // Remove from local array
                this.geofences = this.geofences.filter(f => f.id !== fenceId);
                
                // Clear from localStorage
                try {
                    localStorage.removeItem(`geofence_dist_${fenceId}`);
                } catch (e) {}

                console.log('✅ Removed geofence:', fenceId);
                
                // Track in analytics
                if (window.analytics) {
                    window.analytics.trackFeatureUsage('geofence', 'remove', { fenceId });
                }
                
            } catch (error) {
                console.error('❌ Failed to remove geofence:', error);
                throw error;
            }
        }

        drawOnMap(map) {
            if (!map || !this.geofences || !this.geofences.length) {
                console.log('No map or geofences to draw');
                return;
            }

            try {
                this.geofences.forEach(fence => {
                    // Create circle
                    const circle = L.circle([fence.lat, fence.lng], {
                        radius: fence.radius,
                        color: fence.color || '#2196f3',
                        fillColor: fence.color || '#2196f3',
                        fillOpacity: 0.2,
                        weight: 2,
                        className: 'geofence-circle'
                    }).addTo(map);

                    // Add popup
                    circle.bindPopup(`
                        <b>${fence.name}</b><br>
                        Radius: ${fence.radius}m<br>
                        Lat: ${fence.lat.toFixed(6)}<br>
                        Lng: ${fence.lng.toFixed(6)}<br>
                        <button onclick="geofenceEngine.removeGeofence('${fence.id}')" 
                                style="padding:5px;margin-top:5px;background:#f44336;color:white;border:none;border-radius:3px;cursor:pointer;">
                            Delete
                        </button>
                    `);

                    // Add marker at center
                    L.marker([fence.lat, fence.lng], {
                        icon: L.divIcon({
                            className: 'geofence-marker',
                            html: '📍',
                            iconSize: [24, 24]
                        })
                    }).addTo(map).bindPopup(fence.name);
                });
                
                console.log('🗺️ Drew', this.geofences.length, 'geofences on map');
                
            } catch (error) {
                console.error('❌ Error drawing geofences:', error);
            }
        }

        clearGeofences() {
            this.geofences = [];
            console.log('🗑️ Cleared all geofences');
        }

        getGeofences() {
            return this.geofences;
        }

        getGeofenceById(id) {
            return this.geofences.find(f => f.id === id);
        }

        getGeofencesNear(lat, lng, radius = 1000) {
            return this.geofences.filter(fence => {
                const distance = this.calculateDistance(lat, lng, fence.lat, fence.lng);
                return distance <= radius;
            });
        }
    }

    // Make it globally available
    window.GeofenceEngine = GeofenceEngine;

    // Create and initialize instance
    document.addEventListener('DOMContentLoaded', () => {
        // Small delay to ensure other scripts are loaded
        setTimeout(() => {
            try {
                if (!window.geofenceEngine) {
                    window.geofenceEngine = new GeofenceEngine();
                    console.log('✅ GeofenceEngine instance created');
                }
            } catch (error) {
                console.error('❌ Failed to create GeofenceEngine:', error);
            }
        }, 500);
    });

})();

// Export for module systems (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GeofenceEngine };
}
