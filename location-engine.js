// location-engine.js - Core location tracking engine
// Version 3.0.0 - Handles real-time GPS tracking

class LocationEngine {
    constructor() {
        this.watchId = null;
        this.isTracking = false;
        this.locations = [];
        this.map = null;
        this.marker = null;
        this.polyline = null;
        this.maxLocations = 1000;
        this.antiSpoof = null;
        this.geofenceEngine = null;
        this.startTime = null;
        this.trackingInterval = null;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.waitForDependencies();
    }

    waitForDependencies() {
        // Check if all dependencies are available
        if (!window.AntiSpoof) {
            console.log('⏳ Waiting for AntiSpoof...');
            setTimeout(() => this.waitForDependencies(), 100);
            return;
        }

        if (!window.GeofenceEngine) {
            console.log('⏳ Waiting for GeofenceEngine...');
            setTimeout(() => this.waitForDependencies(), 100);
            return;
        }

        if (!window.offlineQueue) {
            console.log('⏳ Waiting for offlineQueue...');
            setTimeout(() => this.waitForDependencies(), 100);
            return;
        }

        // Initialize dependencies
        this.antiSpoof = new window.AntiSpoof();
        this.geofenceEngine = new window.GeofenceEngine();
        
        // Initialize map
        setTimeout(() => this.initMap(), 500);
        
        console.log('✅ LocationEngine initialized');
    }

    initMap() {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.log('⏳ Waiting for map container...');
            setTimeout(() => this.initMap(), 500);
            return;
        }

        if (typeof L === 'undefined') {
            console.log('⏳ Waiting for Leaflet to load...');
            setTimeout(() => this.initMap(), 500);
            return;
        }

        try {
            this.map = L.map('map').setView([40.7128, -74.0060], 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);
            
            this.userIcon = L.divIcon({
                className: 'user-location-marker',
                html: '📍',
                iconSize: [30, 30],
                popupAnchor: [0, -15]
            });

            console.log('🗺️ Map initialized successfully');
            this.getInitialLocation();
        } catch (error) {
            console.error('❌ Map initialization failed:', error);
        }
    }

    getInitialLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    this.map.setView([latitude, longitude], 15);
                    
                    L.marker([latitude, longitude], { icon: this.userIcon })
                        .addTo(this.map)
                        .bindPopup('Your current location')
                        .openPopup();
                },
                (error) => {
                    console.log('Could not get initial location:', error.message);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        }
    }

    async requestLocationPermission() {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported by this browser');
        }

        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            return permission.state;
        } catch (error) {
            console.warn('Permission API not supported');
            return 'prompt';
        }
    }

    startTracking() {
        if (!navigator.geolocation) {
            this.showError('Geolocation not supported');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        };

        this.watchId = navigator.geolocation.watchPosition(
            this.handleLocationUpdate.bind(this),
            this.handleLocationError.bind(this),
            options
        );

        this.isTracking = true;
        this.startTime = Date.now();
        this.updateTrackingUI();
        
        // Start tracking duration counter
        this.trackingInterval = setInterval(() => {
            this.updateTrackingDuration();
        }, 1000);
        
        console.log('📍 Started tracking');
        this.showSuccess('Tracking started');
        
        if (window.analytics) {
            window.analytics.trackEvent('tracking_started');
        }
    }

    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        this.isTracking = false;
        
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        
        this.updateTrackingUI();
        console.log('⏹️ Stopped tracking');
        this.showSuccess('Tracking stopped');
        
        if (window.analytics) {
            window.analytics.trackEvent('tracking_stopped');
        }
    }

    async handleLocationUpdate(position) {
        const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;
        const timestamp = position.timestamp;

        const locationData = {
            lat: latitude,
            lng: longitude,
            accuracy,
            speed: speed || 0,
            heading: heading || 0,
            altitude: altitude || 0,
            timestamp
        };

        // Anti-spoofing check
        if (this.antiSpoof && !this.antiSpoof.validateLocation(locationData)) {
            console.warn('⚠️ Potential location spoofing detected');
            this.showWarning('Location spoofing detected!');
            return;
        }

        // Geofence check
        if (this.geofenceEngine) {
            const geofenceAlerts = this.geofenceEngine.checkGeofences(locationData);
            if (geofenceAlerts.length > 0) {
                this.handleGeofenceAlerts(geofenceAlerts);
            }
        }

        // Update UI
        this.updateLocationUI(locationData);

        // Update map
        this.updateMap(latitude, longitude);

        // Save location
        await this.saveLocation({
            ...locationData,
            userId: window.authManager?.currentUser?.uid
        });

        // Add to trail
        this.addToTrail(latitude, longitude);
        
        // Track in analytics
        if (window.analytics) {
            window.analytics.trackLocationUpdate(locationData);
        }
    }

    handleLocationError(error) {
        let message = 'Location error: ';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message += 'User denied the request for geolocation.';
                break;
            case error.POSITION_UNAVAILABLE:
                message += 'Location information is unavailable.';
                break;
            case error.TIMEOUT:
                message += 'The request to get user location timed out.';
                break;
            default:
                message += 'An unknown error occurred.';
        }
        
        this.showError(message);
        const locationStatus = document.getElementById('locationStatus');
        if (locationStatus) {
            locationStatus.textContent = '⚠️ ' + message;
            locationStatus.className = 'status-error';
        }
    }

    async saveLocation(locationData) {
        // Add to local array
        this.locations.push(locationData);
        
        // Limit array size
        if (this.locations.length > this.maxLocations) {
            this.locations.shift();
        }

        // Update UI
        const totalPoints = document.getElementById('totalPoints');
        if (totalPoints) {
            totalPoints.textContent = `📍 Points tracked: ${this.locations.length}`;
        }

        // Always queue offline for redundancy
        if (window.offlineQueue) {
            await window.offlineQueue.queueLocation(locationData);
        }

        // Try to sync to Firestore if online
        if (navigator.onLine && window.firebaseServices && window.authManager?.currentUser) {
            try {
                const db = window.firebaseServices.db;
                await db.collection('locations').add({
                    userId: window.authManager.currentUser.uid,
                    ...locationData,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ Location saved to Firestore');
            } catch (error) {
                console.log('📍 Location queued for later sync');
            }
        }
    }

    updateMap(lat, lng) {
        if (!this.map) return;

        if (this.marker) {
            this.marker.setLatLng([lat, lng]);
        } else {
            this.marker = L.marker([lat, lng], { icon: this.userIcon }).addTo(this.map);
        }

        this.map.setView([lat, lng], this.map.getZoom());

        this.marker.bindPopup(`
            <b>Current Location</b><br>
            Lat: ${lat.toFixed(6)}<br>
            Lng: ${lng.toFixed(6)}<br>
            ${new Date().toLocaleTimeString()}
        `).openPopup();
    }

    addToTrail(lat, lng) {
        if (!this.map) return;

        const latlngs = this.locations.map(loc => [loc.lat, loc.lng]);
        
        if (this.polyline) {
            this.polyline.setLatLngs(latlngs);
        } else {
            this.polyline = L.polyline(latlngs, { color: 'blue' }).addTo(this.map);
        }
    }

    updateLocationUI(location) {
        const coordinatesEl = document.getElementById('coordinates');
        const accuracyEl = document.getElementById('accuracy');
        const altitudeEl = document.getElementById('altitude');
        const speedEl = document.getElementById('speed');
        const timestampEl = document.getElementById('timestamp');
        const statusEl = document.getElementById('locationStatus');

        if (coordinatesEl) {
            coordinatesEl.innerHTML = `🌐 Latitude: ${location.lat.toFixed(6)}, Longitude: ${location.lng.toFixed(6)}`;
        }
        
        if (accuracyEl) {
            accuracyEl.innerHTML = `🎯 Accuracy: ${location.accuracy.toFixed(1)} meters`;
        }
        
        if (altitudeEl) {
            altitudeEl.innerHTML = `⛰ Altitude: ${location.altitude?.toFixed(1) || 0} meters`;
        }
        
        if (speedEl) {
            speedEl.innerHTML = `⚡ Speed: ${location.speed?.toFixed(1) || 0} m/s`;
        }
        
        if (timestampEl) {
            timestampEl.innerHTML = `🕐 Last update: ${new Date(location.timestamp).toLocaleTimeString()}`;
        }
        
        if (statusEl) {
            if (location.accuracy < 20) {
                statusEl.textContent = '✅ High accuracy GPS fix';
                statusEl.className = 'status-success';
            } else if (location.accuracy < 50) {
                statusEl.textContent = '⚠️ Medium accuracy';
                statusEl.className = 'status-warning';
            } else {
                statusEl.textContent = '🔴 Low accuracy';
                statusEl.className = 'status-error';
            }
        }
    }

    updateTrackingUI() {
        const startBtn = document.getElementById('startTrackingBtn');
        const stopBtn = document.getElementById('stopTrackingBtn');
        
        if (startBtn) startBtn.disabled = this.isTracking;
        if (stopBtn) stopBtn.disabled = !this.isTracking;
    }

    updateTrackingDuration() {
        if (!this.isTracking || !this.startTime) return;
        
        const duration = Math.floor((Date.now() - this.startTime) / 1000);
        const durationEl = document.getElementById('trackingDuration');
        
        if (durationEl) {
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration % 3600) / 60);
            const seconds = duration % 60;
            
            durationEl.innerHTML = `⏱ Tracking duration: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    handleGeofenceAlerts(alerts) {
        const geofenceStatus = document.getElementById('geofenceStatus');
        if (geofenceStatus) {
            geofenceStatus.innerHTML = alerts.map(alert => 
                `<div class="geofence-alert">${alert.message}</div>`
            ).join('');
            geofenceStatus.className = 'status-info';
        }
        
        if ('Notification' in window && Notification.permission === 'granted') {
            alerts.forEach(alert => {
                new Notification('Geofence Alert', {
                    body: alert.message,
                    icon: 'icon-192x192.png'
                });
            });
        }
        
        if (window.analytics) {
            alerts.forEach(alert => {
                window.analytics.trackGeofenceEvent(alert.type, alert.fence);
            });
        }
    }

    showSuccess(message) {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, 'success');
        }
    }

    showError(message) {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, 'error');
        }
    }

    showWarning(message) {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, 'warning');
        }
    }

    getLastKnownLocation() {
        if (this.locations.length > 0) {
            return this.locations[this.locations.length - 1];
        }
        return null;
    }
}

// Initialize location engine
const locationEngine = new LocationEngine();
window.locationEngine = locationEngine;
