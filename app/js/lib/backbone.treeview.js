(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['backbone', 'backbone-tree-view'], function(Backbone, BackTree) {
            return factory(Backbone, BackTree);
        });
    } else if (typeof exports !== 'undefined') {
        var Backbone = require('backbone');
        var BackTree = require('backbone-tree-view');
        module.exports = factory(Backbone, BackTree);
    } else {
        factory(root.Backbone, root.BackTree);
    }
}(this, function(Backbone, BackTree) {
    
    var TreeView = BackTree.Tree.extend({
        
        initialize: function(options) {    
            BackTree.Tree.prototype.initialize.apply(this, arguments);
            var cascade = this.settings.get('cascade');
            
            this.selection = new Backbone.Collection();
            
            this.listenTo(this.selection, 'update', function() {
                this.trigger('selection:change', this.selection);
            });
            
            this.listenTo(this.collection, 'change node:change dndStructureChanged', function() {
                this.trigger('change', this.collection);
            });
            
            this.listenTo(this.collection, 'checkboxChanged', function(event, item) {
                var checked = Boolean(item.model.get('checked'));
                if (cascade) {
                    item.model.walk(function(node) {
                        if (node === item.model) return;
                        node.set('checked', checked, { silent: true });
                    });
                }
                this.selection.set(this.getSelection());
            });
        },
        
        getSelection: function() {
            var onlyBranches = this.settings.get('branches');
            var selected = [];
            if (onlyBranches) {
                this.collection.walk(function(node) {
                    var contained = _.any(selected, function(sel) {
                        return sel.contains(node);
                    });
                    if (contained) return;
                    if (node.get('checked')) selected.push(node);
                });
            } else {
                this.collection.walk(function(node) {
                    if (node.get('checked')) selected.push(node);
                });
            }
            return selected;
        },
        
        setSelection: function(ids, options) {
            options = _.extend({}, options);
            var addToSelection = options.add === true;
            var onlyBranches = this.settings.get('branches');
            var cascade = this.settings.get('cascade');
            var self = this;
            ids = [].concat(ids || []);
            this.collection.walk(function(node) {
                var contained = _.any(ids, function(id) {
                    if (node.id === id) return true;
                    if (!cascade) return false;
                    var selected = self.collection.get(id);
                    return selected && selected.contains(node);
                });
                if (addToSelection && node.get('checked')) {
                    // do nothing - keep selected
                } else {
                    node.set('checked', contained, options);
                }
            });
            this.selection.set(this.getSelection(onlyBranches));
        }
        
    });
    
    BackTree.Collection.extendWithOptions = function(options) {
        options = _.extend({}, options);
        var Model = this.prototype.model;
        var mixin = {};
        if (_.isString(options.labelKey)) {
            var labelKey = options.labelKey;
            mixin.getTitle = function() { return this.get(labelKey); }
        }
        if (_.isString(options.valueKey)) {
            mixin.idAttribute = options.valueKey;
        }
        if (_.isString(options.nodesAttribute)) {
            mixin.nodesAttribute = options.nodesAttribute;
        }
        return this.extend({ model: Model.extend(mixin) });
    };
    
    TreeView.Item = BackTree.Item;
    TreeView.List = BackTree.List;
    
    TreeView.Model = BackTree.Model;
    TreeView.Collection = BackTree.Collection.extend({
        model: TreeView.Model
    });
    
    Backbone.TreeView = TreeView;
    
    return TreeView;
    
}));