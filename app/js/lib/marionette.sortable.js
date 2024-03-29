// Marionette.SortableCollectionView
//
// Copyright (c) 2014 orangain + atelier fabien 2015
// Distributed under MIT License
// https://github.com/orangain/marionette-sortable

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['marionette', 'underscore', 'dragula'], factory);
    } else if (typeof exports !== 'undefined') {
        // Node/CommonJS
        var Marionette = require('backbone.marionette');
        var _ = require('underscore');
        var dragula = require('dragula');
        factory(Marionette, _, dragula);
    } else {
        // Browser globals
        factory(root.Marionette, root._, root.dragula);
    }
}(this, function(Marionette, _, dragula) {
    
    Marionette.SortableBehavior = Marionette.Behavior.extend({
        
        onSortUpdate: function(el, target, source) {
            var $childElement = $(el);
            var $children = $childElement.parent().children();
            var newIndex = $children.index($childElement);
            var collection = this.view.collection;
            var model = collection.get($childElement.data('model-cid'));
            if (!model) return;
            var oldIndex = collection.indexOf(model);
            if (newIndex === -1 || oldIndex === -1) return;
            var info = { from: oldIndex, to: newIndex, sortable: true };
            collection.remove(model, { silent: true });
            collection.add(model, { at: newIndex, silent: true });
            collection.trigger('update', collection, info);
            collection.trigger('reorder', model, collection, info);
            this.view.triggerMethod('sortable:reorder', model, collection, info);
        },
        
        onSortRemove: function(el, container) {
            var $childElement = $(el);
            var collection = this.view.collection;
            var model = collection.get($childElement.data('model-cid'));
            if (model) collection.remove(model, { sortable: true });
            if (model) this.view.triggerMethod('sortable:remove', model, collection);
        },
        
        onRender: function() {
            if (this.sortable) this.sortable.destroy();
            var options = _.omit(this.options, 'behaviorClass', 'dragMirrorContainer');
            var dragMirrorContainer = this.view.getOption('dragMirrorContainer');
            if (_.isUndefined(dragMirrorContainer)) {
                dragMirrorContainer = this.view.getOption('childViewContainer');
            }
            if (_.isString(dragMirrorContainer)) {
                options.mirrorContainer = this.$(dragMirrorContainer)[0];
            } else if (dragMirrorContainer !== false) {
                options.mirrorContainer = this.el;
            }
            this.sortable = dragula(this.getSortableContainer().toArray(), _.extend({
                isContainer: this.dragIsContainer.bind(this),
                moves: this.dragMoves.bind(this),
                accepts: this.dragAccepts.bind(this),
                invalid: this.dragInvalid.bind(this)
            }, options));
            this.sortable.on('drop', this.onSortUpdate.bind(this));
            this.sortable.on('remove', this.onSortRemove.bind(this));
            this.view.triggerMethod('init:sortable', this.sortable);
        },
        
        onDestroy: function() {
            if (this.sortable) this.sortable.destroy();
        },
        
        dragIsContainer: function(el) {
            return false;
        },
        
        dragMoves: function(el, source, handle) {
            if (this.options.handle !== false) {
                var selector = _.isString(this.options.handle) ? this.options.handle : '.drag-handle';
                return $.contains(el, $(handle).closest(selector)[0]);
            }
            return true;
        },
        
        dragAccepts: function(el, target, source, sibling) {
            return true;
        },
        
        dragInvalid: function(el, target) {
            return false;
        },
        
        onAddChild: function(view) {
            var model = view.itemModel || view.model;
            view.$el.attr('data-model-cid', model.cid);
        },
        
        getSortableContainer: function() {
            var selector = this.getOption('selector') || this.view.getOption('selector');
            if (_.isString(selector))
                return this.$(selector).eq(0);
            if (_.isFunction(this.view.getSortableContainer)) {
                return this.view.getSortableContainer(this.view);
            } else if (_.isFunction(this.view.getChildViewContainer)) {
                return this.view.getChildViewContainer(this.view);
            } else {
                return this.$el;
            }
        }
        
    });

    Marionette.SortableCollectionView = Marionette.CollectionView.extend({

        constructor: function(options) {
            this.behaviors = _.result(this, 'behaviors') || {};
            this.behaviors._Sortable = _.extend({
                behaviorClass: Marionette.SortableBehavior
            }, _.extend({}, _.result(this, 'sortableOptions'), options.sortableOptions));
            Marionette.CollectionView.apply(this, arguments);
        }

    });
    
    return Marionette.SortableBehavior;

}));
