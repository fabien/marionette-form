define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'bootstrap-switch'
], function($, _, Backbone, Marionette, Form) {
    
    Form.Templates.SwitchControl = _.template([
        '<% if (form.layout !== "vertical") { %><label class="<%= labelClassName %> toggle-switch" for="control-<%= id %>"><%= controlLabel %></label><% } %>',
        '<div class="<%= controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <div class="checkbox">',
        '      <input id="control-<%= id %>" name="<%= name %>" data-key="<%= key %>" class="<%= controlClassName %>" type="<%= type %>" <%= value ? \'checked="checked"\' : "" %> <%= disabled ? "disabled" : "" %> <%= required ? "required" : "" %> <%= readonly ? "readonly" : "" %>/>',
        '  </div>',
        '<% if (obj.label) { %>  <label class="toggle-switch"><%= label %></label><% } %>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '</div>'
    ].join('\n'));
    
    var SwitchControl = Form.SwitchControl = Form.BooleanControl.extend({
        
        template: Form.Templates.SwitchControl,
        
        events: {
            'click .toggle-switch': 'toggleSwitch'
        },
        
        constructor: function(options) {
            Form.BooleanControl.prototype.constructor.apply(this, arguments);
            this.onText = this.getAttribute('onText') || this.getOption('onText') || 'On';
            this.offText = this.getAttribute('offText') || this.getOption('offText') || 'Off';
            this.onValue = this.getAttribute('onValue') || this.getOption('onValue') || true;
            this.offValue = this.getAttribute('offValue') || this.getOption('offValue') || false;
        },
        
        toggleSwitch: function(event) {
            event.preventDefault();
            this.ui.control.bootstrapSwitch('toggleState');
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                var bool = this.form.model.get(this.getKey()) === this.onValue;
                return bool ? this.onValue : this.offValue;
            } else {
                var bool = this.coerceValue(this.ui.control.is(':checked'));
                return bool ? this.onValue : this.offValue;
            }
        },
        
        serializeValue: function() {
            return this.form.model.get(this.getKey()) === this.onValue;
        },
        
        onRender: function() {
            var options = this.getAttributes('onText', 'offText');
            this.ui.control.bootstrapSwitch(_.extend({
                onSwitchChange: this.onChange.bind(this)
            }, options));
        },
        
        onDestroy: function() {
            this.ui.control.bootstrapSwitch('destroy');
        }
        
    });
    
    return SwitchControl;
    
});