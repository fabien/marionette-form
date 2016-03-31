define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form'
], function($, _, Backbone, Marionette, Form) {
    
    
    // Locale string
    // 
    // Global: UPLOADCARE_LOCALE 
    // Local: N/A 
    // Object key: N/A 
    // 
    // The widget supports a great list of languages.
    // 
    // Currently there are:
    // en  ar  az  ca  cs  da  de  es  fr  he  it  ja  lv  nb  nl  pl  pt  ru  sv  tr  zhTW  zh
    // English is used by default.
    // 
    // 
    // Locale translations object
    // 
    // Global: UPLOADCARE_LOCALE_TRANSLATIONS 
    // Local: N/A 
    // Object key: N/A 
    // 
    // Custom localization options (see below).
    // 
    // 
    // Locale pluralize object
    
    
    
    if (!window.uploadcare) throw new Error('Uploadcare has not been loaded');
    
    var attributes = [
        'multiple', 'multipleMin', 'multipleMax', 'imagesOnly', 
        'previewStep', 'crop', 'imageShrink', 'clearable',
        'tabs', 'inputAcceptTypes', 'preferredTypes',
        'systemDialog', 'cdnBase', 'doNotStore'
    ];
    
    var dataAttr = 'uploadcareWidget';
    
    Form.Templates.UploadcareControl = _.template([
        '<label class="<%= labelClassName %>" for="control-<%= id %>"><%= label %></label>',
        '<div class="<%= controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <% if (disabled || readonly) { %>',
        '  <input id="control-<%= id %>" name="<%= name %>" data-key="<%= key %>" type="text" value="<%- value %>" readonly/>',
        '  <% } else { %>',
        '  <input id="control-<%= id %>" name="<%= name %>" data-key="<%= key %>" type="hidden" value="<%- value %>" role="uploadcare-uploader"/>',
        '  <% } %>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%= helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    // SET/GET individual images as array of objects
    // custom tab pane(s)
    
    var UploadcareFile = Form.Model.extend({
        
        idAttribute: 'uuid'
        
    });
    
    var UploadcareCollection = Form.UploadcareCollection = Form.Collection.extend({
        
        model: UploadcareFile
        
    });
    
    var UploadcareControl = Form.UploadcareControl = Form.Control.extend(_.extend({}, Form.CollectionMixin, {
        
        template: Form.Templates.UploadcareControl,
        
        defaults: {
            label: '',
            extraClasses: [],
            helpMessage: null,
            multiple: false,
            clearable: true
        },
        
        ui: {
            control: 'input'
        },
        
        collectionConstructor: UploadcareCollection,
        
        constructor: function(options) {
            Form.Control.prototype.constructor.apply(this, arguments);
            if (this.isMultiple() && this.getAttribute('collection') !== false) {
                this.collection = this.collection || this.getCollection(options);
                this.listenTo(this.collection, 'reset sync change update', this._onCollectionUpdate);
                this.on('update:files change:files delete:files', this._updateCollection);
            }
            this.on('dialog:open', this._onDialogOpen);
            this.on('render', this._attachPlugin);
            this.on('destroy', this._detachPlugin);
        },
        
        openDialog: function() {
            if (this.widget) {
                return this.widget.openDialog.apply(this.widget, arguments);
            } else {
                return $.Deferred().reject().promise();
            }
        },
        
        openPanel: function(el, tab, settings) {
            if (!this.widget && this.getAttribute('panel')) {
                if (_.isObject(tab)) settings = tab, tab = null;
                el = el || this.el;
                tab = tab || this.getAttribute('tab');
                settings = _.extend({}, this.getSettings(), settings);
                var dfd = $.Deferred();
                this.getFiles().then(function(files) {
                    var panel = uploadcare.openPanel(el, files, tab, settings);
                    dfd.resolve(panel);
                }, function(error) {
                    dfd.reject(error);
                });
                return dfd;
            } else {
                return $.Deferred().reject().promise();
            }
        },
        
        isMultiple: function() {
            return this.getAttribute('multiple') === true;
        },
        
        getSettings: function() {
            var defaults = _.extend({}, _.result(this.constructor, 'defaults'));
            return _.defaults(this.getAttributes(attributes), defaults);
        },
        
        get: function() {
            if (this.widget) this.widget.value();
        },
        
        set: function(value, from) {
            if (this.widget && _.isArray(value)) {
                this.setFiles(value, from);
            } else {
                this.widget.value(value);
            }
        },
        
        getFile: function() {
            var dfd = $.Deferred();
            this.getFiles().then(function(files) {
                dfd.resolve(_.first(files));
            }, function(error) {
                dfd.reject(error);
            });
            return dfd;
        },
        
        setFile: function(source, from) {
            if (this.widget && this.isMultiple()) {
                var files = [].concat(source || []);
                var group = this.constructor.fileGroup(files, from);
                this.widget.value(group);
                return group;
            } else if (this.widget) {
                var file = this.constructor.fileFrom(source, from);
                this.widget.value(file);
                return file;
            }
        },
        
        getFiles: function() {
            var dfd = $.Deferred();
            if (this.widget && this.isMultiple()) {
                var fileGroup = this.widget.value();
                if (!fileGroup) return dfd.resolve([]).promise();
                $.when.apply(null, fileGroup.files()).then(function() {
                    dfd.resolve(_.toArray(arguments));
                }, function(error) {
                    dfd.reject(error);
                });
                return dfd.promise();
            } else if (this.widget) {
                var file = this.widget.value();
                if (!file) return dfd.resolve([]).promise();
                file.then(function(fileInfo) {
                    dfd.resolve([fileInfo]);
                }, function(error) {
                    dfd.reject(error);
                });
                return dfd.promise();
            } else {
                return dfd.resolve([]).promise();
            }
        },
        
        setFiles: function(files, from) {
            files = _.compact([].concat(files || []));
            if (_.isEmpty(files)) {
                this.widget.value(null);
            } else if (this.widget && this.isMultiple()) {
                var group = this.constructor.fileGroup(files, from);
                this.widget.value(group);
            } else if (this.widget) {
                this.widget.value(_.first(files));
            }
            return this.getFiles();
        },
        
        reloadInfo: function() {
            if (this.widget) {
                return this.widget.reloadInfo.apply(this.widget, arguments);
            } else {
                return $.Deferred().reject().promise();
            }
        },
        
        // Validation
        
        validateFile: function(fileInfo) {}, // Hook
        
        getValidator: function(name) {
            return this.constructor.validator.apply(this.constructor, arguments);
        },
        
        addValidator: function(fn) {
            if (_.isString(fn)) fn = this.getValidator.apply(this, arguments);
            if (!this.widget || !_.isFunction(fn)) return;
            this.widget.validators.push(fn);
        },
        
        removeValidator: function(fn) {
            if (!this.widget || !_.isFunction(fn)) return;
            var index = this.widget.validators.indexOf(fn);
            if (index > -1) this.widget.validators.splice(index, 1);
        },
        
        clearValidators: function() {
            if (!this.widget) return;
            this.widget.validators.length = 0;
        },
        
        _validateFile: function(fileInfo) {
            this.validateFile(fileInfo);
            this.triggerMethod('validate:file', fileInfo);
        },
        
        // Lifecycle
        
        _onChange: function(change) {
            var isMultiple = this.isMultiple();
            if (!change) {
                this.triggerMethod(isMultiple ? 'delete:files' : 'delete:file', this._previousValue);
                this._previousValue = null;
                this._previousUrl = null;
                this.triggerMethod('change');
            } else if (isMultiple) {
                if (this.isBlank() || this._previousValue) this.triggerMethod('before:change', change);
                change.promise().then(function(fileGroup) {
                    if (this.isBlank() || (this._previousUrl && fileGroup.cdnUrl !== this._previousUrl)) {
                        this._previousValue = fileGroup;
                        this._previousUrl = fileGroup.cdnUrl;
                        this.triggerMethod('change:files', fileGroup);
                        this.triggerMethod('change', fileGroup);
                    } else {
                        this._previousValue = fileGroup;
                        this._previousUrl = fileGroup.cdnUrl;
                        this.triggerMethod('update:files', fileGroup);
                        this.triggerMethod('update', fileGroup);
                    }
                }.bind(this), this.triggerMethod.bind(this, 'upload:error'));
            } else {
                if (this.isBlank() || this._previousValue) this.triggerMethod('before:change', change);
                change.then(function(file) {
                    if (this.isBlank() || (this._previousUrl && file.cdnUrl !== this._previousUrl)) {
                        this._previousValue = file;
                        this._previousUrl = file.cdnUrl;
                        this.triggerMethod('change:file', file);
                        this.triggerMethod('change', file);
                    } else {
                        this._previousValue = file;
                        this._previousUrl = file.cdnUrl;
                        this.triggerMethod('update:file', file);
                        this.triggerMethod('update', file);
                    }
                }.bind(this), this.triggerMethod.bind(this, 'upload:error'));
            }
        },
        
        _onDialogOpen: function(dialog) {
            this.dialog = dialog;
            this.dialog.done(this.triggerMethod.bind(this, 'dialog:done', dialog));
            this.dialog.fail(this.triggerMethod.bind(this, 'dialog:fail', dialog));
            this.dialog.progress(this.triggerMethod.bind(this, 'dialog:tab', dialog));
            this.dialog.always(function() { this.dialog = null; }.bind(this));
        },
        
        // Plugin
        
        _attachPlugin: function() {
            this._detachPlugin(this.ui.control);
            var settings = this.getSettings();
            this.triggerMethod('attach:plugin', settings);
            this.ui.control.data(settings); // pre-configure widget
            
            if (this.isMultiple()) {
                this.widget = uploadcare.MultipleWidget(this.ui.control);
            } else {
                this.widget = uploadcare.SingleWidget(this.ui.control);
            }
            
            var validators = [this._validateFile.bind(this)];
            var maxFileSize = this.getAttribute('maxFileSize');
            if (_.isNumber(maxFileSize) && maxFileSize > 0) {
                var validator = this.getValidator('maxFileSize', maxFileSize);
                if (_.isFunction(validator)) validators.push(validator);
            }
            
            validators = validators.concat(_.result(this.constructor, 'validators') || []);
            _.each(validators, this.addValidator.bind(this));
            
            this.widget.onChange(this._onChange.bind(this));
            this.widget.onUploadComplete(this.triggerMethod.bind(this, 'upload:complete'));
            this.widget.onDialogOpen(this.triggerMethod.bind(this, 'dialog:open'));
        },
        
        _detachPlugin: function() {
            this.triggerMethod('detach:plugin');
            cleanupWidget(this.ui.control);
            this._previousValue = null;
            this._previousUrl = null;
            this.widget = null;
        },
        
        // Collection handling
        
        _updateCollection: function() {
            this.getFiles().then(function(files) {
                this.collection.set(files, { widget: this.widget });
            }.bind(this), function() {
                this.collection.reset({ widget: this.widget });
            }.bind(this));
        },
        
        _onCollectionUpdate: function() {
            var options = _.extend({}, _.last(arguments));
            if (options.widget) return; // ignore self-inflicted
            var files = [];
            this.collection.each(function(file) {
                if (file.has('cdnUrl')) {
                    files.push(file.get('cdnUrl'));
                } else if (file.id) {
                    files.push(file.id);
                }
            });
            this.setFiles(files);
        }
        
    }), {
        
        // Global settings
        
        defaults: {},
        
        validators: [],
        
        validator: function(name) {
            var validatorFn = UploadcareControl.Validation[name];
            return _.isFunction(validatorFn) && validatorFn.apply(null, _.rest(arguments));
        },
        
        // Static methods
        
        openDialog: function() {
            return uploadcare.openDialog.apply(uploadcare, arguments);
        },
        
        openPanel: function() {
            return uploadcare.openPanel.apply(uploadcare, arguments);
        },
        
        // Utility methods/factories
        
        fileFrom: function(source, from) {
            return uploadcare.fileFrom(from || 'uploaded', source);
        },
        
        fileGroup: function(source, from) {
            if (_.isArray(source)) {
                from = from || 'uploaded';
                var files = _.map(source, function(file) {
                    return this.fileFrom(file, from);
                }.bind(this));
                return uploadcare.FileGroup(files);
            } else {
                return uploadcare.FileGroup(source);
            }
        }
        
    });
    
    UploadcareControl.Validation = {};
    
    UploadcareControl.Validation.maxFileSize = function(size) {
        size = size * 1024; // kilobytes
        return function(fileInfo) {
            if (fileInfo.size !== null && fileInfo.size > size) {
                throw new Error('fileMaximumSize');
            }
        };
    };
    
    return UploadcareControl;
    
    function cleanupWidget(input) {
        return input.off('.uploadcare').each(function() {
            var widget, widgetElement;
            widgetElement = $(this).next('.uploadcare-widget');
            widget = widgetElement.data(dataAttr);
            if (widget && widget.inputElement === this) {
                return widgetElement.remove();
            }
        });
    };
    
});