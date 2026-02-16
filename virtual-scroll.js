// virtual-scroll.js - High-performance virtual scrolling for large datasets

class VirtualScroll {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        this.options = {
            itemHeight: options.itemHeight || 50,
            overscan: options.overscan || 5,
            bufferSize: options.bufferSize || 20,
            throttleTime: options.throttleTime || 16,
            ...options
        };

        this.items = [];
        this.visibleItems = [];
        this.renderHeight = 0;
        this.scrollTop = 0;
        this.totalHeight = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        
        this.isScrolling = false;
        this.scrollTimeout = null;
        
        this.init();
    }

    init() {
        // Create wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'virtual-scroll-wrapper';
        this.wrapper.style.position = 'relative';
        this.wrapper.style.height = '100%';
        this.wrapper.style.overflow = 'auto';

        // Create content container
        this.content = document.createElement('div');
        this.content.className = 'virtual-scroll-content';
        this.content.style.position = 'relative';
        this.content.style.minHeight = '100%';

        // Create spacer for total height
        this.spacer = document.createElement('div');
        this.spacer.className = 'virtual-scroll-spacer';
        this.spacer.style.width = '1px';
        this.spacer.style.visibility = 'hidden';

        this.wrapper.appendChild(this.content);
        this.wrapper.appendChild(this.spacer);
        
        // Replace container content with wrapper
        while (this.container.firstChild) {
            this.content.appendChild(this.container.firstChild);
        }
        this.container.appendChild(this.wrapper);

        // Bind events
        this.handleScroll = this.throttle(this.handleScroll.bind(this), this.options.throttleTime);
        this.wrapper.addEventListener('scroll', this.handleScroll);

        // Initial render
        this.updateTotalHeight();
        this.render();
    }

    setItems(items) {
        this.items = items;
        this.updateTotalHeight();
        this.render();
    }

    updateTotalHeight() {
        this.totalHeight = this.items.length * this.options.itemHeight;
        this.spacer.style.height = this.totalHeight + 'px';
    }

    handleScroll() {
        this.scrollTop = this.wrapper.scrollTop;
        
        // Throttle render
        if (!this.isScrolling) {
            window.requestAnimationFrame(() => {
                this.render();
                this.isScrolling = false;
            });
            this.isScrolling = true;
        }

        // Handle scroll end
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this.onScrollEnd();
        }, 150);
    }

    onScrollEnd() {
        this.container.dispatchEvent(new CustomEvent('scrollend', {
            detail: {
                scrollTop: this.scrollTop,
                visibleRange: [this.startIndex, this.endIndex]
            }
        }));
    }

    render() {
        // Calculate visible range
        this.startIndex = Math.max(
            0,
            Math.floor(this.scrollTop / this.options.itemHeight) - this.options.overscan
        );
        
        this.endIndex = Math.min(
            this.items.length - 1,
            Math.ceil((this.scrollTop + this.wrapper.clientHeight) / this.options.itemHeight) + this.options.overscan
        );

        // Calculate transform
        const translateY = this.startIndex * this.options.itemHeight;
        this.content.style.transform = `translateY(${translateY}px)`;

        // Get visible items
        this.visibleItems = this.items.slice(this.startIndex, this.endIndex + 1);

        // Render visible items
        this.renderVisibleItems();

        // Dispatch render event
        this.container.dispatchEvent(new CustomEvent('virtualscroll', {
            detail: {
                startIndex: this.startIndex,
                endIndex: this.endIndex,
                visibleItems: this.visibleItems.length
            }
        }));
    }

    renderVisibleItems() {
        // Clear content
        while (this.content.firstChild) {
            this.content.removeChild(this.content.firstChild);
        }

        // Render each visible item
        this.visibleItems.forEach((item, index) => {
            const itemIndex = this.startIndex + index;
            const element = this.createItemElement(item, itemIndex);
            element.style.position = 'absolute';
            element.style.top = (index * this.options.itemHeight) + 'px';
            element.style.width = '100%';
            element.style.height = this.options.itemHeight + 'px';
            this.content.appendChild(element);
        });
    }

    createItemElement(item, index) {
        if (this.options.renderItem) {
            return this.options.renderItem(item, index);
        }

        // Default renderer
        const div = document.createElement('div');
        div.className = 'virtual-scroll-item';
        div.innerHTML = `
            <div class="item-content">
                <span class="item-index">${index}</span>
                <span class="item-data">${JSON.stringify(item)}</span>
            </div>
        `;
        return div;
    }

    scrollToIndex(index) {
        const scrollTop = index * this.options.itemHeight;
        this.wrapper.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
        });
    }

    scrollToTop() {
        this.wrapper.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    scrollToBottom() {
        this.wrapper.scrollTo({
            top: this.totalHeight,
            behavior: 'smooth'
        });
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    destroy() {
        this.wrapper.removeEventListener('scroll', this.handleScroll);
        clearTimeout(this.scrollTimeout);
        
        // Restore original content
        while (this.content.firstChild) {
            this.container.appendChild(this.content.firstChild);
        }
        this.container.removeChild(this.wrapper);
    }

    getVisibleRange() {
        return {
            start: this.startIndex,
            end: this.endIndex,
            count: this.visibleItems.length
        };
    }

    getScrollPosition() {
        return {
            scrollTop: this.scrollTop,
            scrollHeight: this.totalHeight,
            clientHeight: this.wrapper.clientHeight
        };
    }
}

// Data compression utility
class DataCompressor {
    constructor() {
        this.worker = null;
        this.initWorker();
    }

    initWorker() {
        if (window.Worker) {
            // Create web worker for compression
            const workerCode = `
                self.onmessage = function(e) {
                    const { data, type } = e.data;
                    
                    if (type === 'compress') {
                        // Simple compression: remove decimals and use deltas
                        const compressed = compressLocations(data);
                        self.postMessage({ type: 'compressed', data: compressed });
                    } else if (type === 'decompress') {
                        const decompressed = decompressLocations(data);
                        self.postMessage({ type: 'decompressed', data: decompressed });
                    }
                };

                function compressLocations(locations) {
                    if (locations.length === 0) return [];
                    
                    const compressed = [];
                    const first = locations[0];
                    
                    compressed.push({
                        lat: Math.round(first.lat * 1e6),
                        lng: Math.round(first.lng * 1e6),
                        t: first.timestamp
                    });

                    for (let i = 1; i < locations.length; i++) {
                        const prev = locations[i-1];
                        const curr = locations[i];
                        
                        compressed.push({
                            lat: Math.round((curr.lat - prev.lat) * 1e6),
                            lng: Math.round((curr.lng - prev.lng) * 1e6),
                            t: curr.timestamp - prev.timestamp
                        });
                    }

                    return compressed;
                }

                function decompressLocations(compressed) {
                    if (compressed.length === 0) return [];
                    
                    const locations = [];
                    let current = {
                        lat: compressed[0].lat / 1e6,
                        lng: compressed[0].lng / 1e6,
                        timestamp: compressed[0].t
                    };
                    
                    locations.push(current);

                    for (let i = 1; i < compressed.length; i++) {
                        const delta = compressed[i];
                        current = {
                            lat: current.lat + delta.lat / 1e6,
                            lng: current.lng + delta.lng / 1e6,
                            timestamp: current.timestamp + delta.t
                        };
                        locations.push(current);
                    }

                    return locations;
                }
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));
        }
    }

    async compress(data) {
        if (this.worker) {
            return new Promise((resolve) => {
                this.worker.onmessage = (e) => {
                    if (e.data.type === 'compressed') {
                        resolve(e.data.data);
                    }
                };
                this.worker.postMessage({ type: 'compress', data });
            });
        }

        // Fallback compression
        return this.compressSync(data);
    }

    async decompress(data) {
        if (this.worker) {
            return new Promise((resolve) => {
                this.worker.onmessage = (e) => {
                    if (e.data.type === 'decompressed') {
                        resolve(e.data.data);
                    }
                };
                this.worker.postMessage({ type: 'decompress', data });
            });
        }

        // Fallback decompression
        return this.decompressSync(data);
    }

    compressSync(locations) {
        // Simple delta compression
        if (locations.length === 0) return [];

        const compressed = [];
        compressed.push({
            lat: Math.round(locations[0].lat * 1e6),
            lng: Math.round(locations[0].lng * 1e6),
            t: locations[0].timestamp
        });

        for (let i = 1; i < locations.length; i++) {
            compressed.push({
                lat: Math.round((locations[i].lat - locations[i-1].lat) * 1e6),
                lng: Math.round((locations[i].lng - locations[i-1].lng) * 1e6),
                t: locations[i].timestamp - locations[i-1].timestamp
            });
        }

        return compressed;
    }

    decompressSync(compressed) {
        if (compressed.length === 0) return [];

        const locations = [];
        let current = {
            lat: compressed[0].lat / 1e6,
            lng: compressed[0].lng / 1e6,
            timestamp: compressed[0].t
        };
        
        locations.push(current);

        for (let i = 1; i < compressed.length; i++) {
            current = {
                lat: current.lat + compressed[i].lat / 1e6,
                lng: current.lng + compressed[i].lng / 1e6,
                timestamp: current.timestamp + compressed[i].t
            };
            locations.push(current);
        }

        return locations;
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
        }
    }
}

// Map tile optimizer
class TileOptimizer {
    constructor(map) {
        this.map = map;
        this.tileCache = new Map();
        this.pendingTiles = new Set();
        this.maxConcurrent = 4;
        this.currentLoad = 0;
        
        this.init();
    }

    init() {
        // Intercept tile loading
        this.map.on('loadtile', (e) => this.onTileLoad(e));
        this.map.on('tileload', (e) => this.onTileLoaded(e));
        this.map.on('tileerror', (e) => this.onTileError(e));
    }

    onTileLoad(e) {
        const tileUrl = e.tile.src;
        
        // Check cache
        if (this.tileCache.has(tileUrl)) {
            e.tile.src = this.tileCache.get(tileUrl);
            return;
        }

        // Queue tile loading
        if (this.currentLoad >= this.maxConcurrent) {
            this.pendingTiles.add(e.tile);
            e.preventDefault(); // Prevent default loading
        } else {
            this.currentLoad++;
        }
    }

    onTileLoaded(e) {
        this.currentLoad--;
        
        // Cache tile
        const tileUrl = e.tile.src;
        this.tileCache.set(tileUrl, tileUrl);

        // Load next pending tile
        if (this.pendingTiles.size > 0) {
            const nextTile = this.pendingTiles.values().next().value;
            this.pendingTiles.delete(nextTile);
            nextTile.load();
            this.currentLoad++;
        }
    }

    onTileError(e) {
        this.currentLoad--;
        
        // Retry failed tiles
        setTimeout(() => {
            e.tile.load();
        }, 1000);
    }

    clearCache() {
        this.tileCache.clear();
    }

    setMaxConcurrent(max) {
        this.maxConcurrent = max;
    }
}

// Initialize performance optimizations
const dataCompressor = new DataCompressor();
window.dataCompressor = dataCompressor;
