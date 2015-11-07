define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form'
], function($, _, Backbone, Marionette, Form) {
    
    var BindingControl = Form.BindingControl = Form.Control.extend({
        
        template: false,
        
        ui: {},
        
        triggers: function() {
            var triggers = {};
            triggers['focus'] = 'focus';
            triggers['blur'] = 'blur';
            _.extend(triggers, _.result(this, 'controlTriggers'));
            return triggers;
        },
        
        constructor: function(options) {
            options = _.extend({}, options);
            if (options.model && options.model.has('el')) {
                options.el = options.model.get('el');
            } else {
                throw new Error('Control attribute `el` is required');
            }
            
            Form.Control.prototype.constructor.call(this, options);
            
            this.once('render', this.initializeElement);
            this.on('render', this.updateControlAttributes);
            this.on('refresh', this.updateControlAttributes);
        },
        
        initializeElement: function() {
            if (this.initElem) this.initElem();
        },
        
        commit: function(blur) {
            if (blur) this.$el.blur();
            this.setValue(this.getValue());
        },
        
        useHandler: function(handler) {
            this.initElem = this._createInitFn(handler).bind(this);
            this.getValue = this._createGetterFn(handler).bind(this);
            this.onRender = this._createSetterFn(handler).bind(this);
            this.onRefresh = this.onRender;
            
            var triggers = this.getAttribute('trigger');
            var events;
            
            if (triggers === false) {
                events = [];
            } else if (_.isArray(triggers)) {
                events = [];
            } else if (_.isString(triggers)) {
                events = triggers.split(/\s/);
            } else {
                events = [].concat(handler.events || ['change']);
            }
            
            this.controlTriggers = {};
            _.each(events, function(event) {
                this.controlTriggers[event] = 'change';
            }.bind(this));
        },
        
        render: function() {
            var options = _.last(arguments) || {};
            if (this.isRendered) {
                this.triggerMethod('refresh', options);
                this.isValid()
            } else {
                return Form.Control.prototype.render.apply(this, arguments);
            }
            return this;
        },
        
        updateControlAttributes: function() {
            var data = this.serializeData();
            var props = _.pick(data, 'disabled', 'readonly', 'multiple');
            _.each(props, function(value, prop) {
                this.$el.prop(prop, value);
            }.bind(this));
            
            var attrs = _.pick(data, 'placeholder');
            _.each(attrs, function(value, attr) {
                this.$el.attr(attr, value);
            }.bind(this));
        },
        
        _createInitFn: function(handler) {
            return function() {
                if (_.isFunction(handler.init)) {
                    handler.init.call(this, this.$el);
                }
            };
        },
        
        _createGetterFn: function(handler) {
            return function(fromModel) {
                if (fromModel) {
                    return this.getFormValue(this.getKey());
                } else if (_.isFunction(handler.getter)) {
                    var value = handler.getter.call(this, this.$el);
                    return this.coerceValue(value);
                }
            };
        },
        
        _createSetterFn: function(handler) {
            return function() {
                var value = this.getValue(true);
                if (_.isFunction(handler.setter)) {
                    return handler.setter.call(this, this.$el, value);
                }
            };
        },
        
        _setElement: function(el) {
            Form.Control.prototype._setElement.apply(this, arguments);
            
            var handler = _.find(this.constructor.handlers, function(handler) {
                return this.$el.is(handler.selector);
            }.bind(this));
            if (handler) this.useHandler(handler);
        }
        
    }, {
        
        handlers: [],
        
        addHandler: function(selector, options, prepend) {
            var handler = _.where(this.handlers, { selector: selector })[0]
            if (handler) {
                _.extend(handler, options);
            } else if (prepend) {
                this.handlers.unshift(_.extend({ selector: selector }, options));
            } else {
                this.handlers.push(_.extend({ selector: selector }, options));
            }
        }
        
    });
    
    BindingControl.addHandler('[contenteditable]', {
        events: ['change'],
        getter: function($el) { return $el.html(); },
        setter: function($el, val) { $el.html(val); }
    });
    
    BindingControl.addHandler('input[type="checkbox"]', {
        events: ['change'],
        getter: function($el) {
            var controls = this.form.$('[data-key="' + this.getKey() + '"]');
            if (controls.length > 1) { // multiple
                var selected = [];
                controls.filter(':checked').each(function() {
                    selected.push($(this).val());
                });
                return selected;
            } else {
                return $el.prop('checked');
            }
        },
        setter: function($el, val) {
            var controls = this.form.$('[data-key="' + this.getKey() + '"]');
            if (controls.length > 1) { // multiple
                var values = _.map([].concat(val || []), String);
                controls.each(function() {
                    var elem = $(this);
                    elem.prop('checked', _.include(values, elem.val()));
                });
            } else {
                var checked = _.isBoolean(val) ? val : '' + val === $el.val();
                $el.prop('checked', checked);
            }
        }
    });
    
    BindingControl.addHandler('input[type="radio"]', {
        events: ['change'],
        getter: function($el) {
            var controls = this.form.$('[data-key="' + this.getKey() + '"]');
            var selected = [];
            controls.filter(':checked').each(function() {
                selected.push($(this).val());
            });
            return _.first(selected);
        },
        setter: function($el, val) {
            $el.filter('[value="' + val + '"]').prop('checked', true);
        }
    });
    
    BindingControl.addHandler(':input', {
        events: ['change'],
        getter: function($el) { return $el.val(); },
        setter: function($el, val) { $el.val(val); }
    });
    
    return BindingControl;
    
});