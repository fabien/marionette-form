define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'intl-tel-input'
], function($, _, Backbone, Marionette, Form) {
    
    // IMPORTANT: explicitly load the utils in your script, like this:
    //
    // $.fn.intlTelInput.loadUtils('/js/lib/intl-tel-input-utils.js');
    
    var attrs = [
        'allowDropdown', 'autoHideDialCode', 'autoPlaceholder', 'dropdownContainer',
        'formatOnInit', 'initialCountry', 'nationalMode', 'separateDialCode'
    ];
    
    var defaults = {
        allowDropdown: true,
        autoHideDialCode: true,
        autoPlaceholder: true,
        formatOnInit: true,
        nationalMode: false,
        separateDialCode: false
    };
    
    var phoneFormats = {
        E164: 0,
        INTERNATIONAL: 1,
        NATIONAL: 2,
        RFC3966: 3
    };
    
    var phoneTypes = {
        FIXED_LINE: 0,
        MOBILE: 1,
        // In some regions (e.g. the USA), it is impossible to distinguish between
        // fixed-line and mobile numbers by looking at the phone number itself.
        FIXED_LINE_OR_MOBILE: 2,
        // Freephone lines
        TOLL_FREE: 3,
        PREMIUM_RATE: 4,
        // The cost of this call is shared between the caller and the recipient, and
        // is hence typically less than PREMIUM_RATE calls. See
        // http://en.wikipedia.org/wiki/Shared_Cost_Service for more information.
        SHARED_COST: 5,
        // Voice over IP numbers. This includes TSoIP (Telephony Service over IP).
        VOIP: 6,
        // A personal number is associated with a particular person, and may be routed
        // to either a MOBILE or FIXED_LINE number. Some more information can be found
        // here: http://en.wikipedia.org/wiki/Personal_Numbers
        PERSONAL_NUMBER: 7,
        PAGER: 8,
        // Used for 'Universal Access Numbers' or 'Company Numbers'. They may be
        // further routed to specific offices, but allow one number to be used for a
        // company.
        UAN: 9,
        // Used for 'Voice Mail Access Numbers'.
        VOICEMAIL: 10,
        // A phone number is of type UNKNOWN when it does not fit any of the known
        // patterns for a specific region.
        UNKNOWN: -1
    };
    
    var phoneTypesLookup = _.invert(phoneTypes);
    
    var validationErrors = {
        IS_POSSIBLE: 0,
        INVALID_COUNTRY_CODE: 1,
        TOO_SHORT: 2,
        TOO_LONG: 3,
        NOT_A_NUMBER: 4
    };
    
    var validationErrorsLookup = _.invert(validationErrors);
    
    var PhoneControl = Form.PhoneControl = Form.InputControl.extend({
        
        constructor: function(options) {
            Form.InputControl.prototype.constructor.apply(this, arguments);
            this.on('render', this._attachPlugin);
            this.on('destroy', this._detachPlugin);
        },
        
        controlEvents: {
            'countrychange @ui.control': '_onCountryChange'
        },
        
        onChange: function(event) {
            var number = this.getNumber();
            this.ui.control.val(number);
            this.commit();
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return Form.InputControl.prototype.getValue.call(this, fromModel);
            } else {
                return this.coerceValue(this.getNumber());
            }
        },
        
        getNumberType: function() {
            var numberType = this.ui.control.intlTelInput('getNumberType');
            return phoneTypesLookup[numberType] || 'UNKNOWN';
        },
        
        getNumber: function(value, format) {
            var format = _.isUndefined(format) ? this.getPhoneFormat() : format;
            return this.ui.control.intlTelInput('getNumber', format);
        },
        
        setNumber: function(value, format) {
            var format = _.isUndefined(format) ? this.getPhoneFormat() : format;
            this.ui.control.intlTelInput('setNumber', value, format);
        },
        
        getCountry: function() {
            var countryData = this.getSelectedCountryData();
            return countryData && countryData.iso2;
        },
        
        setCountry: function(countryCode) {
            this.ui.control.intlTelInput('setCountry', countryCode);
        },
        
        getSelectedCountryData: function() {
            return this.ui.control.intlTelInput('getSelectedCountryData');
        },
        
        getPhoneFormat: function() {
            var phoneFormat = this.getAttribute('phoneFormat') || 'INTERNATIONAL';
            phoneFormat = phoneFormat.toUpperCase();
            return phoneFormats[phoneFormat] || 0;
        },
        
        getValidationErrorCode: function() {
            var error = this.ui.control.intlTelInput('getValidationError');
            return validationErrorsLookup[error] || 'IS_POSSIBLE';
        },
        
        geoIpLookup: function(callback) {
            Form.geoIpLookup(function(resp) {
                var countryCode = (resp && resp.country) ? resp.country : '';
                callback(countryCode);
            });
        },
        
        isMobile: function() {
            return this.getNumberType() === 'MOBILE';
        },
        
        isValidNumber: function() {
            return this.ui.control.intlTelInput('isValidNumber');
        },
        
        isValid: function(options) {
            if (!this.isValidNumber()) return false;
            return Form.InputControl.prototype.isValid.call(this, options);
        },
        
        _attachPlugin: function() {
            this._detachPlugin();
            var options = _.defaults({}, this.getAttributes(attrs), defaults);
            options.utilsScript = PhoneControl.utilsScript;
            options.numberType = this.getAttribute('mobile') ? 'MOBILE' : 'FIXED_LINE';
            
            if (options.initialCountry === 'auto') {
                options.geoIpLookup = this.geoIpLookup.bind(this);
            }
            
            if (_.isFunction(this.customPlaceholder)) {
                options.customPlaceholder = this.customPlaceholder.bind(this);
            }
            
            var onlyCountries = [].concat(this.getAttribute('only') || []);
            if (!_.isEmpty(onlyCountries)) options.onlyCountries = onlyCountries;
            
            var preferredCountries = [].concat(this.getAttribute('preferred') || []);
            if (!_.isEmpty(preferredCountries)) options.preferredCountries = preferredCountries;
            
            var excludeCountries = [].concat(this.getAttribute('exclude') || []);
            if (!_.isEmpty(excludeCountries)) options.excludeCountries = excludeCountries;
            
            this.ui.control.intlTelInput(options).done(function() {
                this.trigger('control:ready');
            }.bind(this));
        },
        
        _detachPlugin: function() {
            this.ui.control.intlTelInput('destroy');
        },
        
        _onCountryChange: function(e, countryData) {
            this.triggerMethod('country:change', countryData);
            setTimeout(function() { this.onChange(e); }.bind(this), 10);
        }
        
    }, {
        
        phoneFormats: phoneFormats,
        
        phoneTypes: phoneTypes,
        
        formatNumber: function(phoneNumber, countryCode, format) {
            if (!window.intlTelInputUtils) return phoneNumber;
            format = format || phoneFormats.INTERNATIONAL;
            return intlTelInputUtils.formatNumber(phoneNumber, countryCode, format);
        }
        
    });
    
    return PhoneControl;
    
});