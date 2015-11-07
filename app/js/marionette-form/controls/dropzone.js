define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'dropzone'
], function($, _, Backbone, Marionette, Form, Dropzone) {
    
    Dropzone.autoDiscover = false;
    
    Form.Templates.DropzoneControl = _.template([
        '<label class="<%= labelClassName %>" for="control-<%= id %>"><%= label %></label>',
        '<div class="<%= controlsClassName %>">',
        '  <div class="dropzone"></div>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%= helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    var PreviewTemplate = [
        '<div class="dz-preview dz-file-preview">',
        '  <div class="dz-image"><img data-dz-thumbnail /></div>',
        '  <div class="dz-details">',
        '    <div class="dz-size"><span data-dz-size></span></div>',
        '    <div class="dz-filename"><span data-dz-name></span></div>',
        '  </div>',
        '  <div class="dz-progress"><span class="dz-upload" data-dz-uploadprogress></span></div>',
        '  <div class="dz-error-message"><span data-dz-errormessage></span></div>',
        '  <div class="dz-success-mark"></div>',
        '</div>'
    ].join('\n');
    
    var DropzoneControl = Form.DropzoneControl = Form.Control.extend(_.defaults({
        
        template: Form.Templates.DropzoneControl,
        
        ui: {
            dropzone: '.dropzone'
        },
        
        defaults: {
            label: '',
            accept: '',
            wait: true,
            extraClasses: [],
            helpMessage: null,
            collection: true
        },
        
        constructor: function(options) {
            Form.Control.prototype.constructor.apply(this, arguments);
            this.collection = this.collection || this.getCollection(options);
            this.on('destroy', this.destroyDropzone);
            if (this.getAttribute('show')) {
                this.on('init:dropzone', this.loadExisting);
                this.listenTo(this.collection, 'add', this.loadExisting);
                this.listenTo(this.collection, 'remove', this.removeExisting);
            }
        },
        
        createDropzone: function() {
            if (this.dropzone) this.destroyDropzone();
            this.dropzone = new Dropzone(this.ui.dropzone[0], this.dropzoneConfig());
            this.dropzone.on('sending', this.triggerMethod.bind(this, 'file:sending'));
            this.dropzone.on('success', this.triggerMethod.bind(this, 'file:success'));
            this.dropzone.on('complete', this.triggerMethod.bind(this, 'file:complete'));
            this.triggerMethod('init:dropzone', this.dropzone);
        },
        
        destroyDropzone: function() {
            if (this.dropzone) this.dropzone.destroy();
        },
        
        dropzoneConfig: function() {
            var config = this.getAttributes('paramName', 'method', 'maxFiles');
            config.url = this.getUrl();
            config.paramName = config.paramName || 'file';
            config.method = config.method || 'post';
            config.maxFiles = _.isNumber(config.maxFiles) ? config.maxFiles : null;
            config.acceptedFiles = this.getAttribute('accept');
            config.accept = this.acceptFile.bind(this);
            config.autoProcessQueue = !this.getAttribute('queue');
            config.addRemoveLinks = Boolean(this.getAttribute('remove'));
            
            config.createImageThumbnails = this.getAttribute('thumbnail') !== false;
            config.thumbnailWidth = this.getAttribute('width') || 120;
            config.thumbnailHeight = this.getAttribute('height') || 120;
            
            var previewEl = this.$('.dropzone-preview');
            var template = this.getOption('previewTemplate');
            if (template) {
                config.previewTemplate = template;
            } else if (previewEl.is('*')) {
                var template = previewEl.html()
                previewEl.remove();
                this.options.previewTemplate = template;
                config.previewTemplate = template;
            } else {
                config.previewTemplate = PreviewTemplate;
            }
            
            return config;
        },
        
        loadExisting: function() {
            var dropzone = this.dropzone;
            var serializeForDropzone = this.serializeForDropzone.bind(this);
            this.collection.cache.done(function() {
                var existing = [];
                $(dropzone.element).find('[data-dz-name]').each(function() {
                    existing.push($(this).text());
                });
                this.each(function(model) {
                    var mockFile = serializeForDropzone(model);
                    if (_.include(existing, mockFile.name)) return;
                    dropzone.emit('addedfile', mockFile);
                    if (_.isString(mockFile.type) && mockFile.type.match(/^image\//) 
                        && (_.isString(mockFile.url) || _.isString(mockFile.thumbnail))) {
                        dropzone.emit('thumbnail', mockFile, mockFile.thumbnail || mockFile.url);
                    }
                    dropzone.emit('complete', mockFile);
                });
                if (_.isNumber(dropzone.options.maxFiles) && dropzone.options.maxFiles > 0) {
                    dropzone.options.maxFiles = dropzone.options.maxFiles - this.collection.length;
                }
            });
        },
        
        removeExisting: function(model, collection) {
            var dropzone = this.dropzone;
            var serializeForDropzone = this.serializeForDropzone.bind(this);
            this.collection.cache.done(function() {
                var existing = {};
                $(dropzone.element).find('[data-dz-name]').each(function() {
                    existing[$(this).text()] = $(this).closest('.dz-preview');
                });
                var mockFile = serializeForDropzone(model);
                var $elem = existing[mockFile.name];
                if ($elem) $elem.remove();
            });
        },
        
        serializeForDropzone: function(model) {
            var file = {};
            file.name = model.get('filename');
            file.size = model.get('filesize');
            file.type = model.get('filetype');
            file.url = this.getUrl() + model.get('url');
            return file;
        },
        
        acceptFile: function(file, done) {
            done(); // Hook method
        },
        
        onFileSuccess: function(file, data) {
            this.collection.add(data, { viewCid: this.cid });
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return Form.Control.prototype.getValue.apply(this, arguments);
            } else {
                return this.collection.toJSON();
            }
        },
        
        getUrl: function() {
            var url = this.getAttribute('url');
            return url || (this.form.getUrl() + '/attachments');
        },
        
        render: function() {
            var options = _.last(arguments) || {};
            if (!this.isRendered) {
                Form.Control.prototype.render.apply(this, arguments);
                this.createDropzone();
            } else if (!this.dropzone) {
                this.createDropzone();
            }
            return this;
        }
        
    }, Form.CollectionMixin));
    
    return DropzoneControl;
    
});