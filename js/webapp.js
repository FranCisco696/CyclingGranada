/**
 * @author Francisco Gomez Correa
 */


//Variable to save the url to access GeoServer
var geoserverUrl = "https://gs.fagomez.achiefs.com/geoserver";

var sourceMarker =null; // Variable to save the starting marker 
var targetMarker =null; // Variable to save the ending marker 
var selectedPoint = null; // Variable to save the selected point 
var source = null;// Variable to save the starting point 
var target = null; // Variable to save the ending point 
var isPathActive= false; // Variable to control when calculate the route
var isRoadBike = true; // Variable to control type of bicycle
var pathLayer = L.geoJSON(null); // Variable geojson layer to save and display path
var gpxFile = null; // Variable to save path as GPX file
var refreshIntervalId=null; // Variable to set current position interval   
var current_position; // Variable for the user's current position

/**
 * Variables to control road network coverage bounds
 */
var south = 36.6772;
var west = -4.4028;
var north = 38.1216;
var east = -2.1451;

/**
 * Variable to initialize the map
 */
var map = L.map("map", {
	center: [37.3994, -3.2739],
	zoom: 7,
	minZoom: 8,
	maxZoom: 18
});

/**
 * Variables to control the map extension to show
 */ 
var southWestMap = L.latLng(south,west);
var northEastMap = L.latLng(north,east);
var bounds = L.latLngBounds(southWestMap, northEastMap);

/**
 * Set bounds to show
 */
map.setMaxBounds(bounds);
map.on('drag', function() {
    map.panInsideBounds(bounds, { animate: false });
});

/**
 * Add OpenStreetMap base layer
 */ 
var osm= L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18}
).addTo(map);

/**
 * Add Topography base layer
 */
var topography = L.tileLayer(
	'https://api.maptiler.com/maps/topo/{z}/{x}/{y}.png?key=VwOg0Bo48ACUxEqn5Edo',{
  	tileSize: 512,
  	zoomOffset: -1,
  	minZoom: 8,
  	attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
  	crossOrigin: true
});

/**
 * Add Satellite base layer
 */
var ortoimages = L.tileLayer.wms("https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&", {
    layers: "OI.OrthoimageCoverage",
    format: 'image/jpeg',
    transparent: true,
    version: '1.3.0',
    attribution: "PNOA © IGN"
});

/**
 * Control of base layers
 */
var baseMaps = {
	"OpenStreetMap": osm,
	"Topography": topography,
	"Satellite" : ortoimages
};

/**
 * Add the negative mask for Granada's province
 */
var maskGranada = L.tileLayer.wms(`${geoserverUrl}/cycling_granada/wms?service=WMS&`,{
	layers: 'cycling_granada:GR_MaskNegative_Disolved',
	styles:'',
    format: 'image/png',
    transparent: true,    
    opacity: 0.5,    
}).addTo(map);

/**
 * Control for the negative mask
 */
var overlayMask = {
    "Granada": maskGranada
};

/**
 * Add base layers and negative mask to the map to display the chosen ones
 */ 
L.control.layers(baseMaps,overlayMask).addTo(map);

/**
 * Bring to the front the negative mask for Granada province when the layer is selected
 */
map.on("Granada", function (event) {
	maskGranada.bringToFront();
});

/**
 * Add scale in metric units
 */
L.control.scale({ metric:true, imperial:false, position: 'bottomleft'}).addTo(map);


/**
 * Button to select type of bicycle to use
 */
var pathType = L.easyButton({	
	states: [{
	  stateName: 'roadbike',
	  icon: '<img src="https://image.flaticon.com/icons/svg/808/808487.svg" style="width:16px"n>',
	  title: 'Road Bike Selected',
	  onClick: function(control) {
		
		alert('Mountain Bike Selected');
		isRoadBike=false;
		control.state('mountainbike');
		if (isPathActive && sourceMarker != null && targetMarker!= null){
			getRoute();
		}
	  }
	},
	{
	   stateName: 'mountainbike',
	   icon: '<img src="https://image.flaticon.com/icons/svg/1275/1275346.svg" style="width:16px"n>',
	   title: 'Mountain Bike Selected',
	   onClick: function(control) {
		alert('Road Bike selected');
		isRoadBike=true;
		control.state('roadbike');
		if (isPathActive && sourceMarker != null && targetMarker!= null){
			getRoute();
		}
	   }	  
	}]
}).addTo(map);

/**
 * Button to add marker for the starting point
 */ 
var startingPoint = L.easyButton({
	id: 'starting_point',
	states: [{
	  stateName: 'draw_starting_point',
	  icon: '<img src="https://image.flaticon.com/icons/svg/495/495499.svg" style="width:16px"n>',
	  title: 'Locate Starting Point',
	  onClick: function(control) {
		loadStartingPoint();
		control.state('delete_starting_point');
	  }
	},
	{
	   stateName: 'delete_starting_point',
	   icon: '<img src="https://image.flaticon.com/icons/svg/495/495499.svg" style="width:16px"n>',
	   title: 'Delete Starting Point',
	   onClick: function(control) {
		alert('Delete Starting Point');
		deleteStartingPoint();
		deleteRoute();
		control.state('draw_starting_point');

	   }	  
    }]
}).addTo(map);

/**
 * Variable to define characteristics of marker for starting point
 */
var greenMarker = new L.Icon({
	iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
	shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41]
});

/**
 * Button to add marker for the ending point
 */
var endingPoint = L.easyButton({
	id: 'ending_point',
	states: [{
	  stateName: 'draw_ending_point',
	  icon: '<img src="https://image.flaticon.com/icons/svg/985/985802.svg" style="width:16px"n>',
	  title: 'Locate Arrival Point',
	  onClick: function(control) {
		loadEndingPoint();
		control.state('delete_ending_point');
	  }
	},
	{
	   stateName: 'delete_ending_point',
	   icon: '<img src="https://image.flaticon.com/icons/svg/985/985802.svg" style="width:16px"n>',
	   title: 'Delete Arrival Point',
	   onClick: function(control) {
		alert('Delete Arrival Point');
		deleteEndingPoint();
		deleteRoute();
		control.state('draw_ending_point');
	   }	  
	}]
}).addTo(map);

/**
 * Variable to define characteristics of marker for ending point
 */
var redMarker = new L.Icon({
	iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
	shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41]
});


/**
 * Button to calculate the route
 */
var calculateRoute = L.easyButton({
	id: 'calculate_route',
	states: [{
	  stateName: 'draw_route',
	  icon: '<img src="https://image.flaticon.com/icons/svg/837/837932.svg" style="width:16px"n>',
	  title: 'Calculate route',
	  onClick: function(control) {
		if (sourceMarker == null) {
			alert('Please select the Starting Point of the route');
		} else if (targetMarker == null) {
			alert('Please select the Ending Point of the route');
		} else {
			isPathActive=true;
			getRoute();
			control.state('delete_route');
		}		
	  }
	},
	{
	   stateName: 'delete_route',
	   icon: '<img src="https://image.flaticon.com/icons/svg/837/837932.svg" style="width:16px"n>',
	   title: 'Delete the existing route',
	   onClick: function(control) {
		alert('Delete route');
		isPathActive=false;
		deleteRoute();
		control.state('draw_route');
	   }	  
	}]
}).addTo(map);

/**
 * Button to add user location 
 */
var myLocation = L.easyButton({
	id: 'my_location',
	states: [{
	  stateName: 'draw_myLocation',
	  icon: '<img src="https://image.flaticon.com/icons/svg/592/592271.svg" style="width:16px"n>',
	  title: 'Turn on my location',
	  onClick: function(control) {		
		activateMyLocation();
		refreshIntervalId=setInterval(locate, 5000);      
        control.state('delete_myLocation');
	  }
	},
	{
	   stateName: 'delete_myLocation',
	   icon: '<img src="https://image.flaticon.com/icons/svg/592/592271.svg" style="width:16px"n>',
	   title: 'Turn off my location',
	   onClick: function(control) {
		
	    clearInterval(refreshIntervalId);
	    deleteMyLocation();
		control.state('draw_myLocation');
	   }	  
    }]
}).addTo(map);

/**
 * Button to export GPX file
 */  
var exportGpx = L.easyButton({
	id: 'exportGPX',
	position: 'topright',                   
	states:[{               
	  stateName: 'export-gpx',
	  onClick: function(button, map){
		exportGPX();	
	  },
	  title: 'Export route to GPX file',
	  icon: '<img src="https://image.flaticon.com/icons/svg/2810/2810390.svg" style="width:16px"n>'
	}]
}).addTo(map);

/**
 * Function to load on map a draggable marker, initialized at the center of the current map, for the starting point
 */
function loadStartingPoint(){
	sourceMarker = L.marker(map.getCenter(),{ 
		icon:greenMarker,	
		draggable: true
	})
	.on("dragend", function(e) {
		selectedPoint = e.target.getLatLng();	
		
		if (withinBounds(selectedPoint) == false){
			alert('Please select starting location within range');
		}else {
			getVertex(selectedPoint, true);

			if (isPathActive && targetMarker!= null){
				getRoute();
			}
		}		
	}).addTo(map).bindPopup("Starting Location");
}

/**
 * Function to delete the starting point and its marker
 */
function deleteStartingPoint(){
	if (sourceMarker!= null){
		map.removeLayer(sourceMarker);
		sourceMarker = null;
	}	
}

/**
 * Function to load on map a draggable marker, initialized at the center of the current map, for the ending point
 */
function loadEndingPoint(){
	targetMarker = L.marker(map.getCenter(),{ 
		icon:redMarker,
		draggable: true
	})
	.on("dragend", function(e) {
		selectedPoint = e.target.getLatLng();		
		
		if (withinBounds(selectedPoint) == false){
			alert('Please select ending location within range');
		}else {
			getVertex(selectedPoint, false);

			if (isPathActive && sourceMarker != null){
				getRoute();
			}
		}	
	})
	.addTo(map).bindPopup("Arrival Location");
}

/**
 * Function to delete the ending point and its marker
 */
function deleteEndingPoint(){
	if (targetMarker != null){
		map.removeLayer(targetMarker);
		targetMarker = null;
	}
}

/**
 * Function to check if a point is within the bounds of the road network 
 * @param {*} selectedPoint 
 * @return The result as true or false
 */
function withinBounds (selectedPoint){	
	if (selectedPoint.lat <= south || selectedPoint.lng <= west || selectedPoint.lat >= north || selectedPoint.lng >= east){
		return false;
	}else{
		return true;
	}
}

/**
 * Function to update the source and target nodes as returned from geoserver for later querying
 * @param {*} response Nearest vertex obtained from function "getVertex(selectedPoint, isStartingPoint)"
 * @param {*} isSource Indicates if the node passed is source or not (target)
 */
function loadVertex(response, isSource) {
	var features = response.features;
	
	if (isSource) {
		source = features[0].properties.id;
	} else {
		target = features[0].properties.id;
	}
}

/**
 * Function to get nearest vertex to the passed point
 * @param {*} selectedPoint Location passed to obtain nerest vertex 
 * @param {*} isStartingPoint Boolean indicating if is starting point or not
 */
function getVertex(selectedPoint, isStartingPoint) {
	var url = `${geoserverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=cycling_granada:nearest_node&viewparams=x:${selectedPoint.lng};y:${selectedPoint.lat};&outputformat=application/json`;
	
	$.ajax({
		url: url,
		async: false,
		success: function(data) {
			loadVertex(
				data,
				isStartingPoint
			);			
		}		
	});
}	

/**
 * Function to get the shortest route from the given source and target nodes and the characteristics
 * that will be shown by the system.
 * Stores the path in a variable called "pathLayer"
 */
 function getRoute() {
	
	if (isRoadBike){
		var url = `${geoserverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=cycling_granada:dijkstra_shortest_path_roadbike&outputformat=application/json&viewparams=source:${source};target:${target};`;	
	}else {
		var url = `${geoserverUrl}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=cycling_granada:dijkstra_shortest_path_mtb&outputformat=application/json&viewparams=source:${source};target:${target};`;
	}
	
	$.getJSON(url, function(data) {
		var distance_km=0.0;
		var time_minutes=0.0;
		
		deleteRoute();

		pathLayer = L.geoJSON(data, 
		{	onEachFeature: function(feature, layer){
				var popupcontent = [];
			
				distance_km += (feature.properties.length_m)/1000;
					
				popupcontent.push("Street name: " + feature.properties.name);
				popupcontent.push("Acummulated distance: " + distance_km.toFixed(2) + " km");	
			
				layer.bindPopup(popupcontent.join("<br />"));
				
			}			
		});
		
		if (isPathActive){
			map.addLayer(pathLayer);
		
			gpxFile= togpx(data);		

			if(isRoadBike){
				time_minutes=(distance_km/32.0)*60.0;
			}else{
				time_minutes=(distance_km/24.0)*60.0;
			}

			alert('Distance: '+distance_km.toFixed(2) +" km  || " +" Time: "+ time_minutes.toFixed(1) + " minutes");
		}					
	});
}

/**
 * Function to delete the route previously calculated
 */
function deleteRoute() {
	if (pathLayer != null){
		map.removeLayer(pathLayer);
		pathLayer=null;
	}
}

/**
 * Function to activate user's location 
 */
function activateMyLocation(){
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);    
}

/**
 * Function to delete user's location
 */
function deleteMyLocation(){
    if (current_position) {
        map.removeLayer(current_position);    
	}
	map.stopLocate(); 
}


/**
 * Function to add to the map user's location
 * @param {*} e Event from system to get location GPS 
 */
function onLocationFound(e) {
   // if position defined, then remove the existing position marker
   deleteMyLocation();

   current_position = L.marker(e.latlng).addTo(map);    
 }

/**
 * Function to capture error if is not possible to activate user's location
 * @param {*} e Event from system to get location GPS
 */
function onLocationError(e) {
   alert(e.message);
 }

  
/**
 * Function to wrap map.locate that place marker on the map
 */ 
function locate() {
	map.locate({ watch: true, setView: true, maxZoom: 18, enableHighAccuracy: true});
}

/**
 * Function to create and export the GPS file
 */
function exportGPX(){
	if (pathLayer!= null){
		if (gpxFile!=null){
			var element = document.createElement('a');
        	element.href = 'data:application/gpx+xml;charset=utf-8,' + encodeURIComponent(gpxFile);
        	element.download = 'My_GR_Route.gpx';
        	element.style.display = 'none';
        	document.body.appendChild(element);
        	element.click();
        	document.body.removeChild(element);		
		}	
	}else{
		alert('Please calculate the route');
	}
}
