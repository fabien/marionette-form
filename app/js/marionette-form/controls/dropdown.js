define([
    'jquery',
    'underscore',
    'backbone',
    'backbone.marionette',
    'marionette.form',
    'marionette.form.control.filter'
], function($, _, Backbone, Marionette, Form) {
    
    
    Form.Templates.DropdownControl = _.template([
        '<label class="<%= labelClassName %>"><%= label %></label>',
        '<div class="<%= controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <div class="btn-group">',
        '    <button type="button" class="btn btn-<%= buttonClass %><%= buttonSize ? " btn-" + buttonSize : "" %> dropdown-toggle" <% if (!readonly) { %>data-toggle="dropdown"<% } %> aria-haspopup="true" aria-expanded="false" <%= disabled ? "disabled" : "" %>>',
        '    <% if (synopsis && synopsis.length) { %><span class="synopsis"><%= synopsis %></span><% } %> <% if (!readonly) { %><span class="caret"></span><% } %>',
        '    </button>',
        '    <ul class="dropdown-menu"></ul>',
        '  </div>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><div class="<%= helpClassName %>"><%= helpMessage %></div><% } %>',
        '</div>'
    ].join('\n'));
    
    Form.Templates.DropdownControlItem = _.template([
        '<i class="icon <%= icon %>"></i> <span><%- label %></span>'
    ].join('\n'));
    
    Form.Templates.MenuControlItem = _.template([
        '<a href="<%= obj.href ? obj.href : "#" %>">',
        '  <% if (control.icons) { %><i class="icon <%= icon %>"></i><% } %>',
        '  <span><%- label %></span>',
        '</a>'
    ].join('\n'));
    
    var DropdownControlItem = Form.DropdownControlItem = Form.FilterItemView.extend({
        
        tagName: 'li',
        
        template: Form.Templates.DropdownControlItem
        
    });
    
    var DropdownControl = Form.DropdownControl = Form.FilterControl.extend({
        
        template: Form.Templates.DropdownControl,
        
        controlDefaults: {
            columns: false,
            buttonSize: null,
            autoClose: true,
            buttonClass: 'default'
        },
        
        controlEvents: {},
        
        childView: DropdownControlItem,
        
        childViewContainer: '.dropdown-menu'
        
    });
    
    var MenuControlItem = Form.MenuControlItem = Form.DropdownControlItem.extend({
        
        template: Form.Templates.MenuControlItem,
        
        selectedClassName: 'active'
        
    });
    // 
    var MenuControl = Form.MenuControl = Form.DropdownControl.extend({
        
        definition: { ignore: true, omit: true, collapsible: false },
        
        childView: Form.MenuControlItem,
        
        onItemClick: function(childView) {
            if (this.getAttribute('autoClose')) {
                var container = this.$(_.result(this, 'childViewContainer'));
                container.dropdown('toggle');
            }
        }
        
    });
    
    return DropdownControl;
    
});