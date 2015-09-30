define([
    'jquery',
    'underscore',
    'backbone',
    'backbone.marionette',
    'marionette.form'
], function($, _, Backbone, Marionette, Form) {
    
    var RedactorControl = Form.RedactorControl = Form.TextareaControl.extend({
        
        renderOnce: true,
        
        constructor: function(options) {
            Form.TextareaControl.prototype.constructor.apply(this, arguments);
            if (_.isFunction($.fn.redactor)) {
                this.on('render', this._attachRedactor);
                this.on('destroy', this._detachRedactor);
            } else {
                console.warn('Redactor plugin not available');
            }
        },
        
        getData: function() {
            return this.getCode();
        },
        
        getCode: function() {
            return (this.redactor && this.redactor.code.get()) || '';
        },
        
        setCode: function(value) {
            this.redactor && this.redactor.code.set(value);
        },
        
        onRedactorChange: function(e) {
            this.commit();
        },
        
        onRedactorBlur: function(e) {
            this.commit();
        },
        
        onRedactorFocus: function(e) {
            if (this.isImmutable()) this.loseFocus();
        },
        
        onRefresh: function(options) {
            if (!this.redactor) return;
            options = options || {};
            if (options.force || options.viewCid !== this.cid) {
                this.setCode(this.getValue(true));
            }
            var toolbar = this.redactor.core.getToolbar();
            toolbar.toggle(this.isEditable());
        },
        
        _attachRedactor: function() {
            this._detachRedactor();
            var options = _.extend({}, this.getOption('redactor'), this.getAttribute('redactor'));
            options.syncCallback = this.triggerMethod.bind(this, 'redactor:sync');
            options.dropCallback = this.triggerMethod.bind(this, 'redactor:drop');
            options.blurCallback = this.triggerMethod.bind(this, 'redactor:blur');
            options.focusCallback = this.triggerMethod.bind(this, 'redactor:focus');
            options.clickCallback = this.triggerMethod.bind(this, 'redactor:click');
            options.changeCallback = this.triggerMethod.bind(this, 'redactor:change');
            this.ui.control.redactor(options);
            this.redactor = this.ui.control.data('redactor');
            this.triggerMethod('redactor:init', this.redactor);
            this.onRefresh();
        },
        
        _detachRedactor: function() {
            if (this.redactor) this.redactor.core.destroy();
        }
        
    });
    
    return RedactorControl;
    
});