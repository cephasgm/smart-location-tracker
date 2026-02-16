// navigation-engine.js - Professional route planning with Bolt/Google Maps style navigation
// Version 2.1.0 - FIXED: Added useDemo:false to suppress OSRM warning

class NavigationEngine {
    constructor() {
        this.map = null;
        this.routingControl = null;
        this.currentRoute = null;
        this.currentPosition = null;
        this.destination = null;
        this.waypoints = [];
        this.navigationActive = false;
        this.routeAlternatives = [];
        this.trafficLayer = null;
        this.voiceGuidance = true;
        this.units = 'metric';
        
        // Route options
        this.routeOptions = {
            fastest: true,
            shortest: false,
            avoidTolls: false,
            avoidHighways: false,
            walking: false,
            cycling: false
        };

        this.initVoiceGuidance();
        this.loadTrafficData();
        console.log('🗺️ NavigationEngine initialized');
    }

    initVoiceGuidance() {
        if ('speechSynthesis' in window) {
            this.speech = window.speechSynthesis;
            this.voiceEnabled = true;
        } else {
            console.warn('Voice guidance not supported in this browser');
            this.voiceEnabled = false;
        }
    }

    async loadTrafficData() {
        // Load traffic layer - use free layer
        this.trafficLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap, ©CartoDB',
            maxZoom: 19
        });
    }

    setupRouting(map) {
        this.map = map;
        
        // FIXED: Added useDemo:false to suppress OSRM warning
        this.routingControl = L.Routing.control({
            waypoints: [],
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: 'driving',
                alternatives: 2,
                steps: true,
                geometries: 'polyline',
                overview: 'full',
                annotations: true,
                useDemo: false // This suppresses the warning
            }),
            routeWhileDragging: true,
            showAlternatives: true,
            fitSelectedRoutes: true,
            show: true,
            collapsible: true,
            lineOptions: {
                styles: [
                    {color: '#2196f3', opacity: 0.8, weight: 6},
                    {color: '#4caf50', opacity: 0.6, weight: 4, dashArray: '10, 10'}
                ],
                addWaypoints: true,
                extendToWaypoints: true,
                missingRouteTolerance: 10
            },
            createMarker: (i, waypoint, n) => this.createCustomMarker(i, waypoint, n),
            geocoder: L.Control.Geocoder.nominatim({
                geocodingQueryParams: {
                    limit: 10
                }
            })
        }).addTo(this.map);

        // Add route listeners
        this.routingControl.on('routeselected', (e) => this.onRouteSelected(e));
        this.routingControl.on('routesfound', (e) => this.onRoutesFound(e));
        this.routingControl.on('waypointschanged', (e) => this.onWaypointsChanged(e));
    }

    createCustomMarker(i, waypoint, n) {
        const markerIcon = L.divIcon({
            className: `route-marker marker-${i === 0 ? 'start' : i === n-1 ? 'end' : 'waypoint'}`,
            html: i === 0 ? '🚩' : i === n-1 ? '🏁' : '📍',
            iconSize: [30, 30],
            popupAnchor: [0, -15]
        });

        return L.marker(waypoint.latLng, {
            icon: markerIcon,
            draggable: true,
            title: i === 0 ? 'Start' : i === n-1 ? 'Destination' : `Waypoint ${i}`
        });
    }

    onRouteSelected(e) {
        console.log('Route selected:', e.route);
        if (window.analytics) {
            window.analytics.trackEvent('route_selected', {
                distance: e.route.summary.totalDistance,
                duration: e.route.summary.totalTime
            });
        }
    }

    onRoutesFound(e) {
        console.log('Routes found:', e.routes.length);
        this.routeAlternatives = e.routes.slice(1);
    }

    onWaypointsChanged(e) {
        console.log('Waypoints changed:', e.waypoints);
    }

    async setRoute(start, destination) {
        this.currentPosition = start;
        this.destination = destination;
        
        // Clear existing waypoints
        this.routingControl.setWaypoints([
            L.latLng(start.lat, start.lng),
            L.latLng(destination.lat, destination.lng)
        ]);

        // Get route preview
        await this.getRoutePreview(start, destination);
        
        // Start navigation
        this.startNavigation();
    }

    async getRoutePreview(start, destination) {
        try {
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&annotations=true`
            );
            
            const data = await response.json();
            
            if (data.routes && data.routes.length > 0) {
                this.currentRoute = data.routes[0];
                this.routeAlternatives = data.routes.slice(1);
                
                this.displayRouteInfo(this.currentRoute);
                this.displayAlternatives(this.routeAlternatives);
            }
        } catch (error) {
            console.error('Failed to get route preview:', error);
            this.showError('Unable to calculate route');
        }
    }

    displayRouteInfo(route) {
        const distance = this.formatDistance(route.distance);
        const duration = this.formatDuration(route.duration);
        
        // Remove existing info panel
        const existingPanel = document.querySelector('.route-info-panel');
        if (existingPanel) existingPanel.remove();

        // Create route info panel
        const infoPanel = document.createElement('div');
        infoPanel.className = 'route-info-panel';
        infoPanel.innerHTML = `
            <div class="route-header">
                <h3>🚗 Route Information</h3>
                <button class="close-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
            <div class="route-details">
                <div class="route-stat">
                    <span class="stat-label">Distance:</span>
                    <span class="stat-value">${distance}</span>
                </div>
                <div class="route-stat">
                    <span class="stat-label">Duration:</span>
                    <span class="stat-value">${duration}</span>
                </div>
                <div class="route-stat">
                    <span class="stat-label">Fuel Cost:</span>
                    <span class="stat-value">$${(route.distance / 1000 * 0.15).toFixed(2)}</span>
                </div>
            </div>
            <div class="route-steps">
                <h4>Turn-by-Turn Directions</h4>
                <ol class="steps-list">
                    ${route.legs[0].steps.map(step => `
                        <li class="step-item">
                            <span class="step-icon">${this.getStepIcon(step)}</span>
                            <span class="step-instruction">${step.maneuver.instruction}</span>
                            <span class="step-distance">${this.formatDistance(step.distance)}</span>
                        </li>
                    `).join('')}
                </ol>
            </div>
        `;

        // Add to map
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.appendChild(infoPanel);
        }
    }

    displayAlternatives(routes) {
        if (!routes || routes.length === 0) return;

        // Remove existing alternatives panel
        const existingPanel = document.querySelector('.alternatives-panel');
        if (existingPanel) existingPanel.remove();

        const altPanel = document.createElement('div');
        altPanel.className = 'alternatives-panel';
        altPanel.innerHTML = `
            <div class="alternatives-header">
                <h4>🔄 Alternative Routes</h4>
                <button class="close-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
            <div class="alternatives-list">
                ${routes.map((route, index) => `
                    <div class="alternative-item" onclick="window.navigationEngine.selectAlternative(${index})">
                        <span class="route-number">Route ${index + 2}</span>
                        <span class="route-distance">${this.formatDistance(route.distance)}</span>
                        <span class="route-duration">${this.formatDuration(route.duration)}</span>
                    </div>
                `).join('')}
            </div>
        `;

        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.appendChild(altPanel);
        }
    }

    selectAlternative(index) {
        if (this.routeAlternatives[index]) {
            this.currentRoute = this.routeAlternatives[index];
            this.displayRouteInfo(this.currentRoute);
            
            // Update route on map
            const coordinates = this.currentRoute.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            const latlngs = coordinates.map(coord => L.latLng(coord[0], coord[1]));
            
            this.routingControl.setWaypoints([
                latlngs[0],
                latlngs[latlngs.length - 1]
            ]);
        }
    }

    startNavigation() {
        this.navigationActive = true;
        
        // Start position tracking
        if (window.locationEngine) {
            window.locationEngine.startTracking();
        }

        // Monitor position and provide guidance
        this.navigationInterval = setInterval(() => {
            this.updateNavigationGuidance();
        }, 5000);

        console.log('🚗 Navigation started');
        this.speak('Navigation started. Follow the highlighted route.');
        
        if (window.analytics) {
            window.analytics.trackEvent('navigation_started');
        }
    }

    updateNavigationGuidance() {
        if (!this.currentRoute || !this.currentPosition) return;

        // Calculate distance to next turn
        const nextStep = this.getNextStep();
        if (nextStep) {
            const distance = this.calculateDistance(
                this.currentPosition.lat,
                this.currentPosition.lng,
                nextStep.maneuver.location[1],
                nextStep.maneuver.location[0]
            );

            // Provide voice guidance at key points
            if (distance < 100 && !nextStep.announced) {
                this.speak(nextStep.maneuver.instruction);
                nextStep.announced = true;
                
                // Show visual instruction
                this.showVisualInstruction(nextStep);
            }
        }
    }

    getNextStep() {
        if (!this.currentRoute || !this.currentRoute.legs[0].steps) return null;
        
        const steps = this.currentRoute.legs[0].steps;
        let nextStep = null;
        let minDistance = Infinity;

        steps.forEach(step => {
            if (step.announced) return;
            
            const distance = this.calculateDistance(
                this.currentPosition.lat,
                this.currentPosition.lng,
                step.maneuver.location[1],
                step.maneuver.location[0]
            );

            if (distance < minDistance) {
                minDistance = distance;
                nextStep = step;
            }
        });

        return nextStep;
    }

    showVisualInstruction(step) {
        const instructionEl = document.createElement('div');
        instructionEl.className = 'visual-instruction';
        instructionEl.innerHTML = `
            <div class="instruction-icon">${this.getStepIcon(step)}</div>
            <div class="instruction-text">${step.maneuver.instruction}</div>
            <div class="instruction-distance">in ${this.formatDistance(step.distance)}</div>
        `;

        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.appendChild(instructionEl);
        }
        
        setTimeout(() => {
            if (instructionEl.parentNode) {
                instructionEl.remove();
            }
        }, 8000);
    }

    getStepIcon(step) {
        const type = step.maneuver.type;
        
        const icons = {
            'turn': '↪️',
            'continue': '⬆️',
            'merge': '🔄',
            'fork': '🔀',
            'end of road': '🏁',
            'roundabout': '🔄',
            'rotary': '🔄',
            'arrive': '🏁',
            'depart': '🚗',
            'straight': '⬆️',
            'ramp': '↗️'
        };
        
        return icons[type] || '➡️';
    }

    async searchLocation(query) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
            );
            
            const results = await response.json();
            
            return results.map(result => ({
                name: result.display_name,
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                type: result.type,
                address: result.address
            }));
        } catch (error) {
            console.error('Location search failed:', error);
            return [];
        }
    }

    async searchAndRoute(from, to) {
        try {
            const fromResults = await this.searchLocation(from);
            const toResults = await this.searchLocation(to);
            
            if (fromResults.length > 0 && toResults.length > 0) {
                const start = {
                    lat: fromResults[0].lat,
                    lng: fromResults[0].lng
                };
                const end = {
                    lat: toResults[0].lat,
                    lng: toResults[0].lng
                };
                
                await this.setRoute(start, end);
            } else {
                this.showError('Location not found');
            }
        } catch (error) {
            console.error('Search and route failed:', error);
            this.showError('Failed to calculate route');
        }
    }

    clearRoute() {
        if (this.routingControl) {
            this.routingControl.setWaypoints([]);
        }
        this.stopNavigation();
    }

    addWaypoint(lat, lng) {
        this.waypoints.push({ lat, lng });
        
        const waypoints = [
            L.latLng(this.currentPosition.lat, this.currentPosition.lng),
            ...this.waypoints.map(w => L.latLng(w.lat, w.lng)),
            L.latLng(this.destination.lat, this.destination.lng)
        ];
        
        this.routingControl.setWaypoints(waypoints);
    }

    toggleTraffic() {
        if (this.trafficLayer && this.map) {
            if (this.map.hasLayer(this.trafficLayer)) {
                this.map.removeLayer(this.trafficLayer);
            } else {
                this.trafficLayer.addTo(this.map);
            }
        }
    }

    toggleVoiceGuidance() {
        this.voiceGuidance = !this.voiceGuidance;
        this.speak(this.voiceGuidance ? 'Voice guidance on' : 'Voice guidance off');
    }

    speak(message) {
        if (this.voiceEnabled && this.voiceGuidance && this.speech) {
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 1;
            this.speech.speak(utterance);
        }
    }

    formatDistance(meters) {
        if (!meters) return '0 m';
        
        if (this.units === 'metric') {
            return meters > 1000 
                ? `${(meters / 1000).toFixed(1)} km` 
                : `${Math.round(meters)} m`;
        } else {
            const miles = meters * 0.000621371;
            return miles > 0.1 
                ? `${miles.toFixed(1)} mi` 
                : `${Math.round(miles * 5280)} ft`;
        }
    }

    formatDuration(seconds) {
        if (!seconds) return '0 min';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes} min`;
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

    showError(message) {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, 'error');
        } else {
            console.error('Navigation error:', message);
        }
    }

    stopNavigation() {
        this.navigationActive = false;
        if (this.navigationInterval) {
            clearInterval(this.navigationInterval);
            this.navigationInterval = null;
        }
        this.speak('Navigation ended');
        
        // Remove route from map
        if (this.routingControl) {
            this.routingControl.setWaypoints([]);
        }
        
        // Remove info panels
        const panels = document.querySelectorAll('.route-info-panel, .alternatives-panel');
        panels.forEach(panel => panel.remove());
    }
}

// Initialize navigation engine
const navigationEngine = new NavigationEngine();
window.navigationEngine = navigationEngine;
