define([
    'jquery',
    'underscore',
    'backbone',
    'backbone.marionette',
    'marionette.form',
    'bootstrap-combobox'
], function($, _, Backbone, Marionette, Form) {
    
    var ComboboxControl = Form.ComboboxControl = Form.SelectControl.extend({
        
        constructor: function(options) {
            Form.SelectControl.prototype.constructor.apply(this, arguments);
            this.on('render', this._attachCombobox);
            this.on('destroy', this._detachCombobox);
        },
        
        refreshCombobox: function() {
            if (!this.combobox) return;
            if (!this.isEnabled() || this.isReadonly()) {
                this.combobox.disable();
            } else {
                this.combobox.enable();
            }
        },
        
        onComboboxChange: function(event) {
            var value = $(event.target).val();
            this.setValue(value);
        },
        
        _attachCombobox: function() {
            this._detachCombobox();
            var options = _.extend({
                input: Boolean(this.getAttribute('input'))
            }, this.getOption('combobox'), this.getAttribute('combobox'));
            if (_.isString(options.template)) {
                var template = String(options.template);
                options.template = function() { return template; };
            } else if (_.isFunction(this.comboboxTemplate)) {
                options.template = this.comboboxTemplate.bind(this);
            }
            if (_.isFunction(this.matcher)) options.matcher = this.matcher.bind(this);
            if (_.isFunction(this.sorter)) options.sorter = this.sorter.bind(this);
            if (_.isFunction(this.highlighter)) options.highlighter = this.highlighter.bind(this);
            this.ui.control.combobox(options);
            this.combobox = this.ui.control.data('combobox');
            if (options.input) this.combobox.$target.on('change', this.onComboboxChange.bind(this));
            this.triggerMethod('combobox:init', this.combobox);
            this.refreshCombobox();
        },
        
        _detachCombobox: function() {
            this.combobox = null;
        }
        
    });
    
    return ComboboxControl;
    
});