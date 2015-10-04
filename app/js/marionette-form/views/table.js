define([
    'moment',
    'backbone',
    'backbone.marionette',
    'marionette.form',
    'comparators'
], function(moment, Backbone, Marionette, Form, comparators) {
    
    Form.Templates.TableView = _.template([
        '<table class="<%= tableClass %>">',
        '  <% if (obj.header) { %><thead></thead><% } %>',
        '  <tbody></tbody>',
        '</table>'
    ].join('\n'));
    
    Form.Templates.TableHeader = _.template('<tr></tr>');
    
    Form.Templates.TableHeaderColumn = _.template([
        '<%= obj.header || obj.label %>',
        '<% if (obj.sort) { %><span class="sort-dir"></span><% } %>'
    ].join('\n'));
    
    var TableColumnControl = Form.TableColumnControl = Form.DefaultControl.extend({});
    
    var TableHeaderColumnControl = Form.TableHeaderColumnControl = TableColumnControl.extend({
        
        className: '',
        
        template: Form.Templates.TableHeaderColumn,
        
        controlTriggers: {
            'click': 'click'
        },
        
        isSortable: function() {
            return this.getAttribute('sort') && this.form.callDelegate('isSortable', this);
        },
        
        getSortDirection: function() {
            var direction = this.form.callDelegate('getSortDirection', this);
            if (_.isNumber(direction)) return direction;
            return this.getAttribute('sortDirection') || 0;
        },
        
        refreshView: function() {
            TableColumnControl.prototype.refreshView.apply(this, arguments);
            var direction = this.getSortDirection();
            var sortable = this.isSortable();
            this.enableClassName('sort', sortable);
            this.enableClassName('sort-asc', sortable && direction === 1);
            this.enableClassName('sort-desc', sortable && direction === -1);
        },
        
        serializeData: function() {
            var data = TableColumnControl.prototype.serializeData.apply(this, arguments);
            data.sort = this.isSortable();
            if (data.sort) data.sortDirection = this.getSortDirection();
            if (this.hasAttribute('header')) {
                var header = this.getAttribute('header');
                if (_.isObject(header)) _.extend(data, header);
                if (data.header === false) data = _.omit(data, 'header', 'label');
            } else if (this.getAttribute('control') === 'button') {
                data.label = '';
            }
            return data;
        },
        
        onClick: function() {
            if (!this.isSortable()) return;
            var direction = this.getSortDirection();
            if (direction === 0) {
                direction = 1;
            } else if (direction === 1) {
                direction = -1;
            } else if (direction === -1) {
                direction = 0;
            }
            this.triggerMethod('sort', direction);
        }
        
    });
    
    var TableRowView = Marionette.Form.TableRowView = Form.ItemView.extend({
        
        tagName: 'tr',
        
        constructor: function(options) {
            Form.ItemView.prototype.constructor.apply(this, arguments);
            this.on('control:render', this.setColumnWidth);
        },
        
        childViewOptions: function() {
            return { tagName: 'td', unwrap: true };
        },
        
        setColumnWidth: function(control, nonRecursive) {
            var isVisible = control.isVisible();
            var count = this.children.length - (isVisible ? 0 : 1);
            
            // numeric width are assumed to be percentages, strings (with their units) are taken as-is;
            // a * wildcard indicates a calculated equal with:
            
            var width = this.callDelegate('getControlWidth', control) || control.getAttribute('width');
            width = _.isString(width) ? width : (_.isNumber(width) ? width + '%' : null);
            if (width === '*') width = Math.floor(100 / count) + '%';
            
            if (!_.isNull(width)) control.$el.css('width', isVisible ? width : 0);
            
            if (nonRecursive === true) return;
            this.children.each(function(view) {
                if (view === control) return;
                this.setColumnWidth(view, true);
            }.bind(this));
        }
        
    });
    
    var TableHeaderView = Form.TableHeaderView = TableRowView.extend({
        
        tagName: 'th',
        
        template: Form.Templates.TableHeader,
        
        childView: TableHeaderColumnControl,
        
        childViewContainer: 'tr',
        
        enforceDefinitions: false,
        
        childViewOptions: function() {
            return { tagName: 'th', unwrap: true };
        },
        
        getChildView: function(model) {
            return this.getOption('childView');
        }
        
    });
    
    var TableView = Form.TableView = Form.CollectionView.extend({
        
        header: true,
        
        layout: 'table',
        
        className: 'form-table',
        
        template: Form.Templates.TableView,
        
        ui: {
            head: 'thead',
            body: 'tbody'
        },
        
        childView: TableRowView,
        
        childViewContainer: 'tbody',
        
        defaultControl: 'table-column',
        
        defaults: {
            tableClass: 'table',
            sort: true
        },
        
        childViewOptions: {
            classes: { form: 'form-table-row' }
        },
        
        headerView: TableHeaderView,
        
        headerViewOptions: {},
        
        sortByMultiple: false,
        
        constructor: function(options) {
            Form.CollectionView.prototype.constructor.apply(this, arguments);
            var renderHeader = this.model.has('header') ? this.model.get('header') : this.getOption('header');
            var defaultComparator = this.getOption('comparator');
            if (defaultComparator) this.setViewComparator(defaultComparator);
            this._sortState = [];
            this.model.set('header', renderHeader);
            if (renderHeader) {
                this.header = this.buildHeaderView(options.header);
                this.listenTo(this.header, 'all', this._handleHeaderEvent);
                this.on('render', this.renderHeader);
                this.on('destroy', this.destroyHeader);
            }
        },
        
        // Sorting
        
        setViewComparator: function(comparator) {
            if (_.isFunction(comparator)) {
                this.viewComparator = defaultComparator;
            } else if (_.isArray(comparator)) {
                this.viewComparator = comparators.sortByAttribute(comparator[0], comparator[1]);
            } else if (_.isString(comparator)) {
                this.viewComparator = comparators.sortByAttribute(comparator);
            }
            this.render();
        },
        
        sortByAttribute: function(attribute, direction) {
            if (attribute === false) {
                this._sortState = [];
            } else if (direction === 0) {
                this._sortState = _.reject(this._sortState, function(spec) {
                    return spec.attr === attribute;
                });
            } else if (direction === -1 || direction === 1) {
                var spec = _.where(this._sortState, { attr: attribute })[0];
                if (spec) {
                    spec.dir = direction;
                } else if (this.getOption('sortByMultiple')) {
                    this._sortState.unshift({ attr: attribute, dir: direction });
                } else {
                    this._sortState = [{ attr: attribute, dir: direction }];
                }
            }
            if (_.isEmpty(this._sortState)) {
                delete this.viewComparator;
                var defaultComparator = this.getOption('comparator');
                if (defaultComparator) this.setViewComparator(defaultComparator);
            } else {
                var specs = _.map(this._sortState, function(spec) {
                    return [spec.attr, spec.dir];
                });
                this.viewComparator = comparators.sortByAttributes.apply(null, specs);
                this.render();
            }
        },
        
        getSortDirection: function(control) {
            var spec = _.where(this._sortState, { attr: control.getKey() })[0];
            return (spec && spec.dir) || 0;
        },
        
        isSortable: function() {
            return Boolean(this.model.get('sort'));
        },
        
        onHeaderControlSort: function(header, control, direction) {
            this.sortByAttribute(control.getKey(), direction);
        },
        
        // Header
        
        buildHeaderView: function(options) {
            var HeaderView = this.getOption('headerView');
            options = _.extend({}, _.result(this, 'headerViewOptions'), options);
            options.formDelegate = this;
            options.collection = this.fields;
            return new HeaderView(options);
        },
        
        renderHeader: function() {
            if (this.header) this.header.setElement(this.ui.head).render();
        },
        
        destroyHeader: function() {
            if (this.header) this.header.destroy();
        },
        
        _handleHeaderEvent: function(eventName) {
            if (!this.header) return;
            this.triggerMethod.apply(this, ['header:' + eventName, this.header].concat(_.rest(arguments)));
        }
        
    });
    
    // var Table = Form.Table = Form.View.extend({
    //     
    //     // template: Form.Templates.Table,
    //     
    //     // childViewContainer: '.form-controls',
    //     
    //     // behaviors: {
    //     //     sortable: {
    //     //         behaviorClass: Marionette.SortableBehavior,
    //     //         handle: '.control-label',
    //     //         removeOnSpill: true
    //     //     }
    //     // },
    //     
    //     onSortableRemove: function(model, collection) {
    //         var key = model.get('key');
    //         if (key) this.unsetValueOf(key);
    //     },
    //     
    //     // onControlLabelClick: function(control, event) {
    //     //     if (event.altKey && control.model) {
    //     //         event.preventDefault();
    //     //         this.collection.remove(control.model);
    //     //         var key = control.model.get('key');
    //     //         if (key) this.unsetValueOf(key);
    //     //         this.triggerChange(); // manually
    //     //     }
    //     // },
    //     
    //     // getData: function(asModel) {
    //         // var copy = new this.modelConstructor();
    //         // this.collection.each(function(model) {
    //         //     var field = this.children.findByModel(model);
    //         //     var key = field.getKey();
    //         //     if (key && !field.evaluateAttribute('omit')) {
    //         //         copy.set(key, field.getData());
    //         //     }
    //         // }.bind(this));
    //         // return asModel ? copy : copy.toJSON();
    //     // },
    //     
    // });
    
    return TableView;
    
});