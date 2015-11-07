define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'moment',
    'ion.rangeslider'
], function($, _, Backbone, Marionette, Form, moment) {
    
    var SliderControl = Form.SliderControl = Form.InputControl.extend({
        
        controlDefaults: { trigger: false },
        
        rangeSlider: false,
        
        constructor: function(options) {
            Form.InputControl.prototype.constructor.apply(this, arguments);
            this.on('render', this._attachRangeSlider);
            this.on('destroy', this._detachRangeSlider);
            this.listenTo(this.model, 'change:slider', this._updateRangeSlider);
            
            this.minKey = this.getAttribute('minKey') || this.getOption('minKey');
            this.maxKey = this.getAttribute('maxKey') || this.getOption('maxKey');
            this.stepKey = this.getAttribute('stepKey') || this.getOption('stepKey');
            
            if (this.minKey) this.observeKey(this.minKey, this.onMinValueChange);
            if (this.maxKey) this.observeKey(this.maxKey, this.onMaxValueChange);
            if (this.stepKey) this.observeKey(this.stepKey, this.onStepValueChange);
            
            this.on('slider:start slider:finish', this.normalizeValue);
            this.on('slider:change', _.debounce(this.onChangeSlider.bind(this), 100));
            this.on('slider:init', this.setInitialValue); // on init, not start (this.slider would be undefined)
        },
        
        setInitialValue: function() {
            var value = this.getValue(true);
            value = this.coerceSliderValue('value', value);
            if (!_.isNumber(value)) return;
            this.updateRangeSlider({ from: value });
        },
        
        normalizeValue: function(data) {
            var value = this.getValue(true);
            if (value < data.min) value = data.min;
            if (value > data.max) value = data.max;
            this.setValue(value);
        },
        
        prettifyValue: function(num) {
            return this.formatter.fromRaw(num);
        },
        
        coerceSliderValue: function(type, value) {
            return value;
        },
        
        convertSliderValue: function(type, value) {
            return value;
        },
        
        updateRangeSlider: function(options) {
            if (!this.slider) return;
            this.slider.update(_.extend({}, options));
        },
        
        getSliderType: function() {
            if (this.hasAttribute('range') && this.getAttribute('range')) {
                return 'double';
            } else if (this.getOption('rangeSlider')) {
                return 'double';
            } else {
                return 'single';
            }
        },
        
        getMinValue: function() {
            return this.getNumericOption('min', 0);
        },
        
        getMaxValue: function() {
            return this.getNumericOption('max', 100);
        },
        
        getStepValue: function() {
            return this.getNumericOption('step');
        },
        
        onMinValueChange: function(model, value) {
            if (!_.isNumber(value) && !_.isDate(value)) return;
            value = this.coerceSliderValue('min', value);
            this.updateRangeSlider({ min: value });
            var currentValue = this.getValue(true);
            if (currentValue < value) this.setValue(value);
        },
        
        onMaxValueChange: function(model, value) {
            if (!_.isNumber(value) && !_.isDate(value)) return;
            value = this.coerceSliderValue('max', value);
            this.updateRangeSlider({ max: value });
            var currentValue = this.getValue(true);
            if (currentValue > value) this.setValue(value);
        },
        
        onStepValueChange: function(model, value) {
            if (!_.isNumber(value)) return;
            value = this.coerceSliderValue('step', value);
            this.updateRangeSlider({ step: value });
        },
        
        onChangeSlider: function(data) {
            if (this.getSliderType() === 'double') {
                var from = this.convertSliderValue('from', data.from);
                var to = this.convertSliderValue('to', data.to);
                this.setValue([from, to]);
            } else {
                var from = this.convertSliderValue('from', data.from);
                this.setValue(from);
            }
        },
        
        getNumericOption: function(type, defaultValue) {
            var key = type + 'Key', value;
            if (this[key] && this.form.hasValue(this[key])) {
                value = this.form.getValueOf(this[key]);
            } else if (this.hasAttribute(type)) {
                value = this.getAttribute(type);
            } else {
                value = this.getOption(type + 'Value');
            }
            if (_.isNumber(value) || _.isString(value) || _.isDate(value)) {
                return this.coerceSliderValue(type, value);
            } else {
                return defaultValue;
            }
        },
        
        _attachRangeSlider: function() {
            this._detachRangeSlider();
            var defaults = {
                onStart: this.triggerMethod.bind(this, 'slider:start'),
                onChange: this.triggerMethod.bind(this, 'slider:change'),
                onFinish: this.triggerMethod.bind(this, 'slider:finish'),
                onUpdate: this.triggerMethod.bind(this, 'slider:update')
            };
            var options = _.extend({}, this.getOption('sliderOptions'), this.getAttribute('slider'));
            if (!this.isEditable()) options.from_fixed = options.to_fixed = true;
            options.type = this.getSliderType();
            options.min = this.getMinValue();
            options.max = this.getMaxValue();
            options.step = this.getStepValue();
            options.min_interval = this.getNumericOption('minInterval');
            options.max_interval = this.getNumericOption('maxInterval');
            options.prettify = this.prettifyValue.bind(this);
            _.defaults(options, defaults);
            this.ui.control.ionRangeSlider(options);
            this.slider = this.ui.control.data('ionRangeSlider');
            this.triggerMethod('slider:init', this.slider);
        },
        
        _detachRangeSlider: function() {
            if (this.slider) this.slider.destroy();
        },
        
        _updateRangeSlider: function(model, options) {
            this.updateRangeSlider(options);
        }
        
    });
    
    var RangeControl = Form.RangeControl = Form.SliderControl.extend({
        
        rangeSlider: true,
        
        constructor: function(options) {
            Form.SliderControl.prototype.constructor.apply(this, arguments);
            var key = this.getKey();
            this.startKey = this.getAttribute('startKey') || this.getOption('startKey') || key + '[0]';
            this.endKey = this.getAttribute('endKey') || this.getOption('endKey') || key + '[1]';
            this.observeKey(this.startKey, this.onStartValueChange);
            this.observeKey(this.endKey, this.onEndValueChange);
            
            this.minIntervalKey = this.getAttribute('minIntervalKey') || this.getOption('minIntervalKey');
            if (this.minIntervalKey) this.observeKey(this.minIntervalKey, this.onMinIntervalChange);
            
            this.maxIntervalKey = this.getAttribute('maxIntervalKey') || this.getOption('maxIntervalKey');
            if (this.maxIntervalKey) this.observeKey(this.maxIntervalKey, this.onMaxIntervalChange);
            
            this.listenTo(this.model, 'change:minInterval', this.onMinIntervalChange);
            this.listenTo(this.model, 'change:maxInterval', this.onMaxIntervalChange);
        },
        
        setRange: function(start, end) {
            if (_.isArray(start)) {
                if (start.length > 0) this.setStartValue(start[0]);
                if (start.length > 1) this.setEndValue(start[1]);
            } else {
                if (arguments.length > 0) this.setStartValue(start);
                if (arguments.length > 1) this.setEndValue(end);
            }
        },
        
        setStartValue: function(value) {
            if (!_.isNumber(value)) return;
            this.updateRangeSlider({ from: value });
        },
        
        setEndValue: function(value) {
            if (!_.isNumber(value)) return;
            this.updateRangeSlider({ to: value });
        },
        
        setInitialValue: function() {
            var range = this.getValue();
            range[0] = this.coerceSliderValue('value', range[0]);
            range[1] = this.coerceSliderValue('value', range[1]);
            this.setRange(range);
        },
        
        getValue: function() {
            var value = [];
            var fromValue = this.form.getValueOf(this.startKey);
            value[0] = _.isUndefined(fromValue) ? this.getMinValue() : fromValue;
            var toValue = this.form.getValueOf(this.endKey);
            value[1] = _.isUndefined(toValue) ? this.getMaxValue() : toValue;
            return _.isArray(value) && value.length === 2 ? value : [];
        },
        
        setValue: function(value, options) {
            if (!_.isArray(value)) return;
            return this.mutex(function() {
                var viewCid = this.parent ? this.parent.cid : this.cid;
                options = _.extend({ viewCid: viewCid }, options);
                this.setFormValue(this.startKey, value[0], options);
                return this.setFormValue(this.endKey, value[1], options);
            });
        },
        
        normalizeValue: function(data) {
            var value = this.getValue(true);
            if (value[0] < data.min) value[0] = data.min;
            if (value[1] > data.max) value[1] = data.max;
            this.setValue(value);
        },
        
        onStartValueChange: function(model, value) {
            this.setStartValue(value);
        },
        
        onEndValueChange: function(model, value) {
            this.setEndValue(value);
        },
        
        onMinIntervalChange: function(model, value) {
            if (!_.isNumber(value)) return;
            value = this.coerceSliderValue('minInterval', value);
            this.updateRangeSlider({ min_interval: value });
        },
        
        onMaxIntervalChange: function(model, value) {
            if (!_.isNumber(value)) return;
            value = this.coerceSliderValue('maxInterval', value);
            this.updateRangeSlider({ max_interval: value });
        }
        
    });
    
    var DateMixin = {
        
        formatter: Form.DateFormatter,
        
        normalizeValue: function(data) {
            // don't normalize for now ...
        },
        
        getSliderUnit: function(type) {
            var unitType = type + 'Unit';
            var unit = this.getAttribute(unitType) || this.getOption(unitType);
            return unit || this.getAttribute('unit') || this.getOption('unit');
        },
        
        prettifyValue: function(num) {
            var locale = this.getAttribute('locale') || this.getOption('locale') || 'en';
            var dateFormat = this.getAttribute('dateFormat') || this.getOption('dateFormat') || 'LL';
            var m = moment(num, 'X').locale(locale);
            return m.format(dateFormat);
        },
        
        coerceSliderValue: function(type, value) {
            if (type === 'value') {
                return +moment(this.formatter.toRaw(value)).format('X');
            } else if (_.isDate(value)) {
                return +moment(value).format('X');
            } else {
                var interval = _.include(['step', 'minInterval', 'maxInterval'], type);
                var unit = this.getSliderUnit();
                if (interval && _.isString(unit)) {
                    var m = moment();
                    return Math.abs(m.clone().add(value, unit).format('X') - m.format('X'));
                } else if (interval) {
                    return value;
                } else if (_.isString(unit)) {
                    var m = moment().add(value, unit);
                    if (type === 'from' || type === 'min') {
                        m = m.startOf(unit.replace(/s$/, ''));
                    } else if (type === 'to' || type === 'max') {
                        m = m.endOf(unit.replace(/s$/, ''));
                    }
                    return +m.format('X');
                } else {
                    return +moment(value).format('X');
                }
            }
        },
        
        convertSliderValue: function(type, value) {
            var unit = this.getSliderUnit();
            var m = moment(value, 'X');
            if (unit && (type === 'from' || type === 'min')) {
                m = m.startOf(unit.replace(/s$/, ''));
            } else if (unit && (type === 'to' || type === 'max')) {
                m = m.endOf(unit.replace(/s$/, ''));
            }
            return m.toDate();
        }
        
    };
    
    Form.DateSliderControl = Form.SliderControl.extend(DateMixin);
    Form.DateRangeSliderControl = Form.RangeControl.extend(DateMixin);
    
    return SliderControl;
    
});