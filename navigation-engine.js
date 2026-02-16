class NavigationEngine {
    constructor() {
        this.routingControl = null;
        waypoints: [],
        this.currentRoute = null;
        this.geocoder = L.Control.Geocoder.nominatim();
        this.init();
    }

    init() {
        // Wait for map to be ready
        if (!window.locationEngine || !window.locationEngine.map) {
            setTimeout(() => this.init(), 500);
            return;
        }
        
        this.map = window.locationEngine.map;
        this.addNavigationControls();
        console.log('🗺️ Navigation Engine initialized');
    }

    addNavigationControls() {
        // Add geocoder search bar
        const geocoderControl = L.Control.geocoder({
            defaultMarkGeocode: false,
            placeholder: 'Search destination...',
            errorMessage: 'Location not found',
            geocoder: this.geocoder
        }).on('markgeocode', (e) => {
            this.setDestination(e.geocode.center, e.geocode.name);
        }).addTo(this.map);

        // Add navigation panel to UI
        this.createNavigationPanel();
    }

    createNavigationPanel() {
        const trackingSection = document.querySelector('.tracking-section');
        if (!trackingSection) return;

        const navPanel = document.createElement('div');
        navPanel.className = 'navigation-panel';
        navPanel.innerHTML = `
            <div class="nav-header">
                <h3>🚗 Navigation</h3>
                <button class="btn btn-minimize" id="minimizeNav">−</button>
            </div>
            <div class="nav-content">
                <div class="location-inputs">
                    <div class="input-group">
                        <span class="input-icon">🅰️</span>
                        <input type="text" id="startLocation" placeholder="Starting point" value="Current Location" disabled>
                    </div>
                    <div class="input-group">
                        <span class="input-icon">🅱️</span>
                        <input type="text" id="destinationInput" placeholder="Enter destination...">
                    </div>
                </div>
                
                <div class="route-options">
                    <button class="route-option active" data-mode="fastest">⚡ Fastest</button>
                    <button class="route-option" data-mode="shortest">📏 Shortest</button>
                    <button class="route-option" data-mode="eco">🌱 Eco</button>
                </div>
                
                <div class="route-info hidden" id="routeInfo">
                    <div class="route-summary">
                        <span id="routeDistance">-- km</span>
                        <span id="routeDuration">-- min</span>
                    </div>
                    <div class="turn-by-turn" id="turnByTurn">
                        <h4>Turn-by-Turn Directions</h4>
                        <div class="directions-list" id="directionsList"></div>
                    </div>
                </div>
                
                <div class="nav-actions">
                    <button class="btn btn-primary" id="startNavigation" disabled>Start Navigation</button>
                    <button class="btn btn-secondary" id="clearRoute">Clear</button>
                </div>
            </div>
        `;

        trackingSection.insertBefore(navPanel, trackingSection.querySelector('.map-container'));
        this.attachNavigationEvents();
    }

    attachNavigationEvents() {
        const destinationInput = document.getElementById('destinationInput');
        const startNavBtn = document.getElementById('startNavigation');
        const clearRouteBtn = document.getElementById('clearRoute');
        const minimizeBtn = document.getElementById('minimizeNav');
        const routeOptions = document.querySelectorAll('.route-option');

        destinationInput.addEventListener('input', () => this.searchDestination(destinationInput.value));
        
        destinationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchDestination(destinationInput.value);
            }
        });

        routeOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                routeOptions.forEach(o => o.classList.remove('active'));
                e.target.classList.add('active');
                if (this.currentRoute) {
                    this.calculateRoute(this.currentRoute.start, this.currentRoute.end, e.target.dataset.mode);
                }
            });
        });

        startNavBtn.addEventListener('click', () => this.startNavigation());
        clearRouteBtn.addEventListener('click', () => this.clearRoute());

        minimizeBtn.addEventListener('click', (e) => {
            const content = document.querySelector('.nav-content');
            const isMinimized = content.style.display === 'none';
            content.style.display = isMinimized ? 'block' : 'none';
            e.target.textContent = isMinimized ? '−' : '+';
        });
    }

    async searchDestination(query) {
        if (!query || query.length < 3) return;

        try {
            const results = await this.geocoder.geocode(query);
            if (results.length > 0) {
                this.showLocationResults(results);
            }
        } catch (error) {
            console.error('Geocoding error:', error);
        }
    }

    showLocationResults(results) {
        // Remove existing results dropdown
        const existingResults = document.querySelector('.location-results');
        if (existingResults) existingResults.remove();

        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'location-results';
        
        results.slice(0, 5).forEach(result => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <span class="result-name">${result.name}</span>
                <span class="result-desc">${result.properties?.description || ''}</span>
            `;
            item.addEventListener('click', () => {
                this.setDestination(result.center, result.name);
                resultsDiv.remove();
            });
            resultsDiv.appendChild(item);
        });

        const input = document.getElementById('destinationInput');
        input.parentNode.appendChild(resultsDiv);
    }

    setDestination(center, name) {
        document.getElementById('destinationInput').value = name;
        document.querySelector('.location-results')?.remove();

        // Add marker for destination
        if (window.locationEngine) {
            const map = window.locationEngine.map;
            
            // Remove existing destination marker
            if (this.destMarker) map.removeLayer(this.destMarker);
            
            this.destMarker = L.marker(center, {
                icon: L.divIcon({
                    className: 'destination-marker',
                    html: '🏁',
                    iconSize: [30, 30]
                })
            }).addTo(map).bindPopup(`Destination: ${name}`);

            // Get current location
            const currentPos = window.locationEngine.getLastKnownLocation();
            if (currentPos) {
                this.currentRoute = {
                    start: [currentPos.lat, currentPos.lng],
                    end: center,
                    name: name
                };
                this.calculateRoute([currentPos.lat, currentPos.lng], center);
            }
        }
    }

    calculateRoute(start, end, mode = 'fastest') {
        if (!this.map) return;

        // Remove existing route
        if (this.routingControl) {
            this.map.removeControl(this.routingControl);
        }

        // Create routing control with selected mode
        this.routingControl = L.Routing.control({
            waypoints: [
                L.latLng(start[0], start[1]),
                L.latLng(end[0], end[1])
            ],
            routeWhileDragging: false,
            showAlternatives: true,
            altLineOptions: {
                styles: [
                    {color: 'black', opacity: 0.15, weight: 9},
                    {color: 'white', opacity: 0.8, weight: 6},
                    {color: 'blue', opacity: 0.5, weight: 2}
                ]
            },
            router: L.Routing.osrmv1({
                profile: this.getRoutingProfile(mode),
                serviceUrl: 'https://router.project-osrm.org/route/v1'
            }),
            formatter: new L.Routing.Formatter({
                units: 'metric',
                round: true
            })
        }).addTo(this.map);

        this.routingControl.on('routesfound', (e) => {
            const routes = e.routes;
            this.displayRouteInfo(routes[0]);
            document.getElementById('startNavigation').disabled = false;
        });

        this.routingControl.on('routingerror', (e) => {
            console.error('Routing error:', e.error);
            this.showToast('❌ Could not calculate route', 'error');
        });
    }

    getRoutingProfile(mode) {
        switch(mode) {
            case 'fastest': return 'driving';
            case 'shortest': return 'driving'; // OSRM doesn't have shortest, but we can use driving
            case 'eco': return 'cycling'; // Eco-friendly routes (cycling paths, less traffic)
            default: return 'driving';
        }
    }

    displayRouteInfo(route) {
        const distance = (route.summary.totalDistance / 1000).toFixed(1);
        const duration = Math.round(route.summary.totalTime / 60);
        
        document.getElementById('routeInfo').classList.remove('hidden');
        document.getElementById('routeDistance').textContent = `${distance} km`;
        document.getElementById('routeDuration').textContent = `${duration} min`;

        // Display turn-by-turn directions
        const directionsList = document.getElementById('directionsList');
        directionsList.innerHTML = '';
        
        route.instructions.forEach((instruction, index) => {
            const step = document.createElement('div');
            step.className = 'direction-step';
            step.innerHTML = `
                <span class="step-number">${index + 1}</span>
                <span class="step-text">${instruction.text}</span>
                <span class="step-distance">${(instruction.distance / 1000).toFixed(1)} km</span>
            `;
            directionsList.appendChild(step);
        });
    }

    startNavigation() {
        if (!this.routingControl) return;

        // Switch to navigation mode
        this.isNavigating = true;
        
        // Center map on current location
        if (window.locationEngine) {
            const currentPos = window.locationEngine.getLastKnownLocation();
            if (currentPos) {
                window.locationEngine.map.setView([currentPos.lat, currentPos.lng], 15);
            }
        }

        // Start voice guidance
        this.startVoiceGuidance();

        // Update button
        const startBtn = document.getElementById('startNavigation');
        startBtn.textContent = '🚗 Navigating...';
        startBtn.disabled = true;

        this.showToast('🚗 Navigation started', 'success');
    }

    startVoiceGuidance() {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance('Navigation started. Follow the route.');
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    clearRoute() {
        if (this.routingControl) {
            this.map.removeControl(this.routingControl);
            this.routingControl = null;
        }
        
        if (this.destMarker) {
            this.map.removeLayer(this.destMarker);
            this.destMarker = null;
        }

        document.getElementById('routeInfo').classList.add('hidden');
        document.getElementById('destinationInput').value = '';
        document.getElementById('startNavigation').disabled = true;
        
        this.currentRoute = null;
        this.isNavigating = false;
    }

    showToast(message, type = 'info') {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, type);
        }
    }
}

// Initialize navigation engine
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.navigationEngine = new NavigationEngine();
    }, 1000);
});
