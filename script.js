var map = L.map('map').setView([57.707678, 11.986148], 16); // Sverige

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

var markers = L.layerGroup().addTo(map);


// // Test: hämta bara Göteborg-området
// var bbox = "57.65,11.90,57.75,12.00"; // S, W, N, E

// var query = `
// [out:json][timeout:25];
// (
 // node["amenity"="motorcycle_parking"](${bbox});
 // way["amenity"="motorcycle_parking"](${bbox});
// );
// out center;
// `;

// var url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

// fetch(url)
// .then(res => res.json())
// .then(data => {

 // data.elements.forEach(function(el){

   // var lat = el.lat || (el.center && el.center.lat);
   // var lon = el.lon || (el.center && el.center.lon);

   // if(!lat || !lon) return; // hoppa om inga koordinater

   // var name = (el.tags && el.tags.name) || "MC parkering";

   // L.marker([lat,lon], {icon: mcIcon})
    // .addTo(markers)
    // .bindPopup(name);

 // });

// })
// .catch(e => console.error("Overpass fetch failed:", e));


// Marker cluster för tusentals markörer
var markers = L.markerClusterGroup();
map.addLayer(markers);


// Ladda GPX

new L.GPX('parking-sweden.gpx', {
  async: true,
  marker_options: {
    startIconUrl: 'pin-icon-wpt.png', // exakt filnamn
    endIconUrl: 'pin-icon-wpt.png',
    shadowUrl: '',
    iconSize: [22,32],      // valfri storlek
    iconAnchor: [16,32],
    popupAnchor: [0,-32]
  }
}).addTo(map);