define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'marionette.form.control.object'
], function($, _, Backbone, Marionette, Form) {
    
    var ReferenceControl = Form.ReferenceControl = Form.ObjectControl.extend({
        
        modelConstructor: Form.Model,
        
        constructor: function(options) {
            Form.ObjectControl.prototype.constructor.apply(this, arguments);
            
            var resolver = this.getAttribute('resolver') || this.getAttribute('collection');
            if (_.isString(resolver) && this.form.hasResolver(resolver)) {
                this.resolveReference = this.form.getResolver(resolver);
            } else if (_.isString(resolver) && _.isFunction(this[resolver])) {
                this.resolveReference = this[resolver].bind(this);
            } else if (_.isString(resolver) && _.isFunction(this.form[resolver])) {
                this.resolveReference = this.form[resolver].bind(this.form);
            } else if (_.isFunction(resolver)) {
                this.resolveReference = resolver;
            } else if (_.isString(resolver)) {
                this.resolveReference = this.resolveWithCollection.bind(this, resolver);
            };
            
            this.observeKey(this.getKey(), function(formModel, id) { this.onReferenceChange(id); });
            this.assignModel(new this.modelConstructor({ __resolving: true }));
            this.listenToOnce(this.form, 'render:collection', function() {
                this.onReferenceChange(this.getValue(true), true);
            });
            this.on('resolve:done', this.render);
            this.on('resolve:fail', function() {
                this.itemModel.clear({ reset: true });
                this.ui.control.not('button').val('').text('');
            });
        },
        
        setValue: function(value, options) {
            if (_.isObject(value)) {
                if (!value instanceof Backbone.Model) value = _.extend({}, value);
                Form.ObjectControl.prototype.setValue.call(this, value.id, options);
            } else {
                Form.ObjectControl.prototype.setValue.call(this, value, options);
            }
        },
        
        serializeValue: function() {
            return this.itemModel.toJSON();
        },
        
        onReferenceChange: function(id, force) {
            var isResolving = this.itemModel.get('__resolving') && !force;
            var hasChanged = this.itemModel.id !== id;
            if (_.isObject(id)) return; // skip
            if (hasChanged) this.referenceId = id;
            if (isResolving) return;
            if (!hasChanged && !isResolving) return;
            this.assignModel(new this.modelConstructor({ id: id, __resolving: true }));
            this.resolveModel(this.itemModel);
        },
        
        resolveReference: function(model, index) {
            var data = _.omit(model.toJSON(), '__resolving');
            return $.Deferred().resolve(data).promise();
        },
        
        resolvedReference: function(model) {
            if (!_.isObject(model)) return; // model or plain object
            this.itemModel.clear({ reset: true, silent: true });
            if (model instanceof Backbone.Model) {
                model.unset('__resolving', { silent: true })
                this.assignModel(model);
            } else {
                this.itemModel.set(_.extend({}, model));
            }
            this.triggerMethod('resolve:done', this.itemModel);
            // Retry, in case it changed while resolving
            this.onReferenceChange(this.referenceId);
        },
        
        resolveModel: function(model) {
            if (!model || !model.get('__resolving')) return;
            var resolvedReference = this.resolvedReference.bind(this);
            $.when(this.resolveReference(model)).done(function(resolved) {
                setTimeout(function() { resolvedReference(resolved); }, 0);
            }.bind(this)).fail(this.triggerMethod.bind(this, 'resolve:fail', model));
        },
        
        resolveWithCollection: function(collectionName) {
            if (this.form.hasCollection(collectionName)) {
                var collection = this.form.getCollection(collectionName);
                var model = this.itemModel;
                function resolve() {
                    resolved = collection.get(model.id);
                    if (resolved) {
                        this.resolvedReference(resolved);
                    } else {
                        this.triggerMethod('resolve:fail', model);
                    }
                };
                var resolve = resolve.bind(this);
                if (collection.cache && _.isFunction(collection.cache.done)) {
                    collection.cache.done(function() { setTimeout(resolve, 0); });
                } else {
                    setTimeout(resolve, 0);
                }
            } else {
                this.triggerMethod('resolve:fail', this.itemModel);
            }
        },
        
        assignModel: function(model) {
            if (this.itemModel) this.stopListening(this.itemModel);
            this.itemModel = model;
            this.listenTo(this.itemModel, 'change', this.render);
        }
        
    });
    
    return ReferenceControl;
    
});