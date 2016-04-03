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
    
    var uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
    var fileIdRegex = new RegExp('' + uuidRegex.source + '\/?$', 'i');
    var groupIdRegex = new RegExp('' + uuidRegex.source + '~[0-9]+\/?$', 'i');
    var cdnUrlRegex = new RegExp("/(" + uuidRegex.source + ")(?:/(-/(?:[^/]+/)+)?([^/]*))?$", 'i');
    
    var utils = Form.utils;
    
    var templateHelpers = {
        formatName: utils.formatName,
        isBlank: utils.isBlank,
        camelize: utils.camelize,
        truncate: utils.truncate,
        filesize: filesize,
        getIcon: getIcon,
        getIconType: getIconType
    };
    
    var defaultGallerySettings = '/nav/thumbs/-/fit/cover/-/loop/true/-/allowfullscreen/native/-/thumbwidth/100/';
    
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
        '  <div class="control-inputs">',
        '    <div class="input-group disabled-control hidden">',
        '      <% if (obj.input) { %>',
        '      <input id="control-<%= id %>-disabled" class="<%= controlClassName %>" type="text" value="<%- value %>" placeholder="<%- placeholder %>" <%= disabled ? "disabled" : "" %> <%= required ? "required" : "" %> <%= readonly ? "readonly" : "" %> role="uploadcare-disabled"/>',
        '      <% } else { %>',
        '      <div id="control-<%= id %>-synopsis" class="form-control immutable" role="control">',
        '        <% if (obj.icon) { %><span class="<%= icon %> icon" aria-hidden="true" <% if (obj.copy) { %>data-action="copy" title="Copy URL to clipboard"<% } %> role="uploadcare-icon"></span><% } %>',
        '        <span class="synopsis"><%= obj.synopsis %></span>',
        '      </div>',
        '      <% } %>',
        '      <div class="input-group-btn" role="group">',
        '        <button data-action="show" type="button" class="btn btn-default"><span class="<%- showIcon %>" aria-hidden="true"></span></button>',
        '      </div>',
        '    </div>',
        '    <input id="control-<%= id %>" name="<%= name %>" data-key="<%= key %>" type="hidden" value="<%- value %>" role="uploadcare-uploader"/>',
        '  </div>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%= helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Form.Templates.UploadcareView = _.template([
        '<div data-region="header"></div>',
        '<div data-region="main"></div>'
    ].join('\n'));
    
    Form.Templates.UploadcareHeaderView = _.template([
        '<h4>',
        '  <span class="<%- obj.icon %> icon" aria-hidden="true" data-clipboard-text="<%- obj.cdnUrl %>" data-action="copy" title="Copy URL to clipboard"></span>',
        '  <% if (obj.isGroup) { %>',
        '  <%- obj.name %> <small><%- filesize(obj.size) %></small>',
        '  <% } else { %>',
        '  <%- truncate(obj.name, 32) %>',
        '  <% } %>',
        '</h4>'
    ].join('\n'));
    
    Form.Templates.UploadcareEmptyView = _.template([
        '<div class="text-center"><span class="glyphicon glyphicon-exclamation-sign icon" aria-hidden="true"></span></div>'
    ].join('\n'));
    
    Form.Templates.UploadcareSingleView = _.template([
        '<% if (obj.previewUrl) { %>',
        '<a href="<%- obj.cdnUrl %>" title="<%- obj.name %>" target="_blank" class="uploadcare-view-img">',
        '  <img src="<%- obj.previewUrl %>" class="img-responsive"/>',
        '</a>',
        '<% } %>',
        '<% if (obj.showDetails) { %>',
        '  <div class="uploadcare-view-details">',
        '    <table class="table uploadcare-view-table">',
        '    <% if (!obj.isImage || (obj.originalUrl && obj.originalUrl === obj.cdnUrl)) { %>',
        '      <tr><td class="key">Url</td><td><a href="<%- obj.originalUrl %>" title="<%- obj.name %>" target="_blank"><%- truncate(obj.originalUrl, 48) %></a></td></tr>',
        '    <% } else { %>',
        '      <% if (obj.cdnUrl) { %><tr><td class="key">Url</td><td><a href="<%- obj.cdnUrl %>" title="<%- obj.name %>" target="_blank"><%- truncate(obj.cdnUrl, 48) %></a></td></tr><% } %>',
        '      <% if (obj.originalUrl) { %><tr><td class="key">Original Url</td><td><a href="<%- obj.originalUrl %>" title="<%- obj.name %>" target="_blank"><%- truncate(obj.originalUrl, 48) %></a></td></tr><% } %>',
        '    <% } %>',
        '    <tr><td class="key">File Size</td><td><%- filesize(obj.size || 0) %></td></tr>',
        '    <% if (obj.mimeType) { %><tr><td class="key">File Type</td><td><%- obj.mimeType %></td></tr><% } %>',
        '    <% if (obj.isStored) { %><tr><td class="key">Stored</td><td><%- obj.isStored ? "Yes" : "No" %></td></tr><% } %>',
        '    <% if (obj.isImage && obj.originalImageInfo) { %><tr><td class="key">Dimensions</td><td><%- obj.originalImageInfo.width + " x " + obj.originalImageInfo.height + " px" %></td></tr><% } %>',
        '    </table>',
        '  </div>',
        '<% } %>'
    ].join('\n'));
    
    Form.Templates.UploadcareMultipleView = _.template([
        '<div role="container"></div>'
    ].join('\n'));
    
    Form.Templates.UploadcareImagesView = Form.Templates.UploadcareMultipleView,
    
    Form.Templates.UploadcareFileItemView = _.template([
        '<div class="media-left">',
        '  <a href="<%- obj.cdnUrl %>" title="<% obj.name %>" target="_blank" class="media-object-href">',
        '    <% if (obj.thumbnailUrl) { %>',
        '    <img class="media-object" src="<%- obj.thumbnailUrl %>" alt="<%- obj.name %>"/>',
        '    <% } else { %>',
        '    <span class="<%= icon %> media-object media-object-icon" aria-hidden="true"></span>',
        '    <% } %>',
        '  </a>',
        '</div>',
        '<div class="media-body">',
        '  <h4 class="media-heading"><a href="<%- obj.originalUrl %>" title="<% obj.name %>" target="_blank"><%- truncate(obj.name, 32) %></a></h4>',
        '  <p class="media-summary"><%- filesize(obj.size) %> | <%- obj.mimeType %> | <%- obj.isStored ? "Stored" : "Not Stored" %></p>',
        '</div>',
    ].join('\n'));
    
    Form.Templates.UploadcareImageItemView = _.template([
        '<a href="<%- obj.cdnUrl %>" title="<% obj.name %>" target="_blank" class="media-object-href">',
        '  <% if (obj.thumbnailUrl) { %>',
        '  <img class="media-object img-responsive" src="<%- obj.thumbnailUrl %>" alt="<%- obj.name %>"/>',
        '  <% } else { %>',
        '  <span class="<%= icon %> media-object media-object-icon" aria-hidden="true"></span>',
        '  <% } %>',
        '</a>',
    ].join('\n'));
    
    Form.Templates.UploadcareGalleryView = _.template([
        '<iframe src="<%- obj.galleryUrl %>" width="<%- obj.galleryInfo && obj.galleryInfo.width %>" height="<%- obj.galleryInfo && obj.galleryInfo.height %>" allowfullscreen="true" frameborder="0"></iframe>'
    ].join('\n'));
    
    // Model & Collection
    
    Form.UploadcareFile = Form.Model.extend({
        
        idAttribute: 'uuid',
        
        toFile: function(settings) {
            return uploadcare.fileFrom('uploaded', this.get('cdnUrl') || this.id, settings);
        }
        
    });
    
    Form.UploadcareFiles = Form.Collection.extend({
        
        model: Form.UploadcareFile,
        
        toFileGroup: function(settings) {
            var files = this.map(function(model) {
                return model.toFile(settings);
            });
            return UploadcareControl.fileGroup(files, settings);
        }
        
    });
    
    Form.UploadcareFileGroup = Form.Model.extend({
        
        idAttribute: 'uuid',
        
        constructor: function(attributes, options) {
            attributes = attributes || {};
            Form.Model.prototype.constructor.call(this, _.omit(attributes, 'files'), options);
            this.files = new Form.UploadcareFiles(_.isArray(attributes.files) ? attributes.files : []);
        },
        
        toFileGroup: function(settings) {
            if (this.files instanceof Form.UploadcareFiles) {
                return this.files.toFileGroup(settings);
            } else {
                return UploadcareControl.fileGroup([], settings);
            }
        }
        
    });
    
    // Views
    
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
            return UploadcareControl.fileGroup(this.getFiles(), settings);
        },
        
        bindToFileCollection: function(collection) {
            if (collection instanceof Form.UploadcareFiles) {
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
                throw new Error('Invalid UploadcareFiles');
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
            settings: defaultGallerySettings,
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
            return isFileGroupReference(value);
        },
        
        serializeValue: function() {
            var settings = this.getAttribute('settings');
            var value = this.getValue(true);
            value = this.formatter.fromRaw(value);
            if (this.isValidUrl(value) && _.isString(settings) && !utils.isBlank(settings)) {
                value = utils.joinUrl(value, 'gallery/-/', settings) + '/';
            } else {
                value = '';
            }
            return value;
        }
        
    });
    
    // Content views for displaying File or FileGroup contents
    
    Form.UploadcareBaseView = Marionette.LayoutView.extend({
        
        templateHelpers: templateHelpers,
        
        thumbnailSize: { width: 64, height: 64 },
        
        previewSize: { width: 600, height: 450 },
        
        gallerySettings: defaultGallerySettings,
        
        galleryOptions: {
            width: '100%',
            height: '450'
        },
        
        serializeData: function() {
            var data = Marionette.LayoutView.prototype.serializeData.apply(this, arguments);
            data.isGroup = this.getOption('multiple') || _.has(data, 'count');
            data.isImage = data.isImage || (data.isGroup && this.getOption('imagesOnly'));
            data.showDetails = this.getOption('details') !== false;
            
            var iconType = getIconType(this.getOption('multiple'), this.getOption('imagesOnly') || data.isImage);
            data.icon = getIcon(data.mimeType, type);
            
            var isImageGroup = data.isGroup && data.isImage && isFileGroupReference(data.cdnUrl);
            var imageUrl = isImageGroup ? data.cdnUrl + '/nth/0/' : data.cdnUrl;
            
            if (imageUrl && data.isImage) {
                data.thumbnailUrl = this.getImageUrl(imageUrl, 'thumbnail');
                data.previewUrl = this.getImageUrl(imageUrl, 'preview');
            }
            
            if (isImageGroup) {
                var gallerySettings = this.getOption('gallerySettings');
                data.galleryUrl = utils.joinUrl(data.cdnUrl, 'gallery/-/', gallerySettings) + '/';
                data.galleryInfo = _.extend({}, this.getOption('galleryOptions'));
            }
            
            return data;
        },
        
        getImageUrl: function(baseUrl, name) {
            var variantSettings = _.result(this, name + 'Settings');
            var variantSize = _.result(this, name + 'Size');
            if (_.isString(variantSettings) && !utils.isBlank(variantSettings)) {
                return utils.joinUrl(baseUrl, variantSettings) + '/';
            } else if (_.isObject(variantSize)) {
                var spec = '/-/scale_crop/' + variantSize.width + 'x' + variantSize.height + '/center/-/format/jpg/';
                return utils.joinUrl(baseUrl, spec) + '/';
            }
        }
        
    });
    
    Form.UploadcareHeaderView = Form.UploadcareBaseView.extend({
        
        className: 'uploadcare-view-header',
        
        template: Form.Templates.UploadcareHeaderView,
        
        modelEvents: {
            change: 'render'
        }
        
    });
    
    Form.UploadcareEmptyView = Form.UploadcareBaseView.extend({
        
        className: 'uploadcare-view-content uploadcare-view-empty',
        
        template: Form.Templates.UploadcareEmptyView
        
    });
    
    Form.UploadcareSingleView = Form.UploadcareBaseView.extend({
        
        className: 'uploadcare-view-content uploadcare-view-single',
        
        template: Form.Templates.UploadcareSingleView,
        
        modelEvents: {
            change: 'render'
        }
        
    });
    
    Form.UploadcareFileItemView = Form.UploadcareBaseView.extend({
        
        className: 'uploadcare-view-item uploadcare-view-file-item media',
        
        template: Form.Templates.UploadcareFileItemView,
        
        modelEvents: {
            change: 'render'
        }
        
    });
    
    Form.UploadcareImageItemView = Form.UploadcareFileItemView.extend({
        
        className: 'uploadcare-view-item uploadcare-view-image-item col-xs-6 col-md-3',
        
        template: Form.Templates.UploadcareImageItemView,
        
        thumbnailSize: { width: 320, height: 320 },
        
    });
    
    Form.UploadcareMultipleView = Marionette.CompositeView.extend({
        
        className: 'uploadcare-view-content uploadcare-view-multiple',
        
        template: Form.Templates.UploadcareMultipleView,
        
        templateHelpers: templateHelpers,
        
        childView: Form.UploadcareFileItemView,
        
        childViewContainer: '[role="container"]'
        
    });
    
    Form.UploadcareImagesView = Form.UploadcareMultipleView.extend({
        
        className: 'uploadcare-view-content uploadcare-view-images row',
        
        template: Form.Templates.UploadcareImagesView,
        
        childView: Form.UploadcareImageItemView
        
    });
    
    Form.UploadcareGalleryView = Form.UploadcareBaseView.extend({
        
        className: 'uploadcare-view-content uploadcare-view-gallery',
        
        template: Form.Templates.UploadcareGalleryView,
        
        modelEvents: {
            change: 'render'
        }
        
    });
    
    // Container View
    
    Form.UploadcareView = Form.UploadcareBaseView.extend({
        
        className: 'uploadcare-view',
        
        template: Form.Templates.UploadcareView,
        
        templateHelpers: templateHelpers,
        
        headerView: Form.UploadcareHeaderView,
        
        childViews: {
            single: Form.UploadcareSingleView,
            multiple: Form.UploadcareMultipleView,
            images: Form.UploadcareImagesView,
            gallery: Form.UploadcareGalleryView,
            empty: Form.UploadcareEmptyView
        },
        
        modalOptions: {
            allowCancel: false
        },
        
        id: function() {
            return _.uniqueId('uc-');
        },
        
        constructor: function(options) {
            Marionette.LayoutView.prototype.constructor.apply(this, arguments);
            this.deferred = $.Deferred();
            if (options && options.source) this.setData(options.source);
            this.on('render', this._onRender);
            this.on('destroy', this._onDestroy);
        },
        
        isMultiple: function() {
            return this.getOption('multiple') ||
                this.getSettings().multiple === true;
        },
        
        isImagesOnly: function() {
            return this.getOption('imagesOnly') ||
                this.getSettings().imagesOnly === true;
        },
        
        getSettings: function() {
            return _.extend({}, this.getOption('settings'));
        },
        
        // Childviews
        
        showMainView: function(model) {
            var view = this.buildChildView(model, this.getChildView(model));
            this.triggerMethod('show:main:view', view);
            return this.showChildView('main', view);
        },
        
        showHeaderView: function(model) {
            var ChildViewClass = this.getOption('headerView');
            var view = this.buildChildView(model, ChildViewClass);
            this.triggerMethod('show:header:view', view);
            return this.showChildView('header', view);
        },
        
        buildChildView: function(model, ChildViewClass, childViewOptions) {
            childViewOptions = _.extend({}, _.result(this, 'childViewOptions', childViewOptions));
            var options = {
                model: model, settings: this.getSettings(),
                multiple: this.isMultiple(), imagesOnly: this.isImagesOnly()
            };
            if (model && model.files instanceof Form.UploadcareFiles) options.collection = model.files;
            return new ChildViewClass(_.extend(options, childViewOptions));
        },
        
        getChildView: function(model) {
            var childView;
            if (model instanceof Form.UploadcareFileGroup) {
                var isImagesOnly = this.isImagesOnly();
                if (isImagesOnly && this.getOption('gallery')) {
                    childView = this.getChildViewClass('gallery');
                } else if (isImagesOnly) {
                    childView = this.getChildViewClass('images');
                }
                childView = childView || this.getChildViewClass('multiple');
            } else if (model instanceof Form.UploadcareFile) {
                childView = this.getChildViewClass('single');
            }
            return childView || this.getChildViewClass('empty');
        },
        
        getChildViewClass: function(type) {
            return (_.result(this, 'childViews') || {})[type];
        },
        
        // Value
        
        getUrl: function() {
            return this.model && this.model.get('cdnUrl');
        },
        
        getValue: function() {
            return $.when(this.deferredValue);
        },
        
        setValue: function(source) {
            var dfd = this.deferredValue = this.convertValue(source);
            dfd.done(this.triggerMethod.bind(this, 'resolve'));
            dfd.fail(this.triggerMethod.bind(this, 'fail'));
            return dfd;
        },
        
        convertValue: function(source, settings) {
            settings = _.extend({}, this.getOption('settings'), settings);
            settings.multiple = this.isMultiple();
            return Form.UploadcareControl.resolveSource(source, settings);
        },
        
        onResolve: function(result) {
            if (!this.isRendered) return this.once('render', this.onResolve.bind(this, result));
            this.isRendered = true; // force to prevent any infinite loops
            var Model = this.isMultiple() ? Form.UploadcareFileGroup : Form.UploadcareFile;
            this.model = new Model(result);
            return $.when(this.showHeaderView(this.model), this.showMainView(this.model));
        },
        
        // ModalViewMixin integration
        
        setData: function(source) {
            return this.setValue(source).then(this.deferred.resolve.bind(this.deferred));
        },
        
        // Marionette.TransitionRegion deferred integration
        
        onTransition: function() {
            return this.deferredValue || this.deferred;
        },
        
        // Private
        
        _onRender: function() {
            this.addRegion('header', this.$('[data-region="header"]'));
            this.addRegion('main', this.$('[data-region="main"]'));
            
            if (this.clipboard) this.clipboard.destroy();
            var viewId = this.$el.attr('id');
            var sel = '#' + viewId + ' [data-action="copy"]';
            this.clipboard = new Clipboard(sel);
        },
        
        _onDestroy: function() {
            if (this.clipboard) this.clipboard.destroy();
        }
        
    });
    
    // Form Control View
    
    var UploadcareControl = Form.UploadcareControl = Form.Control.extend(_.extend({}, Form.CollectionMixin, {
        
        template: Form.Templates.UploadcareControl,
        
        defaults: {
            label: '',
            placeholder: '',
            extraClasses: [],
            helpMessage: null,
            multiple: false,
            clearable: true,
            input: false,
            copy: true,
            preview: false,
            previewSize: { width: 128, height: 128 },
            showIcon:   'glyphicon glyphicon-eye-open',
            
            blankIcon:  'blank',
            emptyIcon:  'empty',
            fileIcon:   'glyphicon glyphicon-file',
            filesIcon:  'glyphicon glyphicon-th-list',
            imageIcon:  'glyphicon glyphicon-picture',
            imagesIcon: 'glyphicon glyphicon-th'
        },
        
        ui: {
            control: '[role="uploadcare-uploader"]',
            disabledControl: '.disabled-control',
            inputs: '.control-inputs',
            synopsis: '.synopsis',
            synopsisIcon: '[role="uploadcare-icon"]',
            copyButton: '[data-action="copy"]',
            showButton: '[data-action="show"]'
        },
        
        controlEvents: {
            'click .form-control': '_openDialog'
        },
        
        collectionConstructor: Form.UploadcareFiles,
        
        renderOnValueChange: false,
        
        synopsisTemplate: _.template([
            '<span class="synopsis-name"><%- truncate(obj.name, 32) %></span>, ',
            '<span class="synopsis-size"><%- filesize(obj.size) %></span>'
        ].join('\n')),
        
        bootstrapModal: Backbone.BootstrapModal,
        
        modalView: Form.UploadcareView,
        
        modalViewOptions: function() {
            return { settings: this.getSettings(), gallery: this.getAttribute('gallery') };
        },
        
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
            if (!this.isImagesOnly()) return false;
            return this.getAttribute('preview') === true;
        },
        
        getIcon: function(type) {
            var isBlank = this.isBlank();
            var isMultiple = this.isMultiple();
            var isImagesOnly = this.isImagesOnly();
            var iconType = getIconType(isMultiple, isImagesOnly, isBlank);
            type = type || iconType;
            type = normalizeIconName(type);
            var icon = this.getAttribute(type) || this.getAttribute(iconType);
            return icon || UploadcareControl.getIcon(type, iconType);
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
                var group = UploadcareControl.fileGroup(files, from);
                this.widget.value(group);
                return group;
            } else if (this.widget) {
                var file = UploadcareControl.fileFrom(source, from);
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
                if (file) return UploadcareControl.fileGroup([file], settings);
            } else if (this.isMultiple() && !this.isBlank()) {
                return UploadcareControl.fileGroup(this.getValue(true), settings);
            }
            return UploadcareControl.fileGroup([], settings);
        },
        
        setFiles: function(files, from) {
            files = _.compact([].concat(files || []));
            if (_.isEmpty(files)) {
                this.widget.value(null);
            } else if (this.widget && this.isMultiple()) {
                var group = UploadcareControl.fileGroup(files, from);
                this.widget.value(group);
            } else if (this.widget) {
                this.widget.value(_.first(files));
            }
            return this.getFiles();
        },
        
        getUrl: function() {
            if (this.resolvedValue) return this.resolvedValue.cdnUrl;
        },
        
        copyToCliploard: function() {
            if (this.clipboard) this.ui.copyButton.click();
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
            
            if (this.getAttribute('copy')) this._initClipboard();
            if (this.hasPreview()) this._initPopover();
        },
        
        _detachPlugins: function() {
            this.triggerMethod('detach:plugin');
            if (this.clipboard) this.clipboard.destroy();
            this._destroyPopover();
            this.ui.control.off('.uploadcare');
            this.$('.uploadcare-widget').remove();
            this.resolvedValue = null;
            this.resolvedUrl = null;
            this.widget = null;
        },
        
        // Preview/Synopsis handling
        
        getPopoverContent: function() {
            if (!this.resolvedValue || !this.resolvedValue.isImage || !this.resolvedValue.cdnUrl) return;
            var src = this.resolvedValue.cdnUrl;
            if (this.isMultiple()) src += 'nth/0/';
            var previewSettings = _.result(this, 'previewSettings');
            if (_.isString(previewSettings) && !utils.isBlank(previewSettings)) {
                src = utils.joinUrl(src, previewSettings) + '/';
                return '<img src="' + src + '" class="img-responsive"/>';
            } else {
                var size = this.getAttribute('previewSize');
                src += '-/scale_crop/' + size.width + 'x' + size.height + '/center/-/format/jpg/';
                return '<img src="' + src + '" width="' + size.width + '" height="' + size.height + '"/>';
            }
        },
        
        _updateSynopsis: function(resolvedValue) {
            var synopsis = this.serializeSynopsis(resolvedValue);
            this.ui.synopsis.html(synopsis || '');
            this.ui.synopsisIcon.attr('class', this.getIcon() || '');
        },
        
        _initClipboard: function() {
            var copyButton = this.ui.copyButton[0];
            if (copyButton) {
                this.clipboard = new Clipboard(copyButton, {
                    text: this.getUrl.bind(this)
                });
            }
        },
        
        _initPopover: function() {
            if (!_.isFunction(this.ui.inputs.popover)) return; // bootstrap.js not loaded
            var popoverOptions = _.extend({}, _.result(this, 'popoverOptions'), this.getAttribute('popover'));
            var self = this;
            this.ui.inputs.popover(_.extend({
                content: function() {
                    var $popover = $(this).data('bs.popover').$tip;
                    $popover.addClass('popover-img');
                    return self.getPopoverContent();
                },
                trigger: 'hover', placement: 'auto top', html: true,
                delay: { show: 300, hide: 100 }
            }, popoverOptions));
            this.ui.inputs.on('show.bs.popover', function(event) {
                if (!this.resolvedValue || !this.resolvedValue.isImage || !this.resolvedValue.cdnUrl) {
                    event.preventDefault();
                }
            }.bind(this));
        },
        
        _destroyPopover: function() {
            if (!_.isFunction(this.ui.inputs.popover)) return; // bootstrap.js not loaded
            this.ui.inputs.popover('destroy');
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
        
        icons: {
            blankIcon:  'blank',
            emptyIcon:  'empty',
            fileIcon:   'glyphicon glyphicon-file',
            filesIcon:  'glyphicon glyphicon-th-list',
            imageIcon:  'glyphicon glyphicon-picture',
            imagesIcon: 'glyphicon glyphicon-th'
        },
        
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
        
        getIcon: function(type, fallback) {
            fallback = fallback || 'blankIcon';
            type = type || fallback;
            type = normalizeIconName(type);
            fallback = normalizeIconName(fallback);
            return this.icons[type] || this.icons[fallback];
        },
        
        isFileReference: isFileReference,
        
        isFileGroupReference: isFileGroupReference,
        
        fileFrom: function(source, from, settings) {
            if (_.isObject(from)) settings = from, from = null;
            return uploadcare.fileFrom(from || 'uploaded', source, settings);
        },
        
        fileGroup: function(source, from, settings) {
            if (_.isObject(from)) settings = from, from = null;
            if (isFileReference(source)) source = [source];
            if (isFileGroup(source)) {
                return source;
            } else if (_.isArray(source)) {
                from = from || 'uploaded';
                var files = _.map(source, function(file) {
                    return this.fileFrom(file, from, settings);
                }.bind(this));
                return uploadcare.FileGroup(files, settings);
            } else if (isFileGroupReference(source)) {
                return uploadcare.loadFileGroup(source, settings);
            } else {
                return uploadcare.FileGroup([], settings);
            }
        },
        
        resolveSource: function(source, settings) {
            settings = _.extend({}, settings);
            var dfd = $.Deferred();
            var deferredValue;
            var isMultiple = settings.multiple === true;
            var isFileGroupObj = isFileGroup(source);
            var isFileGroupRef = isFileGroupReference(source);
            if (settings.multiple === 'auto') isMultiple = isFileGroupObj || isFileGroupRef;
            var forceSingle = (isFileGroupObj || isFileGroupRef) && !isMultiple;
            
            var resolved = dfd.resolve.bind(dfd);
            var failed = dfd.fail.bind(dfd);
            
            if (isMultiple || isFileGroupObj || isFileGroupRef) {
                deferredValue = UploadcareControl.fileGroup(source, settings);
            } else if (isFileReference(source)) {
                deferredValue = UploadcareControl.fileFrom(source, 'uploaded', settings);
            } else if (_.isObject(source) && source.sourceName === 'uploaded') {
                deferredValue = UploadcareControl.fileFrom(source, 'object', settings);
            } else if (_.isObject(source) && source.sourceName === 'ready') {
                deferredValue = UploadcareControl.fileFrom(source, 'ready', settings);
            }
            
            if (isMultiple && _.isObject(deferredValue) && _.isFunction(deferredValue.promise)) {
                deferredValue.fail(failed);
                deferredValue.done(function(ref) {
                    var promises = [ref.promise()].concat(ref.files());
                    $.when.apply($, promises).then(function(fileGroup) {
                        fileGroup.files = _.rest(arguments);
                        resolved(forceSingle ? _.first(fileGroup.files) : fileGroup);
                        return fileGroup;
                    }, failed);
                }.bind(this));
            } else if (_.isObject(deferredValue) && _.isFunction(deferredValue.promise)) {
                deferredValue.done(resolved);
                deferredValue.fail(failed);
            } else {
                failed('invalid-source');
            }
            
            return dfd.promise();
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
    
    function isFileReference(value) {
        return (_.isString(value) && (value.match(fileIdRegex) || value.match(cdnUrlRegex)));
    };
    
    function isFileGroupReference(value) {
        return (_.isString(value) && !!value.match(groupIdRegex));
    };
    
    function isFileGroup(value) {
        return _.isObject(value) && _.isFunction(value.files) && _.isFunction(value.promise);
    };
    
    function getIcon(type, fallback) {
        return UploadcareControl.getIcon(type, fallback);
    };
    
    function getIconType(isMultiple, isImagesOnly, isBlank) {
        if (isMultiple && isBlank) {
            type = 'emptyIcon';
        } else if (isBlank) {
            type = 'blankIcon';
        } else if (isMultiple && isImagesOnly) {
            type = 'imagesIcon';
        } else if (isImagesOnly) {
            type = 'imageIcon';
        } else if (isMultiple) {
            type = 'filesIcon';
        } else {
            type = 'fileIcon';
        }
        return type;
    };
    
    function normalizeIconName(name) {
        // mime/type to: iconMimeType
        if (_.isString(name) && name.indexOf('/') > -1) {
            return 'icon' + utils.camelize(utils.formatName(name));
        } else {
            return name;
        }
    };
    
});