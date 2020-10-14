function MapManager(options) {

    var self = this;

    //*** Options ***
    self._mapElement = document.getElementById(options.mapElementId);
    self._mapTypeId = options.mapTypeId || google.maps.MapTypeId.ROADMAP;
    self._defaultZoom = options.zoom || 4;
    self._defaultLatLng = options.defaultLatLng || { lat: 38.5, lng: -96 };
    self._portalBoundaryUrl = options.portalBoundaryUrl;

    //*** Internal variables ***
    self._map = null;
    self._polygon = null;
    self._marker = null;
    self._infoWindow = null;

    //*** Private Functions ***

    //--- updateMap Support ---
    self._getGooglePathsAndBounds = function (esriRings) {

        //Both the paths and the bounds are very closely interconnected.
        //Handling both at once allows to avoid looping twice.

        var paths = [];
        var bounds = new google.maps.LatLngBounds();
        var path = null;
        var latLng = null;

        $.each(esriRings, function (idx, esriRing) {

            path = $.map(esriRing, function (coords) {

                latLng = {
                    lat: coords[1],
                    lng: coords[0]
                };

                bounds.extend(latLng);

                return latLng;

            });

            paths.push(path);

        });

        return { paths: paths, bounds: bounds };
    };

    self._addPolygon = function (portalResults) {

        var pab = self._getGooglePathsAndBounds(portalResults.features[0].geometry.rings);

        self._polygon = new google.maps.Polygon({
            paths: pab.paths,
            strokeColor: '#FFC107',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#FFC107',
            fillOpacity: 0.35
        });

        self._polygon.setMap(self._map);
        self._map.fitBounds(pab.bounds);
    };

    self._addMarker = function (latLng, formattedAddress, isRooftopMatch) {

        self._marker = new google.maps.Marker({
            position: latLng
        });
        self._marker.setMap(self._map);

        var infoWindowContent = formattedAddress;
        if (!isRooftopMatch) {
            infoWindowContent += '<br/><small class="text-danger">Approximate Address Match - See Below for Details *</small>';
        }

        self._infoWindow = new google.maps.InfoWindow({
            content: infoWindowContent
        });
        self._infoWindow.open(self._map, self._marker);
    };

    self._updateMapDisplay = function (portalResults, latLng, formattedAddress, isRooftopMatch) {

        //Clear old polygon & marker, if there is one.
        if (self._polygon) self._polygon.setMap(null);
        if (self._marker) self._marker.setMap(null);
        if (self._infoWindow) self._infoWindow.setMap(null);

        self._addMarker(latLng, formattedAddress, isRooftopMatch);
        self._addPolygon(portalResults);

    };


    //--- getLeagueIds Support ---
    self._getQueryPointWhere = function (ballType) {

        var bt = null;

        switch (ballType) {
            case 1:
                bt = "isbaseball";
                break;

            case 2:
                bt = "issoftball";
                break;

            case 4:
                bt = "ischallenger";
                break;
        }

        var where = bt + "=1";

        return where;
    };

    self._getLeagueIdQuery = function (Query, Point, SpatialReference, latLng, ballType) {

        var query = new Query();
        query.returnGeometry = false;
        query.spatialRelationship = "intersects";
        query.geometry = new Point({
            x: latLng.lng,
            y: latLng.lat,
            spatialReference: new SpatialReference(4326)
        });
        query.where = self._getQueryPointWhere(ballType);
        query.outFields = ["objectid", "leagueid"];

        return query;

    };

    self._getLeagueIdResults = function (portalResults) {

        var ret = $.map(portalResults.features, function (feature) {
            return feature.attributes;
        });

        return ret;
    };

    //*** Public Functions ***

    //objectId:  objectid value of Portal Hosted Feature Layer for league polygon.
    //latLng:    Google LatLng object - geocoded point of address - marker will be placed on the map
    //              in addition to the polygon.
    self.updateMap = function (objectId, latLng, formattedAddress, isRooftopMatch) {

        var d = $.Deferred();

        require(["esri/tasks/QueryTask", "esri/tasks/support/Query",
            "esri/geometry/SpatialReference"],
            function (QueryTask, Query, SpatialReference) {

                var query = new Query();
                query.returnGeometry = true;
                query.where = "objectid=" + objectId;
                query.outSpatialReference = new SpatialReference(4326);

                var queryTask = new QueryTask({ url: self._portalBoundaryUrl });

                queryTask.execute(query).then(function (portalResults) {

                    //Expecting 1 result.
                    if (!portalResults || !portalResults.features) {
                        d.reject("Error in getting polygon data.");
                    }
                    else {
                        self._updateMapDisplay(portalResults, latLng, formattedAddress, isRooftopMatch);
                    }

                    d.resolve();

                }, function (error) {
                    d.reject(error);
                });


            }); //require

        return d.promise();

    };

    //latLng: Google LatLng object - geocoded point of address.
    //ballType: Baseball = 1, Softball = 2, Challenger = 4
    self.getLeagueIds = function (latLng, ballType) {

        var d = $.Deferred(); //jQuery Deferred

        require(["esri/tasks/QueryTask", "esri/tasks/support/Query",
            "esri/geometry/Point", "esri/geometry/SpatialReference"],
            function (QueryTask, Query, Point, SpatialReference) {

                var query = self._getLeagueIdQuery(Query, Point, SpatialReference, latLng, ballType);

                var queryTask = new QueryTask({ url: self._portalBoundaryUrl });

                //execute returns Dojo Deferred.
                queryTask.execute(query).then(function (portalResults) {
                    var results = self._getLeagueIdResults(portalResults);
                    d.resolve(results);
                }, function (error) {
                    d.reject(error);
                });

            }); //require

        return d.promise();

    };

    self.initialize = function () {

        self._map = new google.maps.Map(self._mapElement, {
            zoom: self._defaultZoom,
            center: self._defaultLatLng,
            mapTypeId: self._mapTypeId,
            streetViewControl: false
        });

    };
}