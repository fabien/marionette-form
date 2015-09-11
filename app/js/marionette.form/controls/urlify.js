define([
    'jquery',
    'underscore',
    'backbone',
    'backbone.marionette',
    'marionette.form',
    'urlify'
], function($, _, Backbone, Marionette, Form, Urlify) {
    
    var urlify = Urlify({ trim: false });
    var finalize = Urlify({ trim: true });
    
    // Formatter (not used in UrlifyControl, for generic use)
    
    var UrlifyFormatter = Marionette.Form.UrlifyFormatter = function() {};
    _.extend(UrlifyFormatter.prototype, {
        
        fromRaw: function(rawData, model) {
            return rawData;
        },
        
        toRaw: function(formattedData, model) {
            if (!_.isString(formattedData)) return '';
            return finalize(formattedData);
        }
        
    });
    
    var UrlifyControl = Form.UrlifyControl = Form.InputControl.extend({
        
        controlEvents: {
            'keypress @ui.control': 'urlifyInput'
        },
        
        constructor: function(options) {
            Form.InputControl.prototype.constructor.apply(this, arguments);
            this.urlifyInput = _.debounce(this.urlifyInput, 100);
            this.on('change', this.finalizeInput);
            this.on('blur', this.finalizeInput);
            this.fromKeys = [].concat(this.model.get('from') || []);
            _.each(this.fromKeys, function(key) {
                this.observeKey(key, this.urlifyFromSource);
            }.bind(this));
        },
        
        urlifyFromSource: function() {
             var values = this.form.getValuesOf(this.fromKeys);
             var urlified = finalize(_.compact(values).join(' '));
             this.setUrlifiedValue(urlified);
        },
        
        setUrlifiedValue: function(urlified) {
            this.ui.control.val(urlified);
            this.setValue(urlified);
        },
        
        urlifyInput: function(event) {
            if (event.shiftKey || event.ctrlKey || event.altKey) return;
            var value = this.getValue() + '';
            if ((event.which === 189 || event.which === 45 || event.which === 32)
                && value.match(/(\-|\s)$/)) {
                return event.preventDefault();
            }
            value = value.replace(/\-{2,}/, '-');
            value = value.replace(/\s+$/, '-');
            this.ui.control.val(urlify(value));
        },
        
        finalizeInput: function() {
            var urlified = finalize(this.getValue());
            this.setUrlifiedValue(urlified);
        }
        
    });
    
    return UrlifyControl;
    
});