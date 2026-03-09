// Initialize map without default zoom control
var map = L.map('map', {
    zoomControl: false 
}).setView([57.696396, 11.965227], 14);

// Use a standard position; we will override this with CSS
L.control.zoom({ position: 'topright' }).addTo(map);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
}).addTo(map);

// MC ikon
var mcIcon = L.icon({
    iconUrl: 'pin-icon-wpt.png',
    iconSize: [22, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

var markers = L.markerClusterGroup();
map.addLayer(markers);

function createPopupContent(name, lat, lon, source) {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    const sourceText = source === 'gbg' ? 'Göteborg Stad' : 'OpenStreetMap';
    const btnColor = source === 'gbg' ? '#4285F4' : '#34A853';

    return `
        <div style="text-align: center; min-width: 150px;">
            <strong style="font-size: 1.1em; display: block; margin-bottom: 4px;">${name}</strong>
            <span style="color: #666; font-size: 0.85em;">${lat.toFixed(5)}, ${lon.toFixed(5)}</span><br>
            <span style="font-size: 0.8em; color: #999;">Källa: ${sourceText}</span>
            <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
            <a href="${googleMapsUrl}" target="_blank" style="
                display: inline-block;
                padding: 10px 16px;
                background-color: ${btnColor};
                color: white;
                text-decoration: none;
                border-radius: 4px;
                font-weight: bold;
                font-size: 0.9em;
            ">Starta navigering ↗</a>
        </div>
    `;
}

// Load Data
Promise.all([
    fetch('goteborg_api.json').then(res => res.json()),
    fetch('overpass_data.json').then(res => res.json())
])
.then(([gbgData, ovpData]) => {
	gbgData.forEach(p => {
        if (p.Lat !== undefined && p.Long !== undefined) {
            const name = p.Name || "MC Parkering";
            // 1. Create the marker and add a 'searchName' property to it
            const marker = L.marker([p.Lat, p.Long], { icon: mcIcon, searchName: name })
                .bindPopup(createPopupContent(name, p.Lat, p.Long, 'gbg'));
            
            marker.addTo(markers);
        }
    });

    const ovpLocations = ovpData.elements || ovpData;
    ovpLocations.forEach(p => {
        if (p.lat && p.lon) {
            const currentPos = L.latLng(p.lat, p.lon);
            let isDuplicate = false;
            markers.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    const distance = currentPos.distanceTo(layer.getLatLng());
                    if (distance < 15) { 
                        isDuplicate = true;
                    }
                }
            });

			if (!isDuplicate) {
				const name = p.tags?.name || p.tags?.amenity || "MC Parkering";
				const marker = L.marker([p.lat, p.lon], { icon: mcIcon, searchName: name })
					.bindPopup(createPopupContent(name, p.lat, p.lon, 'osm'));
				
				marker.addTo(markers);
			}
        }
    });
})
.catch(err => console.error("Error merging data sources:", err));

// Locate me
let isFollowing = false;
let userMarker = null;
let userCircle = null;
let wakeLock = null;

// Function to keep the screen on
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock is active - Screen will stay on');
            
            // Re-request if the tab is hidden and then shown again
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock was released');
            });
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

// Function to let the screen sleep again
function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release();
        wakeLock = null;
    }
}

function startFollowing() {
    map.locate({
        watch: true, 
        setView: false, // Keep this false as we discussed!
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000
    });
    
    isFollowing = true;
    requestWakeLock(); // <--- ADD THIS
    
    const btn = document.getElementById('locate-me');
    btn.innerHTML = '<span>📡</span> Följer...';
    btn.style.backgroundColor = '#e3f2fd';
}

function stopFollowing() {
    if (isFollowing) {
        map.stopLocate();
        isFollowing = false;
        releaseWakeLock(); // <--- ADD THIS
        
        const btn = document.getElementById('locate-me');
        btn.innerHTML = '<span>📍</span> Hitta min position';
        btn.style.backgroundColor = 'white';
    }
}

map.on('locationfound', (e) => {
    if (isFollowing) {
        // Use panTo instead of setView/flyTo. 
        // This keeps you centered but doesn't force a zoom level.
        map.panTo(e.latlng, { animate: true, duration: 0.8 });
    }

    // --- Marker Updates ---
    if (userCircle) {
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy);
    } else {
        userCircle = L.circle(e.latlng, { radius: e.accuracy, color: '#4285F4', fillOpacity: 0.1 }).addTo(map);
    }

    if (userMarker) {
        userMarker.setLatLng(e.latlng);
    } else {
        userMarker = L.marker(e.latlng).addTo(map).bindPopup("Du är här");
    }
});

map.on('dragstart', stopFollowing);
document.getElementById('locate-me').addEventListener('click', startFollowing);

// Search Bar Functionality
// --- SEARCH UI LOGIC ---
const searchWrapper = document.getElementById('search-wrapper');
const searchToggleBtn = document.getElementById('search-toggle-btn');
const searchInput = document.getElementById('map-search');
const searchResults = document.getElementById('search-results');
let searchTimeout;

// Toggle search bar expansion
searchToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = searchWrapper.classList.toggle('active');
    if (isActive) {
        searchInput.focus();
    } else {
        closeSearch();
    }
});

// Close search when clicking anywhere on the map
map.on('click', closeSearch);

function closeSearch() {
    searchWrapper.classList.remove('active');
    searchResults.style.display = 'none';
    searchInput.value = '';
    searchInput.blur();
}

searchInput.addEventListener('input', function(e) {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);

    if (query.length < 3) {
        searchResults.style.display = 'none';
        return;
    }

    searchTimeout = setTimeout(() => {
        performUniversalSearch(query);
    }, 300);
});

async function performUniversalSearch(query) {
    let resultsFound = [];

    // 1. Search Local Markers
    markers.eachLayer(function(layer) {
        const popupContent = layer.getPopup().getContent();
        const nameMatch = popupContent.match(/<strong>(.*?)<\/strong>/);
        const name = nameMatch ? nameMatch[1] : "MC Parkering";

        if (name.toLowerCase().includes(query.toLowerCase())) {
            resultsFound.push({ 
                display_name: `🅿️ ${name}`, 
                lat: layer.getLatLng().lat, 
                lon: layer.getLatLng().lng,
                isMarker: true,
                layer: layer 
            });
        }
    });

    // 2. Global Nominatim Search
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=11.75,57.85,12.15,57.55&bounded=0&limit=6`;

    try {
        const response = await fetch(url, { headers: { 'Accept-Language': 'sv' } });
        const osmData = await response.json();
        
        osmData.forEach(item => {
            resultsFound.push({
                display_name: `📍 ${item.display_name.split(',')[0]}`,
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
                isMarker: false
            });
        });
    } catch (err) {
        console.error("Geocoding error:", err);
    }

    renderResults(resultsFound);
}

function renderResults(results) {
    if (results.length === 0) {
        searchResults.style.display = 'none';
        return;
    }

    searchResults.innerHTML = '';
    searchResults.style.display = 'block';

    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'search-item';
        div.innerText = result.display_name;
        
        div.onclick = function() {
            stopFollowing();
            
            const latlng = [result.lat, result.lon];
            map.flyTo(latlng, 14);
            
            if (result.isMarker) {
                result.layer.openPopup();
            }

            closeSearch();
        };
        searchResults.appendChild(div);
    });

}


