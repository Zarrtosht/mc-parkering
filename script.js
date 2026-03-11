// 1. INITIALISERA KARTAN
var map = L.map('map', {
    zoomControl: false,
    maxZoom: 20
}).setView([57.696396, 11.965227], 14);

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

// 3. IKONER & MARKERS
var mcIcon = L.icon({
    iconUrl: 'pin-icon-wpt.png',
    iconSize: [22, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

var markers = L.markerClusterGroup();
map.addLayer(markers);

// 4. POPUP & DATA (Samma som förut)
function createPopupContent(name, lat, lon, source) {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
    let sourceText = source === 'gbg' ? 'Göteborg Stad' : (source === 'sthlm' ? 'Stockholm Stad' : 'OpenStreetMap');
    const btnColor = (source === 'gbg' || source === 'sthlm') ? '#4285F4' : '#34A853';

    return `<div style="text-align: center; min-width: 160px; font-family: sans-serif;">
                <strong style="font-size: 1.1em; display: block; margin-bottom: 4px;">${name}</strong>
                <span style="color: #666; font-size: 0.85em;">${lat.toFixed(5)}, ${lon.toFixed(5)}</span><br>
                <span style="font-size: 0.8em; color: #999;">Källa: ${sourceText}</span>
                <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                <a href="${googleMapsUrl}" target="_blank" style="display: block; padding: 10px; margin-bottom: 6px; background-color: ${btnColor}; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 0.9em;">Starta navigering ↗</a>
                <a href="${streetViewUrl}" target="_blank" style="display: block; padding: 8px; background-color: #f1f3f4; color: #3c4043; text-decoration: none; border-radius: 4px; font-weight: normal; font-size: 0.85em; border: 1px solid #dadce0;">Se Street View 📷</a>
            </div>`;
}

// Ladda data
Promise.all([
    fetch('goteborg_api.json').then(res => res.json()).catch(() => []),
    fetch('overpass_data.json').then(res => res.json()).catch(() => []),
    fetch('stockholm_api.json').then(res => res.json()).catch(() => [])
]).then(([gbgData, ovpData, sthlmData]) => {
    gbgData.forEach(p => {
        if (p.Lat && p.Long) {
            L.marker([p.Lat, p.Long], { icon: mcIcon }).bindPopup(createPopupContent(p.Name || "MC Parkering", p.Lat, p.Long, 'gbg')).addTo(markers);
        }
    });
    // Stockholm & Overpass logik (förenklad här för plats, men behåll din gamla bearbetning om du vill)
    // ... din befintliga loop för Stockholm och Overpass fungerar bra här ...
});

// 5. POSITIONERING (Locate Me)
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

// 6. SATELLIT-VÄXLARE
document.getElementById('satellite-toggle-btn').addEventListener('click', function() {
    map.removeLayer(mapLayers[currentLayerIndex]);
    currentLayerIndex = (currentLayerIndex + 1) % mapLayers.length;
    mapLayers[currentLayerIndex].addTo(map);
    this.style.backgroundColor = currentLayerIndex === 0 ? "white" : "#e3f2fd";
});

// 7. INRAPPORTERING 
window.addEventListener('load', function() {
    const reportBtn = document.getElementById('report-btn');
    const crosshair = document.getElementById('map-crosshair');
    let reportMode = false;

    // Funktion för att sätta start-ikonen (Brev med pil)
    function setStartIcon() {
        reportBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
            </svg>`;
    }

    if (reportBtn) {
        // Initiera start-ikonen direkt
        setStartIcon();

        L.DomEvent.on(reportBtn, 'click', function(e) {
            L.DomEvent.stop(e); 
            
            if (!reportMode) {
                // STEG 1: Aktivera sikte
                reportMode = true;
                crosshair.style.display = 'block';
                reportBtn.style.backgroundColor = '#ffcccc'; 
                
                // NY IKON: Skicka-symbol (Pappersflygplan)
                reportBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>`;
                
                console.log("Rapportläge aktiverat");
            } else {
				// Tvinga kartan att uppdatera sin interna storleksberäkning innan vi läser av mitten
				map.invalidateSize();
				
                // STEG 2: Skicka mail
                const center = map.getCenter();
                const lat = center.lat.toFixed(7);
                const lng = center.lng.toFixed(7);
                
				// 1. Skapa de två länkarna först
				const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

				// 2. Bygg ihop texten (body)
				const mailBody = 
				`Latitud: ${lat}
				Longitud: ${lng}

				${googleMapsUrl}`;

				// 3. Kodas för att fungera i Gmail-appen (Viktigt!)
				const subject = "Inrapportering MC-parkering";
				const mailtoLink = `mailto:poja.hakimi@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`;
                
				window.location.href = mailtoLink;
                
                // Återställ
                reportMode = false;
                crosshair.style.display = 'none';
                reportBtn.style.backgroundColor = 'white';
                setStartIcon(); // Tillbaka till brev-ikonen
                
                console.log("Mail skapat för:", lat, lng);
            }
        });
    }

});
