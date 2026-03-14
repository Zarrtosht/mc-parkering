// 1. INITIALISERA KARTAN
var map = L.map('map', {
    zoomControl: false,
    maxZoom: 20
}).setView([60, 14.5], 5);

const zoomControl = L.control.zoom({ position: 'topleft' }).addTo(map);
document.getElementById('map-controls-wrapper').appendChild(zoomControl.getContainer());

// 2. LAGER
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 20,
    maxNativeZoom: 19
}).addTo(map);

const satelliteLayer1 = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 21,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Map data © Google'
});

const satelliteLayer2 = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 21,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Map data © Google'
});

const mapLayers = [streetLayer, satelliteLayer1, satelliteLayer2];
let currentLayerIndex = 0;

document.getElementById('satellite-toggle-btn').addEventListener('click', function() {
    map.removeLayer(mapLayers[currentLayerIndex]);
    currentLayerIndex = (currentLayerIndex + 1) % mapLayers.length;
    mapLayers[currentLayerIndex].addTo(map);
    this.style.backgroundColor = currentLayerIndex === 0 ? "white" : "#e3f2fd";
});

// 3. LADDA DATA OCH MARKERS
var mcIcon = L.icon({
    iconUrl: 'pin-icon-wpt.png',
    iconSize: [22, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

var markers = L.markerClusterGroup({
    disableClusteringAtZoom: 14, // Vid denna zoomnivå (och högre) visas alla ikoner individuellt
    maxClusterRadius: 50,        // (Valfritt) Hur tätt ikonerna måste ligga för att klustras
    spiderfyOnMaxZoom: false      // Om flera punkter ligger på EXAKT samma koordinat sprids de ut som "ben"
});
map.addLayer(markers);

// POPUP & DATA (Samma som förut)
function createPopupContent(name, lat, lon, source) {
    // const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    // const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
    // let sourceText = source === 'gbg' ? 'Göteborg Stad' : (source === 'sthlm' ? 'Stockholm Stad' : 'OpenStreetMap');
    // const btnColor = (source === 'gbg' || source === 'sthlm') ? '#4285F4' : '#34A853';
	
	const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
    let sourceText = source === 'gbg' ? 'Göteborg Stad' : (source === 'sthlm' ? 'Stockholm Stad' : source === 'inrapp' ? 'Inrapporterad' : 'OpenStreetMap');
    const btnColor = (source === 'gbg' || source === 'sthlm') ? '#4285F4' : (source === 'inrapp') ? '#f4cd42' : '#34A853';
    const textColor = (source === 'gbg' || source === 'sthlm' || source === 'osm') ? 'white' : 'black';

    return `<div style="text-align: center; min-width: 160px; font-family: sans-serif;">
                <strong style="font-size: 1.1em; display: block; margin-bottom: 4px;">${name}</strong>
                <span style="color: #666; font-size: 0.85em;">${lat.toFixed(5)}, ${lon.toFixed(5)}</span><br>
                <span style="font-size: 0.8em; color: #999;">Källa: ${sourceText}</span>
                <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                <a href="${googleMapsUrl}" target="_blank" style="display: block; padding: 10px; margin-bottom: 6px; background-color: ${btnColor}; color: ${textColor}; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 0.9em;">Starta navigering ↗</a>
                <a href="${streetViewUrl}" target="_blank" style="display: block; padding: 8px; background-color: #f1f3f4; color: #3c4043; text-decoration: none; border-radius: 4px; font-weight: normal; font-size: 0.85em; border: 1px solid #dadce0;">Se Street View 📷</a>
            </div>`;
}

Promise.all([
    fetch('goteborg_api.json?v=1').then(res => res.json()),
    fetch('overpass_data.json?v=1').then(res => res.json()),
    fetch('stockholm_api.json?v=1').then(res => res.json()),
    fetch('inrapporterad.json?v=1').then(res => res.json()),
])
.then(([gbgData, ovpData, sthlmData, inrappData]) => {
    
    // BEARBETA GÖTEBORG
    gbgData.forEach(p => {
        if (p.Lat !== undefined && p.Long !== undefined) {
            const name = p.Name || "MC Parkering";
            const marker = L.marker([p.Lat, p.Long], { icon: mcIcon, searchName: name })
                .bindPopup(createPopupContent(name, p.Lat, p.Long, 'gbg'));
            marker.addTo(markers);
        }
    });

    // BEARBETA STOCKHOLM (GeoJSON LineStrings -> Points)
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

    // BEARBETA OVERPASS (Samma logik som innan)
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
	
    // BEARBETA INRAPPORTERAD (Samma logik som innan)
    const inrappLocations = inrappData.elements || inrappData;
    inrappLocations.forEach(p => {
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
                    .bindPopup(createPopupContent(name, p.lat, p.lon, 'inrapp'));
                
                marker.addTo(markers);
            }
        }
    });	
})
.catch(err => console.error("Error merging data sources:", err));

// 4. POSITIONERING (Locate Me)
let isFollowing = false;
let userMarker, userCircle, wakeLock;

async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
}

function startFollowing() {
    map.locate({ watch: true, enableHighAccuracy: true });
    isFollowing = true;
    requestWakeLock();
    document.getElementById('locate-me').innerHTML = '<span>📡</span> Följer...';
}

function stopFollowing() {
    if (isFollowing) {
        map.stopLocate();
        isFollowing = false;
        if (wakeLock) wakeLock.release();
        document.getElementById('locate-me').innerHTML = '<span>📍</span> Hitta min position';
    }
}

map.on('locationfound', (e) => {
    if (isFollowing) map.panTo(e.latlng);
    if (!userMarker) {
        userCircle = L.circle(e.latlng, { radius: e.accuracy, color: '#4285F4', fillOpacity: 0.1 }).addTo(map);
        userMarker = L.marker(e.latlng).addTo(map).bindPopup("Du är här");
    } else {
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy);
        userMarker.setLatLng(e.latlng);
    }
});

document.getElementById('locate-me').addEventListener('click', startFollowing);
map.on('dragstart', stopFollowing);

// 6. SEARCH UI LOGIC
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

// 7. INRAPPORTERING 
window.addEventListener('load', function() {
    const reportWrapper = document.getElementById('report-wrapper');
    const reportToggleBtn = document.getElementById('report-toggle-btn');
    const sendReportBtn = document.getElementById('send-report-btn');
    const crosshair = document.getElementById('map-crosshair');

    if (reportToggleBtn && sendReportBtn) {
        
        // 1. Öppna/Stäng inrapporteringsläge
        L.DomEvent.on(reportToggleBtn, 'click', function(e) {
            L.DomEvent.stop(e);
            map.invalidateSize();
			const isActive = reportWrapper.classList.toggle('active');
            
            if (isActive) {
                crosshair.style.display = 'block';
                console.log("Sikte aktiverat");
            } else {
                closeReportUI();
            }
        });

        // 2. Skicka-funktionen (Flygplanet)
        L.DomEvent.on(sendReportBtn, 'click', function(e) {
            L.DomEvent.stop(e);
            
            // Exakt precisionsmätning för mobiler
			map.invalidateSize();
			setTimeout(() => {
				const center = map.getCenter(); // Nu när storleken är korrekt, hämta mitten
				const lat = center.lat.toFixed(7);
				const lng = center.lng.toFixed(7);
				
				const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
				const mailBody = `${lat}, ${lng}\n\n${googleMapsUrl}`;
				const mailtoLink = `mailto:poja.hakimi@gmail.com?subject=Inrapportering&body=${encodeURIComponent(mailBody)}`;
				
				window.location.href = mailtoLink;
				closeReportUI();
			}, 10);
        });

        // Stäng om man klickar på kartan
        map.on('click', closeReportUI);
    }

    function closeReportUI() {
        if (reportWrapper) reportWrapper.classList.remove('active');
        if (crosshair) crosshair.style.display = 'none';
    }
});
