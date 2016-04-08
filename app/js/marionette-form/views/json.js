define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'behave'
], function($, _, Backbone, Marionette, Form, Behave) {
    
    var JsonView = Marionette.Form.JsonView = Marionette.ItemView.extend({
        
        template: _.template('<textarea class="form-control" rows="20"><%- JSON.stringify(obj, null, 4) %></textarea>'),
        
        initialize: function() {
            this.model = this.model || new Form.Model();
            this.on('render', this._attachBehave);
            this.on('destroy', this._detachBehave);
        },
        
        ui: {
            textarea: 'textarea'
        },
        
        commit: function() {
            return this.updateData();
        },
        
        setData: function(value) {
            this.model.set(_.extend({}, value));
        },
        
        getData: function() {
            this.updateData();
            return this.model.toJSON();
        },
        
        updateData: function() {
            var rawData = this.ui.textarea.val();
            try {
                var data = JSON.parse(rawData);
                this.model.set(data);
                return true;
            } catch(e) {
                return false;
            }
        },
        
        _attachBehave: function() {
            this._detachBehave();
            this.editor = new Behave(_.extend({
                textarea: this.ui.textarea[0]
            }, this.getOption('behave')));
            this.triggerMethod('behave:init', this.editor);
        },
        
        _detachBehave: function() {
            if (this.editor) this.editor.destroy();
        }
        
    });
    
    return JsonView;
    
});