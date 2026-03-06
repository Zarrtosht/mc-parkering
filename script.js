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

let targetZoom = Math.round(map.getZoom());
let zoomLock = false;

map.on('locationfound', (e) => {
    // 1. Convert speed to km/h
    let speed = (e.speed && e.speed > 0.5) ? e.speed * 3.6 : 0;
    
    // 2. Determine Tier based on speed
    // We use a "Greater Than" check only to prevent the immediate "snap back"
    let newTier = targetZoom;

    if (speed > 90) {
        newTier = 13; // Motorväg
    } else if (speed > 70) {
        newTier = 14; // Landsväg
    } else if (speed > 45) {
        newTier = 15; // Stadstrafik
    } else if (speed > 25) {
        newTier = 16; // Bostadsområde
    } else if (speed > 10) {
        newTier = 17; // Krypkörning
    } else if (speed < 5) {
        newTier = 18; // Stillastående
    }

    if (isFollowing) {
        // 3. Zoom logic with a "Lock" to prevent jitter
        if (newTier !== targetZoom && !zoomLock) {
            zoomLock = true;
            targetZoom = newTier;
            
            map.flyTo(e.latlng, targetZoom, {
                animate: true,
                duration: 2.0
            });

            // Keep the lock on for a few seconds to let the speed stabilize
            setTimeout(() => { zoomLock = false; }, 3000);
        } else if (!zoomLock) {
            // Smoothly pan to keep user centered
            map.panTo(e.latlng, { animate: true, duration: 0.6 });
        }
    }

    // Update markers...
    if (userCircle) userCircle.setLatLng(e.latlng).setRadius(e.accuracy);
    else userCircle = L.circle(e.latlng, { radius: e.accuracy, color: '#4285F4', fillOpacity: 0.1 }).addTo(map);

    if (userMarker) userMarker.setLatLng(e.latlng);
    else userMarker = L.marker(e.latlng).addTo(map).bindPopup("Du är här");
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



