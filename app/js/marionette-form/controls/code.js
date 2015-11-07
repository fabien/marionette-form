define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'behave'
], function($, _, Backbone, Marionette, Form, Behave) {
    
    var CodeControl = Form.CodeControl = Form.TextareaControl.extend({
        
        constructor: function(options) {
            Form.TextareaControl.prototype.constructor.apply(this, arguments);
            this.on('render', this._attachBehave);
            this.on('destroy', this._detachBehave);
        },
        
        _attachBehave: function() {
            this._detachBehave();
            this.editor = new Behave(_.extend({
                textarea: this.ui.control[0]
            }, this.getOption('behave'), this.getAttribute('behave')));
            this.triggerMethod('behave:init', this.editor);
        },
        
        _detachBehave: function() {
            if (this.editor) this.editor.destroy();
        }
        
    });
    
    return CodeControl;
    
});