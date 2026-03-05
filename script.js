var map = L.map('map').setView([57.696396, 11.965227], 14);

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

// Marker cluster
var markers = L.markerClusterGroup();
map.addLayer(markers);

// Helper function to create the fancy popup content
function createPopupContent(name, lat, lon, source) {
    // Navigation URL updated to trigger 'Directions' mode from user's current location
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
            L.marker([p.Lat, p.Long], { icon: mcIcon })
                .bindPopup(createPopupContent(p.Name || "MC Parkering", p.Lat, p.Long, 'gbg'))
                .addTo(markers);
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
                L.marker([p.lat, p.lon], { icon: mcIcon })
                    .bindPopup(createPopupContent(name, p.lat, p.lon, 'osm'))
                    .addTo(markers);
            }
        }
    });
})
.catch(err => console.error("Error merging data sources:", err));

// --- INTERACTION & LOCATION LOGIC ---

let isFollowing = false;
let userMarker = null;
let userCircle = null;

document.getElementById('locate-me').addEventListener('click', function() {
    startFollowing();
});

function startFollowing() {
    map.locate({
        watch: true, 
        setView: true, 
        maxZoom: 16,
        enableHighAccuracy: true,
        timeout: 10000,    // Wait 10s for GPS lock (helps on mobile)
        maximumAge: 2000   // Allow 2s old cached position for smoothness
    });
    
    isFollowing = true;
    const btn = document.getElementById('locate-me');
    btn.innerHTML = '<span>📡</span> Följer...';
    btn.style.backgroundColor = '#e3f2fd';
}

// Stop following if user manualy pans the map
map.on('dragstart', function() {
    if (isFollowing) {
        map.stopLocate();
        isFollowing = false;
        const btn = document.getElementById('locate-me');
        btn.innerHTML = '<span>📍</span> Hitta min position';
        btn.style.backgroundColor = 'white';
    }
});

map.on('locationfound', (e) => {
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

// "Silent" error handling for mobile
map.on('locationerror', (e) => {
    console.warn("Location error:", e.message);
    // Only alert if we aren't already in "Follow" mode to avoid spamming the user
    if (!isFollowing) {
        alert("Kunde inte hitta din position. Kontrollera behörigheter och att GPS är på.");
    }
});

map.on('click', function(e) {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    L.popup()
        .setLatLng(e.latlng)
        .setContent(`Koordinater: ${lat}, ${lng}`)
        .openOn(map);
});