define([
    'moment',
    'backbone',
    'marionette',
    'marionette.form',
    'marionette.control.binding'
], function(moment, Backbone, Marionette, Form) {
    
    var HtmlForm = Form.Html = Form.View.extend({
        
        template: _.template('<div class="form-controls"></div>'),
        
        childViewContainer: '.form-controls',
        
        constructor: function(options) {
            Form.View.prototype.constructor.apply(this, arguments);
            this.on('render:template', this.updateFields);
        },
        
        updateFields: function() {
            var self = this;
            this.$('[data-key]').each(function() {
                self.fieldFromElement(this);
            });
        },
        
        fieldFromElement: function(elem) {
            elem = $(elem);
            var options = _.extend({}, elem.data());
            var prefix = this.callDelegate('getControlIdPrefix', this) || this.getOption('prefix');
            var id = elem.attr('id') || _.uniqueId('field-'); // don't use `name` attr
            if (prefix && id.indexOf(prefix) === 0) id = id.slice(prefix.length);
            elem.attr('id', prefix ? prefix + id : id);
            this.field(id, _.defaults(options, {
                el: elem[0], control: 'binding'
            }));
        },
        
        attachElContent: function(html) {
            if (this.getOption('prependElContent')) {
                this.$el.prepend(html);
            } else {
                this.$el.append(html);
            }
            return this;
        }
        
    });
    
    return HtmlForm;
    
});
