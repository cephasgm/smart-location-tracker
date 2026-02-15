class AdminDashboard {
    constructor() {
        this.map = null;
        this.userMarkers = new Map();
        this.userPolylines = new Map();
        this.activeListeners = [];
        this.initMap();
        this.initEventListeners();
        this.checkAdminAccess();
    }

    initMap() {
        this.map = L.map('adminMap').setView([40.7128, -74.0060], 10);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    initEventListeners() {
        document.getElementById('signOutBtn').addEventListener('click', () => {
            authManager.signOut();
            window.location.href = '/';
        });

        document.getElementById('userSelect').addEventListener('change', (e) => {
            this.onUserSelected(e.target.value);
        });

        document.getElementById('liveMode').addEventListener('change', (e) => {
            const historicalControls = document.getElementById('historicalControls');
            historicalControls.style.display = e.target.checked ? 'none' : 'block';
            
            if (e.target.checked) {
                this.startLiveTracking();
            } else {
                this.stopLiveTracking();
            }
        });

        document.getElementById('loadHistoryBtn').addEventListener('click', () => {
            this.loadHistoricalData();
        });
    }

    async checkAdminAccess() {
        authManager.auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = '/';
                return;
            }

            // Check if user is admin
            const idTokenResult = await user.getIdTokenResult();
            if (!idTokenResult.claims.admin) {
                alert('Access denied. Admin only.');
                window.location.href = '/';
                return;
            }

            this.loadUsers();
        });
    }

    async loadUsers() {
        try {
            const db = firebaseServices.db;
            
            // Get users from locations collection
            const snapshot = await db.collection('locations')
                .orderBy('timestamp', 'desc')
                .limit(1000)
                .get();

            const users = new Set();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.userId) {
                    users.add(data.userId);
                }
            });

            this.populateUserSelect(Array.from(users));
            this.updateStats(users.size, snapshot.size);
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }

    populateUserSelect(users) {
        const select = document.getElementById('userSelect');
        select.innerHTML = '<option value="">Choose a user...</option>';
        
        users.forEach(userId => {
            const option = document.createElement('option');
            option.value = userId;
            option.textContent = `${userId.slice(0, 8)}...`;
            select.appendChild(option);
        });
    }

    async onUserSelected(userId) {
        if (!userId) return;

        this.clearMap();

        if (document.getElementById('liveMode').checked) {
            this.startLiveTrackingForUser(userId);
        } else {
            await this.loadHistoricalDataForUser(userId);
        }
    }

    startLiveTrackingForUser(userId) {
        // Stop existing listeners
        this.stopLiveTracking();

        const db = firebaseServices.db;
        
        // Listen for new locations
        const unsubscribe = db.collection('locations')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        this.updateUserLocation(userId, change.doc.data());
                    }
                });
            });

        this.activeListeners.push(unsubscribe);
    }

    async loadHistoricalDataForUser(userId) {
        const startDate = new Date(document.getElementById('startDate').value);
        const endDate = new Date(document.getElementById('endDate').value);
        
        if (!startDate || !endDate) {
            alert('Please select start and end dates');
            return;
        }

        const db = firebaseServices.db;
        
        const snapshot = await db.collection('locations')
            .where('userId', '==', userId)
            .where('timestamp', '>=', startDate)
            .where('timestamp', '<=', endDate)
            .orderBy('timestamp', 'asc')
            .get();

        const locations = snapshot.docs.map(doc => doc.data());
        this.plotHistoricalData(userId, locations);
    }

    updateUserLocation(userId, location) {
        const latlng = [location.lat, location.lng];
        
        // Update or create marker
        if (this.userMarkers.has(userId)) {
            this.userMarkers.get(userId).setLatLng(latlng);
        } else {
            const marker = L.marker(latlng, {
                title: `User: ${userId.slice(0, 8)}`
            }).addTo(this.map);
            
            marker.bindPopup(`
                <b>User: ${userId.slice(0, 8)}...</b><br>
                Lat: ${location.lat.toFixed(6)}<br>
                Lng: ${location.lng.toFixed(6)}<br>
                Time: ${new Date(location.timestamp?.toDate()).toLocaleString()}
            `);
            
            this.userMarkers.set(userId, marker);
        }

        // Update polyline
        this.updateUserPolyline(userId, latlng);
        
        // Update location in list
        this.updateUserLocationList(userId, location);
    }

    updateUserPolyline(userId, latlng) {
        if (!this.userPolylines.has(userId)) {
            const polyline = L.polyline([], { color: this.getRandomColor() }).addTo(this.map);
            this.userPolylines.set(userId, polyline);
        }
        
        const polyline = this.userPolylines.get(userId);
        const latlngs = polyline.getLatLngs();
        latlngs.push(latlng);
        
        // Keep only last 100 points
        if (latlngs.length > 100) {
            latlngs.shift();
        }
        
        polyline.setLatLngs(latlngs);
    }

    updateUserLocationList(userId, location) {
        const listElement = document.getElementById('userLocationsList');
        
        let userItem = document.getElementById(`user-${userId}`);
        if (!userItem) {
            userItem = document.createElement('div');
            userItem.id = `user-${userId}`;
            userItem.className = 'user-location-item';
            listElement.prepend(userItem);
        }
        
        userItem.innerHTML = `
            <strong>User: ${userId.slice(0, 8)}...</strong><br>
            Lat: ${location.lat.toFixed(6)}<br>
            Lng: ${location.lng.toFixed(6)}<br>
            Time: ${new Date(location.timestamp?.toDate()).toLocaleString()}
        `;
    }

    plotHistoricalData(userId, locations) {
        const points = locations.map(loc => [loc.lat, loc.lng]);
        
        // Create polyline for history
        L.polyline(points, { 
            color: this.getRandomColor(),
            weight: 3,
            opacity: 0.7
        }).addTo(this.map);
        
        // Add start marker
        if (locations.length > 0) {
            L.marker([locations[0].lat, locations[0].lng], {
                icon: L.divIcon({ className: 'start-marker', html: '🚩' })
            }).addTo(this.map)
              .bindPopup('Start of tracking');
        }
        
        // Add end marker
        if (locations.length > 1) {
            const last = locations[locations.length - 1];
            L.marker([last.lat, last.lng], {
                icon: L.divIcon({ className: 'end-marker', html: '🏁' })
            }).addTo(this.map)
              .bindPopup('End of tracking');
        }
        
        // Fit map to show all points
        if (points.length > 0) {
            this.map.fitBounds(points);
        }
    }

    stopLiveTracking() {
        this.activeListeners.forEach(unsubscribe => unsubscribe());
        this.activeListeners = [];
    }

    clearMap() {
        this.userMarkers.forEach(marker => this.map.removeLayer(marker));
        this.userPolylines.forEach(polyline => this.map.removeLayer(polyline));
        this.userMarkers.clear();
        this.userPolylines.clear();
    }

    async updateStats(userCount, locationCount) {
        document.getElementById('activeUsers').textContent = userCount;
        document.getElementById('totalLocations').textContent = locationCount;
        
        // Get geofence count
        const db = firebaseServices.db;
        const geofenceSnapshot = await db.collection('geofences').get();
        document.getElementById('geofenceCount').textContent = geofenceSnapshot.size;
    }

    getRandomColor() {
        const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33F1', '#F1FF33'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AdminDashboard();
});
