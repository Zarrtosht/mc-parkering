// Initialize map without default zoom control
var map = L.map('map', {
    zoomControl: false,
	maxZoom: 20
}).setView([57.696396, 11.965227], 14);

// Lägg till zoomen manuellt och flytta den till din wrapper
const zoomControl = L.control.zoom({
    position: 'topleft' // Detta spelar mindre roll nu när vi flyttar den
}).addTo(map);

// Denna rad flyttar in zoom-knapparna i din snygga wrapper till vänster
document.getElementById('map-controls-wrapper').appendChild(zoomControl.getContainer());

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
    // URL för Google Maps Navigering
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    
    // URL för Google Street View (öppnar direkt i 360-vy)
    const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
    
    // Bestäm text baserat på källa
    let sourceText = 'OpenStreetMap';
    if (source === 'gbg') sourceText = 'Göteborg Stad';
    if (source === 'sthlm') sourceText = 'Stockholm Stad';

    // Blå för officiell data (Gbg/Sthlm), Grön för OSM
    const btnColor = (source === 'gbg' || source === 'sthlm') ? '#4285F4' : '#34A853';

    return `
        <div style="text-align: center; min-width: 160px; font-family: sans-serif;">
            <strong style="font-size: 1.1em; display: block; margin-bottom: 4px;">${name}</strong>
            <span style="color: #666; font-size: 0.85em;">${lat.toFixed(5)}, ${lon.toFixed(5)}</span><br>
            <span style="font-size: 0.8em; color: #999;">Källa: ${sourceText}</span>
            <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
            
            <a href="${googleMapsUrl}" target="_blank" style="
                display: block;
                padding: 10px;
                margin-bottom: 6px;
                background-color: ${btnColor};
                color: white;
                text-decoration: none;
                border-radius: 4px;
                font-weight: bold;
                font-size: 0.9em;
            ">Starta navigering ↗</a>

            <a href="${streetViewUrl}" target="_blank" style="
                display: block;
                padding: 8px;
                background-color: #f1f3f4;
                color: #3c4043;
                text-decoration: none;
                border-radius: 4px;
                font-weight: normal;
                font-size: 0.85em;
                border: 1px solid #dadce0;
            ">Se Street View 📷</a>
        </div>
    `;
}

// Load Data
Promise.all([
    fetch('goteborg_api.json').then(res => res.json()),
    fetch('overpass_data.json').then(res => res.json()),
    fetch('stockholm_api.json').then(res => res.json()) // Inkluderar Stockholm
])
.then(([gbgData, ovpData, sthlmData]) => {
    
    // 1. BEARBETA GÖTEBORG
    gbgData.forEach(p => {
        if (p.Lat !== undefined && p.Long !== undefined) {
            const name = p.Name || "MC Parkering";
            const marker = L.marker([p.Lat, p.Long], { icon: mcIcon, searchName: name })
                .bindPopup(createPopupContent(name, p.Lat, p.Long, 'gbg'));
            marker.addTo(markers);
        }
    });

    // 2. BEARBETA STOCKHOLM (GeoJSON LineStrings -> Points)
    if (sthlmData && sthlmData.features) {
        sthlmData.features.forEach(feature => {
            const props = feature.properties;
            const coords = feature.geometry.coordinates;

            // Beräkna mittpunkt (Average)
            let latSum = 0, lonSum = 0;
            coords.forEach(c => {
                lonSum += c[0];
                latSum += c[1];
            });
            const avgLat = latSum / coords.length;
            const avgLon = lonSum / coords.length;
            const currentPos = L.latLng(avgLat, avgLon);

            // Kolla dubletter mot Göteborg (och ev. tidigare Stockholm-punkter)
            let isDuplicate = false;
            markers.eachLayer(layer => {
                if (layer instanceof L.Marker && currentPos.distanceTo(layer.getLatLng()) < 15) {
                    isDuplicate = true;
                }
            });

            if (!isDuplicate) {
                const name = props.STREET_NAME ? `${props.ADDRESS || ''}` : "MC Parkering";
                               
                const marker = L.marker([avgLat, avgLon], { icon: mcIcon, searchName: name })
                    .bindPopup(createPopupContent(name , avgLat, avgLon, 'sthlm')); // 'osm' eller 'sthlm' stil
                
                marker.addTo(markers);
            }
        });
    }

    // 3. BEARBETA OVERPASS (Samma logik som innan)
    const ovpLocations = ovpData.elements || ovpData;
    ovpLocations.forEach(p => {
        if (p.lat && p.lon) {
            const currentPos = L.latLng(p.lat, p.lon);
            let isDuplicate = false;
            
            markers.eachLayer(layer => {
                if (layer instanceof L.Marker && currentPos.distanceTo(layer.getLatLng()) < 15) {
                    isDuplicate = true;
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
        map.panTo(e.latlng, { animate: true, duration: 0.1 });
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
let searchMarker;

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
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=se&addressdetails=1&limit=6`;

    try {
        const response = await fetch(url, { headers: { 'Accept-Language': 'sv' } });
        const osmData = await response.json();
        
        osmData.forEach(item => {
            resultsFound.push({
                display_name:`${item.display_name.split(',')[0]}`,
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

    const seenAddresses = new Set();

    results.forEach(result => {
        const parts = result.display_name.split(',').map(p => p.trim());
        
        // 1. Ta de första två delarna (t.ex. "Sveavägen 44" och "Stockholm")
        // Detta är det säkraste sättet att få med gatunummer oavsett ordning.
        const firstPart = parts[0] || "";
        const secondPart = parts[1] || "";
        
        // 2. Vi letar efter en "riktig" stad längre bak i listan (index 2 eller 3)
        // för att sätta i parentesen, så vi ser skillnad på olika orter.
        let city = "";
        for (let i = 2; i < parts.length; i++) {
            // Hoppa över postnummer (5 siffror)
            if (/^\d{5}$|^\d{3}\s\d{2}$/.test(parts[i])) continue;
            city = parts[i];
            break;
        }

        // 3. Bygg namnet: "Sveavägen 44, Vasastan (Stockholm)"
        // Vi kombinerar de två första delarna för att garantera gata + nr.
        const mainAddress = secondPart ? `${firstPart}, ${secondPart}` : firstPart;
        const friendlyText = city ? `${mainAddress} (${city})` : mainAddress;

        // 4. Dubblettkontroll
        if (seenAddresses.has(friendlyText.toLowerCase())) return;
        seenAddresses.add(friendlyText.toLowerCase());

        const div = document.createElement('div');
        div.className = 'search-item';
        div.innerText = friendlyText;
        
        div.onclick = function() {
            stopFollowing();
            const latlng = [result.lat, result.lon];
            
            if (searchMarker) map.removeLayer(searchMarker);

            if (!result.isMarker) {
                searchMarker = L.marker(latlng).addTo(map);
                searchMarker.bindPopup(`${result.display_name}`).openPopup();
                map.flyTo(latlng, 18);
            } else {
                map.flyTo(latlng, 16);
                result.layer.openPopup();
            }
            closeSearch();
        };
        searchResults.appendChild(div);
    });
}

// 1. Definiera de två lagren
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
	maxZoom: 20,
	maxNativeZoom: 19
});

const satelliteLayer1 = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 21, // Google har mycket djup zoom
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Map data &copy; Google'
});

const satelliteLayer2 = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 21,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Map data &copy; Google'
});

// // Se till att streetLayer är det som laddas först
// streetLayer.addTo(map);

// let isSatellite = false;

// // 2. Funktion för att växla
// document.getElementById('satellite-toggle-btn').addEventListener('click', function() {
    // if (isSatellite) {
        // map.removeLayer(satelliteLayer);
        // streetLayer.addTo(map);
        // this.style.backgroundColor = "white"; // Normal färg
    // } else {
        // map.removeLayer(streetLayer);
        // satelliteLayer.addTo(map);
        // this.style.backgroundColor = "#e3f2fd"; // Ljusblå indikation att det är aktivt
    // }
    // isSatellite = !isSatellite;
// });

// 1. Samla alla lager i en lista för att enkelt loopa igenom dem
const mapLayers = [streetLayer, satelliteLayer1, satelliteLayer2];
let currentLayerIndex = 0; // Börjar på 0 (streetLayer)

// Se till att det första lagret visas från start
mapLayers[currentLayerIndex].addTo(map);

// 2. Uppdaterad funktion för att växla mellan tre lägen
document.getElementById('satellite-toggle-btn').addEventListener('click', function() {
    // Ta bort det nuvarande lagret innan vi byter
    map.removeLayer(mapLayers[currentLayerIndex]);

    // Gå till nästa lager i listan (0 -> 1 -> 2 -> 0...)
    currentLayerIndex = (currentLayerIndex + 1) % mapLayers.length;

    // Lägg till det nya lagret
    mapLayers[currentLayerIndex].addTo(map);

    // 3. Uppdatera knappens utseende baserat på läge
    if (currentLayerIndex === 0) {
        // Standardkarta
        this.style.backgroundColor = "white";
        this.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
            </svg>`;
    } else if (currentLayerIndex === 1) {
        // Satellit 1 (Ren satellit?)
        this.style.backgroundColor = "#e3f2fd";
    } else {
        // Satellit 2 (Hybrid/Google?)
        this.style.backgroundColor = "#bbdefb"; // Något mörkare blå för att visa "läge 3"
    }
});

