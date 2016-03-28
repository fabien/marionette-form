define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'countable'
], function($, _, Backbone, Marionette, Form, Countable) {
    
    var defaults = { min: 0, max: 0, count: 'words' };
    
    var TextControl = Form.TextControl = Form.TextareaControl.extend({
        
        countLabels: {
            paragraphs: 'paragraphs',
            characters: 'characters',
            words: 'words'
        },
        
        events: {
            'keydown @ui.control': 'onKeydown'
        },
        
        setValue: function(value, options) {
            var options = _.defaults(this.getAttributes('min', 'max', 'count', 'truncate'), defaults);
            if (options.truncate && options.max) {
                var countableOptions = _.extend({}, this.getAttribute('countable'));
                value = Countable.truncateText(value, options.max, options.count, countableOptions);
            }
            return Form.TextareaControl.prototype.setValue.call(this, value, options);
        },
        
        getCountLabel: function(type) {
            return this.getAttribute('countLabel') || 
                _.extend({}, this.getOption('countLabels'), this.getAttributes('countLabels'))[type];
        },
        
        onKeydown: function(e) {
            var k = e.keyCode;
            if($.inArray(k, [13, 16, 17, 18, 19, 20, 27, 35, 36, 37, 38, 39, 40, 91, 93, 224])) return;
            if (8 === k || 46 === k || 127 === k || e.ctrlKey || e.altKey || e.metaKey) return;
            if (this.$el.hasClass('limit')) e.preventDefault();
        },
        
        onRender: function() {
            var options = _.defaults(this.getAttributes('min', 'max', 'count', 'truncate'), defaults);
            var countableOptions = _.extend({}, this.getAttribute('countable'));
            var label = this.getCountLabel(options.count);
            options.min = Math.max(options.min, 0);
            var self = this;
            var $control = this.ui.control;
            var $counter = $('<span class="counter"></span>');
            this.$('.col-controls').before($counter);
            Countable.live(this.ui.control[0], function(counter) {
                var count = counter[options.count] || 0;
                if (options.min > 0 && count < options.min) {
                    $counter.text(count + ' ' + label + ' (min. ' + options.min + ')').addClass('warning');
                    self.$el.addClass('limit limit-min');
                } else if (options.max > 0 && count > options.max) {
                    $counter.text(count + ' ' + label + ' (max. ' + options.max + ')').addClass('warning');
                    self.$el.addClass('limit limit-max');
                    if (options.truncate) {
                        $control.val(Countable.truncateText($control.val(), options.max, options.count, countableOptions));
                    }
                } else if (options.max > 0) {
                    $counter.text(count + ' / ' + options.max + ' ' + label).removeClass('warning');
                    self.$el.removeClass('limit limit-min limit-max');
                } else {
                    $counter.text(count + ' ' + label).removeClass('warning');
                    self.$el.removeClass('limit limit-min limit-max');
                }
            }.bind(this), countableOptions);
        },
        
        onDestroy: function() {
            Countable.die(this.ui.control[0]);
        }
        
    });
    
    return TextControl;
    
});