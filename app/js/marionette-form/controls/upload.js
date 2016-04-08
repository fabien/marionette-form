define([
    'jquery',
    'underscore',
    'backbone',
    'marionette',
    'marionette.form',
    'jquery.fileupload',
    'jquery.iframe-transport'
], function($, _, Backbone, Marionette, Form, FileUpload) {
    
    // This control needs a model that has the backbone.file-upload mixin applied:
    //
    // Thing = FileUpload.extend(Thing, ['file', 'photos']);
    
    Form.Templates.UploadControl = _.template([
        '<label class="<%- labelClassName %>" for="control-<%- id %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <div class="upload-control">',
        '    <span class="btn btn-success fileinput-button">',
        '      <i class="<%- buttonIcon %>"></i>',
        '      <span><%= buttonLabel %></span>',
        '      <input id="control-<%- id %>" name="<%- name %>" data-key="<%- key %>" class="<%- controlClassName %>" type="file" placeholder="<%- placeholder %>" accept="<%- accept %>" <%- multiple ? "multiple" : "" %> <%- disabled ? "disabled" : "" %> <%- required ? "required" : "" %> <%- readonly ? "readonly" : "" %>/>',
        '    </span>',
        '    <div class="progress hidden">',
        '      <div class="progress-bar progress-bar-success"></div>',
        '    </div>',
        '  </div>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%- helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    var UploadControl = Form.UploadControl = Form.FileControl.extend(_.defaults({
        
        template: Form.Templates.UploadControl,
        
        ui: {
            control: 'input',
            progress: '.progress',
            progressBar: '.progress-bar'
        },
        
        defaults: {
            label: '',
            accept: '',
            multiple: true,
            buttonLabel: 'Select files...',
            buttonIcon: 'glyphicon glyphicon-plus',
            extraClasses: [],
            helpMessage: null,
            collection: true
        },
        
        constructor: function(options) {
            Form.FileControl.prototype.constructor.apply(this, arguments);
            this.collection = this.collection || this.getCollection(options);
            this.on('destroy', this.destroyFileUpload);
        },
        
        onChange: function() {
            // disabled
        },
        
        createFileUpload: function() {
            if (this.fileUpload) this.destroyFileUpload();
            this.fileUpload = this.ui.control.fileupload(this.uploadConfig()).data('blueimp-fileupload');
            this.ui.control.bind('fileuploaddone', this.triggerMethod.bind(this, 'upload:done'));
            this.ui.control.bind('fileuploadfail', this.triggerMethod.bind(this, 'upload:fail'));
            this.ui.control.bind('fileuploadalways', this.triggerMethod.bind(this, 'upload:always'));
            this.ui.control.bind('fileuploadprogress', this.triggerMethod.bind(this, 'upload:progress'));
            this.ui.control.bind('fileuploadprogressall', this.triggerMethod.bind(this, 'upload:progress:all'));
            this.ui.control.prop('disabled', !$.support.fileInput)
            this.ui.control.parent().addClass($.support.fileInput ? undefined : 'disabled');
            this.triggerMethod('init:fileupload', this.dropzone);
        },
        
        destroyFileUpload: function() {
            if (this.fileUpload) this.ui.control.fileupload('destroy');
        },
        
        uploadConfig: function() {
            var config = this.getAttributes('paramName', 'method', 'minFileSize', 'maxFileSize');
            config.url = this.getUrl();
            config.paramName = config.paramName || 'file';
            config.type = (this.getAttribute('method') || 'post').toUpperCase();
            config.sequentialUploads = this.getAttribute('sequential') !== true;
            config.autoUpload = !this.getAttribute('queue');
            config.dropZone = this.getAttribute('dropZone') || this.$el;
            config.formData = this.getUploadData.bind(this);
            config.submit = this.onBeforeSend.bind(this);
            
            var acceptTypes = this.getAttribute('acceptTypes');
            
            if (_.isRegExp(acceptTypes)) {
                config.acceptFileTypes = acceptTypes;
            } else if (_.isString(this.getAttribute('accept'))) {
                var types = this.getAttribute('accept').split(/\s?,\s?/);
                config.acceptFileTypes = new RegExp('^(' + types.join('|') + ')$');
            }
            
            return config;
        },
        
        onBeforeSend: function(e, data) {
            // Hook - return false to abort
        },
        
        onUploadDone: function(e, data) {
            if (_.isObject(data.result)) this.collection.add(data.result, { viewCid: this.cid });
        },
        
        onUploadProgressAll: function(e, data) {
            var progress = parseInt(data.loaded / data.total * 100, 10);
            this.ui.progress.removeClass('hidden').show();
            this.ui.progressBar.css('width', progress + '%');
            if (progress >= 100) {
                setTimeout(function() {
                    this.ui.progress.hide();
                    this.ui.progressBar.css('width', 0);
                }.bind(this), 1000);
            }
        },
        
        getUrl: function() {
            var url = this.getAttribute('url');
            return url || (this.form.getUrl() + '/attachments');
        },
        
        getUploadData: function() {
            return _.extend({}, this.getAttribute('data'));
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return Form.Control.prototype.getValue.apply(this, arguments);
            } else {
                return this.collection.toJSON();
            }
        },
        
        render: function() {
            var options = _.last(arguments) || {};
            if (!this.isRendered) {
                Form.FileControl.prototype.render.apply(this, arguments);
                this.createFileUpload();
            } else if (!this.fileUpload) {
                this.createFileUpload();
            }
            if (this.ui.control.data('blueimp-fileupload')) {
                var disabled = this.evaluateAttribute('disabled');
                this.ui.control.fileupload(disabled ? 'disable' : 'enable');
            }
            return this;
        }
        
    }, Form.CollectionMixin));
    
    return UploadControl;
    
});