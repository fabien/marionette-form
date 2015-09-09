define([
    'jquery',
    'underscore',
    'backbone',
    'backbone.marionette',
    'marionette.form',
    'backbone.treeview'
], function($, _, Backbone, Marionette, Form, TreeView) {
    
    var TreeControl = Form.TreeControl = Form.ViewControl.extend(_.defaults({
        
        collectionConstructor: TreeView.Collection,
        
        viewConstructor: TreeView,
        
        itemConstructor: TreeView.Item,
        
        listConstructor: TreeView.List,
        
        ui: {},
        
        defaults: { references: true, helpMessage: '' },
        
        omitAttributes: ['open', 'checked'],
        
        initialize: function(options) {
            this.labelKey = this.getAttribute('labelKey') || this.getOption('labelKey') || 'text';
            this.valueKey = this.getAttribute('valueKey') || this.getOption('valueKey') || 'id';
            var asCollection = this.getAttribute('collection') === true;
            var references = this.getAttribute('references');
            this.model.set('references', references && !asCollection);
            this.collection = this.collection || this.getCollection(options);
            if (asCollection) {
                this.on('view:change', this.onTreeChange);
            } else {
                this.on('view:selection:change', this.onSelectionChange);
            }
        },
        
        extendCollectionConstructor: function(collectionConstructor) {
            var options = { labelKey: this.labelKey, valueKey: this.valueKey };
            options.nodesAttribute = this.getAttribute('nodes') || this.getOption('nodesAttribute') || 'nodes';
            return collectionConstructor.extendWithOptions(options);
        },
        
        getSelection: function(asCollection) {
            if (asCollection) {
                return this.view.selection;
            } else if (this.getAttribute('references')) {
                return this.view.selection.pluck(this.valueKey);
            } else {
                return this.serializeNodes(this.view.selection);
            }
        },
        
        setSelection: function(selected, options) {
            if (this.getAttribute('collection') === true) return;
            var selected = _.isArray(selected) ? selected : [];
            var valueKey = this.valueKey;
            if (!this.getAttribute('references')) {
                selected = _.map(selected, function(item) {
                    return item[valueKey];
                });
            }
            this.view.setSelection(selected, options);
        },
        
        updateSelection: function(options) {
            this.setSelection(this.getValue(true), options);
        },
        
        onSelectionChange: function(collection) {
            if (this.getAttribute('references')) {
                this.setValue(collection.pluck(this.valueKey));
            } else {
                this.setValue(this.serializeNodes(collection));
            }
        },
        
        onTreeChange: function(collection) {
            this.setValue(this.collection.toJSON());
        },
        
        serializeNodes: function(collection, deep) {
            var omit = [].concat(this.getAttribute('omit') || []);
            if (_.isEmpty(omit)) {
                omit = [].concat(this.getOption('omitAttributes') || []);
            }
            return collection.toJSON({ deep: Boolean(deep), omit: omit });
        },
        
        getData: function() {
            if (this.getAttribute('collection') === true) return this.getValue();
            return Form.ViewControl.prototype.getData.apply(this, arguments);
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return this.getFormValue(this.getKey());
            } else if (this.getAttribute('collection') === true) {
                var data = this.serializeNodes(this.collection, true);
                return this.coerceValue(data);
            } else {
                return this.coerceValue(this.getSelection());
            }
        },
        
        render: function() {
            var options = _.last(arguments) || {};
            if (!this.isRendered) {
                Form.ViewControl.prototype.render.apply(this, arguments);
                this.updateSelection(options);
            } else if (options.viewCid !== this.cid) {
                this.setSelection(this.getValue(true), options);
            }
            return this;
        },
        
        initView: function(view) {
            this.listenTo(view.collection, 'sync', function() {
                this.updateSelection();
            });
        },
        
        viewOptions: function() {
            return { settings: this.treeConfig(), collection: this.collection };
        },
        
        treeConfig: function() {
            var reorder = this.getAttribute('reorder');
            var config = this.getAttributes('cascade', 'branches', 'checkbox', 'plugins');
            config.plugins = config.plugins || {};
            if (reorder === 'branch') {
                config.plugins = _.extend({ DnD: { changeParent: false } }, config.plugins);
            } else if (reorder) {
                config.plugins = _.extend({ DnD: {} }, config.plugins);
            }
            
            var itemView = this.getAttribute('itemView');
            if (_.isString(itemView)) itemView = this.form.getRegisteredView(itemView);
            config.ItemConstructor = itemView || TreeView.Item;
            
            var listView = this.getAttribute('listView');
            if (_.isString(listView)) listView = this.form.getRegisteredView(listView);
            config.ListConstructor = listView || TreeView.List;
            
            return config;
        }
        
    }, Form.CollectionMixin));
    
    var TreeSelectControl = Form.TreeSelectControl = Form.QuerySelectControl.extend({
        
        collectionConstructor: TreeView.Collection,
        
        pathSeparator: ' / ',
        
        filterCollection: function(query) {
            var matchModel = this.matchModel.bind(this, query);
            var matches = [];
            this.collection.walk(function(item) {
                if (matchModel(item)) matches.push(item);
            });
            return matches;
        },
        
        formatDataLabel: function(model) {
            var path = model.path(this.labelKey);
            return this.formatPath(path);
        },
        
        formatPath: formatPath
        
    });
    
    var TreeReferencesControl = Form.TreeReferencesControl = Form.ReferencesControl.extend({
        
        collectionConstructor: TreeView.Collection,
        
        pathSeparator: ' / ',
        
        initialize: function(options) {
            this.labelKey = this.getAttribute('labelKey') || this.getOption('labelKey') || 'text';
            this.collection = this.collection || this.getCollection(options);
        },
        
        onSerializeItemValue: function(model, data) {
            data.path = model.path(this.labelKey);
            data.formattedPath = this.formatPath(data.path);
        },
        
        formatPath: formatPath
        
    });
    
    return TreeControl;
    
    function formatPath(path) {
        var separator = this.getAttribute('pathSeparator') || this.getOption('pathSeparator');
        var pathLimit = this.getAttribute('pathLimit') || this.getOption('pathLimit') || 0;
        if (pathLimit) path = path.slice(- pathLimit); // last n segments of path only
        if (pathLimit === 1) return path.join(separator);
        var label = path.pop();
        return path.concat('<strong>' + label + '</strong>').join(separator);
    }
    
});