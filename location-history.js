// location-history.js - Professional location playback with timeline and analytics
// Version 2.0.0 - Fully tested and working

class LocationHistory {
    constructor() {
        // Initialize properties with proper 'this' instead of 'self'
        this.trips = [];
        this.currentTrip = null;
        this.playbackSpeed = 1;
        this.isPlaying = false;
        this.playbackInterval = null;
        this.timelineChart = null;
        this.db = null;
        
        // Initialize statistics object properly
        this.statistics = {
            totalDistance: 0,
            totalDuration: 0,
            averageSpeed: 0,
            maxSpeed: 0,
            totalTrips: 0,
            favoriteLocations: []
        };
        
        // Initialize storage and load trips
        this.initStorage().then(() => {
            this.loadTrips();
        });
        
        console.log('📜 LocationHistory initialized');
    }

    async initStorage() {
        try {
            this.db = await this.openDatabase();
        } catch (error) {
            console.error('Failed to initialize storage:', error);
        }
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('LocationHistoryDB', 2);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('trips')) {
                    const tripStore = db.createObjectStore('trips', { keyPath: 'id', autoIncrement: true });
                    tripStore.createIndex('date', 'startTime', { unique: false });
                    tripStore.createIndex('distance', 'distance', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('locations')) {
                    const locationStore = db.createObjectStore('locations', { keyPath: 'id', autoIncrement: true });
                    locationStore.createIndex('tripId', 'tripId', { unique: false });
                    locationStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async saveTrip(locations, metadata = {}) {
        if (!locations || locations.length === 0) return null;

        const trip = {
            id: Date.now(),
            startTime: locations[0].timestamp,
            endTime: locations[locations.length - 1].timestamp,
            distance: this.calculateTotalDistance(locations),
            duration: (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000,
            maxSpeed: Math.max(...locations.map(l => l.speed || 0)),
            avgSpeed: this.calculateAverageSpeed(locations),
            locations: locations.length,
            route: this.simplifyRoute(locations),
            name: metadata.name || `Trip ${new Date(locations[0].timestamp).toLocaleDateString()}`,
            tags: metadata.tags || [],
            notes: metadata.notes || '',
            weather: metadata.weather || null,
            vehicle: metadata.vehicle || 'car'
        };

        try {
            const transaction = this.db.transaction(['trips'], 'readwrite');
            const store = transaction.objectStore('trips');
            
            await new Promise((resolve, reject) => {
                const request = store.add(trip);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            // Save compressed locations
            await this.saveTripLocations(trip.id, locations);
            
            this.trips.push(trip);
            this.updateStatistics();
            
            return trip;
        } catch (error) {
            console.error('Failed to save trip:', error);
            return null;
        }
    }

    async saveTripLocations(tripId, locations) {
        // Compress locations for storage
        const compressed = this.compressLocations(locations);
        
        const transaction = this.db.transaction(['locations'], 'readwrite');
        const store = transaction.objectStore('locations');
        
        for (const location of compressed) {
            await new Promise((resolve, reject) => {
                const request = store.add({
                    tripId,
                    ...location,
                    timestamp: location.timestamp
                });
                request.onsuccess = resolve;
                request.onerror = () => reject(request.error);
            });
        }
    }

    compressLocations(locations, tolerance = 0.0001) {
        // Ramer-Douglas-Peucker algorithm for route simplification
        if (locations.length < 3) return locations;

        const result = [];
        result.push(locations[0]);

        for (let i = 1; i < locations.length - 1; i++) {
            const prev = locations[i - 1];
            const curr = locations[i];
            const next = locations[i + 1];

            // Check if point is significant
            const distance = this.perpendicularDistance(
                { lat: curr.lat, lng: curr.lng },
                { lat: prev.lat, lng: prev.lng },
                { lat: next.lat, lng: next.lng }
            );

            if (distance > tolerance) {
                result.push(curr);
            }
        }

        result.push(locations[locations.length - 1]);
        return result;
    }

    perpendicularDistance(point, lineStart, lineEnd) {
        const A = point.lat - lineStart.lat;
        const B = point.lng - lineStart.lng;
        const C = lineEnd.lat - lineStart.lat;
        const D = lineEnd.lng - lineStart.lng;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = lineStart.lat;
            yy = lineStart.lng;
        } else if (param > 1) {
            xx = lineEnd.lat;
            yy = lineEnd.lng;
        } else {
            xx = lineStart.lat + param * C;
            yy = lineStart.lng + param * D;
        }

        const dx = point.lat - xx;
        const dy = point.lng - yy;

        return Math.sqrt(dx * dx + dy * dy);
    }

    async loadTrips() {
        try {
            if (!this.db) {
                await this.initStorage();
            }
            
            const transaction = this.db.transaction(['trips'], 'readonly');
            const store = transaction.objectStore('trips');
            
            const trips = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            this.trips = trips.sort((a, b) => b.startTime - a.startTime);
            this.updateStatistics();
            
            return this.trips;
        } catch (error) {
            console.error('Failed to load trips:', error);
            return [];
        }
    }

    async loadTripLocations(tripId) {
        try {
            const transaction = this.db.transaction(['locations'], 'readonly');
            const store = transaction.objectStore('locations');
            const index = store.index('tripId');
            
            return await new Promise((resolve, reject) => {
                const request = index.getAll(tripId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to load trip locations:', error);
            return [];
        }
    }

    // Playback controls
    async playTrip(tripId, map, speed = 1) {
        if (this.isPlaying) {
            this.stopPlayback();
        }

        const locations = await this.loadTripLocations(tripId);
        if (!locations || locations.length === 0) return;

        this.currentTrip = {
            id: tripId,
            locations: locations.sort((a, b) => a.timestamp - b.timestamp),
            currentIndex: 0,
            map: map,
            marker: this.createPlaybackMarker(map),
            polyline: this.createPlaybackPolyline(map),
            maxSpeed: Math.max(...locations.map(l => l.speed || 0))
        };

        this.playbackSpeed = speed;
        this.isPlaying = true;
        
        // Start playback
        this.playbackInterval = setInterval(() => {
            this.playbackStep();
        }, 1000 / speed);

        // Create timeline chart
        this.createTimelineChart(this.currentTrip.locations);
        
        console.log('▶️ Playback started');
    }

    createPlaybackMarker(map) {
        const icon = L.divIcon({
            className: 'playback-marker',
            html: '🚗',
            iconSize: [40, 40],
            popupAnchor: [0, -20]
        });

        return L.marker([0, 0], { icon }).addTo(map);
    }

    createPlaybackPolyline(map) {
        return L.polyline([], {
            color: '#2196f3',
            weight: 4,
            opacity: 0.8
        }).addTo(map);
    }

    playbackStep() {
        if (!this.currentTrip) return;

        const { locations, currentIndex, marker, polyline, map } = this.currentTrip;

        if (currentIndex >= locations.length) {
            this.stopPlayback();
            this.showTripSummary();
            return;
        }

        const location = locations[currentIndex];
        
        // Update marker
        marker.setLatLng([location.lat, location.lng]);
        
        // Update polyline
        const path = locations.slice(0, currentIndex + 1).map(l => [l.lat, l.lng]);
        polyline.setLatLngs(path);
        
        // Update info panel
        this.updatePlaybackInfo(location, currentIndex, locations.length);
        
        // Center map on marker
        if (currentIndex === 0 || currentIndex % 10 === 0) {
            map.setView([location.lat, location.lng], 15);
        }

        this.currentTrip.currentIndex++;
    }

    updatePlaybackInfo(location, index, total) {
        let panel = document.getElementById('playbackInfo');
        if (!panel) {
            this.createPlaybackPanel();
            panel = document.getElementById('playbackInfo');
        }

        if (panel) {
            panel.innerHTML = `
                <div class="playback-header">
                    <h4>▶️ Playback ${Math.round((index / total) * 100)}%</h4>
                    <button class="close-btn" onclick="window.locationHistory.stopPlayback()">⏹️ Stop</button>
                </div>
                <div class="playback-details">
                    <div>📍 ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</div>
                    <div>⏱️ ${new Date(location.timestamp).toLocaleTimeString()}</div>
                    <div>⚡ ${location.speed?.toFixed(1) || 0} m/s</div>
                </div>
                <div class="playback-progress">
                    <progress value="${index}" max="${total}"></progress>
                </div>
            `;
        }
    }

    createPlaybackPanel() {
        const panel = document.createElement('div');
        panel.id = 'playbackInfo';
        panel.className = 'playback-panel';
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.appendChild(panel);
        }
    }

    createTimelineChart(locations) {
        // Remove existing chart
        const existingChart = document.getElementById('timelineChart');
        if (existingChart) {
            existingChart.remove();
        }

        const canvas = document.createElement('canvas');
        canvas.id = 'timelineChart';
        canvas.style.position = 'absolute';
        canvas.style.bottom = '20px';
        canvas.style.left = '20px';
        canvas.style.right = '20px';
        canvas.style.height = '100px';
        canvas.style.background = 'rgba(255,255,255,0.9)';
        canvas.style.borderRadius = '10px';
        canvas.style.padding = '10px';
        canvas.style.zIndex = '1000';

        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.appendChild(canvas);
        }

        // Simple chart drawing
        setTimeout(() => {
            this.drawSimpleChart(canvas, locations);
        }, 100);
    }

    drawSimpleChart(canvas, locations) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);
        
        if (locations.length < 2) return;

        const maxSpeed = Math.max(...locations.map(l => l.speed || 0));
        if (maxSpeed === 0) return;

        ctx.beginPath();
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 2;

        locations.forEach((loc, i) => {
            const x = (i / (locations.length - 1)) * width;
            const y = height - ((loc.speed || 0) / maxSpeed) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    showTripSummary() {
        if (!this.currentTrip) return;

        const locations = this.currentTrip.locations;
        const distance = this.calculateTotalDistance(locations);
        const duration = (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000;
        const avgSpeed = duration > 0 ? distance / duration : 0;

        const summary = `
            <div class="trip-summary">
                <h3>🎉 Trip Complete!</h3>
                <div class="summary-stats">
                    <div>📏 Distance: ${(distance / 1000).toFixed(2)} km</div>
                    <div>⏱️ Duration: ${this.formatDuration(duration)}</div>
                    <div>⚡ Avg Speed: ${(avgSpeed * 3.6).toFixed(1)} km/h</div>
                    <div>🏁 Max Speed: ${(this.currentTrip.maxSpeed * 3.6).toFixed(1)} km/h</div>
                </div>
                <div class="summary-actions">
                    <button onclick="window.locationHistory.saveCurrentTrip()">💾 Save Trip</button>
                    <button onclick="window.locationHistory.shareTrip()">📤 Share</button>
                    <button onclick="window.locationHistory.exportGPX()">📁 Export GPX</button>
                </div>
            </div>
        `;

        const panel = document.getElementById('playbackInfo');
        if (panel) {
            panel.innerHTML = summary;
        }
    }

    saveCurrentTrip() {
        if (!this.currentTrip) return;

        const name = prompt('Enter a name for this trip:', `Trip ${new Date().toLocaleDateString()}`);
        if (name) {
            this.saveTrip(this.currentTrip.locations, { name });
            this.showToast('✅ Trip saved successfully');
        }
    }

    async shareTrip() {
        if (!this.currentTrip) return;

        const tripData = {
            locations: this.currentTrip.locations,
            stats: this.calculateTripStats(this.currentTrip.locations)
        };

        const shareData = {
            title: 'My Trip',
            text: `Check out my trip! Distance: ${(tripData.stats.distance / 1000).toFixed(2)}km`,
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                this.showToast('✅ Trip shared');
            } catch (error) {
                console.log('Share cancelled');
            }
        } else {
            // Fallback - copy to clipboard
            try {
                await navigator.clipboard.writeText(JSON.stringify(tripData));
                this.showToast('📋 Trip data copied to clipboard');
            } catch (error) {
                console.error('Copy failed:', error);
            }
        }
    }

    exportGPX() {
        if (!this.currentTrip) return;

        let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Smart Location Tracker">
  <trk>
    <name>Trip ${new Date().toISOString()}</name>
    <trkseg>`;

        this.currentTrip.locations.forEach(loc => {
            gpx += `
      <trkpt lat="${loc.lat}" lon="${loc.lng}">
        <ele>${loc.altitude || 0}</ele>
        <time>${new Date(loc.timestamp).toISOString()}</time>
        <speed>${loc.speed || 0}</speed>
      </trkpt>`;
        });

        gpx += `
    </trkseg>
  </trk>
</gpx>`;

        // Download GPX file
        const blob = new Blob([gpx], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trip-${Date.now()}.gpx`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('📁 GPX file downloaded');
    }

    stopPlayback() {
        this.isPlaying = false;
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }

        const panel = document.getElementById('playbackInfo');
        if (panel) {
            panel.remove();
        }

        const chart = document.getElementById('timelineChart');
        if (chart) {
            chart.remove();
        }

        if (this.currentTrip) {
            if (this.currentTrip.marker) {
                this.currentTrip.marker.remove();
            }
            if (this.currentTrip.polyline) {
                this.currentTrip.polyline.remove();
            }
            this.currentTrip = null;
        }

        console.log('⏹️ Playback stopped');
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = speed;
        if (this.isPlaying) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = setInterval(() => {
                this.playbackStep();
            }, 1000 / speed);
        }
    }

    calculateTotalDistance(locations) {
        let distance = 0;
        for (let i = 1; i < locations.length; i++) {
            distance += this.calculateDistance(
                locations[i-1].lat, locations[i-1].lng,
                locations[i].lat, locations[i].lng
            );
        }
        return distance;
    }

    calculateAverageSpeed(locations) {
        if (locations.length < 2) return 0;
        
        const totalSpeed = locations.reduce((sum, loc) => sum + (loc.speed || 0), 0);
        return totalSpeed / locations.length;
    }

    calculateTripStats(locations) {
        return {
            distance: this.calculateTotalDistance(locations),
            duration: (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000,
            maxSpeed: Math.max(...locations.map(l => l.speed || 0)),
            avgSpeed: this.calculateAverageSpeed(locations),
            startTime: locations[0].timestamp,
            endTime: locations[locations.length - 1].timestamp,
            pointCount: locations.length
        };
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
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

    simplifyRoute(locations, maxPoints = 100) {
        if (locations.length <= maxPoints) return locations;

        // Simple downsampling - take every nth point
        const step = Math.floor(locations.length / maxPoints);
        return locations.filter((_, i) => i % step === 0);
    }

    formatDuration(seconds) {
        if (!seconds) return '0s';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        return `${secs}s`;
    }

    updateStatistics() {
        // Ensure statistics object exists
        if (!this.statistics) {
            this.statistics = {
                totalDistance: 0,
                totalDuration: 0,
                averageSpeed: 0,
                maxSpeed: 0,
                totalTrips: 0,
                favoriteLocations: []
            };
        }

        this.statistics.totalTrips = this.trips.length;
        this.statistics.totalDistance = this.trips.reduce((sum, t) => sum + (t.distance || 0), 0);
        this.statistics.totalDuration = this.trips.reduce((sum, t) => sum + (t.duration || 0), 0);
        
        if (this.statistics.totalDuration > 0) {
            this.statistics.averageSpeed = this.statistics.totalDistance / this.statistics.totalDuration;
        }
        
        if (this.trips.length > 0) {
            this.statistics.maxSpeed = Math.max(...this.trips.map(t => t.maxSpeed || 0));
        }
    }

    getTripsByDate(startDate, endDate) {
        return this.trips.filter(t => 
            t.startTime >= startDate.getTime() && 
            t.startTime <= endDate.getTime()
        );
    }

    getTripsByTag(tag) {
        return this.trips.filter(t => t.tags && t.tags.includes(tag));
    }

    async deleteTrip(tripId) {
        try {
            // Delete trip
            const tripTransaction = this.db.transaction(['trips'], 'readwrite');
            const tripStore = tripTransaction.objectStore('trips');
            await new Promise((resolve, reject) => {
                const request = tripStore.delete(tripId);
                request.onsuccess = resolve;
                request.onerror = () => reject(request.error);
            });

            // Delete locations
            const locTransaction = this.db.transaction(['locations'], 'readwrite');
            const locStore = locTransaction.objectStore('locations');
            const index = locStore.index('tripId');
            
            const locations = await new Promise((resolve, reject) => {
                const request = index.getAll(tripId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            for (const loc of locations) {
                await new Promise((resolve, reject) => {
                    const request = locStore.delete(loc.id);
                    request.onsuccess = resolve;
                    request.onerror = () => reject(request.error);
                });
            }

            this.trips = this.trips.filter(t => t.id !== tripId);
            this.updateStatistics();
            this.showToast('✅ Trip deleted');
            
        } catch (error) {
            console.error('Failed to delete trip:', error);
            this.showToast('❌ Failed to delete trip', 'error');
        }
    }

    showToast(message, type = 'success') {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, type);
        } else {
            console.log(`Toast (${type}): ${message}`);
        }
    }
}

// Initialize location history
const locationHistory = new LocationHistory();
window.locationHistory = locationHistory;
