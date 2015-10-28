define([
    'jquery',
    'underscore',
    'backbone',
    'backbone.marionette',
    'marionette.form'
], function($, _, Backbone, Marionette, Form) {
    
    Form.Templates.Filter = _.template([
        '<div class="filter-label">',
        '  <label class="<%= labelClassName %>"><%= label %></label>',
        '  <% if (subLabel && subLabel.length) { %><span class="sub-label" data-action="show:details"><%= subLabel %></span><% } %>',
        '</div>',
        '<div class="<%= controlsClassName %>">',
        '  <% if (synopsis && synopsis.length) { %><div class="synopsis form-control-static"><%= synopsis %></div><% } %>',
        '  <div class="filter-list<%= scrollable ? " scrollable" : "" %>">',
        '    <% if (input) { %><div class="filter-input"><input type="text" placeholder="<%= placeholder %>" class="<%= controlClassName %>"></div><% } %>',
        '    <div class="nested-controls-wrapper <%= scrollable ? " scroll" : "" %>">',
        '      <div class="nested-controls"></div>',
        '    </div>',
        '    <% if (helpMessage && helpMessage.length) { %><div class="<%= helpClassName %>"><%= helpMessage %></div><% } %>',
        '  </div>',
        '</div>'
    ].join('\n'));
    
    Form.Templates.FilterItem = _.template([
        '<i class="icon <%= icon %>"></i> <span><%- label %></span>'
    ].join('\n'));
    
    Form.Templates.FilterSet = _.template([
        '<div class="filter-item-header <%= collapsed ? " collapsed-set" : "" %>">',
        '  <i class="icon <%= icon %>"></i> <span><%- label %></span>',
        '  <% if (collapsibleSets) { %><span class="toggle-collapse"></span><% } %>',
        '</div>',
        '<div class="filter-items"></div>'
    ].join('\n'));
    
    var FilterItemMixin = Form.FilterItemMixin = {
        
        className: 'filter-item',
        
        selectedClassName: 'selected',
        
        disabledClassName: 'disabled',
        
        triggers: {
            'click': 'click'
        },
        
        ui: {
            icon: '.icon'
        },
        
        getItemLabel: function() {
            return this.parent.getItemLabel(this.model);
        },
        
        getItemIcon: function() {
            return this.parent.getItemIcon(this.model);
        },
        
        getItemValue: function() {
            return this.parent.getItemValue(this.model);
        },
        
        isSelected: function() {
            return this.parent.isSelected(this.model);
        },
        
        isSelectable: function() {
            return this.parent.isSelectable(this.model);
        },
        
        setMatchTerm: function(match, term) {
            match = Boolean(match);
            if (term) {
                this.$el.toggleClass('match', match);
                this.$el.toggleClass('no-match', !match);
            } else {
                this.$el.removeClass('match');
                this.$el.removeClass('no-match');
            }
        },
        
        applyElementState: function() {
            this.$el.toggleClass(this.getOption('selectedClassName'), this.isSelected());
            this.$el.toggleClass(this.getOption('disabledClassName'), !this.isSelectable());
            this.$el.toggleClass('filter-set', Boolean(this.collection));
        },
        
        mixinTemplateHelpers: function(itemData) {
            var data = this.form.mixinTemplateHelpers(data);
            data.control = this.parent.serializeData();
            data.item = Marionette.ItemView.prototype.mixinTemplateHelpers.call(this, itemData);
            data.label = this.getItemLabel();
            data.value = this.getItemValue();
            data.icon = this.getItemIcon();
            data.selected = this.isSelected();
            data.selectable = this.isSelectable();
            data.collapsibleSets = !!this.parent.getAttribute('collapsibleSets');
            if (this.collection) data.children = this.collection.toJSON();
            if (_.isFunction(this.isCollapsed)) data.collapsed = this.isCollapsed();
            return data;
        }
        
    };
    
    function defaultMatcher(term, text) {
        return ('' + text).toUpperCase().indexOf(('' + term).toUpperCase()) >= 0;
    };
    
    // Views
    
    var FilterItemView = Form.FilterItemView = Marionette.ItemView.extend(_.extend({
        
        template: Form.Templates.FilterItem,
        
        constructor: function(options) {
            options = _.extend({}, options);
            var opts = _.omit(options, 'form', 'parent');
            Marionette.ItemView.prototype.constructor.call(this, opts);
            this.form = options.form;
            this.parent = options.parent;
            this.on('render', this.applyElementState);
        }
        
    }, FilterItemMixin));
    
    var FilterSetView = Form.FilterSetView = Marionette.CompositeView.extend(_.extend({
        
        template: Form.Templates.FilterSet,
        
        childView: FilterItemView,
        
        childViewEventPrefix: 'item',
        
        childViewContainer: '.filter-items',
        
        events: {
            'click span.toggle-collapse': 'onToggleCollapse'
        },
        
        constructor: function(options) {
            options = _.extend({}, options);
            var opts = _.omit(options, 'form', 'parent');
            Marionette.CompositeView.prototype.constructor.call(this, opts);
            this.form = options.form;
            this.parent = options.parent;
            this.on('render', this.applyElementState);
            var childrenKey = this.parent.childrenKey || 'children';
            var children = this.model.get(childrenKey);
            if (_.isArray(children)) this.collection = new Form.Collection(children);
            if (this.parent.isCollapsedSet(this)) {
                this.once('render', function() {
                    this.$el.addClass('collapsed-set');
                    this.getItemsContainer().css('display', 'none');
                });
            }
            this.on('before:render', this.captureDisplayState);
            this.on('render', this.applyDisplayState);
        },
        
        buildChildView: function(model, ChildViewClass, childViewOptions) {
            var options = _.extend({ model: model, form: this.form, parent: this.parent }, childViewOptions);
            _.extend(options, this.parent.getAttribute('item'));
            if (options.template) options.template = this.parent.lookupTemplate(options.template);
            var childView = new ChildViewClass(options);
            this.initChildView(childView);
            return childView;
        },
        
        initChildView: function(view) {},
        
        getItemsContainer: function() {
            return this.$(_.result(this, 'childViewContainer'));
        },
        
        getData: function() {
            var state = this.getSelectionState();
            if (state === -1) {
                return [this.getItemValue()];
            } else if (state === 1) {
                return this.getSelectedValues();
            } else if (this.isSelected()) {
                return [this.getItemValue()];
            } else {
                return [];
            }
        },
        
        // Collapsing
        
        isCollapsed: function() {
            if (!this.isRendered) return this.parent.isCollapsedSet(this);
            return !this.getItemsContainer().is(':visible');
        },
        
        toggleSet: function(options, callback) {
            if (this.isCollapsed()) {
                return this.uncollapseSet(options, callback);
            } else {
                return this.collapseSet(options, callback);
            }
        },
        
        collapseSet: function(options, callback) {
            if (_.isFunction(options)) callback = options, options = {};
            if (!this.isCollapsed() && this.children.length > 0) {
                this.triggerMethod('before:collapse', true);
                var promise = this.getItemsContainer().slideUp(options).promise();
                promise.done(function() {
                    if (_.isFunction(callback)) callback(false);
                    this.$el.addClass('collapsed-set');
                    this.triggerMethod('collapse', false);
                }.bind(this));
                return promise;
            } else {
                return $.Deferred().resolve().promise();
            }
        },
        
        uncollapseSet: function(options, callback) {
            if (_.isFunction(options)) callback = options, options = {};
            if (this.isCollapsed() && this.children.length > 0) {
                this.triggerMethod('before:collapse', false);
                var promise = this.getItemsContainer().slideDown(options).promise();
                promise.done(function() {
                    if (_.isFunction(callback)) callback(true);
                    this.$el.removeClass('collapsed-set');
                    this.triggerMethod('collapse', true);
                }.bind(this));
                return promise;
            } else {
                return $.Deferred().resolve().promise();
            }
        },
        
        // Selection
        
        isSelected: function() {
            return this.parent.isSelected(this.model);
        },
        
        getItemValue: function() {
            return this.parent.getItemValue(this.model);
        },
        
        getItemValues: function() {
            return this.collection.map(function(model) {
                return this.parent.getItemValue(model);
            }.bind(this));
        },
        
        getSelectedValues: function() {
            var values = this.getItemValues();
            var selected = this.parent.getSelectedValues();
            return _.intersection(values, selected);
        },
        
        getSelectionState: function() {
            var values = this.getItemValues();
            var selected = this.parent.getSelectedValues();
            var selectionCount = _.intersection(values, selected).length;
            if (selectionCount === values.length) {
                return -1; // all
            } else if (selectionCount > 0) {
                return 1; // some
            } else {
                return 0; // none
            }
        },
        
        updateSelectedState: function() {
            if (!this.parent.getAttribute('multiple')) return;
            var state = this.getSelectionState();
            if (state === 0) { // none
                this.parent.deselectValue(this.getItemValue());
            } else {
                this.parent.selectValue(this.getItemValue(), true);
            }
        },
        
        // Interaction
        
        onToggleCollapse: function(event) {
            event.preventDefault();
            event.stopPropagation();
            this.toggleSet('fast');
        },
        
        onClick: function(info) {
            if (!this.parent.getAttribute('multiple')) {
                this.parent.selectValue(this.getItemValue());
            } else if (this.getSelectionState() !== 0) {
                var values = this.getItemValues();
                values.unshift(this.getItemValue());
                this.parent.deselectValue(values);
            } else if (this.parent.getAttribute('selectChildren')) {
                var values = this.getItemValues();
                values.unshift(this.getItemValue());
                this.parent.selectValue(values);
            }
        },
        
        onItemClick: function(childView) {
            if (this.parent.onItemClick) this.parent.onItemClick(childView);
            this.updateSelectedState();
        },
        
        // Display state
        
        captureDisplayState: function() {
            this._isCollapsed = this.isCollapsed();
        },
        
        applyDisplayState: function() {
            if (this._isCollapsed) this.collapseSet(0);
            var partial = this.getSelectionState() === 1;
            this.$el.toggleClass('partial-selection', partial);
        }
        
    }, FilterItemMixin));
    
    // Controls
    
    var BaseFilterControl = Form.BaseFilterControl = Form.extendView(Marionette.CompositeView, _.extend({
        
        template: Form.Templates.Filter,
        
        childView: FilterItemView,
        
        childViewContainer: '.nested-controls',
        
        childViewEventPrefix: 'item',
        
        getChildView: function(model) {
            var viewClass = model.get('view') || this.getOption('childView');
            if (_.isString(viewClass)) viewClass = this.form.getRegisteredView(viewClass);
            return viewClass || FilterItemView;
        },
        
        buildChildView: function(model, ChildViewClass, childViewOptions) {
            var options = _.extend({ model: model, form: this.form, parent: this }, childViewOptions);
            _.extend(options, this.getAttribute('item'));
            if (options.template) options.template = this.lookupTemplate(options.template);
            var childView = new ChildViewClass(options);
            this.initChildView(childView);
            return childView;
        },
        
        initChildView: function(view) {},
        
        // Item values
        
        getItemLabel: function(model) {
            return model.get(this.labelKey);
        },
        
        getItemIcon: function(model) {
            var icon = this.model.get(this.iconKey);
            if (_.isString(icon)) return icon;
        },
        
        getItemValue: function(model) {
            return model.get(this.valueKey);
        },
        
        getItemValues: function() {
            var itemValues = [];
            this.collection.each(function(model) {
                if (!this.isSelectable(model)) return;
                itemValues.push(this.getItemValue(model));
            }.bind(this)); 
            return itemValues;
        },
        
        ensureValue: function(force) {
            if (!this.getAttribute('ensureValue') && !force) return;
            var values = this.getItemValues();
            var currentValue = this.getValue(true);
            currentValue = [].concat(currentValue || []);
            var intersection = _.intersection(values, currentValue);
            if (_.isEmpty(intersection)) {
                this.forceValue(_.first(values));
            } else {
                this.forceValue(intersection);
            }
        },
        
        isSelectable: function(model) {
            if (!this.evaluateAttribute('selectable')) return false;
            var selectedValues = this.getSelectedValues();
            if (this.getAttribute('multiple') && this.getAttribute('limit') > 0
                && selectedValues.length >= this.getAttribute('limit')
                && !_.include(selectedValues, this.getItemValue(model))) {
                return false;
            }
            if (!model.has(this.selectableKey)) return true;
            return model.get(this.selectableKey);
        }
        
    }, Form.CollectionMixin), function(options) {
        this.collection = this.collection || this.getCollection(options);
        
        this.labelKey = this.getAttribute('labelKey') || this.getOption('labelKey') || 'label';
        this.valueKey = this.getAttribute('valueKey') || this.getOption('valueKey') || 'id';
        this.dataKey = this.getAttribute('dataKey') || this.getOption('dataKey');
        this.iconKey = this.getAttribute('iconKey') || this.getOption('iconKey') || 'icon';
        this.selectableKey = this.getAttribute('selectableKey') || this.getOption('selectableKey') || 'selectable';
        this.childrenKey = this.getAttribute('childrenKey') || this.getOption('childrenKey') || 'children';
        
        this.listenTo(this.collection, 'reset sync change update', this.ensureValue.bind(this, false));
        this.listenTo(this.collection, 'change:' + this.selectableKey, this.ensureValue.bind(this, true));
        this.listenTo(this.collection, 'reset sync change update', this.render);
        
        if (this.getAttribute('ensureValue')) {
            this.once('render', this.ensureValue);
            this.on('value:change', this.ensureValue);
        }
    });
    
    var FilterControl = Form.FilterControl = BaseFilterControl.extend({
        
        defaults: {
            subLabel: false,
            input: false,
            multiple: false,
            nullValue: false,
            ensureValue: false,
            selectable: true,
            collapsible: true,
            scrollable: false,
            autoClose: false,
            escape: true,
            helpMessage: '',
            defaultLabel: '',
            placeholder: '',
            limit: -1,              // max. items for selection
            maxValues: -1,          // max. items for synopsis
            collapseTrigger: null,  // jQuery selector,
            icon: 'glyphicon glyphicon-unchecked',
            selectedIcon: 'glyphicon glyphicon-check',
            columns: 1,
            columnPrefix: 'col-sm-'
        },
        
        ui: {
            control: '.filter-input input',
            scrollContainer: '.scroll',
            list: '.filter-list',
            subLabel: '.sub-label'
        },
        
        controlEvents: {
            'keyup @ui.control': 'onTermChange',
            'click': 'onToggleList'
        },
        
        constructor: function(options) {
            this.onTermChange = _.debounce(this.onTermChange, 100);
            BaseFilterControl.prototype.constructor.apply(this, arguments);
            var termMatcher = $.fn.select2 ? $.fn.select2.defaults.matcher : defaultMatcher;
            this.matcher = this.getOption('matcher') || termMatcher;
            if (this.getAttribute('collapsible')) {
                this.once('render', function() { 
                    this.$el.addClass('collapsed');
                    this.ui.list.css('display', 'none');
                });
            }
            this.on('before:render', this.captureDisplayState);
            this.on('render', this.applyDisplayState);
            this.listenTo(this.model, 'change:synopsis', this.render);
        },
        
        getItemIcon: function(model) {
            var icon = BaseFilterControl.prototype.getItemIcon.apply(this, arguments);
            if (_.isString(icon)) return icon;
            return this.getAttribute(this.isSelected(model) ? 'selectedIcon' : 'icon');
        },
        
        getData: function() {
            var dataValues = [];
            var values = [].concat(this.getValue(true) || []);
            this.collection.each(function(model) {
                var v = this.getItemValue(model);
                if (!_.include(values, v)) return;
                if (this.dataKey === '*') {
                    dataValues.push(model.toJSON());
                } else if (this.dataKey) {
                    dataValues.push(model.get(this.dataKey));
                } else {
                    dataValues.push(v);
                }
            }.bind(this));
            return this.isMultiSelection() ? dataValues : _.first(dataValues);
        },
        
        getValue: function(fromModel) {
            // always use fromModel: true
            return BaseFilterControl.prototype.getValue.call(this, true);
        },
        
        setValue: function(value, options) {
            if (this.isMultiSelection()) {
                value = [].concat(value || []);
                if (this.getAttribute('limit') > 0 && value.length >= this.getAttribute('limit')) {
                    value = value.slice(0, this.getAttribute('limit'));
                }
                if (_.isEmpty(value)) return this.clearValue();
            } else if (_.isUndefined(value) || (_.isArray(value) && _.isEmpty(value))) {
                return this.clearValue();
            } else {
                value = _.isArray(value) ? _.first(value) : value;
            }
            return BaseFilterControl.prototype.setValue.call(this, value, options);
        },
        
        unsetValue: function(options) {
            if (this.getAttribute('ensureValue')) {
                var itemValues = this.getItemValues();
                if (_.isEmpty(itemValues)) return;
                var values = [].concat(this.getValue(true) || []);
                if (_.isEmpty(values)) {
                    values = itemValues;
                } else {
                    values = _.intersection(values, itemValues);
                    if (_.isEmpty(values)) values = itemValues;
                }
                return this.forceValue(_.first(values));
            }
            return BaseFilterControl.prototype.unsetValue.call(this, options);
        },
        
        clearValue: function(options) {
            if (!this.evaluateAttribute('nullValue')) {
                this.unsetValue(options);
            } else if (this.isMultiSelection()) {
                this.setFormValue(this.getKey(), [], options);
            } else {
                this.setFormValue(this.getKey(), null, options);
            }
        },
        
        setSynopsis: function(value) {
            this.model.set('synopsis', value);
        },
        
        unsetSynopsis: function(value) {
            this.model.unset('synopsis');
        },
        
        // Selection
        
        isMultiSelection: function() {
            return this.evaluateAttribute('multiple');
        },
        
        getSelectedValues: function() {
            return [].concat(this.getValue(true) || []);
        },
        
        getSelection: function() {
            var values = this.getSelectedValues();
            return this.collection.select(function(model) {
                return _.include(values, this.getItemValue(model));
            }.bind(this));
        },
        
        isSelected: function(model) {
            var values = [].concat(this.getValue(true) || []);
            var value = this.getItemValue(model);
            return _.include(values, value);
        },
        
        selectAll: function() {
            var values = this.getItemValues();
            if (values.length > 0) {
                this.forceValue(values);
            } else {
                this.deselectAll();
            }
        },
        
        deselectAll: function() {
            this.clearValue();
        },
        
        selectValue: function(value, add) {
            var currentValue = this.getValue(true);
            if (this.isMultiSelection()) {
                currentValue = [].concat(currentValue || []);
                value = [].concat(value || []);
                if (!add && _.intersection(currentValue, value).length > 0) {
                    value = _.difference(currentValue, value);
                } else {
                    value = _.union(currentValue, value);
                }
                if (value.length > 0) {
                    this.forceValue(value);
                } else {
                    this.resetValue();
                }
            } else if (currentValue === value) {
                this.resetValue(); // toggle off
            } else {
                this.forceValue(value);
            }
        },
        
        deselectValue: function(value) {
            var currentValue = this.getValue(true);
            if (this.isMultiSelection()) {
                currentValue = [].concat(currentValue || []);
                value = [].concat(value || []);
                value = _.difference(currentValue, value);
                if (value.length > 0) {
                    this.forceValue(value);
                } else {
                    this.resetValue();
                }
            } else if (currentValue === value) {
                this.resetValue(); // toggle off
            }
        },
        
        // Rendering
        
        serializeSynopsis: function(data) {
            var maxValues = this.getAttribute('maxValues') || 1;
            var ellipsis = maxValues > 0 && data.selection.length > maxValues;
            var escape = this.getAttribute('escape');
            var models = data.selection;
            if (maxValues > 0) models = models.slice(0, maxValues);
            var labels = _.map(models, function(model) {
                var label = this.getItemLabel(model);
                return escape ? _.escape(label) : label;
            }.bind(this));
            if (ellipsis) labels.push('&hellip;');
            return labels.join(', ');
        },
        
        mixinTemplateHelpers: function(data) {
            data = BaseFilterControl.prototype.mixinTemplateHelpers.call(this, data);
            data.selection = this.getSelection();
            data.isEmpty = _.isEmpty(data.selection);
            if (_.isString(data.synopsis)) {
                data.synopsis = data.synopsis;
            } else if (data.isEmpty) {
                data.synopsis = this.getAttribute('defaultLabel') || '';
            } else {
                data.synopsis = this.serializeSynopsis(data);
            }
            return data;
        },
        
        attachHtml: function(collectionView, childView, index) {
            var columns = this.getAttribute('columns');
            if (_.isNumber(columns) && columns) {
                columns = columns > 0 ? columns : this.collection.length;
                var colPrefix = this.getAttribute('columnPrefix') || 'col-sm-';
                var colClass = colPrefix + (12 / columns);
                var total = this.collection.length;
                var limit = Math.ceil(total / columns);
                var offset = index + 1;
                var column = Math.ceil(offset / limit);
                var selector = '[data-col="' + column + '"]';
                
                var container = this.$(_.result(this, 'childViewContainer'));
                if (!container.is('ul')) container.addClass('row');
                
                var $column = container.children(selector);
                if ($column.length === 0) {
                    container.append('<div class="col ' + colClass + '" data-col="' + column + '"></div>');
                    $column = container.children(selector);
                }
                $column.append(childView.el);
            } else {
                BaseFilterControl.prototype.attachHtml.apply(this, arguments);
            }
        },
        
        // Native Select support
        
        createNativeControl: function() {
            var control = this;
            var elem = $('<select>');
            elem.addClass('mobile-trigger');
            elem.prop('multiple', control.isMultiSelection());
            control.collection.each(function(model) {
                var value = control.getItemValue(model);
                var label = control.getItemLabel(model);
                elem.append('<option value="' + value + '">' + label+ '</option>');
            });
            elem.val(control.getSelectedValues());
            elem.on('blur', function() {
                var values = [].concat(elem.val() || []);
                var matches = [];
                control.collection.each(function(model) {
                    var value = control.getItemValue(model);
                    if (_.contains(values, String(value))) {
                        matches.push(value);
                    }
                });
                control.forceValue(matches);
            });
            return elem;
        },
        
        // Items
        
        filterChildrenByTerm: function(term) {
            this.children.each(function(childView) {
                var match = false;
                if (!term) {
                    match = true;
                } else {
                    var text = this.getItemLabel(childView.model);
                    match = this.matcher(term, text);
                }
                childView.setMatchTerm(match, term);
            }.bind(this));
        },
        
        toggleList: function(options, callback) {
            if (!this.evaluateAttribute('collapsible')) return; // skip
            var isCollapsed = this.isCollapsed();
            options = _.isUndefined(options) ? 'fast' : options;
            if (isCollapsed) {
                return this.uncollapseList(options, callback);
            } else {
                return this.collapseList(options, callback);
            }
        },
        
        collapseList: function(options, callback) {
            var collapsible = this.evaluateAttribute('collapsible');
            if (_.isFunction(options)) callback = options, options = {};
            if (collapsible && !this.isCollapsed() && this.children.length > 0) {
                this.triggerMethod('before:collapse', false);
                var promise = this.ui.list.slideUp(options).promise();
                promise.done(function() {
                    if (_.isFunction(callback)) callback(true);
                    this.$el.removeClass('expanded');
                    this.$el.addClass('collapsed');
                    this.triggerMethod('collapse', true);
                }.bind(this));
                return promise;
            } else {
                return $.Deferred().resolve().promise();
            }
        },
        
        uncollapseList: function(options, callback) {
            var collapsible = this.evaluateAttribute('collapsible');
            if (_.isFunction(options)) callback = options, options = {};
            if (collapsible && this.isCollapsed() && this.children.length > 0) {
                this.triggerMethod('before:collapse', true);
                var promise = this.ui.list.slideDown(options).promise();
                promise.done(function() {
                    if (_.isFunction(callback)) callback(false);
                    this.$el.removeClass('collapsed');
                    this.$el.addClass('expanded');
                    this.triggerMethod('collapse', false);
                }.bind(this));
                return promise;
            } else {
                return $.Deferred().resolve().promise();
            }
        },
        
        isCollapsed: function() {
            if (!this.isRendered) return false;
            return this.ui.list && !this.ui.list.is(':visible');
        },
        
        // Interaction
        
        onItemClick: function(childView) {
            var isSelectable = this.isSelectable(childView.model);
            if (!isSelectable || this.isImmutable()) return;
            if (this.getAttribute('autoClose')) {
                this.once('render', this.collapseList.bind(this, 'fast'));
            }
            var value = this.getItemValue(childView.model);
            this.selectValue(value);
        },
        
        onToggleList: function(event) {
            var selector = this.getAttribute('collapseTrigger');
            this.triggerMethod('toggle', event); // cancel with: stopPropagation()
            if (this.isCollapsible() && !event.isPropagationStopped()) {
                if (event.target === this.ui.control[0]) return; // skip
                if (_.isString(selector) && !$(event.target).is(selector)) {
                    return; // skip
                }
                event.preventDefault();
                event.stopPropagation();
                this.toggleList();
            }
        },
        
        onTermChange: function(event) {
            if (event.which === 27) {
                event.preventDefault();
                this.filterChildrenByTerm();
                return this.ui.control.val('');
            }
            this.filterChildrenByTerm(this.ui.control.val());
        },
        
        isCollapsible: function() {
            if (!this.evaluateAttribute('collapsible')) return false;
            return !this.isImmutable();
        },
        
        // Display state
        
        captureDisplayState: function() {
            if (!this.isRendered) return;
            this._isCollapsed = this.isCollapsed();
            this._scrollPosition = this.ui.scrollContainer.scrollTop();
        },
        
        applyDisplayState: function() {
            this.$el.toggleClass('collapsible', this.isCollapsible());
            this.ui.scrollContainer.scrollTop(this._scrollPosition || 0);
            var isCollapsed = this._isCollapsed;
            if (this.hasAttribute('open')) {
                if (this.evaluateAttribute('open')) {
                    this.uncollapseList(0);
                } else {
                    this.collapseList(0);
                }
            } else if (isCollapsed) {
                this.collapseList(0);
            }
        }
        
    });
    
    var FilterSetControl = Form.FilterSetControl = FilterControl.extend({
        
        childView: FilterSetView,
        
        constructor: function(options) {
            FilterControl.prototype.constructor.apply(this, arguments);
            this._collapsedSets = [];
            if (this.getAttribute('collapsibleSets')) {
                this.once('render', function() { this.collapseSets(0); });
            }
        },
        
        getData: function() {
            if (this.getAttribute('normalizeSets') === false) {
                return this.getValue(true);
            }
            var data = [];
            this.children.each(function(view) {
                data = data.concat(view.getData());
            });
            return _.uniq(data);
        },
        
        getSelection: function() {
            return this.getSelectionForCollection(this.getData(), this.collection);
        },
        
        getSelectionForCollection: function(values, collection) {
            var self = this;
            var selection = [];
            collection.each(function(model) {
                var children = model.get(self.childrenKey);
                if (_.include(values, self.getItemValue(model))) {
                    selection.push(model);
                }
                if (_.isArray(children)) {
                    var collection = new Form.Collection(children);
                    var sel = self.getSelectionForCollection(values, collection);
                    selection = selection.concat(sel);
                }
            });
            return selection;
        },
        
        // Collapse
        
        isCollapsedSet: function(view) {
            var value = this.getItemValue(view.model);
            return _.include(this._collapsedSets, value);
        },
        
        toggleSets: function(options) {
            if (this._collapsedSets.length > 0) {
                return this.uncollapseSets(options);
            } else {
                return this.collapseSets(options);
            }
        },
        
        collapseSets: function(options) {
            var collapsedSets = [];
            var promises = this.children.map(function(view) {
                collapsedSets.push(this.getItemValue(view.model));
                return view.collapseSet(options);
            }.bind(this));
            return $.when(promises).done(function() {
                this._collapsedSets = collapsedSets;
                this.triggerMethod('collapse:sets', true);
            }.bind(this)).promise();
        },
        
        uncollapseSets: function(options) {
            var promises = this.children.map(function(view) {
                return view.uncollapseSet(options);
            });
            return $.when(promises).done(function() {
                this._collapsedSets = [];
                this.triggerMethod('collapse:sets', false);
            }.bind(this)).promise();
        },
        
        onActionShowDetails: function(event) {
            event.preventDefault();
            event.stopPropagation();
            this.uncollapseList('fast').done(function() {
                this.toggleSets('fast');
            }.bind(this));
        },
        
        mixinTemplateHelpers: function(data) {
            data = BaseFilterControl.prototype.mixinTemplateHelpers.call(this, data);
            data.selection = this.getSelection();
            data.isEmpty = _.isEmpty(data.selection);
            if (data.isEmpty) {
                data.synopsis = this.getAttribute('defaultLabel') || '';
            } else {
                data.synopsis = this.serializeSynopsis(data);
            }
            return data;
        },
        
        captureDisplayState: function() {
            if (this.getAttribute('collapsibleSets')) {
                this._collapsedSets = [];
                this.children.each(function(view) {
                    if (!view.isCollapsed()) return;
                    this._collapsedSets.push(this.getItemValue(view.model));
                }.bind(this));
            }
            FilterControl.prototype.captureDisplayState.apply(this, arguments);
        }
        
    });
    
    return FilterControl;
    
});