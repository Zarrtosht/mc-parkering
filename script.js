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

// FIXED: This function now correctly handles the variables passed to it
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
            L.marker([p.Lat, p.Long], { icon: mcIcon })
                // Pass individual coordinates to the function
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

// --- LOCATION LOGIC ---
let isFollowing = false;
let userMarker = null;
let userCircle = null;

function startFollowing() {
    map.locate({
        watch: true, 
        setView: true, 
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000
    });
    
    isFollowing = true;
    const btn = document.getElementById('locate-me');
    btn.innerHTML = '<span>📡</span> Följer...';
    btn.style.backgroundColor = '#e3f2fd';
}

map.on('locationfound', (e) => {
    if (isFollowing) {
        let speedKmH = (e.speed || 0) * 3.6;
        let targetZoom = 18;

        if (speedKmH > 90) targetZoom = 13;
        else if (speedKmH > 70) targetZoom = 14;
        else if (speedKmH > 40) targetZoom = 15;
        else if (speedKmH > 15) targetZoom = 16;
        else targetZoom = 18;

        map.setView(e.latlng, targetZoom, { animate: true });
    }

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

map.on('dragstart', function() {
    if (isFollowing) {
        map.stopLocate();
        isFollowing = false;
        const btn = document.getElementById('locate-me');
        btn.innerHTML = '<span>📍</span> Hitta min position';
        btn.style.backgroundColor = 'white';
    }
});


document.getElementById('locate-me').addEventListener('click', startFollowing);

