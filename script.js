var map = L.map('map').setView([57.696396, 11.965227], 14); // Sverige

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
 attribution: '&copy; OpenStreetMap',
 maxZoom: 19
}).addTo(map);


// MC ikon
var mcIcon = L.icon({
 iconUrl: 'pin-icon-wpt.png',
 iconSize: [22,32],
 iconAnchor: [16,32],
 popupAnchor: [0,-32]
});

// Marker cluster
var markers = L.markerClusterGroup();
map.addLayer(markers);

// // Ladda JSON Goteborg
// fetch('goteborg_api.json')
  // .then(res => res.json())
  // .then(data => {
    // data.forEach(p => {
      // L.marker([p.Lat, p.Long], { icon: mcIcon })
       // .bindPopup(p.name)
       // .addTo(markers);
    // });
  // })
  // .catch(err => console.error("Failed to load JSON:", err));

// // Ladda JSON Overpass Turbo 
// fetch('overpass_data.json')
  // .then(res => res.json())
  // .then(data => {
    // // 1. Access the 'elements' array (common in Overpass JSON)
    // // If your file is a direct array [{},{}], keep it as 'data'
    // const locations = data.elements || data; 

    // locations.forEach(p => {
      // // 2. Access lat/lon directly from the object
      // // 3. Use p.tags to find a name, or fallback to the amenity type
      // const popupContent = p.tags.name || p.tags.amenity || "Motorcycle Parking";

      // L.marker([p.lat, p.lon], { icon: mcIcon })
        // .bindPopup(`<b>${popupContent}</b><br>Capacity: ${p.tags.capacity || 'Unknown'}`)
        // .addTo(markers);
    // });
  // })
  // .catch(err => console.error("Failed to load JSON:", err));
  
// Use a Set to track coordinates we've already placed on the map
const seenCoords = new Set();

Promise.all([
    fetch('goteborg_api.json').then(res => res.json()),
    fetch('overpass_data.json').then(res => res.json())
])
.then(([gbgData, ovpData]) => {
    
    // 1. Process Gothenburg Data (Primary Source)
	gbgData.forEach(p => {
    // Check if both coordinates actually exist
    if (p.Lat !== undefined && p.Long !== undefined) {
        const lat = p.Lat;
        const lon = p.Long;
        const coordKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
        
        seenCoords.add(coordKey);

        L.marker([lat, lon], { icon: mcIcon })
            .bindPopup(`<b>${p.Name || "MC Parkering"}</b><br>Källa: Göteborg Stad`)
            .addTo(markers);
		}
	});

    // 2. Process Overpass Turbo Data
	const ovpLocations = ovpData.elements || ovpData;

	ovpLocations.forEach(p => {
		if (p.lat && p.lon) {
			const currentPos = L.latLng(p.lat, p.lon);
			
			// Check if this point is within 15 meters of ANY existing Gothenburg marker
			let isDuplicate = false;
			markers.eachLayer(layer => {
				if (layer instanceof L.Marker) {
					const distance = currentPos.distanceTo(layer.getLatLng());
					if (distance < 15) { // 15 meters threshold
						isDuplicate = true;
					}
				}
			});

			if (!isDuplicate) {
				const name = p.tags?.name || p.tags?.amenity || "Motorcycle Parking";
				L.marker([p.lat, p.lon], { icon: mcIcon })
					.bindPopup(`<b>${name}</b><br>Source: OSM`)
					.addTo(markers);
			}
		}
	});		
	
})
.catch(err => console.error("Error merging data sources:", err));


map.on('click', function(e) {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    
    console.log(`Clicked at: ${lat}, ${lng}`);
    
    // Optional: Open a popup at the click location
    L.popup()
        .setLatLng(e.latlng)
        .setContent(`Coordinates: ${lat}, ${lng}`)
        .openOn(map);
});