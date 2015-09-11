define([
    'jquery',
    'underscore',
    'backbone',
    'backbone.marionette',
    'marionette.form',
    'backbone.googlemaps'
], function($, _, Backbone, Marionette, Form) {
    
    Form.Templates.GeoControl = _.template([
        '<label class="<%= labelClassName %>" for="control-<%= id %>"><%= label %></label>',
        '<div class="<%= controlsClassName %>">',
        '  <div data-region="map"></div>',
        '  <div class="row geo-controls">',
        '    <div class="col-sm-6">',
        '      <div class="input-group">',
        '        <span class="input-group-addon" title="Latitude">Lat</span>',
        '        <input id="control-<%= id %>-lat" name="lat" class="<%= controlClassName %> geo-lat" type="text" value="<%- value.lat %>" <%= disabled ? "disabled" : "" %> <%= required ? "required" : "" %> <%= readonly ? "readonly" : "" %>/>',
        '      </div>',
        '    </div>',
        '    <div class="col-sm-6">',
        '      <div class="input-group">',
        '        <span class="input-group-addon" title="Longitude">Lng</span>',
        '        <input id="control-<%= id %>-lng" name="lng" class="<%= controlClassName %> geo-lng" type="text" value="<%- value.lng %>" <%= disabled ? "disabled" : "" %> <%= required ? "required" : "" %> <%= readonly ? "readonly" : "" %>/>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div class="<%= helpClassName %>"><%= helpMessage %></div>',
        '</div>'
    ].join('\n'));
    
    Backbone.GoogleMaps.Location.prototype.toPoint = function() {
        return { lat: this.get('lat'), lng: this.get('lng') };
    };
    
    var CoordinatesFormatter = Marionette.Form.CoordinatesFormatter = function(options) {
        options = _.extend({}, options);
        this.format = options.format || 'object';
        this.default = options.default || { lat: 0, lng: 0 };
    };
    
    _.extend(CoordinatesFormatter.prototype, {
        
        fromRaw: function(rawData, model) {
            return this.toRaw(rawData, model, 'object');
        },
        
        toRaw: function(formattedData, model, format) {
            format = format || this.format;
            if (_.isString(formattedData)) {
                var coordinates = _.compact(String(formattedData).split(/\s|,/));
                var lat = parseFloat(coordinates[0]);
                var lng = parseFloat(coordinates[1]);
            } else if (_.isArray(formattedData)) {
                var lat = parseFloat(formattedData[0]);
                var lng = parseFloat(formattedData[1]);
            } else if (_.isObject(formattedData)) {
                var lat = parseFloat(formattedData.lat);
                var lng = parseFloat(formattedData.lng);
            }
            if (!this.isValidCoordinate(lat, lng)) {
                lat = this.default.lat;
                lng = this.default.lng;
            }
            if (format === 'object') {
                return { lat: lat, lng: lng };
            } else if (format === 'array') {
                return [lat, lng];
            } else {
                return [lat, lng].join(', ');
            }
        },
        
        isValidCoordinate: function(lat, lng) {
            if (_.isUndefined(lat) || _.isUndefined(lng)) return false;
            if (_.isNaN(lat) || _.isNaN(lng)) return false;
            return true;
        }
        
    });
    
    Form.GeoMarkerView = Backbone.GoogleMaps.MarkerView.extend({
        
        constructor: function(options) {
            Backbone.GoogleMaps.MarkerView.prototype.constructor.apply(this, arguments);
            _.bindAll(this, 'onDragEnd');
            _.bindAll(this, 'onRightClick');
            this.listenTo(this.model, 'change:title', this.refreshDetailView);
        },
        
        mapEvents: {
            'dragend': 'onDragEnd',
            'rightclick': 'onRightClick'
        },
        
        onDragEnd: function(e) {
            if (this.options.control && !this.options.control.canMovePoint(this.model)) {
                return; // not allowed
            }
            this.model.set({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        },
        
        onRightClick: function(e) {
            if (this.options.control && !this.options.control.canRemovePoint(this.model)) {
                return; // not allowed
            }
            this.model.collection.remove(this.model);
        },
        
        openDetail: function() {
            var options = _.extend({}, this.options.overlayOptions.infoWindowOptions);
            this.detailView = new this.infoWindow(_.extend({
                model: this.model,
                map: this.map,
                marker: this.gOverlay
            }, options));
            this.detailView.render();
        },
        
        refreshDetailView: function() {
            if (!this.model.get('selected')) return;
            this.closeDetail();
            this.openDetail();
        }
        
    });
    
    Form.GeoMapView = Backbone.GoogleMaps.MarkerCollectionView.extend({
        
        markerView: Form.GeoMarkerView,
        
        addChild: function(childModel) {
            var overlayOptions = _.extend({}, this.overlayOptions, this.options.overlayOptions);
            overlayOptions.infoWindowOptions = _.extend({}, 
                this.infoWindowOptions, this.options.infoWindowOptions);
            var MarkerView = this.getMarkerView(childModel);
            var markerView = new MarkerView({
                overlayOptions: overlayOptions,
                model: childModel,
                control: this.options.control,
                map: this.map
            });
            this.markerViewChildren[childModel.cid] = markerView;
            markerView.render();
        },
        
        getMarkerView: function(model) {
            return this.options.markerView || this.markerView;
        }
        
    });
    
    var GeoControl = Form.GeoControl = Form.BaseControl.extend(_.defaults({
        
        template: Form.Templates.GeoControl,
        
        formatter: 'coordinates',
        
        ui: {
            control: ':input, [role="control"]',
            map: '[data-region="map"]',
            lat: 'input.geo-lat',
            lng: 'input.geo-lng'
        },
        
        collectionConstructor: Backbone.GoogleMaps.LocationCollection,
        
        defaults: { helpMessage: '', editable: false, autoCenter: true, controls: true },
        
        defaultCenter: { lat: 54.9000, lng: 25.3167 },
        
        mapOptions: { zoom: 3, mapType: 'roadmap' },
        
        overlayOptions: {},
        
        constructor: function(options) {
            Form.BaseControl.prototype.constructor.apply(this, arguments);
            
            this.onMapClickRight = _.debounce(this.onMapClickRight.bind(this), 250);
            
            var latKey = this.getAttribute('latKey') || this.getOption('latKey');
            var lngKey = this.getAttribute('lngKey') || this.getOption('lngKey');
            if (latKey && lngKey) {
                if (this.getFormat() !== 'object') {
                    throw new Error('Cannot use latKey, lngKey unless format is object');
                }
                this.latKey = latKey;
                this.lngKey = lngKey;
                this.observeKey(this.latKey);
                this.observeKey(this.lngKey);
            }
            
            this.collection = this.collection || this.getCollection(options);
            if (!(this.collection instanceof Backbone.GoogleMaps.LocationCollection)) {
                throw new Error('Invalid LocationCollection');
            }
            
            this.geocoder = new google.maps.Geocoder();
            
            if (this.getAttribute('geocode')) {
                var keys = [].concat(this.getAttribute('geocode') || []);
                var callback = this.triggerMethod.bind(this, 'address:change', keys);
                _.each(keys, function(key) {
                    this.observeKey(key, callback);
                }.bind(this));
            }
            
            if ($.fn.autoNumeric) this.on('render:control', this._attachAutoNumeric);
            
            this.listenTo(this.collection, 'add', this.triggerMethod.bind(this, 'add:point'));
            this.listenTo(this.collection, 'change', this.triggerMethod.bind(this, 'change:point'));
            this.listenTo(this.collection, 'change:lat change:lng', this.triggerMethod.bind(this, 'update:point'));
            
            this.listenTo(this.model, 'change:helpMessage', this.render);
            this.listenTo(this.model, 'change:controls', this.render);
            this.listenTo(this.model, 'change:map', this.render);
            this.listenTo(this.model, 'change:zoom', callSetter('setZoom'));
            this.listenTo(this.model, 'change:center', callSetter('setCenter'));
            this.listenTo(this.model, 'change:mapType', callSetter('setMapType'));
        },
        
        formatterOptions: function() {
            if (_.isObject(this.getAttribute('center'))) {
                var defaultCenter = this.getAttribute('center');
            } else {
                var defaultCenter = this.getOption('defaultCenter');
            }
            return { format: this.getFormat(), default: defaultCenter };
        },
        
        getFormat: function() {
            return this.getAttribute('format') || 'object';
        },
        
        updateView: function() {
            var point = this.getPointValue();
            if (!point) return;
            if ($.fn.autoNumeric) {
                this.ui.lat.autoNumeric('set', point.lat || 0);
                this.ui.lng.autoNumeric('set', point.lng || 0);
            } else {
                this.ui.lat.val(point.lat);
                this.ui.lng.val(point.lng);
            }
            if (this.point) {
                this.point.set(point);
                if (this.getAttribute('autoCenter')) {
                    setTimeout(this.setCenter.bind(this, point), 200);
                }
            }
        },
        
        commit: function() {
            this.setValue(this.getValue());
        },
        
        handleChange: function() {
            if (!this.getAttribute('collection')) {
                return this.commit();
            } else if (this.selectedPoint) {
                var point = this.getInputValue();
                if (!point) return;
                point = this.formatter.fromRaw(point);
                this.selectedPoint.set(point);
            }
        },
        
        getPointValue: function(fromControl) {
            if (this.getAttribute('collection')) {
                if (this.selectedPoint) return this.selectedPoint.toPoint();
                return {};
            } else {
                return this.formatter.fromRaw(this.getValue(true));
            }
        },
        
        setPointValue: function(point) {
            if (this.getAttribute('collection')) return;
            point = this.formatter.fromRaw(point);
            this.setValue(point);
            this.triggerMethod('set:point', this.point);
        },
        
        serializePointsCollection: function() {
            return this.collection.map(function(point) {
                return _.omit(point.toJSON(), 'selected');
            });
        },
        
        getInputValue: function() {
            var point = {};
            if ($.fn.autoNumeric) {
                point.lat = this.ui.lat.autoNumeric('get', point.lat);
                point.lng = this.ui.lng.autoNumeric('get', point.lng);
            } else {
                point.lat = this.ui.lat.val();
                point.lng = this.ui.lng.val();
            }
            point.lat = parseFloat(point.lat);
            point.lng = parseFloat(point.lng);
            return this.coerceValue(point);
        },
        
        getValue: function(fromModel, fromControl) {
            if (this.getAttribute('collection')) {
                return this.serializePointsCollection();
            } else if (fromModel && this.latKey && this.lngKey) {
                var point = {};
                point.lat = parseFloat(this.getFormValue(this.latKey));
                point.lng = parseFloat(this.getFormValue(this.lngKey));
                return this.coerceValue(point);
            } else if (fromModel) {
                return this.getFormValue(this.getKey());
            } else {
                return this.getInputValue();
            }
        },
        
        setValue: function(value, options) {
            if (this.getAttribute('collection')) {
                this.collection.reset(value || []);
            } else if (this.latKey && this.lngKey) {
                return this.mutex(function() {
                    options = _.extend({ viewCid: this.cid }, options);
                    var point = {};
                    point[this.latKey] = value.lat;
                    point[this.lngKey] = value.lng;
                    return this.form.model.set(point, options);
                });
            } else {
                value = this.formatter.toRaw(value);
                return Form.BaseControl.prototype.setValue.call(this, value, options);
            }
        },
        
        ensureDefaultValue: function() {
            this.__ensuredValue = false;
            if (this.getAttribute('collection')) {
                return; // no defaults
            } else if (this.latKey && this.lngKey && !this.form.model.has(this.latKey)) {
                this.setValue(this.getValue());
                this.__ensuredValue = true;
            } else if (!this.hasValue()) {
                this.setValue(this.getValue());
                this.__ensuredValue = true;
            }
        },
        
        // GoogleMap support
        
        setZoom: function(factor) {
            this.map && this.map.setZoom(factor);
        },
        
        setCenter: function(lat, lng) {
            this.map && this.map.setCenter(this.makeLatLng(lat, lng));
        },
        
        setMapType: function(type) {
            this.map && this.map.setMapTypeId(this.coerceMapType(type));
        },
        
        coerceMapType: function(type) {
            return google.maps.MapTypeId[(type + '').toUpperCase()];
        },
        
        getMapCenter: function() {
            // don't use fallback [0, 0] coordinates
            if (this.getAttribute('collection')) {
                var point = this.collection.at(0);
                if (point) return point.toPoint();
                return;
            }
            if (this.__ensuredValue) return;
            return this.getValue(true);
        },
        
        getPointId: function(point) {
            return _.uniqueId();
        },
        
        getPointTitle: function(point) {
            return this.getAttribute('title') || this.getLabel();
        },
        
        mapConfig: function() {
            var config = this.getAttributes('zoom', 'mapType', 'center');
            _.defaults(config, this.getOption('mapOptions'));
            config.mapTypeId = this.coerceMapType(config.mapType);
            
            config.center = config.center || this.getMapCenter();
            if (config.center) {
                config.center = this.makeLatLng(config.center);
            } else {
                config.center = this.makeLatLng(this.defaultCenter);
            }
            return _.omit(config, 'mapType');
        },
        
        makeLatLng: function(lat, lng) {
            if (lat instanceof google.maps.LatLng) {
                return lat;
            } else if (_.isArray(lat)) {
                return new google.maps.LatLng(lat[0], lat[1]);
            } else if (_.isObject(lat)) {
                return new google.maps.LatLng(lat.lat, lat.lng);
            } else {
                lat = _.isString(lat) ? parseFloat(lat) : lat;
                lng = _.isString(lng) ? parseFloat(lng) : lng;
                return new google.maps.LatLng(lat, lng);
            }
        },
        
        onMapClickRight: function(e) {
            var data = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            if (this.point && this.canMovePoint(this.point)) {
                this.point.set(data);
            } else if (this.getAttribute('collection')) {
                data.id = this.getPointId(data);
                var point = new this.collection.model(data);
                if (!this.canAddPoint(point)) return;
                this.collection.add(point);
            }
        },
        
        canAddPoint: function(point) {
            return this.evaluateAttribute('editable');
        },
        
        canMovePoint: function(point) {
            return this.evaluateAttribute('editable');
        },
        
        canRemovePoint: function(point) {
            if (this.point) return false;
            return this.evaluateAttribute('editable');
        },
        
        // Geocoding
        
        geocode: function(req) {
            var language = this.getAttribute('language');
            if (language) req.language = req.language || language;
            var dfd = $.Deferred();
            this.triggerMethod('before:geocode', req, dfd);
            this.geocoder.geocode(req, function(results, status) {
                if (status === google.maps.GeocoderStatus.OK) {
                    this.triggerMethod('geocode', results, req);
                    dfd.resolve(results, req);
                } else {
                    this.triggerMethod('geocode:fail', status, req);
                    dfd.reject(status, req);
                }
            }.bind(this));
            var promise = dfd.promise();
            promise.parseResults = parseGeocodeResults;
            return promise;
        },
        
        onAddressChange: function(keys, model, value, options) {
            if (options && options.geocoded) return; // skip
            var address = this.form.getValuesOf(keys);
            var segments = _.map(keys, function(key) {
                return address[key];
            });
            
            if (this.getAttribute('region')) {
                var region = this.getAttribute('region');
            } else if (this.getAttribute('regionKey')) {
                var regionKey = this.getAttribute('regionKey');
                var region = this.getFormValue(regionKey);
            } else {
                var region = address['country'] || address['region'];
            }
            
            var req = { address: _.compact(segments).join(', ') };
            if (_.isString(region)) req.region = region;
            
            var promise = this.geocode(req);
            promise.done(this.onGeocodeAddress.bind(this));
            promise.fail(this.onGeocodeAddressFail.bind(this));
        },
        
        onGeocodeAddress: function(results, req) {
            this.model.set('helpMessage', results[0]['formatted_address']);
            this.enableClassName('valid-location', true);
            this.enableClassName('invalid-location', false);
            var location = results[0].geometry.location;
            var value = this.formatter.toRaw({
                lat: location.lat(), lng: location.lng()
            });
            this.setValue(value);
        },
        
        onGeocodeAddressFail: function(status, req) {
            this.model.set('helpMessage', 'Invalid location.');
            this.enableClassName('invalid-location', true);
            this.enableClassName('valid-location', false);
        },
        
        // Rendering
        
        render: function() {
            var options = _.last(arguments) || {};
            if (!this.isRendered) {
                Form.BaseControl.prototype.render.apply(this, arguments);
                if (this.getAttribute('map')) this.renderMap();
            } else {
                if (this.getAttribute('map')) this.renderMap();
                this.updateView();
            }
            if (!_.isEmpty(this.getAttribute('helpMessage'))) {
                this.$('.help-block').text(this.getAttribute('helpMessage')).show();
            } else {
                this.$('.help-block').text('').hide();
            }
            var visible = Boolean(this.getAttribute('controls'));
            this.$('.geo-controls')[visible ? 'show' : 'hide']();
            return this;
        },
        
        renderMap: function() {
            var config = _.extend({}, this.mapConfig(), this.getAttribute('map'));
            this.map = this.map || new google.maps.Map(this.ui.map[0], config);
            this.map.addListener('click', this.triggerMethod.bind(this, 'map:click'));
            this.map.addListener('dblclick', this.triggerMethod.bind(this, 'map:click:dbl'));
            this.map.addListener('rightclick', this.triggerMethod.bind(this, 'map:click:right'));
            this.ui.map.addClass('gmap');
            this.triggerMethod('render:map', this.map);
        },
        
        disableControls: function(bool) {
            if (this.evaluateAttribute('disabled')) return;
            bool = Boolean(bool);
            this.ui.lat.prop('disabled', bool);
            this.ui.lng.prop('disabled', bool);
        },
        
        onRenderMap: function() {
            if (this.mapView) return;
            
            if (this.getAttribute('collection')) {
                this.disableControls(true);
                this.listenTo(this.collection, 'change:selected', function(model, isSelected) {
                    if (isSelected) {
                        this.selectedPoint = model;
                        this.listenTo(model, 'change:lat change:lng', _.debounce(function(model) {
                            this.updateView();
                        }, 250));
                    } else {
                        if (this.selectedPoint === model) this.selectedPoint = null;
                        this.stopListening(model);
                    }
                    var disabled = this.collection.where({ selected: true }).length === 0;
                    this.disableControls(disabled);
                    this.updateView();
                    this.triggerMethod('select:point', model, isSelected);
                });
            } else if (this.collection.length === 0) {
                var point = this.getPointValue();
                this.collection.add(_.extend({ 
                    id: this.getPointId(point), title: this.getPointTitle(point)
                }, point), { init: true });
                this.point = this.collection.at(0);
                this.listenTo(this.point, 'change:lat change:lng', _.debounce(function(model) {
                    this.setPointValue(model.toPoint());
                }, 250));
            }
            
            var overlayOptions = _.extend({}, this.getAttribute('overlay'));
            _.defaults(overlayOptions, this.getOption('overlayOptions'));
            
            var infoWindowOptions = _.extend({}, this.getAttribute('infoWindow'));
            _.defaults(infoWindowOptions, this.getOption('infoWindowOptions'));
            
            if (this.getAttribute('editable')) {
                overlayOptions.draggable = Boolean(this.getAttribute('editable'));
            }
            
            var MapView = this.getAttribute('MapView') || this.getOption('MapView');
            if (_.isString(MapView)) MapView = this.form.getRegisteredView(MapView);
            MapView = MapView || Form.GeoMapView;
            
            var MarkerView = this.getAttribute('MarkerView') || this.getOption('MarkerView');
            if (_.isString(MarkerView)) MarkerView = this.form.getRegisteredView(MarkerView);
            MarkerView = MarkerView || Form.GeoMarkerView;
            
            this.mapView = new MapView({
                overlayOptions: overlayOptions,
                infoWindowOptions: infoWindowOptions,
                collection: this.collection,
                markerView: MarkerView,
                control: this,
                map: this.map
            });
            
            this.mapView.render();
        },
        
        onDestroy: function() {
            if (this.mapView) this.mapView.close();
            if (this.map) google.maps.event.clearInstanceListeners(this.map);
        },
        
        _attachAutoNumeric: function() {
            var settings = { aDec: '.', mDec: 7, aSep: '', lZero: 'deny', pSign: 's' };
            this.ui.lat.autoNumeric(_.extend({ vMin: -85, vMax: 85, aSign: ' \xB0 N' }, settings));
            this.ui.lng.autoNumeric(_.extend({ vMin: -180, vMax: 180, aSign: ' \xB0 E' }, settings));
        }
        
    }, Form.CollectionMixin));
    
    return GeoControl;
    
    function addressComponentsToObject(components) {
        var address = {}, street = {};
        _.each(components, function(comp) {
            var type = _.first(comp.types);
            if (type === 'street_address') {
                street['street'] = comp.long_name;
            } else if (type === 'route') {
                street['street'] = street['street'] || comp.long_name;
            } else if (type === 'street_number' && comp.long_name) {
                street['number'] = comp.long_name;
            } else if (type === 'country') {
                address['country'] = comp.long_name;
                address['countryCode'] = comp.short_name;
            } else if (type === 'postal_code') {
                address['postalCode'] = comp.long_name;
            } else if (type === 'administrative_area_level_1') {
                address['region'] = comp.long_name;
            } else if (type === 'administrative_area_level_2') {
                address['region'] = address['region'] || comp.long_name;
            } else if (type === 'administrative_area_level_3') {
                address['region'] = address['region'] || comp.long_name;
            } else if (type === 'administrative_area_level_4') {
                address['region'] = address['region'] || comp.long_name;
            } else if (type === 'administrative_area_level_5') {
                address['region'] = address['region'] || comp.long_name;
            } else if (type === 'locality') {
                address['locality'] = comp.long_name;
            }
        });
        if (street.street) {
            address.street = street.street;
            if (street.number && address.countryCode === 'US') {
                address.street = street.number + ' ' + address.street;
            } else if (street.number) {
                address.street += ' ' + street.number;
            }
        }
        return address;
    };
    
    function parseGeocodeResults(results) {
        var info = results[0];
        var loc = {};
        if (info.address_components) {
            _.extend(loc, addressComponentsToObject(info.address_components));
        }
        if (info.geometry && info.geometry.location) {
            loc.coordinates = {
                lat: info.geometry.location.lat(),
                lng: info.geometry.location.lng()
            };
        }
        if (info.formatted_address) {
            loc.formatted = info.formatted_address;
        }
        return loc;
    };
    
    function callSetter(setter) {
        return function(model, value) {
            this[setter](value);
        };
    };
    
});