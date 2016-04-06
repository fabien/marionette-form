(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['backbone', 'object-path'], function(Backbone, objectPath) {
            return factory(Backbone, objectPath);
        });
    } else if (typeof exports !== 'undefined') {
        module.exports = factory(require('backbone'), require('object-path'));
    } else {
        factory(root.Backbone, root.objectPath);
    }
}(this, function(Backbone, objectPath) {
    
    var nestedArrayRegex = /(\.\d+\.?|\[\d+\]?)/;
    
    function mixin(Model) {
        return Model.extend({
            
            trackedAttributes: [],
            
            constructor: function(attrs, options) {
                options = options || {};
                Model.prototype.constructor.apply(this, arguments);
                this.on('change', this._trackChanges);
                this.on('sync', function() { this.resetTracking(); });
                this.trackedAttributes = options.trackedAttributes || this.trackedAttributes;
                this.enableTracking(options.tracking !== false);
            },
            
            hasChanges: function() {
                return !_.isEmpty(this.unsavedChanges) || this.isNew();
            },
            
            revert: function(options) {
                options = _.extend({}, options, { revert: true });
                return this.set(this.originalAttributes || {}, options);
            },
            
            isTracking: function() {
                return Boolean(this._tracking);
            },
            
            enableTracking: function(bool) {
                this._tracking = Boolean(bool);
            },
            
            resetTracking: function(bool) {
                if (_.isBoolean(bool)) this.enableTracking(bool);
                delete this.originalAttributes;
                this.unsavedChanges = {};
            },
            
            _trackChanges: function(model, options) {
                options = options || {};
                if (!this.isTracking() || options.revert) return; // skip
                if (!_.isObject(this.originalAttributes)) { // lazy init
                    this.originalAttributes = _.clone(this.previousAttributes());
                    this.unsavedChanges = {};
                }
                var unsavedChanges = this.unsavedChanges || {};
                var originalAttributes = this.originalAttributes || {};
                var trackedAttributes = this.trackedAttributes;
                var changedAttributes = model.changedAttributes() || {};
                if (_.isEmpty(trackedAttributes)) trackedAttributes = _.keys(changedAttributes);
                _.each(trackedAttributes, function(attr) {
                    if (nestedArrayRegex.test(attr)) return; // skip nested array items
                    var oldValue = objectPath.get(originalAttributes, attr);
                    var newValue = objectPath.get(changedAttributes, attr);
                    if (_.isEqual(newValue, oldValue)) {
                        objectPath.del(unsavedChanges, attr);
                    } else {
                        objectPath.set(unsavedChanges, attr, newValue);
                    }
                });
                var recentlyChangedAttributes = _.keys(changedAttributes);
                var recentChanges = _.pick(unsavedChanges, recentlyChangedAttributes);
                if (!_.isEmpty(recentChanges)) {
                    this.trigger('change:unsaved', recentChanges, unsavedChanges);
                }
                this.trigger('unsaved', unsavedChanges);
            }
        });
    };
    
    Backbone.TrackingModel = mixin(Backbone.Model);
    Backbone.TrackingModel.mixin = mixin;
    
    return Backbone.TrackingModel;
    
}));