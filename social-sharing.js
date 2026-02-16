// social-sharing.js - Professional sharing with multiple platforms

class SocialSharing {
    constructor() {
        this.supportedPlatforms = {
            facebook: true,
            twitter: true,
            whatsapp: true,
            telegram: true,
            email: true,
            sms: true
        };
        
        this.shareHistory = [];
        this.initShareButtons();
        console.log('📤 SocialSharing initialized');
    }

    initShareButtons() {
        // Create share panel
        const sharePanel = document.createElement('div');
        sharePanel.className = 'share-panel';
        sharePanel.id = 'sharePanel';
        sharePanel.innerHTML = `
            <div class="share-header">
                <h4>📤 Share Location</h4>
                <button class="close-btn" onclick="document.getElementById('sharePanel').classList.remove('active')">✕</button>
            </div>
            <div class="share-body">
                <div class="share-type-selector">
                    <button class="share-type-btn active" data-type="location">📍 Location</button>
                    <button class="share-type-btn" data-type="trip">🗺️ Trip</button>
                    <button class="share-type-btn" data-type="live">🟢 Live Tracking</button>
                </div>
                
                <div class="share-content location-content active">
                    <div class="current-location-preview" id="shareLocationPreview"></div>
                    <label>
                        <input type="checkbox" id="includeMap" checked> Include map preview
                    </label>
                    <label>
                        <input type="checkbox" id="includeAccuracy"> Include accuracy
                    </label>
                </div>
                
                <div class="share-content trip-content">
                    <select id="tripSelect" class="trip-select">
                        <option value="">Select a trip to share...</option>
                    </select>
                    <label>
                        <input type="checkbox" id="includeRoute"> Include route map
                    </label>
                    <label>
                        <input type="checkbox" id="includeStats"> Include trip statistics
                    </label>
                </div>
                
                <div class="share-content live-content">
                    <label>
                        <input type="checkbox" id="liveTracking"> Share live location
                    </label>
                    <div class="live-duration">
                        <label>Duration:</label>
                        <select id="liveDuration">
                            <option value="15">15 minutes</option>
                            <option value="30">30 minutes</option>
                            <option value="60">1 hour</option>
                            <option value="360">6 hours</option>
                            <option value="1440">24 hours</option>
                        </select>
                    </div>
                </div>
                
                <div class="share-platforms">
                    <button class="platform-btn facebook" onclick="socialSharing.shareTo('facebook')">
                        <span class="icon">📘</span> Facebook
                    </button>
                    <button class="platform-btn twitter" onclick="socialSharing.shareTo('twitter')">
                        <span class="icon">🐦</span> Twitter
                    </button>
                    <button class="platform-btn whatsapp" onclick="socialSharing.shareTo('whatsapp')">
                        <span class="icon">📱</span> WhatsApp
                    </button>
                    <button class="platform-btn telegram" onclick="socialSharing.shareTo('telegram')">
                        <span class="icon">✈️</span> Telegram
                    </button>
                    <button class="platform-btn email" onclick="socialSharing.shareTo('email')">
                        <span class="icon">📧</span> Email
                    </button>
                    <button class="platform-btn sms" onclick="socialSharing.shareTo('sms')">
                        <span class="icon">💬</span> SMS
                    </button>
                    <button class="platform-btn copy" onclick="socialSharing.copyToClipboard()">
                        <span class="icon">📋</span> Copy Link
                    </button>
                    <button class="platform-btn qr" onclick="socialSharing.generateQR()">
                        <span class="icon">📷</span> QR Code
                    </button>
                </div>
                
                <div class="share-preview" id="sharePreview"></div>
                <div id="qrContainer" class="qr-container"></div>
            </div>
        `;

        document.body.appendChild(sharePanel);

        // Add event listeners
        document.querySelectorAll('.share-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchShareType(e));
        });

        // Load trips for sharing
        this.loadTripsForSharing();
    }

    switchShareType(e) {
        document.querySelectorAll('.share-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');

        const type = e.target.dataset.type;
        document.querySelectorAll('.share-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelector(`.share-content.${type}-content`).classList.add('active');

        if (type === 'location') {
            this.updateLocationPreview();
        } else if (type === 'trip') {
            this.loadTripsForSharing();
        }
    }

    updateLocationPreview() {
        const preview = document.getElementById('shareLocationPreview');
        if (!preview) return;

        if (window.locationEngine && window.locationEngine.getLastKnownLocation()) {
            const loc = window.locationEngine.getLastKnownLocation();
            preview.innerHTML = `
                <div class="location-card">
                    <div class="coordinates">
                        <div>Lat: ${loc.lat.toFixed(6)}</div>
                        <div>Lng: ${loc.lng.toFixed(6)}</div>
                    </div>
                    <div class="accuracy">Accuracy: ±${loc.accuracy?.toFixed(1)}m</div>
                    <div class="time">${new Date(loc.timestamp).toLocaleString()}</div>
                </div>
            `;
        } else {
            preview.innerHTML = '<div class="no-location">No location available</div>';
        }
    }

    async loadTripsForSharing() {
        const select = document.getElementById('tripSelect');
        if (!select) return;

        if (window.locationHistory && window.locationHistory.trips) {
            select.innerHTML = '<option value="">Select a trip to share...</option>';
            window.locationHistory.trips.forEach(trip => {
                const option = document.createElement('option');
                option.value = trip.id;
                option.textContent = `${trip.name} - ${(trip.distance / 1000).toFixed(2)}km`;
                select.appendChild(option);
            });
        }
    }

    async shareTo(platform) {
        const type = document.querySelector('.share-type-btn.active').dataset.type;
        let shareData = {};

        switch (type) {
            case 'location':
                shareData = await this.prepareLocationShare();
                break;
            case 'trip':
                shareData = await this.prepareTripShare();
                break;
            case 'live':
                shareData = await this.prepareLiveShare();
                break;
        }

        if (!shareData) {
            this.showToast('No data to share', 'error');
            return;
        }

        // Add to share history
        this.shareHistory.push({
            platform,
            type,
            timestamp: Date.now(),
            data: shareData
        });

        // Share to selected platform
        switch (platform) {
            case 'facebook':
                this.shareToFacebook(shareData);
                break;
            case 'twitter':
                this.shareToTwitter(shareData);
                break;
            case 'whatsapp':
                this.shareToWhatsApp(shareData);
                break;
            case 'telegram':
                this.shareToTelegram(shareData);
                break;
            case 'email':
                this.shareToEmail(shareData);
                break;
            case 'sms':
                this.shareToSMS(shareData);
                break;
        }

        // Track analytics
        if (window.analytics) {
            window.analytics.trackEvent('share', {
                platform,
                type
            });
        }
    }

    async prepareLocationShare() {
        if (!window.locationEngine) return null;

        const location = window.locationEngine.getLastKnownLocation();
        if (!location) return null;

        const includeMap = document.getElementById('includeMap')?.checked;
        const includeAccuracy = document.getElementById('includeAccuracy')?.checked;

        let mapUrl = '';
        if (includeMap) {
            mapUrl = await this.generateMapImage(location.lat, location.lng);
        }

        return {
            title: '📍 My Current Location',
            text: `I'm at: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` +
                   (includeAccuracy ? ` (accuracy: ±${location.accuracy?.toFixed(1)}m)` : ''),
            url: this.generateMapsUrl(location.lat, location.lng),
            mapUrl,
            location
        };
    }

    async prepareTripShare() {
        const tripId = document.getElementById('tripSelect')?.value;
        if (!tripId || !window.locationHistory) return null;

        const trip = window.locationHistory.trips.find(t => t.id == tripId);
        if (!trip) return null;

        const includeRoute = document.getElementById('includeRoute')?.checked;
        const includeStats = document.getElementById('includeStats')?.checked;

        let mapUrl = '';
        if (includeRoute) {
            mapUrl = await this.generateRouteImage(trip);
        }

        const stats = includeStats ? 
            `\n\n📊 Trip Stats:\n` +
            `• Distance: ${(trip.distance / 1000).toFixed(2)}km\n` +
            `• Duration: ${this.formatDuration(trip.duration)}\n` +
            `• Max Speed: ${(trip.maxSpeed * 3.6).toFixed(1)}km/h` : '';

        return {
            title: `🗺️ My Trip: ${trip.name}`,
            text: `Check out my trip!${stats}`,
            url: this.generateTripUrl(trip),
            mapUrl,
            trip
        };
    }

    async prepareLiveShare() {
        const liveTracking = document.getElementById('liveTracking')?.checked;
        const duration = document.getElementById('liveDuration')?.value;

        if (!liveTracking || !window.locationEngine) return null;

        // Generate live tracking link
        const liveId = this.generateLiveId();
        const expiresAt = Date.now() + (parseInt(duration) * 60 * 1000);

        // Store live session
        await this.storeLiveSession(liveId, expiresAt);

        return {
            title: '🟢 Live Location Tracking',
            text: `Follow my live location for the next ${duration} minutes!`,
            url: `${window.location.origin}/live/${liveId}`,
            expiresAt
        };
    }

    shareToFacebook(data) {
        const url = encodeURIComponent(data.url);
        const quote = encodeURIComponent(data.text);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank');
    }

    shareToTwitter(data) {
        const text = encodeURIComponent(data.text);
        const url = encodeURIComponent(data.url);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    }

    shareToWhatsApp(data) {
        const text = encodeURIComponent(data.text + '\n' + data.url);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    }

    shareToTelegram(data) {
        const text = encodeURIComponent(data.text + '\n' + data.url);
        window.open(`https://t.me/share/url?url=${data.url}&text=${text}`, '_blank');
    }

    shareToEmail(data) {
        const subject = encodeURIComponent(data.title);
        const body = encodeURIComponent(data.text + '\n\n' + data.url);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }

    shareToSMS(data) {
        const body = encodeURIComponent(data.text + ' ' + data.url);
        window.location.href = `sms:?body=${body}`;
    }

    async copyToClipboard() {
        const data = await this.prepareLocationShare();
        if (!data) return;

        const text = `${data.text}\n${data.url}`;
        
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('📋 Copied to clipboard!');
            
            if (window.analytics) {
                window.analytics.trackEvent('share', {
                    platform: 'copy',
                    type: document.querySelector('.share-type-btn.active').dataset.type
                });
            }
        } catch (error) {
            console.error('Copy failed:', error);
            this.showToast('❌ Failed to copy', 'error');
        }
    }

    async generateQR() {
        const data = await this.prepareLocationShare();
        if (!data) return;

        const qrContainer = document.getElementById('qrContainer');
        qrContainer.innerHTML = '<div class="qr-loading">Generating QR Code...</div>';

        // Use QR code API
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.url)}`;
        
        qrContainer.innerHTML = `
            <div class="qr-result">
                <img src="${qrUrl}" alt="QR Code" class="qr-image">
                <p>Scan to view location</p>
                <button onclick="socialSharing.downloadQR('${qrUrl}')">📥 Download QR</button>
            </div>
        `;
    }

    downloadQR(url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'location-qr.png';
        a.click();
    }

    generateMapsUrl(lat, lng) {
        return `https://www.google.com/maps?q=${lat},${lng}`;
    }

    generateTripUrl(trip) {
        return `${window.location.origin}/trip/${trip.id}`;
    }

    generateLiveId() {
        return 'live_' + Math.random().toString(36).substr(2, 9);
    }

    async generateMapImage(lat, lng) {
        // Use static map API
        return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x300&markers=${lat},${lng}&key=YOUR_API_KEY`;
    }

    async generateRouteImage(trip) {
        // Generate route image from trip coordinates
        return `https://maps.googleapis.com/maps/api/staticmap?size=600x300&path=weight:3%7Ccolor:blue%7Cenc:${trip.route}&key=YOUR_API_KEY`;
    }

    async storeLiveSession(liveId, expiresAt) {
        // Store in Firestore
        if (window.firebaseServices) {
            try {
                await window.firebaseServices.db.collection('liveSessions').doc(liveId).set({
                    userId: window.authManager?.currentUser?.uid,
                    expiresAt: new Date(expiresAt),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error('Failed to store live session:', error);
            }
        }
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}min`;
    }

    showPanel() {
        document.getElementById('sharePanel').classList.add('active');
        this.updateLocationPreview();
    }

    showToast(message, type = 'success') {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, type);
        }
    }
}

// Initialize social sharing
const socialSharing = new SocialSharing();
window.socialSharing = socialSharing;
