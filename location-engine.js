class LocationEngine {
    constructor() {
        this.watchId = null;
        this.isTracking = false;
        this.locations = [];
        this.map = null;
        this.marker = null;
        this.polyline = null;
        this.antiSpoof = new AntiSpoof();
        this.geofenceEngine = new GeofenceEngine();
        this.maxLocations = 1000; // Maximum locations to keep in memory
        this.initMap();
    }

    initMap() {
        // Initialize map with OpenStreetMap
        this.map = L.map('map').setView([0, 0], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        // Custom icon for user location
        this.userIcon = L.divIcon({
            className: 'user-location-marker',
            html: '📍',
            iconSize: [30, 30],
            popupAnchor: [0, -15]
        });
    }

    async requestLocationPermission() {
        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported by this browser');
        }

        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            return permission.state;
        } catch (error) {
            console.warn('Permission API not supported, falling back to getCurrentPosition');
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
        this.updateTrackingUI();
    }

    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isTracking = false;
            this.updateTrackingUI();
        }
    }

    async handleLocationUpdate(position) {
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        const timestamp = position.timestamp;

        // Anti-spoofing check
        const locationData = {
            lat: latitude,
            lng: longitude,
            accuracy,
            speed,
            heading,
            timestamp
        };

        if (!this.antiSpoof.validateLocation(locationData)) {
            console.warn('Potential location spoofing detected');
            this.showWarning('Location spoofing detected!');
            return;
        }

        // Geofence check
        const geofenceAlerts = this.geofenceEngine.checkGeofences(locationData);
        if (geofenceAlerts.length > 0) {
            this.handleGeofenceAlerts(geofenceAlerts);
        }

        // Update UI
        this.updateLocationUI(locationData);

        // Update map
        this.updateMap(latitude, longitude);

        // Save location
        await this.saveLocation({
            ...locationData,
            userId: authManager.currentUser?.uid
        });

        // Add to trail
        this.addToTrail(latitude, longitude);
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
        document.getElementById('locationStatus').textContent = '⚠️ ' + message;
        document.getElementById('locationStatus').className = 'status-error';
    }

    async saveLocation(locationData) {
        // Add to local array
        this.locations.push(locationData);
        
        // Limit array size
        if (this.locations.length > this.maxLocations) {
            this.locations.shift();
        }

        // Update UI
        document.getElementById('totalPoints').textContent = 
            `Points tracked: ${this.locations.length}`;

        // Check online status
        if (navigator.onLine) {
            try {
                // Save to Firestore
                const db = firebaseServices.db;
                await db.collection('locations').add({
                    ...locationData,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error('Failed to save to Firestore:', error);
                // Queue offline
                await offlineQueue.queueLocation(locationData);
            }
        } else {
            // Queue offline
            await offlineQueue.queueLocation(locationData);
        }
    }

    updateMap(lat, lng) {
        if (!this.map) return;

        // Update marker
        if (this.marker) {
            this.marker.setLatLng([lat, lng]);
        } else {
            this.marker = L.marker([lat, lng], { icon: this.userIcon }).addTo(this.map);
        }

        // Center map on new location
        this.map.setView([lat, lng], this.map.getZoom());

        // Update popup
        this.marker.bindPopup(`
            <b>Current Location</b><br>
            Lat: ${lat.toFixed(6)}<br>
            Lng: ${lng.toFixed(6)}<br>
            ${new Date().toLocaleTimeString()}
        `).openPopup();
    }

    addToTrail(lat, lng) {
        if (!this.map) return;

        // Update polyline
        const latlngs = this.locations.map(loc => [loc.lat, loc.lng]);
        
        if (this.polyline) {
            this.polyline.setLatLngs(latlngs);
        } else {
            this.polyline = L.polyline(latlngs, { color: 'blue' }).addTo(this.map);
        }
    }

    updateLocationUI(location) {
        document.getElementById('coordinates').innerHTML = 
            `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}`;
        document.getElementById('accuracy').innerHTML = 
            `Accuracy: ${location.accuracy.toFixed(1)} m`;
        document.getElementById('timestamp').innerHTML = 
            `Last update: ${new Date(location.timestamp).toLocaleTimeString()}`;
        
        const statusEl = document.getElementById('locationStatus');
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

    updateTrackingUI() {
        const startBtn = document.getElementById('startTrackingBtn');
        const stopBtn = document.getElementById('stopTrackingBtn');
        
        if (this.isTracking) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }

    handleGeofenceAlerts(alerts) {
        const geofenceStatus = document.getElementById('geofenceStatus');
        geofenceStatus.innerHTML = alerts.map(alert => 
            `<div class="geofence-alert">${alert.message}</div>`
        ).join('');
        
        // Show notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
            alerts.forEach(alert => {
                new Notification('Geofence Alert', {
                    body: alert.message,
                    icon: '/assets/icons/icon-192x192.png'
                });
            });
        }
    }

    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--danger-color);
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 1000;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    showWarning(message) {
        const toast = document.createElement('div');
        toast.className = 'warning-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--warning-color);
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 1000;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
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
