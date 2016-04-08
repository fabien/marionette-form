define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'marionette.form.control.filter'
], function($, _, Backbone, Marionette, Form) {
    
    Form.Templates.DropdownControl = _.template([
        '<label class="<%- labelClassName %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <% if (obj.wrap) { %><div class="btn-group"><% } %>',
        '    <button type="button" class="btn btn-<%- buttonClass %><%- buttonSize ? " btn-" + buttonSize : "" %> dropdown-toggle" <% if (!readonly) { %>data-toggle="dropdown"<% } %> aria-haspopup="true" aria-expanded="false" <%- disabled ? "disabled" : "" %>>',
        '    <% if (synopsis && synopsis.length) { %><span class="synopsis"><%= synopsis %></span><% } %> <% if (!readonly) { %><span class="caret"></span><% } %>',
        '    </button>',
        '    <ul class="dropdown-menu"></ul>',
        '  <% if (obj.wrap) { %></div><% } %>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><div class="<%- helpClassName %>"><%= helpMessage %></div><% } %>',
        '</div>'
    ].join('\n'));
    
    Form.Templates.InputDropdownControl = _.template([
        '<label class="<%- labelClassName %>"><%= label %></label>',
        '<% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '<div class="<%- controlsClassName %> input-group nested-controls"></div>',
        '<% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '<% if (helpMessage && helpMessage.length) { %><div class="<%- helpClassName %>"><%= helpMessage %></div><% } %>'
    ].join('\n'));
    
    Form.Templates.DropdownControlItem = _.template([
        '<i class="icon <%- icon %>"></i> <span><%- label %></span>'
    ].join('\n'));
    
    Form.Templates.MenuControlItem = _.template([
        '<a href="<%- obj.href ? obj.href : "#" %>">',
        '  <% if (control.icons) { %><i class="icon <%- icon %>"></i><% } %>',
        '  <span><%- label %></span>',
        '</a>'
    ].join('\n'));
    
    var DropdownControlItem = Form.DropdownControlItem = Form.FilterItemView.extend({
        
        tagName: 'li',
        
        template: Form.Templates.DropdownControlItem
        
    });
    
    var DropdownControl = Form.DropdownControl = Form.FilterControl.extend({
        
        definition: { collapsible: false },
        
        template: Form.Templates.DropdownControl,
        
        controlDefaults: {
            wrap: true,
            columns: false,
            buttonSize: null,
            autoClose: true,
            buttonClass: 'default'
        },
        
        controlEvents: {},
        
        childView: DropdownControlItem,
        
        childViewContainer: '.dropdown-menu',
        
        toggleDropdown: function() {
            var container = this.$(_.result(this, 'childViewContainer'));
            container.dropdown('toggle');
        }
        
    });
    
    var MenuControlItem = Form.MenuControlItem = Form.DropdownControlItem.extend({
        
        template: Form.Templates.MenuControlItem,
        
        selectedClassName: 'active'
        
    });
    
    var MenuControl = Form.MenuControl = Form.DropdownControl.extend({
        
        definition: { ignore: true, omit: true, collapsible: false },
        
        childView: Form.MenuControlItem,
        
        onItemClick: function(childView) {
            if (this.getAttribute('autoClose')) this.toggleDropdown();
        }
        
    });
    
    var InputDropdownControl = Form.InputDropdownControl = Form.GroupControl.extend({
        
        template: Form.Templates.InputDropdownControl,
        
        defaults: {
            autoClose: true,
            helpMessage: '',
            extraClasses: []
        },
        
        inputDefaults: { control: 'input' },
        
        dropdownDefaults: { control: 'dropdown', controlClass: 'input-group-btn', wrap: false },
        
        constructor: function(options) {
            Form.GroupControl.prototype.constructor.apply(this, arguments);
            this.listenTo(this.model, 'change:input', this.render);
            this.listenTo(this.model, 'change:dropdown', this.render);
            this.on('item:item:click', this.onControlItemClick);
        },
        
        fields: function() {
            var input = _.extend({}, this.getOption('inputDefaults'), this.getAttribute('input'));
            var dropdown = _.extend({}, this.getOption('dropdownDefaults'), this.getAttribute('dropdown'));
            return this.getAttribute('prepend') ? [dropdown, input] : [input, dropdown];
        },
        
        onControlItemClick: function(control, item) {
            if (this.getAttribute('autoClose') && control.toggleDropdown) control.toggleDropdown();
        }
        
    });
    
    return DropdownControl;
    
});