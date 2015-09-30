//     Backbone.Model File Upload v1.0.0
//     by Joe Vu - joe.vu@homeslicesolutions.com
//     For all details and documentation:
//     https://github.com/homeslicesolutions/backbone-model-file-upload
//     Contributors:
//       lutherism - Alex Jansen - alex.openrobot.net
//       bildja - Dima Bildin - github.com/bildja
//       Minjung - Alejandro - github.com/Minjung
//       XemsDoom - Luca Moser - https://github.com/XemsDoom
//       DanilloCorvalan  - Danillo Corvalan - https://github.com/DanilloCorvalan

(function(root, factory) {

  // AMD
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'backbone'], function(_, $, Backbone){
      return factory(root, Backbone, _, $);
    });

  // NodeJS/CommonJS
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore'), $ = require('jquery'), Backbone = require('backbone');
    return factory(root, Backbone, _, $);

  // Browser global
  } else {
    return factory(root, root.Backbone, root._, root.$);
  }

}(this, function(root, Backbone, _, $) {
  'use strict';
  
  var Mixin = {};
  
  Mixin.extend = function(Model, fileAttributes) {
    fileAttributes = fileAttributes || [];
    
    var _save = Model.prototype.save;

    return Model.extend({

      // ! Default file attributes - can be overwritten
      fileAttributes: fileAttributes,

      // @ Save - overwritten
      save: function(key, val, options) {
        var fileAttrs = [].concat(_.result(this, 'fileAttributes') || []);

        if (_.isEmpty(fileAttrs)) {
          return _save.apply(this, arguments);
        }

        // Variables
        var attrs, attributes = this.attributes;

        // Signature parsing - taken directly from original Backbone.Model.save
        // and it states: 'Handle both "key", value and {key: value} -style arguments.'
        if (key == null || typeof key === 'object') {
          attrs = key;
          options = val;
        } else {
          (attrs = {})[key] = val;
        }

        // Validate & wait options - taken directly from original Backbone.Model.save
        options = _.extend({validate: true}, options);
        if (attrs && !options.wait) {
          if (!this.set(attrs, options)) return false;
        } else {
          if (!this._validate(attrs, options)) return false;
        }

        // Merge data temporarily for formdata
        var mergedAttrs = _.extend({}, attributes, attrs);

        if (attrs && options.wait) {
          this.attributes = mergedAttrs;
        }

        fileAttrs = _.intersection(_.keys(mergedAttrs), fileAttrs);
        fileAttrs = _.filter(fileAttrs, function(k) {
          return isFileAttribute(mergedAttrs, k);
        });

        // Check for "formData" flag and check for if file exist.
        if ((options.formData === true || options.formData !== false) && !_.isEmpty(fileAttrs)) {
          var formAttrs = _.omit(mergedAttrs, fileAttrs);
          formAttrs = _.extend(formAttrs, _.pick(mergedAttrs, fileAttrs));

          // Converting Attributes to Form Data
          var formData = new FormData();
          _.each(formAttrs, function(value, key) {
            if (value instanceof FileList) {
              _.each(value, function(file) {
                formData.append(key + '[]', file);
              });
              return;
            } else if (value instanceof File) {
              formData.append(key, value);
            } else if (value instanceof Blob) {
              formData.append(key, value, value.filename);
            } else if (_.isArray(value) || _.isObject(value)) {
              return; // skip
            } else {
              formData.append(key, value);
            }
          });
          
          this.trigger('formdata', formData);
          
          // Set options for AJAX call
          options.data = formData;
          options.processData = false;
          options.contentType = false;
          
          // Apply custom XHR for processing status & listen to "progress"
          var that = this;
          options.xhr = function() {
            var xhr = $.ajaxSettings.xhr();
            xhr.upload.addEventListener('progress', that._progressHandler.bind(that), false);
            return xhr;
          }
        }

        // Resume back to original state
        if (attrs && options.wait) this.attributes = attributes;

        // Continue to call the existing "save" method
        return _save.call(this, attrs, options);
      },

      // _ Get the Progress of the uploading file
      _progressHandler: function(event) {
        if (event.lengthComputable) {
          var completed = (event.loaded / event.total || 1);
          this.trigger('progress', completed);
        }
      }
    });
  };
  
  return Mixin;
  
  function isFileAttribute(attrs, key) {
    return attrs[key] && (
      attrs[key] instanceof File ||
      attrs[key] instanceof FileList ||
      attrs[key] instanceof Blob
    );
  };

}));