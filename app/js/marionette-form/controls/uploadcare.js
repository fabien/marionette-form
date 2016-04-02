define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'filesize',
    'clipboard',
    'backbone.bootstrap-modal'
], function($, _, Backbone, Marionette, Form, filesize, Clipboard) {
    
    // Documentation:
    //
    // https://uploadcare.com/documentation/widget/
    // https://uploadcare.com/documentation/javascript_api/
    
    // Setup instructions:
    //
    // <!-- load jquery as normal, instead of through requirejs -->
    // <script src="/js/vendor/jquery/dist/jquery.js"></script>
    // <script src="/js/vendor/requirejs/require.js"></script>
    // <!-- use jquery from script tag above with requirejs -->
    // <script>define('jquery', [], function() { return jQuery; });</script>
    // <!-- global upload-care config -->
    // <script>UPLOADCARE_LIVE = false; UPLOADCARE_MANUAL_START = true;</script>
    // <script src="https://ucarecdn.com/widget/2.8.1/uploadcare/uploadcare.min.js" charset="utf-8"></script>
    
    if (!window.uploadcare) throw new Error('Uploadcare has not been loaded');
    
    var utils = Form.utils;
    
    var templateHelpers = {
        formatName: utils.formatName,
        isBlank: utils.isBlank,
        camelize: utils.camelize,
        truncate: utils.truncate,
        filesize: filesize
    };
    
    var attributes = [
        'multiple', 'multipleMin', 'multipleMax', 'imagesOnly', 
        'previewStep', 'crop', 'imageShrink', 'clearable',
        'tabs', 'inputAcceptTypes', 'preferredTypes',
        'systemDialog', 'cdnBase', 'doNotStore'
    ];
    
    var dataAttr = 'uploadcareWidget';
    
    Form.Templates.UploadcareGalleryControl = _.template([
        '<% if (obj.label) { %><label class="<%= labelClassName %>"><%= obj.label %></label><% } %>',
        '<div class="<%= controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <iframe src="<%- value %>" width="<%- width %>" height="<%- height %>" allowfullscreen="true" frameborder="0"></iframe>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%= helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Form.Templates.UploadcareControl = _.template([
        '<label class="<%= labelClassName %>" for="control-<%= id %>"><%= label %></label>',
        '<div class="<%= controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <div class="input-group disabled-control hidden">',
        '    <% if (obj.input) { %>',
        '    <input id="control-<%= id %>-disabled" class="<%= controlClassName %>" type="text" value="<%- value %>" placeholder="<%- placeholder %>" <%= disabled ? "disabled" : "" %> <%= required ? "required" : "" %> <%= readonly ? "readonly" : "" %> role="uploadcare-disabled"/>',
        '    <% } else { %>',
        '    <div id="control-<%= id %>-synopsis" class="form-control immutable" role="control">',
        '      <% if (obj.icon) { %><span class="<%= icon %>" aria-hidden="true" data-action="copy" role="uploadcare-icon"></span><% } %>',
        '      <span class="synopsis"><%- obj.synopsis %></span>',
        '    </div>',
        '    <% } %>',
        '    <div class="input-group-btn" role="group">',
        '      <button data-action="show" type="button" class="btn btn-default"><span class="<%= showIcon %>" aria-hidden="true"></span></button>',
        '    </div>',
        '  </div>',
        '  <input id="control-<%= id %>" name="<%= name %>" data-key="<%= key %>" type="hidden" value="<%- value %>" role="uploadcare-uploader"/>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%= helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    var UploadcareFile = Form.UploadcareFile = Form.Model.extend({
        
        idAttribute: 'uuid',
        
        toFile: function(settings) {
            return uploadcare.fileFrom('uploaded', this.get('cdnUrl') || this.id, settings);
        }
        
    });
    
    var UploadcareCollection = Form.UploadcareCollection = Form.Collection.extend({
        
        model: UploadcareFile,
        
        toFileGroup: function(settings) {
            var files = this.map(function(model) {
                return model.toFile(settings);
            });
            return uploadcare.FileGroup(files, settings);
        }
        
    });
    
    var UploadcareTabView = Form.UploadcareTabView = Marionette.LayoutView.extend({
        
        constructor: function(options) {
            options = _.extend({}, options);
            var settings = _.extend({}, options.settings);
            if (options.el) settings.el = options.el;
            this.tabName = options.name;
            this.dialog = options.dialog;
            this.button = options.button;
            this.control = settings.control;
            if (!this.control instanceof UploadcareControl) {
                throw new Error('Invalid UploadcareControl instance');
            }
            _.extend(settings, this.control.getTabSettings());
            Marionette.LayoutView.prototype.constructor.call(this, settings);
            this.control.triggerMethod('dialog:tab:init', this.dialog, this);
        },
        
        getFiles: function() {
            var fileCollection = this.dialog.fileColl;
            var files = [];
            for (var i = 0; i < fileCollection.length(); i++) {
                files.push(fileCollection.get(i));
            }
            return files;
        },
        
        getFileGroup: function(settings) {
            return uploadcare.FileGroup(this.getFiles(), settings);
        },
        
        bindToFileCollection: function(collection) {
            if (collection instanceof UploadcareCollection) {
                var fileCollection = this.dialog.fileColl;
                var updateCollectionFn = this._updateCollection.bind(this, collection);
                updateCollectionFn(); // initial call
                fileCollection.onAdd.add(updateCollectionFn);
                fileCollection.onRemove.add(updateCollectionFn);
                fileCollection.onSort.add(updateCollectionFn);
                fileCollection.onReplace.add(updateCollectionFn);
                this.on('destroy', function() {
                    fileCollection.onAdd.remove(updateCollectionFn);
                    fileCollection.onRemove.remove(updateCollectionFn);
                    fileCollection.onSort.remove(updateCollectionFn);
                    fileCollection.onReplace.remove(updateCollectionFn);
                });
            } else {
                throw new Error('Invalid UploadcareCollection');
            }
        },
        
        _updateCollection: function(collection) {
            $.when.apply(null, this.dialog.fileColl.get()).then(function() {
                collection.set(_.toArray(arguments));
            });
        }
        
    }, {
        
        register: function(name, options) {
            var self = this;
            uploadcare.registerTab(name, function(container, button, dialogApi, settings, name) {
                settings = _.extend({}, options, settings);
                self.attach(container, button, dialogApi, settings, name);
            });
        },
        
        attach: function(container, button, dialog, settings, name) {
            var view = new this({
                name: name, dialog: dialog, button: button, el: container,
                settings: settings
            });
            dialog.done(view.triggerMethod.bind(view, 'dialog:done', dialog));
            dialog.fail(view.triggerMethod.bind(view, 'dialog:fail', dialog));
            dialog.progress(function(tabName) {
                if (tabName === name) view.triggerMethod('dialog:tab:switch', dialog);
            });
            dialog.always(view.destroy.bind(view));
            view.render();
        }
        
    });
    
    Form.UploadcareGalleryControl = Form.BaseControl.extend({
        
        template: Form.Templates.UploadcareGalleryControl,
        
        defaults: {
            label: '',
            extraClasses: [],
            helpMessage: null,
            settings: '/nav/thumbs/-/fit/cover/-/loop/true/-/allowfullscreen/native/-/thumbwidth/100/',
            width: '100%',
            height: '450'
        },
        
        ui: {
            iframe: 'iframe'
        },
        
        constructor: function(options) {
            Form.BaseControl.prototype.constructor.apply(this, arguments);
            this.on('value:change', function(model, value, options) {
                this.ui.iframe.toggleClass('hidden', !this.isValidUrl(value));
            });
        },
        
        isValidUrl: function(value) {
            return (_.isString(value) && !!value.match(/~(\d+)\/$/));
        },
        
        serializeValue: function() {
            var settings = this.getAttribute('settings');
            var value = this.getValue(true);
            value = this.formatter.fromRaw(value);
            if (this.isValidUrl(value) && _.isString(settings) && !isBlank(settings)) {
                if (settings.indexOf('/') === 0) settings = settings.slice(1);
                value += 'gallery/-/' + settings;
            } else {
                value = '';
            }
            return value;
        }
        
    });
    
    Form.UploadcareView = Marionette.LayoutView.extend({
        
        template: _.template('UploadcareView'),
        
        modalOptions: {
            allowCancel: false
        },
        
        constructor: function(options) {
            Marionette.LayoutView.prototype.constructor.apply(this, arguments);
            this.deferred = $.Deferred();
            if (options && options.src) this.setData(options.src);
        },
        
        setData: function(src) {
            console.log('SET SRC', src);
            this.deferred.resolve();
        },
        
        templateHelpers: templateHelpers
        
    });
    
    var UploadcareControl = Form.UploadcareControl = Form.Control.extend(_.extend({}, Form.CollectionMixin, {
        
        template: Form.Templates.UploadcareControl,
        
        defaults: {
            label: '',
            placeholder: '',
            extraClasses: [],
            helpMessage: null,
            multiple: false,
            clearable: true,
            preview: false,
            input: false,
            blankIcon:  'blank',
            emptyIcon:  'empty',
            showIcon:   'glyphicon glyphicon-eye-open',
            fileIcon:   'glyphicon glyphicon-file',
            filesIcon:  'glyphicon glyphicon-th-list',
            imageIcon:  'glyphicon glyphicon-picture',
            imagesIcon: 'glyphicon glyphicon-th'
        },
        
        ui: {
            control: '[role="uploadcare-uploader"]',
            disabledControl: '.disabled-control',
            synopsis: '.synopsis',
            synopsisIcon: '[role="uploadcare-icon"]'
        },
        
        controlEvents: {
            'click .form-control': '_openDialog'
        },
        
        bootstrapModal: Backbone.BootstrapModal,
        
        modalView: Form.UploadcareView,
        
        collectionConstructor: UploadcareCollection,
        
        renderOnValueChange: false,
        
        synopsisTemplate: _.template([
            '<span class="synopsis-name"><%- truncate(obj.name, 32) %></span>, ',
            '<span class="synopsis-size"><%- filesize(obj.size) %></span>'
        ].join('\n')),
        
        constructor: function(options) {
            Form.Control.prototype.constructor.apply(this, arguments);
            var synopsis = this.getAttribute('synopsis');
            if (_.isString(synopsis)) this.synopsisTemplate = _.template(synopsis);
            
            if (this.isMultiple() && this.getAttribute('collection') !== false) {
                this.collection = this.collection || this.getCollection(options);
                this.listenTo(this.collection, 'reset sync change update', this._onCollectionUpdate);
                this.on('update:files change:files delete:files', this._updateCollection);
            }
            
            this.on('change update', this._updateSynopsis);
            this.on('dialog:open', this._onDialogOpen);
            this.on('render', this._attachPlugins);
            this.on('destroy', this._detachPlugins);
        },
        
        openDialog: function(tab) {
            if (this.widget) {
                return this.widget.openDialog(tab);
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
        
        isImagesOnly: function() {
            return this.getAttribute('imagesOnly') === true;
        },
        
        hasPreview: function() {
            return this.getAttribute('preview') === true;
        },
        
        getIcon: function() {
            var isBlank = this.isBlank();
            var isMultiple = this.isMultiple();
            var isImagesOnly = this.isImagesOnly();
            if (isMultiple && isBlank) {
                return this.getAttribute('emptyIcon')
            } else if (isBlank) {
                return this.getAttribute('blankIcon');
            } else if (isMultiple && isImagesOnly) {
                return this.getAttribute('imagesIcon');
            } else if (isImagesOnly) {
                return this.getAttribute('imageIcon');
            } else if (isMultiple) {
                return this.getAttribute('filesIcon');
            } else {
                return this.getAttribute('fileIcon');
            }
        },
        
        serializeSynopsis: function(resolvedValue) {
            resolvedValue = resolvedValue || this.resolvedValue;
            if (this.isBlank() || !resolvedValue) {
                return this.getAttribute('placeholder') || '';
            } else {
                var template = this.getOption('synopsisTemplate');
                var data = _.extend({}, templateHelpers, resolvedValue);
                return template(data);
            }
        },
        
        serializeField: function() {
            var data = Form.Control.prototype.serializeField.apply(this, arguments);
            data.synopsis = this.serializeSynopsis();
            data.icon = this.getIcon();
            return data;
        },
        
        getSettings: function() {
            var defaults = _.extend({}, _.result(this.constructor, 'defaults'));
            var settings = _.defaults(this.getAttributes(attributes), defaults);
            settings.control = this;
            return settings;
        },
        
        getTabSettings: function(tabName) {
            return _.extend({}, this.getAttribute(tabName + 'Tab') || {});
        },
        
        // Value/File(s) handling
        
        onValueChange: function(model, value, options) {
            if (this.widget && _.isString(value)) {
                this.ui.disabledControl.val(value);
                this.widget.value(value);
            } else if (this.widget) {
                this.ui.disabledControl.val('');
                this.widget.value(null);
            }
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
        
        getFileGroup: function(settings) {
            if (this.widget && this.isMultiple()) {
                return this.widget.value();
            } else if (this.widget) {
                var file = this.widget.value();
                if (file) return uploadcare.FileGroup([file], settings);
            }
            return uploadcare.FileGroup([], settings);
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
        
        getUrl: function() {
            if (this.resolvedValue) return this.resolvedValue.cdnUrl;
        },
        
        reloadInfo: function() {
            if (this.widget) {
                return this.widget.reloadInfo.apply(this.widget, arguments);
            } else {
                return $.Deferred().reject().promise();
            }
        },
        
        // Modal View
        
        showModal: function(event) {
            if (event instanceof $.Event) {
                event.preventDefault();
                $(event.currentTarget).blur();
            }
            if (this.modal || this.isBlank()) return; // singleton
            var view = this.createModalView();
            var dfd = $.Deferred();
            this.modal = this.openModalWithView(view, function(dialog) {
                dfd.resolve(dialog);
            }.bind(this)).fail(function(err) {
                dfd.reject(err);
            }).always(function() {
                delete this.modal;
            }.bind(this));
            return dfd.promise();
        },
        
        onActionShow: function(event) {
            this.showModal(event);
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
                this.triggerMethod(isMultiple ? 'delete:files' : 'delete:file', this.resolvedValue);
                this.resolvedValue = null;
                this.resolvedUrl = null;
                this.triggerMethod('change');
            } else if (isMultiple) {
                if (this.isBlank() || this.resolvedValue) this.triggerMethod('before:change', change);
                change.promise().then(function(fileGroup) {
                    if (this.isBlank() || (this.resolvedUrl && fileGroup.cdnUrl !== this.resolvedUrl)) {
                        this.resolvedValue = fileGroup;
                        this.resolvedUrl = fileGroup.cdnUrl;
                        this.triggerMethod('change:files', fileGroup);
                        this.triggerMethod('change', fileGroup);
                    } else {
                        this.resolvedValue = fileGroup;
                        this.resolvedUrl = fileGroup.cdnUrl;
                        this.triggerMethod('update:files', fileGroup);
                        this.triggerMethod('update', fileGroup);
                    }
                }.bind(this), this.triggerMethod.bind(this, 'upload:error'));
            } else {
                if (this.isBlank() || this.resolvedValue) this.triggerMethod('before:change', change);
                change.then(function(file) {
                    if (this.isBlank() || (this.resolvedUrl && file.cdnUrl !== this.resolvedUrl)) {
                        this.resolvedValue = file;
                        this.resolvedUrl = file.cdnUrl;
                        this.triggerMethod('change:file', file);
                        this.triggerMethod('change', file);
                    } else {
                        this.resolvedValue = file;
                        this.resolvedUrl = file.cdnUrl;
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
            this.dialog.progress(this.triggerMethod.bind(this, 'dialog:tab:switch', dialog));
            this.dialog.always(function() { this.dialog = null; }.bind(this));
        },
        
        _openDialog: function(event) {
            if (this.getAttribute('clickable') === false) return;
            var $target = $(event.target);
            if (this.widget && ($target.hasClass('form-control') || $target.hasClass('uploadcare-widget-text'))) {
                event.preventDefault();
                event.stopPropagation();
                if (!this.isImmutable()) this.widget.openDialog();
            }
        },
        
        // Plugin
        
        _attachPlugins: function() {
            this._detachPlugins(this.ui.control);
            
            var defaults = _.extend({}, _.result(this.constructor, 'defaults'));
            var settings = this.getSettings();
            this.triggerMethod('attach:plugin', settings);
            this.ui.control.data(settings); // pre-configure widget
            
            if (this.isMultiple()) {
                this.widget = uploadcare.MultipleWidget(this.ui.control);
            } else {
                this.widget = uploadcare.SingleWidget(this.ui.control);
            }
            
            var $widget = this.$('.uploadcare-widget');
            
            var isImmutable = this.isImmutable();
            $widget.toggleClass('hidden', isImmutable);
            this.ui.disabledControl.toggleClass('hidden', !isImmutable);
            
            if (defaults.formControl !== false && this.getAttribute('formControl') !== false) {
                $widget.addClass('form-control'); // Bootstrap style by default
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
            
            // Clipboard
            var copyButton = this.$('[data-action="copy"]')[0];
            if (copyButton) {
                this.clipboard = new Clipboard(copyButton, {
                    text: this.getUrl.bind(this)
                });
            }
            
            if (this.hasPreview()) {
                this.$el.addClass('control-uploadcare-with-preview');
                this.on('change update', this._updatePreview);
            } else {
                this.$el.removeClass('control-uploadcare-with-preview');
            }
        },
        
        _detachPlugins: function() {
            this.triggerMethod('detach:plugin');
            if (this.clipboard) this.clipboard.destroy();
            this.ui.control.off('.uploadcare');
            this.$('.uploadcare-widget').remove();
            this.resolvedValue = null;
            this.resolvedUrl = null;
            this.widget = null;
        },
        
        // Preview/Synopsis handling
        
        _updateSynopsis: function(resolvedValue) {
            var synopsis = this.serializeSynopsis(resolvedValue);
            this.ui.synopsis.html(synopsis || '');
            this.ui.synopsisIcon.attr('class', this.getIcon() || '');
        },
        
        _updatePreview: function() {
            var preview = this.getAttribute('preview');
            console.log('PREVIEW', preview);
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
        
    }, Form.ModalViewMixin), {
        
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
        
        fileFrom: function(source, from, settings) {
            return uploadcare.fileFrom(from || 'uploaded', source, settings);
        },
        
        fileGroup: function(source, from, settings) {
            if (_.isArray(source)) {
                from = from || 'uploaded';
                var files = _.map(source, function(file) {
                    return this.fileFrom(file, from, settings);
                }.bind(this));
                return uploadcare.FileGroup(files, settings);
            } else {
                return uploadcare.FileGroup(source, settings);
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
    
    function isBlank(obj) {
        if (_.isNumber(obj)) return false;
        return _.isNull(obj) || _.isUndefined(obj) || _.isEmpty(obj) ||
            (_.isString(obj) && /^[\s\t\r\n]*$/.test(obj));
    };
    
});