define([
    'moment',
    'backbone',
    'marionette',
    'marionette.form',
    'marionette.sort'
], function(moment, Backbone, Marionette, Form, Sort) {
    
    Form.Templates.TableView = _.template([
        '<table class="<%- tableClass %>">',
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
            var direction = this.form.callDelegate('getSortDirection', this.getKey());
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
            Sort.CollectionViewMixin.extend(this);
            var renderHeader = this.model.has('header') ? this.model.get('header') : this.getOption('header');
            this.model.set('header', renderHeader);
            if (renderHeader) {
                this.header = this.buildHeaderView(options.header);
                this.listenTo(this.header, 'all', this._handleHeaderEvent);
                this.on('render', this.renderHeader);
                this.on('destroy', this.destroyHeader);
            }
        },
        
        // Sorting
        
        isSortable: function() {
            return Boolean(this.model.get('sort'));
        },
        
        onHeaderControlSort: function(header, control, direction) {
            if (this.isSortable()) this.sortByAttribute(control.getKey(), direction);
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
    
    return TableView;
    
});