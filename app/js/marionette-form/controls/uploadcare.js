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
    
    var dataAttr = 'uploadcareWidget';
    
    var uploadcareViewOptions = [
        'multiple', 'imagesOnly', 'gallery',
        'details', 'header',
        'thumbnailSize', 'thumbnailSettings',
        'previewSize', 'previewSettings'
    ];
    
    var uploadcareAttributes = [
        'multiple', 'multipleMin', 'multipleMax', 'imagesOnly', 
        'previewStep', 'crop', 'imageShrink', 'clearable',
        'tabs', 'inputAcceptTypes', 'preferredTypes',
        'systemDialog', 'cdnBase', 'doNotStore'
    ];
    
    var uploadcareOptions = _.uniq(uploadcareViewOptions.concat(uploadcareAttributes));
    
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
    
    Form.Templates.UploadcareControlSynopis = _.template([
        '<span class="synopsis-name"><%- truncate(obj.name, 32) %></span>, ',
        '<span class="synopsis-size"><%- filesize(obj.size) %></span>'
    ].join('\n')),
    
    Form.Templates.UploadcareControl = _.template([
        '<label class="<%- labelClassName %>" for="control-<%- id %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <div class="control-inputs">',
        '    <div class="input-group disabled-control hidden">',
        '      <% if (obj.input) { %>',
        '      <input id="control-<%- id %>-disabled" class="<%- controlClassName %>" type="text" value="<%- value %>" placeholder="<%- placeholder %>" <%- disabled ? "disabled" : "" %> <%- required ? "required" : "" %> <%- readonly ? "readonly" : "" %> role="uploadcare-disabled"/>',
        '      <% } else { %>',
        '      <div id="control-<%- id %>-synopsis" class="form-control immutable" role="control">',
        '        <% if (obj.icon) { %><span class="<%- icon %> icon" aria-hidden="true" <% if (obj.copy) { %>data-action="copy" title="Copy URL to clipboard"<% } %> role="uploadcare-icon"></span><% } %>',
        '        <span class="synopsis"><%= obj.synopsis %></span>',
        '      </div>',
        '      <% } %>',
        '      <div class="input-group-btn" role="group">',
        '        <button data-action="show" type="button" class="btn btn-default"><span class="<%- showIcon %>" aria-hidden="true"></span></button>',
        '      </div>',
        '    </div>',
        '    <input id="control-<%- id %>" name="<%- name %>" data-key="<%- key %>" type="hidden" value="<%- value %>" role="uploadcare-uploader"/>',
        '  </div>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%- helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Form.Templates.UploadcareStaticControl = _.template([
        '<label class="<%- labelClassName %>" for="control-<%- id %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <div class="control-inputs">',
        '    <div class="input-group">',
        '      <% if (obj.input) { %>',
        '      <input id="control-<%- id %>-disabled" class="<%- controlClassName %>" type="text" value="<%- value %>" placeholder="<%- placeholder %>" <%- disabled ? "disabled" : "" %> <%- required ? "required" : "" %> <%- readonly ? "readonly" : "" %> role="uploadcare-disabled"/>',
        '      <% } else { %>',
        '      <div id="control-<%- id %>-synopsis" class="form-control immutable" role="control">',
        '        <% if (obj.icon) { %><span class="<%- icon %> icon" aria-hidden="true" <% if (obj.copy) { %>data-action="copy" title="Copy URL to clipboard"<% } %> role="uploadcare-icon"></span><% } %>',
        '        <span class="synopsis"><%= obj.synopsis %></span>',
        '      </div>',
        '      <% } %>',
        '      <div class="input-group-btn" role="group">',
        '        <button data-action="show" type="button" class="btn btn-default"><span class="<%- showIcon %>" aria-hidden="true"></span></button>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%- helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Form.Templates.UploadcareView = _.template([
        '<div data-region="header"></div>',
        '<div data-region="main"></div>'
    ].join('\n'));
    
    Form.Templates.UploadcareConfirmView = Form.Templates.UploadcareView;
    
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
        '    <span class="<%- icon %> media-object media-object-icon" aria-hidden="true"></span>',
        '    <% } %>',
        '  </a>',
        '</div>',
        '<div class="media-body">',
        '  <h4 class="media-heading"><a href="<%- obj.originalUrl %>" title="<% obj.name %>" target="_blank"><%- obj.name %></a></h4>',
        '  <p class="media-summary"><%- filesize(obj.size) %> | <%- obj.mimeType %> | <%- obj.isStored ? "Stored" : "Not Stored" %></p>',
        '</div>',
    ].join('\n'));
    
    Form.Templates.UploadcareImageItemView = _.template([
        '<a href="<%- obj.cdnUrl %>" title="<% obj.name %>" target="_blank" class="media-object-href">',
        '  <% if (obj.thumbnailUrl) { %>',
        '  <img class="media-object img-responsive" src="<%- obj.thumbnailUrl %>" alt="<%- obj.name %>"/>',
        '  <% } else { %>',
        '  <span class="<%- icon %> media-object media-object-icon" aria-hidden="true"></span>',
        '  <% } %>',
        '</a>',
    ].join('\n'));
    
    Form.Templates.UploadcareGalleryView = _.template([
        '<iframe src="<%- obj.galleryUrl %>" width="<%- obj.galleryInfo && obj.galleryInfo.width %>" height="<%- obj.galleryInfo && obj.galleryInfo.height %>" allowfullscreen="true" frameborder="0"></iframe>'
    ].join('\n'));
    
    Form.Templates.UploadcarePanelView = _.template([
        '<div data-region="panel"></div>'
    ].join('\n'));
    
    Form.Templates.UploadcarePanelControl = _.template([
        '<label class="<%- labelClassName %>" for="control-<%- id %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <div data-region="main"></div>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%- helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    // Model & Collection
    
    Form.UploadcareFile = Form.Model.extend({
        
        idAttribute: 'uuid',
        
        isImage: function() {
            return this.get('isImage') === true;
        },
        
        isImagesOnly: function() {
            return this.isImage();
        },
        
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
        
        isImagesOnly: function() {
            return this.files.all(function(file) { return file.isImage(); });
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
            data.isGroup = this.model instanceof Form.UploadcareFileGroup;
            data.isImage = data.isImage || (data.isGroup && this.model.isImagesOnly());
            data.showDetails = this.getOption('details') !== false || !data.isImage;
            
            var iconType = getIconType(data.isGroup, data.isImage);
            data.icon = getIcon(data.mimeType, type);
            
            var isImageGroup = data.isGroup && data.isImage && isFileGroupReference(data.cdnUrl);
            var imageUrl = isImageGroup ? data.cdnUrl + 'nth/0/' : data.cdnUrl;
            
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
            if (options && options.source) {
                this.setData(options.source);
            } else if (this.model) {
                this.setModel(this.model);
            }
            this.on('render', this._onRender);
            this.on('destroy', this._onDestroy);
        },
        
        // Childviews
        
        showMainView: function(model) {
            var view = this.buildChildView(model, this.getChildView(model));
            this.triggerMethod('show:main:view', view);
            return this.showChildView('main', view);
        },
        
        showHeaderView: function(model) {
            if (this.getOption('header') === false) {
                return $.Deferred().resolve().promise(); // OK
            }
            var ChildViewClass = this.getOption('headerView');
            var view = this.buildChildView(model, ChildViewClass);
            this.triggerMethod('show:header:view', view);
            return this.showChildView('header', view);
        },
        
        buildChildView: function(model, ChildViewClass, childViewOptions) {
            childViewOptions = _.extend({}, _.result(this, 'childViewOptions', childViewOptions));
            var isMultiple = model instanceof Form.UploadcareFileGroup;
            var isImagesOnly = this.getOption('imagesOnly');
            isImagesOnly = isImagesOnly || (isImagesOnly !== false && isMultiple && model.isImagesOnly());
            var showDetails = this.getOption('details');
            var options = {
                model: model, multiple: isMultiple, imagesOnly: isImagesOnly, details: showDetails
            };
            if (model && model.files instanceof Form.UploadcareFiles) options.collection = model.files;
            return new ChildViewClass(_.extend(options, childViewOptions));
        },
        
        getChildView: function(model) {
            var childView;
            if (model instanceof Form.UploadcareFileGroup) {
                var isImagesOnly = this.getOption('imagesOnly');
                isImagesOnly = isImagesOnly || (isImagesOnly !== false && model.isImagesOnly());
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
        
        updateChildViews: function() {
            return $.when(this.showHeaderView(this.model), this.showMainView(this.model)).then(function() {
                this.triggerMethod('update:childviews');
            }.bind(this));
        },
        
        // Value
        
        setModel: function(model) {
            if (model instanceof Form.UploadcareFileGroup || model instanceof Form.UploadcareFile) {
                if (!this.isRendered || !this.header || !this.main) {
                    var dfd = $.Deferred();
                    this.once('render', function() {
                        this.setModel(model).then(dfd.resolve.bind(dfd), dfd.fail.bind(dfd));
                    });
                    return dfd;
                } else {
                    if (this.model) this.stopListening(this.model);
                    this.isRendered = true; // force to prevent any infinite loops
                    this.model = model;
                    return this.updateChildViews().then(function() {
                        this.triggerMethod('set:model', this.model);
                    }.bind(this));
                }
            } else {
                return $.Deferred().reject().promise();
            }
        },
        
        getUrl: function() {
            return this.model && this.model.get('cdnUrl');
        },
        
        getValue: function() {
            return $.when(this.deferredValue);
        },
        
        setValue: function(source, options) {
            if (source instanceof Form.UploadcareFileGroup || source instanceof Form.UploadcareFile) {
                return this.setModel(source);
            } else if ($.isPlainObject(source)) {
                var Model = _.isArray(source.files) ? Form.UploadcareFileGroup : Form.UploadcareFile;
                return this.setModel(new Model(source));
            } else {
                var dfd = this.deferredValue = this.convertValue(source);
                dfd.done(this.triggerMethod.bind(this, 'resolve'));
                dfd.fail(this.triggerMethod.bind(this, 'fail'));
                return dfd;
            }
        },
        
        convertValue: function(source, options) {
            var settings = _.extend({}, this.getOption('settings'));
            settings.multiple = this.getOption('multiple');
            settings.imagesOnly = this.getOption('imagesOnly');
            return Form.UploadcareControl.resolveSource(source, _.extend(settings, options));
        },
        
        onResolve: function(data) {
            return this.setValue(data);
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
    
    Form.UploadcareConfirmView = Form.UploadcareView.extend({
        
        template: Form.Templates.UploadcareConfirmView,
        
        modalOptions: {
            allowDelete: true,
            allowCancel: false,
            okText: 'Cancel',
            deleteText: 'Remove'
        }
        
    });
    
    Form.UploadcarePanelView = Form.UploadcareBaseView.extend({
        
        className: 'uploadcare-panel-view',
        
        template: Form.Templates.UploadcarePanelView,
        
        ui: {
            panel: '[data-region="panel"]'
        },
        
        keepOpen: true,
        
        defaultTab: 'preview',
        
        constructor: function(options) {
            Form.UploadcareBaseView.prototype.constructor.apply(this, arguments);
            this.once('render', function() { this.openPanel(); });
            this.on('set:value', function() { this.openPanel() });
            this.on('panel:tab:switch', function(tabName) {
                this._panelHeight = this.$('.uploadcare-dialog-panel').height();
            });
        },
        
        getValue: function() {
            return this.options.source;
        },
        
        setValue: function(value) {
            var changed = value !== this.getValue();
            this.options.source = value;
            if (changed) this.triggerMethod('set:value', value);
        },
        
        getFiles: function() {
            var dfd = $.Deferred();
            var source = this.getOption('source');
            if (utils.isBlank(source)) return dfd.resolve([]).promise();
            
            var settings = _.extend({}, this.getSettings());
            if (isFileGroupReference(source)) {
                Form.UploadcareControl.resolveSource(source, settings).then(function(result) {
                    var files = _.map(_.isArray(result.files) ? result.files : [result], function(file) {
                        return uploadcare.fileFrom('uploaded', file.cdnUrl, settings);
                    });
                    dfd.resolve(files);
                }, dfd.reject.bind(dfd));
            } else if (isFileReference(source)) {
                var file = uploadcare.fileFrom('uploaded', source, settings);
                dfd.resolve([file]);
            } else {
                return dfd.resolve([]).promise();
            }
            
            return dfd.promise();
        },
        
        validateFile: function(fileInfo) {}, // Hook
        
        getValidator: function(name) {
            return UploadcareControl.getValidator(name);
        },
        
        getSettings: function() {
            var settings = _.extend({}, _.result(this, 'options'));
            settings = _.pick(settings, uploadcareOptions);
            
            var validators = [this._validateFile.bind(this)];
            var maxFileSize = this.getOption('maxFileSize');
            if (_.isNumber(maxFileSize) && maxFileSize > 0) {
                var validator = this.getValidator('maxFileSize', maxFileSize);
                if (_.isFunction(validator)) validators.push(validator);
            }
            _.each(_.result(this.constructor, 'validators') || [], function(validator) {
                if (_.isString(validator)) validator = this.getValidator(validator);
                if (_.isFunction(validator)) validators.push(validator);
            }.bind(this));
            settings.validators = validators;
            
            return settings;
        },
        
        // Panel
        
        openPanel: function(tab, settings) {
            if (_.isObject(tab)) settings = tab, tab = null;
            var dfd = $.Deferred();
            dfd.done(this.triggerMethod.bind(this, 'panel:open:done'));
            dfd.fail(this.triggerMethod.bind(this, 'panel:open:fail'));
            
            this.getFiles().then(function(files) {
                if (this.panel) {
                    this.updatePanel(files);
                } else {
                    var el = this.ui.panel[0];
                    tab = tab || this.getOption('tab');
                    settings = _.extend({}, this.getSettings(), settings);
                    files = _.isEmpty(files) ? null : files;
                    this.panel = uploadcare.openPanel(el, files, tab, settings);
                    this.panel.done(this.triggerMethod.bind(this, 'panel:done', this.panel));
                    this.panel.fail(this.triggerMethod.bind(this, 'panel:fail', this.panel));
                    this.panel.progress(this.triggerMethod.bind(this, 'panel:tab:switch', this.panel));
                    this.panel.always(function() {
                        this.panel = null;
                        this.triggerMethod('panel:close', this.panel);
                    }.bind(this));
                }
                dfd.resolve(this.panel);
            }.bind(this), function(error) {
                this.panel = null;
                dfd.reject(error);
            }.bind(this));
            return dfd;
        },
        
        reopenPanel: function() {
            if (this._panelHeight > 0) this.ui.panel.height(this._panelHeight);
            return this.openPanel();
        },
        
        updatePanel: function(files) {
            if (!this.panel) return;
            if (_.isEmpty(files)) {
                this.panel.fileColl.clear();
            } else {
                this.panel.fileColl.clear();
                this.panel.addFiles(files);
                this.panel.switchTab(this.getOption('defaultTab'));
            }
        },
        
        onPanelDone: function(panel, ref) {
            var resolved = this.triggerMethod.bind(this, 'change');
            var failed = this.triggerMethod.bind(this, 'error');
            if (isFileGroup(ref)) {
                var promises = [ref.promise()].concat(ref.files());
                $.when.apply($, promises).then(function(fileGroup) {
                    fileGroup.files = _.rest(arguments);
                    resolved(fileGroup);
                }, failed);
            } else if (_.isObject(ref) && _.isFunction(ref.then)) {
                ref.then(function(fileInfo) {
                    resolved(fileInfo);
                }, failed);
            }
        },
        
        onPanelClose: function(panel) {
            if (this.getOption('keepOpen')) this.reopenPanel();
        },
        
        // Private
        
        _validateFile: function(fileInfo) {
            this.validateFile(fileInfo);
            this.triggerMethod('validate:file', fileInfo);
        }
        
    });
    
    // Form Control Views for display
    
    Form.UploadcareViewControl = Form.RegionControl.extend({
        
        defaults: {
            multiple: 'auto'
        },
        
        childView: Form.UploadcareView,
        
        constructor: function(options) {
            Form.RegionControl.prototype.constructor.apply(this, arguments);
            this.on('value:change', this.updateView);
        },
        
        viewOptions: function() {
            var options = this.getAttributes(uploadcareOptions);
            if (!this.isBlank()) options.source = this.getValue(true);
            return options;
        },
        
        updateView: function(model, value, options) {
            var view = this.getView();
            if (view) view.setValue(value, options);
        }
        
    });
    
    Form.UploadcarePanelControl = Form.UploadcareViewControl.extend({
        
        template: Form.Templates.UploadcarePanelControl,
        
        childviewContainer: '[data-region="main"]',
        
        childView: Form.UploadcarePanelView,
        
        immutableChildView: Form.UploadcareView,
        
        defaults: {
            label: '',
            extraClasses: [],
            helpMessage: null,
            multiple: false
        },
        
        constructor: function(options) {
            Form.UploadcareViewControl.prototype.constructor.apply(this, arguments);
            this.on('view:change', function(result) {
                var isMultiple = this.getAttribute('multiple');
                if (isMultiple && isFileGroupReference(result.cdnUrl)) {
                    this.setValue(result.cdnUrl);
                } else if (isFileReference(result.cdnUrl)) {
                    this.setValue(result.cdnUrl);
                } else {
                    this.resetValue();
                }
            });
        },
        
        getViewClass: function() {
            if (this.isImmutable()) {
                return this.getOption('immutableChildView') || Form.UploadcareView;
            } else {
                return Form.UploadcareViewControl.prototype.getViewClass.apply(this, arguments);
            }
        }
        
    });
    
    // Form Control
    
    Form.UploadcareBaseControl = Form.Control.extend(_.extend({}, Form.CollectionMixin, {
        
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
            showIcon: 'glyphicon glyphicon-eye-open'
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
        
        bootstrapModal: Backbone.BootstrapModal,
        
        modalView: Form.UploadcareView,
        
        synopsisTemplate: Form.Templates.UploadcareControlSynopis,
        
        collectionConstructor: Form.UploadcareFiles,
        
        renderOnValueChange: false,
        
        constructor: function(options) {
            Form.Control.prototype.constructor.apply(this, arguments);
            var synopsis = this.getAttribute('synopsis');
            if (_.isString(synopsis)) this.synopsisTemplate = _.template(synopsis);
            this.on('change update', this._updateSynopsis);
            this.on('after:render', this._attachPlugins);
            this.on('destroy', this._detachPlugins);
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
            var settings = _.defaults(this.getAttributes(uploadcareAttributes), defaults);
            settings.control = this;
            return settings;
        },
        
        getUrl: function() {
            if (this.resolvedValue) return this.resolvedValue.cdnUrl;
        },
        
        copyToCliploard: function() {
            if (this.clipboard) this.ui.copyButton.click();
        },
        
        // Modal
        
        modalViewOptions: function() {
            var defaults = { multiple: this.isMultiple(), imagesOnly: this.isImagesOnly() };
            var options = this.getAttributes(uploadcareViewOptions);
            _.defaults(options, defaults);
            return options;
        },
        
        confirmationViewOptions: function() {
            var options = _.extend({ details: false }, this.getAttribute('confirmation'));
            return _.defaults({}, this.modalViewOptions(), options);
        },
        
        onActionShow: function(event) {
            this.showModal(event);
        },
        
        // PLugin integration
        
        getPopoverContent: function() {
            if (!this.isImagesOnly() || !this.resolvedValue || !this.resolvedValue.cdnUrl) return;
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
        
        // Private
        
        _attachPlugins: function() {
            this._detachPlugins();
            if (this.getAttribute('copy')) this._initClipboard();
            if (this.hasPreview()) this._initPopover();
        },
        
        _detachPlugins: function() {
            this.triggerMethod('detach:plugin');
            if (this.clipboard) this.clipboard.destroy();
            this._destroyPopover();
            this.resolvedValue = null;
            this.resolvedUrl = null;
        },
        
        // Preview/Synopsis handling
        
        valueForClipboard: function() {
            var data = { value: this.getUrl() };
            this.triggerMethod('clipboard:copy', data);
            return data.value;
        },
        
        _initClipboard: function() {
            if (this.ui.copyButton[0]) {
                this.clipboard = new Clipboard(this.ui.copyButton[0], {
                    text: this.valueForClipboard.bind(this)
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
        
        _updateSynopsis: function(resolvedValue) {
            var synopsis = this.serializeSynopsis(resolvedValue);
            this.ui.synopsis.html(synopsis || '');
            this.ui.synopsisIcon.attr('class', this.getIcon() || '');
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
        
        getValidator: function(name) {
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
            var handleMultiple = isMultiple || isFileGroupObj || isFileGroupRef;
            var forceSingle = (isFileGroupObj || isFileGroupRef) && !isMultiple;
            
            var resolved = dfd.resolve.bind(dfd);
            var failed = dfd.fail.bind(dfd);
            
            if (handleMultiple) {
                deferredValue = UploadcareControl.fileGroup(source, settings);
            } else if (isFileReference(source)) {
                deferredValue = UploadcareControl.fileFrom(source, 'uploaded', settings);
            } else if (_.isObject(source) && source.sourceName === 'uploaded') {
                deferredValue = UploadcareControl.fileFrom(source, 'object', settings);
            } else if (_.isObject(source) && source.sourceName === 'ready') {
                deferredValue = UploadcareControl.fileFrom(source, 'ready', settings);
            }
            
            if (_.isObject(deferredValue) && _.isFunction(deferredValue.files)) {
                resolveGroupRef(deferredValue);
            } else if (handleMultiple && _.isObject(deferredValue) && _.isFunction(deferredValue.promise)) {
                deferredValue.fail(failed);
                deferredValue.done(resolveGroupRef.bind(this));
            } else if (_.isObject(deferredValue) && _.isFunction(deferredValue.promise)) {
                deferredValue.done(resolved);
                deferredValue.fail(failed);
            } else {
                failed('invalid-source');
            }
            
            return dfd.promise();
            
            function resolveGroupRef(ref) {
                var promises = [ref.promise()].concat(ref.files());
                $.when.apply($, promises).then(function(fileGroup) {
                    fileGroup.files = _.rest(arguments);
                    resolved(forceSingle ? _.first(fileGroup.files) : fileGroup);
                    return fileGroup;
                }, failed);
            }
        }
        
    });
    
    Form.UploadcareStaticControl = Form.UploadcareBaseControl.extend({
        
        definition: { ignore: true, omit: true, escape: true },
        
        controlDefaults: { multiple: 'auto' },
        
        template: Form.Templates.UploadcareStaticControl,
        
        constructor: function(options) {
            Form.UploadcareBaseControl.prototype.constructor.apply(this, arguments);
            
            if (this.getAttribute('fileCollection') === true) {
                this.collection = this.collection || this.getCollection(options);
                this.triggerMethod('init:collection', this.collection);
            }
            
            this.once('render', function() { this.$el.addClass('control-uploadcare'); });
            this.once('after:render', this.resolveSource);
        },
        
        isMultiple: function() {
            if (this.getAttribute('multiple') === false) return false; // enforce
            return this.getAttribute('multiple') === true ||
                (this.resolvedValue && _.isArray(this.resolvedValue.files));
        },
        
        isImagesOnly: function() {
            if (this.getAttribute('imagesOnly') === false) return false; // enforce
            return this.getAttribute('imagesOnly') === true ||
                (this.resolvedValue && this.resolvedValue.isImage) ||
                (this.resolvedValue && _.isArray(this.resolvedValue.files) && _.all(this.resolvedValue.files, isImage));
        },
        
        setSource: function(source) {
            if (source instanceof Form.UploadcareFileGroup || source instanceof Form.UploadcareFile) {
                return this.setResolvedValue(source.toJSON());
            } else if ($.isPlainObject(source)) {
                return this.setResolvedValue(source);
            } else {
                var dfd = this.deferredValue = this.convertSource(source);
                dfd.done(this.triggerMethod.bind(this, 'resolve'));
                dfd.fail(this.triggerMethod.bind(this, 'fail'));
                return dfd;
            }
        },
        
        convertSource: function(source, options) {
            var settings = _.extend({}, this.getSettings());
            return Form.UploadcareControl.resolveSource(source, _.extend(settings, options));
        },
        
        setResolvedValue: function(resolvedValue) {
            this.resolvedValue = resolvedValue;
            this.resolvedUrl = resolvedValue.cdnUrl;
            
            if (this.collection instanceof Form.UploadcareFiles) {
                if (_.isArray(resolvedValue.files)) {
                    this.collection.reset(resolvedValue.files);
                } else if (_.isObject(resolvedValue)) {
                    this.collection.reset(resolvedValue);
                }
            }
            
            this.triggerMethod('update', this.resolvedValue);
        },
        
        resolveSource: function() {
            if (!this.isBlank()) this.setSource(this.getValue(true));
        },
        
        onSetValue: function(key, value, options) {
            this.setSource(value);
        },
        
        onValueChange: function(model, value, options) {
            this.setSource(value);
        },
        
        onResolve: function(data) {
            this.setResolvedValue(data);
        },
        
        ensureDefaultValue: function() {}
        
    });
    
    // Form Control with Uploadcare Widget
    
    var UploadcareControl = Form.UploadcareControl = Form.UploadcareBaseControl.extend({
        
        template: Form.Templates.UploadcareControl,
        
        controlEvents: {
            'click .form-control': '_openDialog'
        },
        
        confirmationView: Form.UploadcareConfirmView,
        
        constructor: function(options) {
            Form.UploadcareBaseControl.prototype.constructor.apply(this, arguments);
            
            if (this.isMultiple() && this.getAttribute('collection') !== false) {
                this.collection = this.collection || this.getCollection(options);
                this.triggerMethod('init:collection', this.collection);
                this.listenTo(this.collection, 'reset sync change update', this._onCollectionUpdate);
                this.on('update:files change:files delete:files', this._updateCollection);
            }
            
            this.on('dialog:open', this._onDialogOpen);
            this.on('after:render', this._attachWidget);
            this.on('destroy', this._detachWidget);
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
        
        reloadInfo: function() {
            if (this.widget) {
                return this.widget.reloadInfo.apply(this.widget, arguments);
            } else {
                return $.Deferred().reject().promise();
            }
        },
        
        // Validation
        
        getValidator: function(name) {
            return this.constructor.getValidator.apply(this.constructor, arguments);
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
        
        validateFile: function(fileInfo) {}, // Hook
        
        // Private
        
        _validateFile: function(fileInfo) {
            this.validateFile(fileInfo);
            this.triggerMethod('validate:file', fileInfo);
        },
        
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
        
        _attachWidget: function() {
            this._detachWidget();
            
            var defaults = _.extend({}, _.result(this.constructor, 'defaults'));
            var settings = this.getSettings();
            var isImmutable = this.isImmutable();
            this.triggerMethod('attach:plugin', settings);
            this.ui.control.data(settings); // pre-configure widget
            
            this.ui.disabledControl.toggleClass('hidden', !isImmutable);
            
            if (this.isMultiple()) {
                this.widget = uploadcare.MultipleWidget(this.ui.control);
            } else {
                this.widget = uploadcare.SingleWidget(this.ui.control);
            }
            
            var $widget = this.$('.uploadcare-widget');
            $widget.toggleClass('hidden', isImmutable);
            
            if (settings.clearable) {
                var removeButton = $widget.find('.uploadcare-widget-button-remove');
                removeButton.off('click');
                removeButton.on('click', this._confirmRemove.bind(this));
            }
            
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
        },
        
        _detachWidget: function() {
            this.triggerMethod('detach:widget');
            this.ui.control.off('.uploadcare');
            this.$('.uploadcare-widget').remove();
            this.widget = null;
        },
        
        _confirmRemove: function(event) {
            if (event instanceof $.Event) event.preventDefault();
            if (!this.resolvedValue || this.triggerMethod('confirm:remove') === false) return;
            var dfd = Form.UploadcareControl.resolveSource(this.getValue(), this.getSettings());
            dfd.then(function(resolved) {
                var options = { attributeName: 'confirmation' };
                if (_.isArray(resolved.files)) {
                    options.model = new Form.UploadcareFileGroup(resolved);
                } else {
                    options.model = new Form.UploadcareFile(resolved);
                }
                var view = this.createModalView(null, options);
                this.openModalWithView(view);
            }.bind(this));
        },
        
        onModalDelete: function(modal, view) {
            if (this.widget && view instanceof this.confirmationView) {
                this.widget.value(null);
            }
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
    
    function isImage(file) {
        return _.isObject(file) && file.isImage;
    };
    
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