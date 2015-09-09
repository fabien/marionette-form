(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['backbone.original'], function(Backbone) {
            return factory(Backbone);
        });
    } else if (typeof exports !== 'undefined') {
        var Backbone = require('backbone.original');
        module.exports = factory(Backbone);
    } else {
        factory(root.Backbone);
    }
}(this, function(Backbone) {
    
    Backbone.DeferredModel = Backbone.Model.extend({
        
        constructor: function() {
            Backbone.Model.prototype.constructor.apply(this, arguments);
            attachDeferred.call(this)(); // resolve immediately
            this.on('fetch', attachDeferred);
        }
        
    });
    
    var CollectionConstructor = Backbone.Collection;
    Backbone.Collection = Backbone.Collection.extend({
        
        constructor: function(items, options) {
            CollectionConstructor.apply(this, arguments);
            var resolve = attachDeferred.call(this);
            if (_.isArray(items) && !_.isEmpty(items)) resolve();
            this.on('fetch', attachDeferred);
        },
        
        lookup: function(id) {
            var dfd = $.Deferred();
            var model;
            if (model = this.get('id')) {
                dfd.resolveWith(this, model);
            } else {
                model = new this.model({ id: id });
                model.fetch({
                    success: function(model, response, options) {
                        dfd.resolveWith(this, model, response, options);
                    },
                    error: function(model, response, options) {
                        dfd.rejectWith(this, model, response, options);
                    }
                });
            }
            return dfd.promise();
        }
        
    });
    
    return Backbone;
    
    function attachDeferred() {
        this.cache = $.Deferred();
        var resolve = this.cache.resolve.bind(this, this);
        var reject = this.cache.reject.bind(this, this);
        this.once('sync reset', resolve);
        this.once('error', reject);
        return resolve;
    };
    
}));