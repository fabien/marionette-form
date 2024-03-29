define([
    'jquery',
    'underscore',
    'moment',
    'backbone',
    'marionette',
    'backbone.nested-model',
    'backbone.syphon'
], function($, _, moment, Backbone, Marionette) {
    
    var TransparantPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    
    var NestedModel = Backbone.NestedModel;
    var NestedCollection = Backbone.Collection.extend({ model: NestedModel });
    
    Marionette.Form = {};
    
    Marionette.Form.classes = {};
    Marionette.Form.classes.form = 'form-horizontal';
    Marionette.Form.classes.group = 'form-group';
    Marionette.Form.classes.groupItem = 'form-group-item';
    Marionette.Form.classes.inputGroup = 'input-group';
    Marionette.Form.classes.inputGroupAddon = 'input-group-addon';
    Marionette.Form.classes.inputGroupButton = 'input-group-btn';
    Marionette.Form.classes.controlLabel = 'control-label col-sm-3';
    Marionette.Form.classes.controls = 'col-controls col-sm-9';
    Marionette.Form.classes.control = 'form-control';
    Marionette.Form.classes.help = 'help-block';
    Marionette.Form.classes.error = 'has-error';
    Marionette.Form.classes.hidden = 'hidden';
    Marionette.Form.classes.requiredInput = 'required';
    Marionette.Form.classes.buttonStatusError = 'text-danger';
    Marionette.Form.classes.buttonStatusSuccess = 'text-success';
    Marionette.Form.classes.nestedControlLabel = 'control-label col-sm-12';
    Marionette.Form.classes.nestedControls = 'col-controls col-sm-12';
    
    var verticalFormClasses = {
        form: 'form',
        controlLabel: 'control-label',
        controls: 'col-controls',
        nestedControlLabel: 'control-label',
        nestedControls: 'col-controls'
    };
    
    Marionette.Form.utils = {
        formatName: formatName,
        evaluateCondition: evaluateCondition,
        pickAttributes: pickAttributes,
        formatDataLabel: formatDataLabel,
        camelize: camelize,
        resolveNameToClass: resolveNameToClass,
        isBlank: isBlank,
        truncate: truncate,
        joinUrl: joinUrl
    };
    
    Marionette.Form.DefaultRegion = Marionette.Region;
    
    var CollectionMixin = {
        
        collectionConstructor: NestedCollection,
        
        getCollection: function(options) {
            var registerCollection = this.getAttribute('registerCollection');
            registerCollection = registerCollection || this.getOption('registerCollection');
            var opts = this.getCollectionData() || [];
            var key = this.getKey();
            var collection;
            if (_.isString(opts) && this.form.hasCollection(opts)) {
                collection = this.form.getCollection(opts);
            } else if (opts instanceof Backbone.Collection) {
                collection = opts;
            } else if (opts === true) {
                var Collection = this.getCollectionConstructor();
                opts = { collection: Collection };
                collection = this.form.bindCollection(key, opts);
            } else if (this.getAttribute('url')) {
                var Collection = this.getCollectionConstructor().extend({
                    url: this.getAttribute('url')
                });
                var collection = new Collection();
                this.listenToOnce(collection, 'sync', this.ensureValue);
                collection.fetch();
                collection = collection;
            } else if (_.isObject(opts) && _.isFunction(opts.done)) { // Deferred
                collection = this.createCollection();
                opts.done(function(data) { collection.reset(data); });
            } else if (_.isArray(opts)) {
                collection = this.createCollection(opts);
            } else {
                var items = this.getFormValue(key);
                _.isArray(items) ? items : [];
                collection = this.createCollection(items);
            }
            if (registerCollection) {
                var name = _.isString(registerCollection) ? registerCollection : null;
                name = name || formatName(key);
                this.form.registerCollection(name, collection);
            }
            return collection;
        },
        
        getCollectionData: function() {
            return this.getAttribute('collection') || this.getAttribute('options');
        },
        
        getCollectionConstructor: function(options) {
            var collectionConstructor = this.form.getCollectionConstructor(this, options);
            collectionConstructor = collectionConstructor || this.getOption('collectionConstructor') || NestedCollection;
            return this.extendCollectionConstructor(collectionConstructor);
        },
        
        extendCollectionConstructor: function(collectionConstructor) {
            return collectionConstructor;
        },
        
        createCollection: function(items, options) {
            var collectionConstructor = this.getCollectionConstructor(options);
            items = this.buildItems(items);
            if (collectionConstructor && collectionConstructor.prototype instanceof Backbone.Collection) {
                return new collectionConstructor(items, options);
            } else if (_.isFunction(collectionConstructor)) {
                return collectionConstructor(items, options);
            } else {
                return new NestedCollection(items, options);
            }
        },
        
        createItemLabel: function(value) {
            return value;
        },
        
        createItemValue: function(value) {
            return value;
        },
        
        buildItems: function(values) {
           return  _.map(values, function(value) {
                return _.isObject(value) ? value : this.buildItem(value);
            }.bind(this));
        },
        
        buildItem: function(value, labelKey, valueKey) {
            if (_.isString(value)) value = value.replace(/,/g, '');
            var labelKey = labelKey || this.labelKey || 'label';
            var valueKey = valueKey || this.valueKey || 'id';
            var item = {};
            item[labelKey] = this.createItemLabel(value);
            item[valueKey] = this.createItemValue(value);
            return item;
        }
        
    };
    
    Marionette.Form.CollectionMixin = CollectionMixin;
    
    // A modal view can implement the following interface methods to comply with ModalControlMixin:
    // 
    // - getData() - to retrieve the view's data
    // - setData() - to set the view's data
    // - commit()  - to validate and set data before getData() is called (optional)
    //               unless commit returns `true`, the dialog will not close on 'OK'
    
    var ModalViewMixin = {
        
        showModal: function(options) {
            if (options instanceof $.Event) {
                event.preventDefault();
                $(options.currentTarget).blur();
                options = $(options.currentTarget).data();
            }
            if (this.modal) return; // singleton
            var view = this.createModalView(null, options);
            var dfd = $.Deferred();
            var promises = [];
            
            this.modal = this.openModalWithView(view);
            
            this.modal.done(function(view, dialog, options) {
                promises.push(view.triggerMethod('modal:resolve', dialog, this, options));
                promises.push(this.triggerMethod('modal:resolve', dialog, view, options));
                $.when.apply($, promises).then(function() {
                    dfd.resolve(dialog, view, options);
                });
            }.bind(this));
            
            this.modal.fail(function(view, dialog, options, err) {
                promises.push(view.triggerMethod('modal:reject', dialog, this, options, err));
                promises.push(this.triggerMethod('modal:reject', dialog, view, options, err));
                $.when.apply($, promises).then(function() {
                    dfd.reject(dialog, view, options, err);
                });
            }.bind(this));
            
            this.modal.always(function() {
                delete this.modal;
            }.bind(this));
            
            return dfd.promise();
        },
        
        getModalViewContstructor: function(viewClass, options) {
            var attributeName = (_.isObject(options) && options.attributeName) || 'modal';
            viewClass = viewClass || this.getOption(attributeName + 'View');
            viewClass = _.isFunction(viewClass) ? viewClass : Marionette.Form.DebugView;
            return viewClass;
        },
        
        getModalViewId: function(options) {
            return _.uniqueId();
        },
        
        getModalViewData: function() {
            if (this.model instanceof Backbone.Model) {
                return this.model.toJSON();
            } else {
                return {};
            }
        },
        
        getModalViewOptions: function(options) {
            var attributeName = (_.isObject(options) && options.attributeName) || 'modal';
            var optionsAttributeName = attributeName + 'ViewOptions';
            return _.extend({}, _.result(this, optionsAttributeName), options, {
                attributeName: attributeName
            });
        },
        
        createModalView: function(viewClass, options) {
            options = this.getModalViewOptions(options);
            viewClass = this.getModalViewContstructor(viewClass, options);
            this.triggerMethod('modal:view:options', options, viewClass);
            var view = new viewClass(options);
            this.triggerMethod('modal:view', view, options);
            return view;
        },
        
        openModalWithView: function(view, modalOptions, callback) {
            if (_.isFunction(modalOptions)) callback = modalOptions, modalOptions = {};
            modalOptions = this.getModalViewOptions(modalOptions);
            _.extend(modalOptions, _.result(view, 'modalOptions'));
            callback = callback || _.noop;
            
            var dfd = $.Deferred();
            var BootstrapModal = this.bootstrapModal;
            
            var dialog = new BootstrapModal(_.extend({
                id: 'dialog-' + this.getModalViewId(modalOptions),
                content: view, enterTriggersOk: true,
                focusOk: false, animate: true
            }, modalOptions));
            
            dialog.on('all', function(eventName) {
                var args = _.rest(arguments);
                this.triggerMethod.apply(this, ['modal:' + eventName, dialog, view].concat(args));
                view.triggerMethod.apply(view, ['modal:' + eventName, dialog, this].concat(args));
            }.bind(this));
            
            dialog.on('shown', function() {
                view.$(':input:enabled:visible:not([readonly]):first').focus();
            });
            
            dialog.once('ok', function() {
                modalOptions.action = 'ok';
                dfd.resolve(view, dialog, modalOptions);
            });
            
            dialog.once('delete', function() {
                modalOptions.action = 'delete';
                dfd.resolve(view, dialog, modalOptions);
            });
            
            dialog.once('cancel', function() {
                modalOptions.action = 'cancel';
                dfd.reject(view, dialog, modalOptions);
            });
            
            if (_.isFunction(view.setData)) view.setData(this.getModalViewData());
            this.triggerMethod('modal:init', dialog, view, modalOptions);
            view.triggerMethod('modal:init', dialog, this, modalOptions);
            
            callback = callback.bind(null, dialog);
            
            if (_.isObject(view.deferred) && _.isFunction(view.deferred.promise)) {
                this.triggerMethod('modal:load:start', dialog, view);
                view.deferred.always(function() {
                    this.triggerMethod('modal:load:stop', dialog, view);
                }.bind(this));
                view.deferred.done(function() { dialog.open(callback); });
                view.deferred.fail(dfd.reject.bind(dfd, view, dialog, modalOptions));
            } else {
                dialog.open(callback);
            }
            
            return dfd.promise();
        }
        
    };
    
    Marionette.Form.ModalViewMixin = ModalViewMixin;
    
    var ModalControlMixin = _.extend({}, ModalViewMixin, {
        
        getModalViewId: function(options) {
            return this.getId() || _.uniqueId();
        },
        
        getModalViewContstructor: function(viewClass, options) {
            var attributeName = (_.isObject(options) && options.attributeName) || 'modal';
            viewClass = viewClass || this.getAttribute(attributeName + 'View') || this.getAttribute(attributeName);
            viewClass = viewClass || this.getOption(attributeName + 'View');
            if (_.isString(viewClass)) viewClass = this.form.getRegisteredView(viewClass);
            viewClass = _.isFunction(viewClass) ? viewClass : Marionette.Form.DebugView;
            return viewClass;
        },
        
        getModalViewOptions: function(options) {
            var attributeName = (_.isObject(options) && options.attributeName) || 'modal';
            var optionsAttributeName = attributeName + 'ViewOptions';
            return _.extend({}, _.result(this, optionsAttributeName), this.getAttribute(optionsAttributeName), options, {
                attributeName: attributeName
            });
        },
        
        getModalViewData: function() {
            if (this.itemModel instanceof Backbone.Model) {
                return this.itemModel.toJSON();
            } else {
                return this.getValue(true);
            }
        }
        
    });
    
    Marionette.Form.ModalControlMixin = ModalControlMixin;
    
    Marionette.Form.Model = NestedModel;
    Marionette.Form.Collection = NestedCollection;
    
    var Templates = Marionette.Form.Templates = {};
    
    Templates.Control = _.template([
        '<label class="<%- labelClassName %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <span class="<%- controlClassName %> immutable">',
        '    <%= _.isArray(obj.value) ? obj.value.join(", ") : obj.value %>',
        '  </span>',
        '</div>'
    ].join('\n'));
    
    Templates.DefaultControl = _.template([
        '<%= _.isArray(obj.value) ? obj.value.join(", ") : obj.value %>'
    ].join('\n'));
    
    Templates.BaseControl = Templates.LayoutControl = _.template([
        '<label class="<%- labelClassName %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>" data-region="main"></div>'
    ].join('\n'));
    
    Templates.HtmlControl = _.template([
      '<% if (obj.label) { %><label class="<%- labelClassName %>"><%= obj.label %></label><% } %>',
      '<div class="<%- controlsClassName %>">',
      '  <%= html %>',
      '</div>'
    ].join('\n'));
    
    Templates.StaticControl = _.template([
      '<label class="<%- labelClassName %>"><%= label %></label>',
      '<div class="<%- controlsClassName %>">',
      '  <p class="form-control-static"><%= text %></p>',
      '</div>'
    ].join('\n'));
    
    Templates.HelpControl = _.template([
        '<label class="<%- labelClassName %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <span class="<%- helpClassName %>"><%= text %></span>',
        '</div>'
    ].join('\n'));
    
    Templates.HeaderControl = _.template([
        '<div class="<%- labelClassName %>"></div>',
        '<div class="<%- controlsClassName %>" data-action="collapse">',
        '  <h<%- level %>><%= label %> <% if (smallLabel) { %><small><%= smallLabel %><% } %></small>',
        '  <% if (collapse) { %><span class="section-caret"></span><% } %>',
        '  </h<%- level %>>',
        '</div>'
    ].join('\n'));
    
    Templates.SpacerControl = _.template([
      '<label class="<%- labelClassName %>">&nbsp;</label>',
      '<div class="<%- controlsClassName %>"><% if (rule) { %><hr /><% } %></div>'
    ].join('\n'));
    
    Templates.RuleControl = _.template(['<hr />'].join('\n'));
    
    Templates.InputControl = _.template([
        '<label class="<%- labelClassName %>" for="control-<%- id %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <input id="control-<%- id %>" name="<%- name %>" data-key="<%- key %>" class="<%- controlClassName %>" type="<%- type %>" <%= maxlength ? (\'maxlength="\' + maxlength + \'"\') : "" %> value="<%- value %>" placeholder="<%- placeholder %>" <%- disabled ? "disabled" : "" %> <%- required ? "required" : "" %> <%- readonly ? "readonly" : "" %>/>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%- helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Templates.HiddenControl = _.template([
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <input id="control-<%- id %>" name="<%- name %>" data-key="<%- key %>" type="hidden" value="<%- value %>"/>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>'
    ].join('\n'));
    
    Templates.TextareaControl = _.template([
        '<label class="<%- labelClassName %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <textarea id="control-<%- id %>" name="<%- name %>" data-key="<%- key %>" class="<%- controlClassName %>" rows="<%- rows %>" <%= maxlength ? (\'maxlength="\' + maxlength + \'"\') : "" %> placeholder="<%- placeholder %>" <%- disabled ? "disabled" : "" %> <%- required ? "required" : "" %> <%- readonly ? "readonly" : "" %>><%- value %></textarea>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%- helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Templates.SelectControl = _.template([
        '<label class="<%- labelClassName %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <select id="control-<%- id %>" name="<%- name %>" data-key="<%- key %>" class="<%- controlClassName %>" value="<%- value %>" <%- multiple ? "multiple" : "" %> <%- disabled ? "disabled" : "" %> <%- required ? "required" : "" %> <%- readonly ? "readonly" : "" %>></select>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%- helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Templates.SelectControlItem = _.template('<%- label %>');
    
    Templates.BooleanControl = _.template([
        '<% if (form.layout !== "vertical") { %><label class="<%- labelClassName %>" for="control-<%- id %>"><%= controlLabel %></label><% } %>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <div class="checkbox">',
        '    <label>',
        '      <input id="control-<%- id %>" name="<%- name %>" data-key="<%- key %>" class="<%- controlClassName %>" type="<%- type %>" <%= value ? \'checked="checked"\' : "" %> <%- disabled ? "disabled" : "" %> <%- required ? "required" : "" %> <%- readonly ? "readonly" : "" %>/>',
        '      <%= label %>',
        '    </label>',
        '  </div>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '</div>'
    ].join('\n'));
    
    Templates.MultiControl = _.template([
        '<label class="<%- labelClassName %>" for="control-<%- id %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <div class="control-options"></div>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%- helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Templates.MultiControlItem = _.template([
        '<input name="<%- control.name %>" type="<%- control.type %>" value="<%- value %>" <%= selected ? \'checked="checked"\' : "" %> <%- disabled ? "disabled" : "" %> <%- readonly ? "readonly" : "" %>/>',
        '<%- label %>'
    ].join('\n'));
    
    Templates.ButtonControl = _.template([
        '<% if (form.layout !== "vertical") { %><label class="<%- labelClassName %>">&nbsp;</label><% } %>',
        '<div class="<%- controlsClassName %>">',
        '  <button id="control-<%- id %>" data-action="<%- action %>" type="<%- type %>" name="<%- name %>" class="btn btn-<%- buttonType %>" <%- disabled ? "disabled" : "" %>><%= label %></button>',
        '  <% if (message) { %><span role="message"><%= message %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Templates.ListControl = _.template([
        '<% if (form.layout !== "vertical" || !_.isEmpty(label)) { %><label class="<%- labelClassName %>"><%= label %></label><% } %>',
        '<% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '<div class="<%- controlsClassName %> nested-controls"></div>',
        '<% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>'
    ].join('\n'));
    
    Templates.EmptyListControl = _.template('<span class="form-control immutable">No <%- parentLabel || "items" %></span>');
    
    Templates.NestedControl = _.template([
        '<div class="<%- controlsClassName %> nested-controls"></div>'
    ].join('\n'));
    
    Templates.DateControl = _.template([
        '<label class="<%- labelClassName %>" for="control-<%- id %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <div class="input-group date">',
        '    <input id="control-<%- id %>" name="<%- name %>" data-key="<%- key %>" class="picker <%- controlClassName %>" type="text" value="<%- value %>" placeholder="<%- placeholder %>" <%- disabled ? "disabled" : "" %> <%- required ? "required" : "" %> readonly/>',
        '    <div class="input-group-addon" data-target="picker"><span class="glyphicon glyphicon-calendar fa fa-calendar" aria-hidden="true"></span></div>',
        '  </div>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%- helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Templates.FileControl = _.template([
        '<label class="<%- labelClassName %>" for="control-<%- id %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <input id="control-<%- id %>" name="<%- name %>" data-key="<%- key %>" class="<%- controlClassName %>" type="file" placeholder="<%- placeholder %>" accept="<%- accept %>" <%- multiple ? "multiple" : "" %> <%- disabled ? "disabled" : "" %> <%- required ? "required" : "" %> <%- readonly ? "readonly" : "" %>/>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (helpMessage && helpMessage.length) { %><span class="<%- helpClassName %>"><%= helpMessage %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    Templates.ImageControl = _.template([
        '<label class="<%- labelClassName %>"><%= label %></label>',
        '<div class="<%- controlsClassName %>">',
        '  <% if (obj.prependHtml) { %><%= obj.prependHtml %><% } %>',
        '  <div class="preview well well-lg">',
        '    <% if (value) { %><img src="<%- value %>" class="img-responsive center-block img-<%- style %>"><% } %>',
        '  </div>',
        '  <% if (obj.appendHtml) { %><%= obj.appendHtml %><% } %>',
        '  <% if (caption && caption.length) { %><span class="<%- helpClassName %>"><%= caption %></span><% } %>',
        '</div>'
    ].join('\n'));
    
    // Field model and collection
    //
    // A field maps a model attriute to a control for rendering and capturing
    // user input.
    var Field = Marionette.Form.Field = NestedModel.extend({
        
        defaults: {
            // Default id for the field
            // (Optional - string)
            id: undefined,
            // Key of the model attribute
            // - It accepts '.' nested path (e.g. x.y.z)
            key: undefined,
            // Placeholder for the input
            placeholder: '',
            // Disable the input control
            // (Optional - true/false/function returning boolean)
            // (Default Value: false)
            disabled: false,
            // Visible
            // (Optional - true/false/function returning boolean)
            // (Default Value: true)
            visible: true,
            // Value Required (validation)
            // (Optional - true/false/function returning boolean)
            // (Default Value: false)
            required: false,
            // Value Readonly
            // (Optional - true/false/function returning boolean)
            // (Default Value: false)
            readonly: false,
            // Default value for the field
            // (Optional - value or function returning value)
            value: undefined,
            // Control class name for the control representing this field
            control: undefined,
            // Formatter for converting value
            formatter: undefined,
            // Whether this field's data is included in form.getData()
            omit: false,
            // Whether this field will set values on the form's data model
            ignore: false
        },
        
        constructor: function(attributes, options) {
            attributes = attributes || {};
            attributes.key = attributes.key || attributes.id || _.uniqueId('field-');
            var defaultName = attributes.key === '*' ? _.uniqueId('field-') : attributes.key;
            attributes.name = formatName(attributes.name || defaultName);
            attributes.id = attributes.id || attributes.name;
            NestedModel.prototype.constructor.call(this, attributes, options);
        },
        
        validate: function(attributes, options) {
            if (_.isEmpty(attributes.key)) {
                return 'field "key" is required';
            }
        }
        
    });
    
    var Fields = Marionette.Form.Fields = Backbone.Collection.extend({
        
        model: Field
    
    });
    
    // Formatters
    
    // Converting data to/from Model/DOM.
    // Stolen directly from Backgrid's CellFormatter.
    // Source: http://backgridjs.com/ref/formatter.html
    /**
    Just a convenient class for interested parties to subclass.
    
    The default Cell classes don't require the formatter to be a subclass of
    Formatter as long as the fromRaw(rawData) and toRaw(formattedData) methods
    are defined.
    
    @abstract
    @class Marionette.Form.ControlFormatter
    @constructor
    */
    var ControlFormatter = Marionette.Form.ControlFormatter = function() {};
    _.extend(ControlFormatter.prototype, {
        
        /**
        Takes a raw value from a model and returns an optionally formatted string
        for display. The default implementation simply returns the supplied value
        as is without any type conversion.
        
        @member Marionette.Form.ControlFormatter
        @param {*} rawData
        @param {Backbone.Model} model Used for more complicated formatting
        @return {*}
        */
        fromRaw: function (rawData, model) {
            return rawData;
        },
        
        /**
        Takes a formatted string, usually from user input, and returns a
        appropriately typed value for persistence in the model.
        
        If the user input is invalid or unable to be converted to a raw value
        suitable for persistence in the model, toRaw must return `undefined`.
        
        @member Marionette.Form.ControlFormatter
        @param {string} formattedData
        @param {Backbone.Model} model Used for more complicated formatting
        @return {*|undefined}
        */
        toRaw: function (formattedData, model) {
            return formattedData;
        }
        
    });
    
    var JsonFormatter = Marionette.Form.JsonFormatter = function() {};
    _.extend(JsonFormatter.prototype, {
        
        fromRaw: function(rawData, model) {
            return rawData;
        },
        
        toRaw: function(formattedData, model) {
            try {
                return JSON.parse(formattedData);
            } catch(e) {
                if (_.isString(formattedData)
                    || _.isObject(formattedData)
                    || _.isBoolean(formattedData)
                    || _.isNumber(formattedData)) {
                    return formattedData;
                }
                return null;
            }
        }
        
    });
    
    var DateFormatter = Marionette.Form.DateFormatter = function() {};
    _.extend(DateFormatter.prototype, {
        
        fromRaw: function(rawData, model) {
            return rawData;
        },
        
        toRaw: function(formattedData, model) {
            if (_.isDate(formattedData)) return formattedData;
            if (_.isNumber(formattedData)) return new Date(formattedData);
            if (_.isObject(formattedData) && formattedData.toDate) {
                return formattedData.toDate();
            }
            if (_.isEmpty(formattedData)) return;
            return new Date(String(formattedData).replace(/GMT.*$/, 'GMT'));
        }
        
    });
    
    var IntegerFormatter = Marionette.Form.IntegerFormatter = function() {};
    _.extend(IntegerFormatter.prototype, {
        
        fromRaw: function(rawData, model) {
            return rawData;
        },
        
        toRaw: function(formattedData, model) {
            var intVal = parseInt(formattedData, 10);
            return _.isNaN(intVal) ? 0 : intVal;
        }
        
    });
    
    var FloatFormatter = Marionette.Form.FloatFormatter = function() {};
    _.extend(FloatFormatter.prototype, {
        
        fromRaw: function(rawData, model) {
            return rawData;
        },
        
        toRaw: function(formattedData, model) {
            var floatVal = parseFloat(String(formattedData).replace(',', '.'));
            return _.isNaN(floatVal) ? 0 : floatVal;
        }
        
    });
    
    var CentsFormatter = Marionette.Form.CentsFormatter = function() {};
    _.extend(CentsFormatter.prototype, {
        
        fromRaw: function(rawData, model) {
            rawData = _.isNaN(rawData) ? 0 : rawData;
            return (rawData / 100).toFixed(2);
        },
        
        toRaw: function(formattedData, model) {
            var number = parseFloat(formattedData);
            return Math.round((_.isNaN(number) ? 0 : number) * 100);
        }
        
    });
    
    var PercentageFormatter = Marionette.Form.PercentageFormatter = function() {};
    _.extend(PercentageFormatter.prototype, {
        
        fromRaw: function(rawData, model) {
            return (_.isNumber(rawData) ? rawData.toFixed() : 0) + ' %';
        },
        
        toRaw: function(formattedData, model) {
            return parseInt(String(formattedData).replace(/\D+/g, ''));
        }
        
    });
    
    var ArrayFormatter = Marionette.Form.ArrayFormatter = function() {};
    _.extend(ArrayFormatter.prototype, {
        
        fromRaw: function(rawData, model) {
            if (_.isArray(rawData)) return rawData.join(',');
            return '';
        },
        
        toRaw: function(formattedData, model) {
            return String(formattedData).split(',');
        }
        
    });
    
    // Global registry
    
    var __resolvers = {};
    var __collections = {};
    
    Marionette.Form.registerResolver = function(name, fn) {
        __resolvers[name] = fn;
    };
    
    Marionette.Form.unregisterResolver = function(name, fn) {
        delete __resolvers[name];
    };
    
    Marionette.Form.getCollection = function(name) {
        return __collections[name];
    };
    
    Marionette.Form.registerCollection = function(name, collection) {
        if (collection instanceof Backbone.Collection) {
            __collections[name] = collection;
        } else if (_.isArray(collection)) {
            __collections[name] = new NestedCollection(collection);
        } else if (_.isString(collection)) { // url
            var Collection = NestedCollection.extend({ url: collection });
            __collections[name] = new Collection();
            __collections[name].fetch();
        } else {
            __collections[name] = new NestedCollection();
        }
        return __collections[name];
    };
    
    Marionette.Form.unregisterCollection = function(name) {
        delete __collections[name];
    };
    
    // Forms
    
    Marionette.Form.getForm = function(name) {
        return resolveNameToClass(name, 'Form');
    };
    
    // Util
    
    Marionette.Form.geoIpLookup = function(callback) {
        return $.get('http://ipinfo.io', function() {}, 'jsonp').always(callback);
    };
    
    // Views
    
    Marionette.Form.OverlayView = Marionette.ItemView.extend({
        
        template: false
        
    });
    
    var DebugView = Marionette.Form.DebugView = Marionette.ItemView.extend({
        
        template: _.template('<pre><%- JSON.stringify(obj, null, 4) %></pre>'),
        
        initialize: function() {
            this.model = this.model || new NestedModel();
        },
        
        setData: function(value) {
            this.model.set('value', value);
        }
        
    });
    
    // Controls
    
    function extendView(View, protoDef, viewConstructor) {
        if (_.isFunction(protoDef)) viewConstructor = protoDef, protoDef = {};
        return View.extend(_.extend({
            
            defaults: {},
            
            groupClassName: 'group',
            
            id: function() {
                var id = (this.model && this.model.id) || ('field-' + this.cid);
                var prefix = this.form.callDelegate('getControlIdPrefix', this) || this.form.getOption('prefix');
                return formatName(prefix ? prefix + id : id);
            },
            
            tagName: function() {
                return this.getAttribute('tagName') || this.options.tagName || 'div';
            },
            
            className: function() {
                var className = this.getClassName(this.getOption('groupClassName'));
                className += ' control-' + this.model.get('control');
                className += ' field-' + this.model.get('name');
                var controlClassName = _.result(this, 'controlClassName');
                if (!_.isEmpty(controlClassName)) className += ' ' + controlClassName;
                controlClassName = this.getAttribute('controlClass');
                if (!_.isEmpty(controlClassName)) className += ' ' + controlClassName;
                return className;
            },
            
            attributes: function() {
                var attrs = {};
                var section = this.getAttribute('section');
                if (_.isEmpty(section) || this.parent) return attrs;
                attrs['data-section'] = section;
                return attrs;
            },
            
            formatter: ControlFormatter,
            
            ui: {
                control: '.immutable'
            },
            
            triggers: function() {
                if (this.getAttribute('trigger') === false) {
                    var changeTriggers = [];
                } else {
                    var changeTriggers = this.getAttribute('trigger') || 'change';
                    changeTriggers = changeTriggers.split(/\s/);
                }
                var triggers = {};
                _.each(changeTriggers, function(trigger) {
                    triggers[trigger + ' @ui.control'] = 'change';
                });
                triggers['focus @ui.control'] = 'focus';
                triggers['blur @ui.control'] = 'blur';
                _.extend(triggers, _.result(this, 'controlTriggers'));
                return triggers;
            },
            
            events: function() {
                var events = {};
                events['keydown :input'] = 'onKeyDown';
                events['click [data-action]'] = 'onAction';
                var labelClick = this.triggerMethod.bind(this, 'label:click');
                events['click label.control-label'] = labelClick;
                _.extend(events, _.result(this, 'controlEvents'));
                return events;
            },
            
            formEvents: [],
            
            controlClassName: undefined,
            
            controlEvents: undefined,
            
            controlTriggers: undefined,
            
            constructor: function(options) {
                options = _.extend({}, options);
                var opts = _.omit(options, 'form', 'parent');
                
                if (!(options.form instanceof Marionette.Form.View)) {
                    throw new Error('Cannot create Control without Form View');
                }
                
                this.defaults = _.extend({}, _.result(this, 'defaults'), _.result(this, 'controlDefaults'), options.defaults);
                this.definition = _.extend({}, _.result(this, 'definition'), options.definition);
                
                this.form = options.form;
                if (options.parent) this.parent = options.parent;
                
                this.setupControlBehaviors(opts);
                
                View.prototype.constructor.call(this, opts);
                
                if (!(this.model instanceof NestedModel)) {
                    throw new Error('Cannot create Control without a Model');
                } else if (!_.isEmpty(this.definition) && this.form.getOption('enforceDefinitions')) {
                    // note that this might cause side-effects when multiple
                    // (form) views are bound to this same model!
                    this.model.set(this.definition);
                }
                
                var formatterOptions = _.extend({}, _.result(this, 'formatterOptions'));
                var formatter = this.getAttribute('formatter') || this.formatter;
                this.formatter = this.form.getFormatter(formatter, formatterOptions);
                
                this.on('focus', this.clearError);
                this.on('change', this.clearError);
                this.on('blur', this.renderError);
                
                if (this.hasAttribute('default') && this.isBlank()) {
                    this.setValue(this.getAttribute('default'), { silent: true });
                }
                
                if (this.getOption('renderOnValueChange') !== false) this.observeKey(this.getKey());
                this.observeKey(this.getKey(), this.triggerMethod.bind(this, 'value:change'));
                
                this.listenTo(this.model, 'change:key', function(model, key) {
                    this.stopObservingKey(model.previous('key'));
                    this.observeKey(key);
                });
                
                _.each([].concat(this.model.get('observe') || []), function(key) {
                    this.observeKey(key);
                }.bind(this));
                
                this.listenTo(this.form, 'destroy', this.destroy);
                
                _.each(_.result(this, 'formEvents'), function(eventName) {
                    var eventTrigger = 'form:' + eventName;
                    this.listenTo(this.form, eventName, this.triggerMethod.bind(this, eventTrigger));
                }.bind(this));
                
                this.listenTo(this.model, 'change:disabled', this.render);
                this.listenTo(this.model, 'change:required', this.render);
                this.listenTo(this.model, 'change:readonly', this.render);
                this.listenTo(this.model, 'change:visible', this.render);
                this.listenTo(this.model, 'change:ignore', this.render);
                this.listenTo(this.model, 'change:omit', this.render);
                
                this.listenTo(this.model, 'change:prependHtml', this.render);
                this.listenTo(this.model, 'change:appendHtml', this.render);
                this.listenTo(this.model, 'change:addon', this.render);
                
                this.on('render', this.renderError);
                this.on('render', this.applyJQuery);
                this.on('render', this.triggerMethod.bind(this, 'render:control'));
                this.on('render', this.triggerMethod.bind(this, 'after:render'));
                
                this.once('render', this.ensureDefaultValue);
                
                this.on('refresh', this.refreshView);
                
                this.listenTo(this.model, 'change:template', function(model, template) {
                    this.setTemplate(template);
                    this.render();
                });
                
                var templateAttribute = this.getOption('templateAttribute') || 'template';
                this.setTemplate(this.getAttribute(templateAttribute) || this.template);
                
                var formatTemplate = this.getAttribute('format') || this.getOption('format');
                this.formatTemplate = formatTemplate ? this.lookupTemplate(formatTemplate) : null;
                
                this.listenTo(this.model, 'change:label', function(model, label) {
                    this.labelTemplate = _.template(label);
                    this.render();
                });
                
                this.setLabel(this.getAttribute('label'));
                
                var debounce = this.getAttribute('debounce');
                if (debounce === true) debounce = 100;
                if (_.isNumber(debounce)) {
                    this.onChange = _.debounce(this.onChange.bind(this), debounce);
                }
                
                if (_.isFunction(viewConstructor)) viewConstructor.call(this, options);
                
                this.triggerMethod('initialize', options);
            },
            
            setupControlBehaviors: function(options) {
                this.behaviors = _.result(this, 'behaviors') || {};
                if (this instanceof Marionette.CollectionView
                    && options.model && options.model.get('sortable')) {
                    if (!Marionette.SortableBehavior) {
                        throw new Error('Marionette.SortableBehavior is not available');
                    }
                    var sortable = options.model.get('sortable');
                    this.behaviors._Sortable = _.extend({
                        behaviorClass: Marionette.SortableBehavior
                    }, _.isObject(sortable) ? sortable : {});
                }
            },
            
            lookupTemplate: function(template, raw) {
                var isString = _.isString(template);
                if (raw) {
                    template = _.template(String(template || ''));
                } else if (isString && template.indexOf('#') === 0) {
                    template = Marionette.TemplateCache.get(template);
                } else if (isString && template.indexOf('@') === 0) {
                    try {
                        template = resolveNameToClass(template.slice(1), 'Template');
                    } catch(e) {
                        template = _.template('Template not found: ' + template);
                    }
                } else if (isString) {
                    template = _.template(template || '');
                } else if (_.isFunction(template)) {
                    template = template;
                }
                return template;
            },
            
            setTemplate: function(template, raw) {
                if (raw || _.isString(template)) {
                    this.template = this.lookupTemplate(template, raw);
                } else if (_.isFunction(template) && this.template !== template) {
                    this.template = template;
                }
            },
            
            getClassName: function(key, prefix) {
                if (this.parent && !this.parent.parent && prefix) {
                    key = prefix + camelize(key);
                }
                return this.form.getClassName(this.model, key);
            },
            
            enableClassName: function(className, bool) {
                className = this.getClassName(className) || className;
                this.$el.toggleClass(className, !!bool);
            },
            
            getLabel: function() {
                if (!this.labelTemplate) return '';
                var options = this.serializeLabelData();
                var label = this.form.getFieldLabel(this.getId(), options);
                if (_.isString(label)) return label;
                label = this.labelTemplate(options);
                if (!_.isEmpty(label)) return label;
                label = _.last(this.getKey().split('.'));
                return this.formatLabel(label);
            },
            
            setLabel: function(label) {
                if (label === false) {
                    this.labelTemplate = undefined;
                } else {
                    this.labelTemplate = _.template(label || '');
                }
            },
            
            setFocus: function(bool) {
                if (!this.ui.control) return;
                this.ui.control[bool === false ? 'blur' : 'focus']();
            },
            
            setVisible: function(bool) {
                this.setAttribute('visible', bool);
                this.setAttribute('omit', !bool);
            },
            
            getId: function() {
                return _.result(this, 'id');
            },
            
            getKey: function() {
                var prefix = this.getOption('keyPrefix');
                var key = this.getAttribute('key');
                return prefix ? prefix + key : key;
            },
            
            getData: function() {
                return this.getValue(true);
            },
            
            commit: function(blur) {
                if (this.ui.control && this.ui.control.is(':input')) {
                    if (blur) this.ui.control.blur();
                    this.setValue(this.getValue());
                }
            },
            
            getValueOf: function(key) {
                if (!_.isString(key)) return;
                var glue = key.indexOf('[') === 0 ? '' : '.';
                key = this.getKey() + glue + key;
                return this.getFormValue(key);
            },
            
            setValueOf: function(key, value, options) {
                if (!_.isString(key)) return;
                var glue = key.indexOf('[') === 0 ? '' : '.';
                key = this.getKey() + glue + key;
                return this.setFormValue(key, value, options);
            },
            
            hasValue: function() {
                return this.form.hasValue(this.getKey());
            },
            
            getValue: function(fromModel) {
                if (fromModel) {
                    return this.getFormValue(this.getKey());
                } else if (this.ui.control && this.ui.control.is(':input')) {
                    return this.coerceValue(this.ui.control.val());
                } else if (this.ui.control && this.ui.control.is('*')) {
                    return this.coerceValue(this.ui.control.text());
                }
            },
            
            setValue: function(value, options) {
                return this.mutex(function() {
                    var viewCid = this.parent ? this.parent.cid : this.cid;
                    options = _.extend({ viewCid: viewCid }, options);
                    return this.setFormValue(this.getKey(), value, options);
                });
            },
            
            resetValue: function(options) {
                this.setValue(this.getAttribute('default'), options);
            },
            
            unsetValue: function(options) {
                this.form.unsetValueOf(this.getKey(), options);
            },
            
            forceValue: function(value, options) {
                this.setValue(value, _.extend({ viewCid: false }, options));
            },
            
            clearValue: function(options) {
                if (this.ui.control && this.ui.control.is(':input')) {
                    this.ui.control.val(this.getAttribute('default'));
                } else {
                    this.resetValue(options);
                }
            },
            
            getFormValue: function(key) {
                return this.form.getValueOf(key);
            },
            
            setFormValue: function(key, value, options) {
                if (key === this.getKey() && _.isString(value) && this.getAttribute('escape')) {
                    value = _.unescape(value);
                }
                if (this.evaluateAttribute('ignore')) {
                    this.triggerMethod('set:value', key, value, options);
                } else {
                    return this.form.setValueOf(key, value, options);
                }
            },
            
            hasChanged: function() {
                return this.form.hasChanged(this.getKey());
            },
            
            isNew: function() {
                return this.form.model.isNew();
            },
            
            isBlank: function() {
                return isBlank(this.getValue(true));
            },
            
            isInput: function() {
                return Boolean(this.ui.control && this.ui.control.is(':input:enabled:visible:not([readonly])') &&
                    this.ui.control.not('input[type="button"]') && this.ui.control.not('input[type="submit"]'));
            },
            
            isBranched: function() {
                return this.getAttribute('branch') === true;
            },
            
            isEditable: function() {
                return !this.isDisabled() && !this.isReadonly() && this.isVisible();
            },
            
            isImmutable: function() {
                return !this.isEditable();
            },
            
            isDisabled: function() {
                var isDisabled = this.form.isDisabled(this.getKey());
                return isDisabled || this.evaluateAttribute('disabled');
            },
            
            isEnabled: function() {
                return !this.isDisabled();
            },
            
            isVisible: function() {
                return this.evaluateAttribute('visible');
            },
            
            isReadonly: function() {
                var isReadonly = this.form.isReadonly(this.getKey());
                return isReadonly || this.evaluateAttribute('readonly');
            },
            
            isRequired: function() {
                return this.evaluateAttribute('required');
            },
            
            isOmitted: function() {
                return this.evaluateAttribute('omit');
            },
            
            isIgnored: function() {
                return  this.evaluateAttribute('ignore')
            },
            
            isValid: function(options) {
                return this.validateValue(options);
            },
            
            validateValue: function(options) {
                return this.form.validateValueOf(this.getKey(), options);
            },
            
            coerceValue: function(value) {
                // 'raw' is the actual model attribute's value
                if (!this.formatter) return value;
                return this.formatter.toRaw(value, this.form.model);
            },
            
            formatLabel: function(label) {
                return this.form.formatLabel(label);
            },
            
            getDefault: function(attr) {
                return this.defaults[attr];
            },
            
            hasAttribute: function(attr) {
                return this.model.has(attr);
            },
            
            getAttribute: function(attr) {
                if (this.model.has(attr)) return this.model.get(attr);
                return this.getDefault(attr);
            },
            
            setAttribute: function(attr, value) {
                this.model.set(attr, value);
            },
            
            getAttributes: function() {
                var attrs = _.flatten(arguments);
                if (attrs.length === 0) {
                    return _.defaults({}, this.model.toJSON(), this.defaults);
                } else {
                    return _.reduce(attrs, function(hash, attr) {
                        var value = this.getAttribute(attr);
                        if (!_.isUndefined(value)) hash[attr] = value;
                        return hash;
                    }.bind(this), {});
                }
            },
            
            onChange: function(event) {
                this.commit();
            },
            
            evaluateAttribute: function(attr, data) {
                data = data || this.serializeField();
                if (_.isString(data[attr]) && data[attr].indexOf(':') > 0) {
                    var parts = data[attr].split(':'); // don't pass in data
                    return this.form.evaluateAttributeOf(parts[0], parts[1]);
                }
                return evaluateCondition(this, data[attr], data);
            },
            
            serializeLabelData: function() {
                var data = Marionette.ItemView.prototype.serializeData.apply(this);
                data.id = this.getId();
                data.key = this.getKey();
                data.form = this.form.serializeData();
                data.value = this.serializeValue();
                data.formatter = this.formatter;
                data.nested = this.parent instanceof Marionette.View;
                data = _.defaults(data, this.defaults);
                return data;
            },
            
            serializeField: function() {
                var data = Marionette.ItemView.prototype.serializeData.apply(this);
                data.id = this.getId();
                data.key = this.getKey();
                data.form = this.form.serializeData();
                data.value = this.serializeValue();
                data.formatter = this.formatter;
                data.nested = this.parent instanceof Marionette.View;
                data = _.defaults(data, this.defaults);
                data.label = this.getLabel(); // enforce
                return data;
            },
            
            serializeValue: function() {
                if (this.parent && _.isFunction(this.parent.serializeItemValue)) {
                    var value = this.parent.serializeItemValue(this);
                } else {
                    var value = this.getValue(true);
                }
                value = this.formatter.fromRaw(value);
                if (this.getAttribute('escape')) {
                    value = _.escape(value);
                }
                return value;
            },
            
            serializeData: function() {
                var data = this.serializeField();
                
                var addon = _.extend({}, this.getOption('addon'), this.getAttribute('addon'));
                var hasAddon = !_.isEmpty(addon);
                
                data.prependHtml = this.getPrependHtml();
                if (hasAddon) data.prependHtml = '<div class="' + this.getClassName('inputGroup') + '">' + (data.prependHtml || '');
                
                data.appendHtml = this.getAppendHtml();
                if (hasAddon) data.appendHtml = (data.appendHtml || '') + '</div>';
                
                _.extend(data, {
                    disabled: this.isDisabled(),
                    required: this.isRequired(),
                    readonly: this.isReadonly(),
                    visible:  this.isVisible(),
                    ignore:   this.isIgnored(),
                    omit:     this.isOmitted(),
                    branched: this.isBranched()
                });
                
                data.error = this.form.getError(data.key);
                data.errors = this.form.getErrors(data.key);
                
                if (!_.isString(data.labelClassName)) {
                    data.labelClassName = this.getClassName('controlLabel', 'nested');
                }
                
                if (!_.isString(data.controlsClassName)) {
                    data.controlsClassName = this.getClassName('controls', 'nested');
                    if (this.collection && this.collection.isEmpty() &&
                        this.renderOnValueChange !== false) {
                        data.controlsClassName += ' empty';
                    }
                }
                
                if (!_.isString(data.controlClassName)) {
                    data.controlClassName = this.getClassName('control');
                }
                
                if (!_.isString(data.helpClassName)) {
                    data.helpClassName = this.getClassName('help');
                }
                
                if (!_.isEmpty(data.extraClasses)) {
                    var extraClasses = _.result(this, 'extraClasses') || [];
                    extraClasses = extraClasses.concat(data.extraClasses || []);
                    data.controlClassName += ' ' + extraClasses.join(' ');
                }
                
                delete data.extraClasses;
                
                if (_.isFunction(this._serializeData)) this._serializeData(data);
                
                this.triggerMethod('serialize:data', data);
                
                return data;
            },
            
            getAddon: function(prepend) {
                var addon = _.extend({}, this.getOption('addon'), this.getAttribute('addon'));
                if (_.isEmpty(addon)) return '';
                if (prepend && !addon.prepend) return '';
                if (!prepend && addon.prepend) return '';
                var span = $('<span>', _.pick(addon, 'id', 'class', 'style'));
                span.addClass(this.getClassName(addon.button ? 'inputGroupButton' : 'inputGroupAddon'));
                var elem = span;
                if (addon.button) {
                    var buttonOptions = _.isObject(addon.button) ? addon.button : {};
                    elem = $('<button>', buttonOptions);
                    elem.addClass('btn');
                    if (!buttonOptions.class) elem.addClass('btn-default');
                    span.append(elem);
                }
                if (addon.html) {
                    elem.html(addon.html);
                } else if (addon.text) {
                    elem.text(addon.text);
                }
                elem.attr('data-action', addon.action || 'addon');
                if (addon.icon) elem.append($('<i>', { class: addon.icon }));
                this.triggerMethod('init:addon', span, addon);
                return span.wrap('<div>').parent().html();
            },
            
            getPrependHtml: function() {
                var html = this.getOption('prependHtml') || '';
                if (this.hasAttribute('prependHtml')) html += this.getAttribute('prependHtml');
                html += this.getAddon(true);
                if (!_.isEmpty(html)) return html;
            },
            
            getAppendHtml: function() {
                var html = this.getAddon(false);
                if (this.hasAttribute('appendHtml')) html += this.getAttribute('appendHtml');
                html += this.getOption('appendHtml') || '';
                if (!_.isEmpty(html)) return html;
            },
            
            refreshView: function() {
                this.enableClassName('hidden', !this.isVisible());
                this.enableClassName('requiredInput', this.isRequired());
                this.enableClassName('disabled', this.isDisabled());
                this.enableClassName('readonly', this.isReadonly());
                this.enableClassName('omit', this.isOmitted());
                this.enableClassName('branched', this.isBranched());
            },
            
            render: function() {
                var options = _.last(arguments) || {};
                if (this.getOption('renderOnce') && this.isRendered && !options.force) {
                    this.triggerMethod('refresh', options);
                    this.isValid();
                } else if (options.force || !this.isRendered || options.viewCid !== this.cid) {
                    this.once('render', this.triggerMethod.bind(this, 'refresh', options));
                    return View.prototype.render.apply(this, arguments);
                } else {
                    this.triggerMethod('refresh', options);
                    this.isValid();
                }
                return this;
            },
            
            appendTo: function(sel) {
                if (!this.isRendered) this.render();
                this.$el.appendTo(sel);
                return this;
            },
            
            attachElContent: function(html) {
                var unwrap = this.getOption('unwrap') || this.form.getOption('unwrapControls');
                if (unwrap && _.isString(html) && html.match(/<[a-z][\s\S]*>/i)) {
                    var unwrapped = $('<div />').append(html).find('.col-controls').html();
                    html = _.isEmpty(unwrapped) ? html : unwrapped;
                }
                return View.prototype.attachElContent.call(this, html);
            },
            
            renderError: function() {
                var self = this;
                this.clearError();
                var errorClass = this.getClassName('error');
                this.$el.find(':input').not('button').each(function(idx, el) {
                    var key = $(el).data('key') || self.getKey();
                    var name = $(el).attr('name') || self.model.get('name');
                    var errors = self.form.getErrors(key);
                    if (_.isEmpty(errors)) {
                        return; // skip - OK
                    } else {
                        self.triggerMethod('error', errors);
                        if (self.form.lastActiveControl) {
                            self.form.lastActiveControl.setFocus();
                            self.form.lastActiveControl = null; // reset!
                        }
                    }
                    $(el).one('change keydown', self.clearError.bind(self));
                    self.$el.addClass(errorClass);
                    var $control = self.$el.find('.col-controls');
                    _.each(errors, function(error) {
                        $control.append(self.errorHtml(error));
                    });
                });
            },
            
            clearError: function() {
                this.$el.removeClass(this.getClassName('error'));
                this.$el.find('.' + this.getClassName('help') + '.error').remove();
                return this;
            },
            
            applyJQuery: function() {
                var control = this.ui.elem || this.ui.control;
                if (!control || !control.is('*')) return; // skip
                if (_.isFunction(this._applyJQuery)) this._applyJQuery(control);
                var jquery = _.extend({}, this.getOption('jquery'), this.getAttribute('jquery'));
                var appliedPlugins = [];
                var self = this;
                
                var plugins = _.extend({}, _.result(this, 'plugins'));
                _.each(plugins, function(plugin, attr) {
                    var settings = this.getAttribute(attr);
                    if (settings) jquery[plugin] = settings;
                }.bind(this));
                
                _.each(jquery, function(args, method) {
                    args = _.isArray(args) ? args : [].concat(args || []);
                    if (_.isFunction(control[method])) {
                        control[method].apply(control, args);
                        appliedPlugins.push(method);
                        self.triggerMethod('jquery:plugin', method, args);
                    }
                });
                
                this.triggerMethod('jquery:plugins', appliedPlugins);
            },
            
            observeKey: function(key, method) {
                method = method || this.render;
                var errorMethod = method === this.render ? this.renderError : null;
                if (key === '*') {
                    this.listenTo(this.form.model, 'change', method);
                    if (errorMethod) this.listenTo(this.form.errors, 'change', errorMethod);
                } else {
                    this.listenTo(this.form.model, 'change:' + key, method);
                    if (errorMethod) this.listenTo(this.form.errors, 'change:' + key, errorMethod);
                }
            },
            
            stopObservingKey: function(key, method) {
                if (key === '*') {
                    this.stopListening(this.form.model, 'change', method);
                    this.stopListening(this.form.errors, 'change', method);
                } else {
                    this.stopListening(this.form.model, 'change:' + key, method);
                    this.stopListening(this.form.errors, 'change:' + key, method);
                }
            },
            
            mixinTemplateHelpers: function(data) {
                data = this.form.mixinTemplateHelpers(data);
                data = Marionette.ItemView.prototype.mixinTemplateHelpers.call(this, data);
                
                // This is a workaround, in order to have access to the serialized data to be
                // rendered, and to use it directly to update the DOM
                
                this.enableClassName('hidden', !data.visible);
                this.enableClassName('requiredInput', data.required);
                this.enableClassName('disabled', data.disabled);
                this.enableClassName('readonly', data.readonly);
                this.enableClassName('omit', data.omit);
                
                return data;
            },
            
            formatError: function(error) {
                return error.message;
            },
            
            errorHtml: function(error) {
                var id = _.result(this, 'id') + '-error';
                var code = error.code || 'invalid';
                var className = this.getClassName('help');
                var html = '<label id="' + id + '-error" for="control-' + id + '" class="' + className + ' error" data-error-code="' + code + '">';
                html += this.formatError(error);
                html += '</label>';
                return html;
            },
            
            loseFocus: function(toPrevious, target) {
                var $self = this.$el;
                var $target = $(target || this.ui.control || this.$(':input'));
                var className = this.getClassName(this.getOption('groupClassName'));
                setTimeout(function() {
                    var $nextFocus;
                    if (toPrevious) {
                        $nextFocus = $target.prevAll(':input:visible').length ?
                            $target.prevAll(':input:visible').first() :
                            $target.closest('.control-group:visible').prev('.control-group:visible').find(':input:visible');
                        if ($nextFocus.length === 0) $nextFocus = $self.prev('.' + className).find(':input:visible');
                    } else {
                        $nextFocus = $target.nextAll(':input:visible').length ?
                            $target.nextAll(':input:visible').first() :
                            $target.closest('.control-group:visible').next('.control-group:visible').find(':input:visible');
                        if ($nextFocus.length === 0) $nextFocus = $self.next('.' + className).find(':input:visible');
                    }
                    if ($nextFocus.length) $nextFocus.first().focus();
                }, 0);
            },
            
            onKeyDown: function(e) {
                var $target = $(e.currentTarget);
                if (e.which == 9) {
                    this.loseFocus(e.shiftKey, $target);
                } else if (e.which === 13 && $target.is(':input') && $target.is(':not(textarea)')) {
                    this.commit();
                }
            },
            
            onAction: function(event) {
                var $currentTarget = $(event.currentTarget);
                $currentTarget.blur();
                var action = $currentTarget.data('action') || 'default';
                this.form.triggerMethod('before:action', action, event);
                this.triggerMethod('before:action', action, event);
                this.triggerMethod('action:' + action, event);
            },
            
            ensureDefaultValue: function() {
                if (!this.hasValue()) {
                    var defaultValue = this.getValue();
                    this.setValue(defaultValue, { silent: true });
                }
            },
            
            mutex: function(callback) {
                if (this.__mutex) return;
                this.__mutex = true;
                var ret = callback.call(this);
                delete this.__mutex;
                return ret;
            }
            
        }, protoDef), {
            
            preset: function(name, definition) {
                var register = _.isString(name);
                definition = _.extend({}, register ? definition : name);
                var controlClass = this.extend({ definition: definition });
                if (register) Marionette.Form.registerControl(name, controlClass);
                return controlClass;
            },
            
            define: function(name, protoDef, viewConstructor) {
                var args = _.toArray(arguments);
                var register = _.isString(name);
                if (register) args.unshift();
                var controlClass = extendView(this, args[0], args[1]);
                if (register) Marionette.Form.registerControl(name, controlClass);
                return controlClass;
            },
        
        });
    };
    
    Marionette.Form.extendView = extendView;
    
    Marionette.Form.registerControl = function(name, controlClass) {
        name = camelize(name) + 'Control';
        Marionette.Form[name] = controlClass;
    };
    
    var Control = Marionette.Form.Control = extendView(Marionette.ItemView, {
        
        template: Templates.Control
        
    });
    
    // Non-editable and utility controls
    
    var LogicControl = Marionette.Form.LogicControl = Control.extend({
        
        // Base class for controls without any display/view interaction.
        
        template: _.template(''),
        
        definition: { ignore: true, visible: false },
        
        observeKey: function(key, method) {
            method = method || this.onChange;
            if (key === '*') {
                this.listenTo(this.form.model, 'change', method);
            } else {
                this.listenTo(this.form.model, 'change:' + key, method);
            }
        },
        
        commit: function() {
            // Hook method
        }
        
    });
    
    var DefaultControl = Marionette.Form.DefaultControl = Control.extend({
        
        template: Templates.DefaultControl,
        
        definition: { ignore: true, omit: true, escape: true },
        
        ensureDefaultValue: function() {}
        
    });
    
    var ImmutableControl = Marionette.Form.ImmutableControl = Control.extend({
        
        definition: { ignore: true, omit: true, escape: true },
        
        ensureDefaultValue: function() {}
        
    });
    
    var StaticControl = Marionette.Form.StaticControl = ImmutableControl.extend({
        
        template: Templates.StaticControl,
        
        defaults: { label: '&nbsp;', text: '', escape: true }
        
    });
    
    var HtmlControl = Marionette.Form.HtmlControl = Control.extend({
        
        template: Templates.HtmlControl,
        
        defaults: { label: false, escape: false, html: '' },
        
        _serializeData: function(data) {
            data.html = _.template(data.html || '')(data);
            if (this.getAttribute('escape')) {
                data.html = _.escape(data.html);
            }
        }
        
    });
    
    var DynamicControl = Marionette.Form.DynamicControl = StaticControl.extend({
        
        _serializeData: function(data) {
            data.text = _.template(data.text || '')(data);
        }
        
    });
    
    var HelpControl = Marionette.Form.HelpControl = StaticControl.extend({
        
        template: Templates.HelpControl
        
    });
    
    var SpacerControl = Marionette.Form.SpacerControl = StaticControl.extend({
        
        template: Templates.SpacerControl,
        
        controlDefaults: { rule: false }
        
    });
    
    var RuleControl = Marionette.Form.RuleControl = StaticControl.extend({
        
        template: Templates.RuleControl
        
    });
    
    var BaseControl = Marionette.Form.BaseControl = Control.extend({
        
        template: Templates.BaseControl,
        
        defaults: { helpMessage: '' },
        
        ui: {
            control: ':input, [role="control"]',
            addon: '.input-group-addon',
            button: '.input-group-btn .btn'
        },
        
        controlTriggers:  {
            'change @ui.control': 'control:change',
            'click @ui.control': 'control:click',
            'click @ui.addon': 'addon:click',
            'click @ui.button': 'button:click'
        },
        
        childViewContainer: '[data-region="main"]',
        
        constructor: function(options) {
            Control.prototype.constructor.apply(this, arguments);
            this.on('after:render', this.updateView);
            this.on('control:change', this.handleChange);
        },
        
        commit: function() {}, // disabled
        
        updateView: function() {},
        
        handleChange: function() {},
        
        getViewClass: function() {
            var viewClass = this.getAttribute('view') || this.getOption('viewConstructor')  || this.getOption('childView');
            if (_.isString(viewClass)) viewClass = this.form.getRegisteredView(viewClass);
            return viewClass;
        },
        
        _renderTemplate: function() {
            var viewClass = this.getViewClass();
            if (viewClass) {
                var options = _.extend({}, _.result(this, 'viewOptions'), this.getAttribute('viewOptions'));
                this.view = new viewClass(options);
                this.triggerMethod('init:view', this.view);
                this.listenTo(this.view, 'all', function(eventName) {
                    var args = ['view:' + eventName].concat(_.rest(arguments));
                    this.triggerMethod.apply(this, args);
                });
                this.view.render();
                if (_.isString(this.childViewContainer)) {
                    Control.prototype._renderTemplate.apply(this, arguments);
                    this.$(this.childViewContainer).html(this.view.el);
                } else {
                    this.attachElContent(this.view.el);
                }
                return this;
            } else {
                return Control.prototype._renderTemplate.apply(this, arguments);
            }
        }
        
    });
    
    var ViewControl = Marionette.Form.ViewControl = BaseControl.extend({
        
        // Uses https://github.com/marionettejs/backbone.syphon
        // to enable two-way binding of inputs.
        
        updateView: function() {
            var data = this.serializeValue();
            Backbone.Syphon.deserialize(this, data);
        },
        
        handleChange: function() {
            var data = Backbone.Syphon.serialize(this);
            _.defaults(data, this.serializeValue());
            this.setValue(data);
        }
        
    });
    
    var RegionControl = Marionette.Form.RegionControl = extendView(Marionette.ItemView, {
        
        renderOnValueChange: false,
        
        template: false,
        
        commit: function() {}, // disabled
        
        getView: function() {
            return this.region.currentView;
        },
        
        showView: function(view, options) {
            return this.region.show(view, options);
        },
        
        getViewClass: function() {
            var viewClass = this.getAttribute('view') || this.getOption('viewConstructor')  || this.getOption('childView');
            if (_.isString(viewClass)) viewClass = this.form.getRegisteredView(viewClass);
            return viewClass;
        },
        
        renderView: function(showOptions) {
            if (!this.region) this.setupRegion();
            var currentView = this.getView();
            if (currentView) this.stopListening(currentView);
            
            var viewClass = this.getViewClass();
            if (!viewClass) return this.triggerMethod('invalid:view', viewClass);
            var options = _.extend({}, _.result(this, 'viewOptions'), this.getAttribute('viewOptions'));
            
            var view = new viewClass(options);
            view.parent = this;
            view.control = this;
            view.form = this.form;
            
            this.triggerMethod('init:view', view);
            this.listenTo(view, 'all', function(eventName) {
                var args = ['view:' + eventName].concat(_.rest(arguments));
                this.triggerMethod.apply(this, args);
            });
            
            return this.showView(view, showOptions);
        },
        
        setupRegion: function() {
            this.destroyRegion(); // always cleanup first
            
            var regionClass = this.getAttribute('regionClass') || 'default';
            if (_.isString(regionClass)) regionClass = resolveNameToClass(regionClass, 'Region');
            if (_.isObject(regionClass) && (regionClass === Marionette.Region || regionClass.prototype instanceof Marionette.Region)) {
                var childviewContainer = this.getOption('childviewContainer');
                var el = _.isString(childviewContainer) ? this.$(childviewContainer) : this.el;
                this.region = new regionClass(_.extend({}, this.getOption('regionOptions'), { el: el }));
            } else {
                throw new Error('Invalid Region');
            }
        },
        
        destroyRegion: function() {
            if (this.region) this.region.destroy();
        },
        
        _renderTemplate: function() {
            if (this.region) {
                return this;
            } else {
                return Marionette.ItemView.prototype._renderTemplate.apply(this, arguments);
            }
        }
        
    }, function(options) {
        this.on('after:render', this.renderView);
        this.on('destroy', this.destroyRegion);
        this.listenTo(this.model, 'change:view', this.renderView);
    });
    
    var LayoutControl = Marionette.Form.LayoutControl = extendView(Marionette.LayoutView, {
        
        template: Templates.LayoutControl,
        
        commit: function() {}, // disabled
        
        regions: function(options) {
            var defaultRegions = { main: '[data-region="main"]' };
            var regions = defaultRegions;
            if (options.model instanceof Backbone.Model) {
                var regions = options.model.get('regions');
                if (_.isArray(regions)) {
                    regions = _.reduce(regions, function(hash, regionName) {
                        hash[regionName] = '[data-region="' + regionName + '"]';
                        return hash;
                    }, {});
                }
                regions = _.extend({}, regions);
            } else if (_.isArray(options.regions)) {
                regions = _.reduce(options.regions, function(hash, regionName) {
                    hash[regionName] = '[data-region="' + regionName + '"]';
                    return hash;
                }, {});
            } else if (_.isObject(options.regions)) {
                regions = _.extend({}, options.regions);
            }
            return _.isEmpty(regions) ? defaultRegions : regions;
        },
        
        showView: function(regionName, view) {;
            this.model.set('views.' + regionName, view);
            return view;
        },
        
        renderViews: function() {
            var views = _.extend({}, this.getAttribute('views'));
            var mainView = this.getAttribute('view') || this.getOption('mainView');
            if (mainView) views.main = mainView;
            _.each(views, function(view, regionName) {
                var region = this.getRegion(regionName);
                if (!region) return; // undefined region - skip
                var view = this.createViewFor(regionName, view);
                if (view) region.show(view);
            }.bind(this));
            this.triggerMethod('render:views');
        },
        
        createViewFor: function(regionName, viewClass, options) {
            if (_.isString(viewClass)) viewClass = this.form.getRegisteredView(viewClass);
            if (viewClass && viewClass.prototype instanceof Backbone.View) {
                return this.buildViewFor(regionName, viewClass, options);
            }
        },
        
        buildViewFor: function(regionName, viewClass) {
            var isFormView = viewClass.prototype instanceof Marionette.Form.View;
            var options = _.extend({}, _.result(this, 'viewOptions'), this.getAttribute('viewOptions'), options);
            
            if (isFormView) {
                options.tagName = 'div';
                options.model = this.form.model;
                var rootKey = this.getAttribute('rootKey');
                if (!_.isEmpty(rootKey)) options.rootKey = rootKey;
            }
            
            var view = new viewClass(options);
            view.parent = this;
            view.control = this;
            view.form = this.form;
            
            var serializeData = view.serializeData;
            view.serializeData = function() {
                var data = serializeData.apply(this, arguments);
                data.control = this.control.serializeData();
                return data;
            };
            
            if (_.isFunction(this.initView)) this.initView(view);
            if (_.isFunction(view.initViewFor)) view.initViewFor(regionName);
            return view;
        }
        
    }, function(options) {
        this.listenTo(this.model, 'change:views', this.renderViews);
        this.listenTo(this.model, 'change:view', this.renderViews);
        this.on('render', this.renderViews);
    });
    
    var HeaderControl = Marionette.Form.HeaderControl = BaseControl.extend({
        
        template: Templates.HeaderControl,
        
        defaults: {
            collapse: false, collapsed: false, escape: true, level: 2,
            section: '*', smallLabel: '', helpMessage: ''
        },
        
        constructor: function(options) {
            BaseControl.prototype.constructor.apply(this, arguments);
            if (this.getAttribute('collapsed')) {
                this.once('render', function() {
                    _.defer(this.toggleSection.bind(this));
                });
            }
        },
        
        toggleSection: function(section) {
            section = section || this.getAttribute('section');
            if (!section) return;
            var collapsed = this.$el.hasClass('collapsed');
            this.$el.toggleClass('collapsed');
            this.form.toggleSection(section, !collapsed, this.el);
        },
        
        onActionCollapse: function(event, control) {
            this.toggleSection();
        }
        
    });
    
    var LookupControl = Marionette.Form.LookupControl = ImmutableControl.extend(_.extend({
        
        // Lookup display (label) values for reference/id value.
        
        template: Templates.Control,
        
        getTemplate: function() {
            if (this.hasAttribute('template')) return ImmutableControl.prototype.getTemplate.apply(this, arguments);
            if (this.form.getOption('layout') === 'table') return Templates.DefaultControl;
            return Templates.Control;
        },
        
        constructor: function(options) {
            ImmutableControl.prototype.constructor.apply(this, arguments);
            this.collection = this.collection || this.getCollection(options);
            this.listenTo(this.collection, 'reset change update', function() {
                _.defer(this.render.bind(this));
            });
            this.maxValues = this.getAttribute('maxValues') || this.getOption('maxValues') || 100;
            this.labelKey = this.getAttribute('labelKey') || this.getOption('labelKey') || 'label';
            this.valueKey = this.getAttribute('valueKey') || this.getOption('valueKey') || 'id';
        },
        
        ensureDefaultValue: function() {},
        
        _serializeData: function(data) {
            var maxValues = this.maxValues;
            var labelKey = this.labelKey;
            var valueKey = this.valueKey;
            var template = this.formatTemplate;
            var collection = this.collection;
            var value = this.form.getValueOf(this.getKey());
            var refs = data.references = [].concat(value || []);
            if (valueKey === 'id') {
                var values = _.map(refs, function(id) {
                    var item = collection.get(id);
                    if (item) return formatDataLabel(item.toJSON(), labelKey, template);
                });
            } else {
                var values = _.map(refs, function(id) {
                    var where = {};
                    where[valueKey] = id;
                    var item = collection.findWhere(where);
                    if (item) return formatDataLabel(item.toJSON(), labelKey, template);
                });
            }
            values = _.compact(values);
            if (values.length > maxValues) {
                values = values.slice(0, maxValues);
                values.push('&hellip;');
            }
            data.value = values;
        }
        
    }, CollectionMixin));
    
    // Text controls
    
    var InputControl = Marionette.Form.InputControl = Control.extend({
        
        // Mask syntax (see jquery.maskedinput):
        //
        // a - Represents an alpha character (A-Z,a-z)
        // 9 - Represents a numeric character (0-9)
        // * - Represents an alphanumeric character (A-Z,a-z,0-9)
        
        plugins: {
            mask: 'mask', numeric: 'autoNumeric',
            prefix: 'prefix', suffix: 'suffix'
        },
        
        template: Templates.InputControl,
        
        defaults: {
            type: 'text',
            label: '',
            maxlength: 512,
            extraClasses: [],
            helpMessage: null
        },
        
        ui: {
            control: 'input'
        },
        
        initialize: function() {
            Control.prototype.initialize.apply(this, arguments);
            this.on('jquery:plugins', this._finalizePlugins);
            this.on('destroy', this._detachPlugins);
            this.listenTo(this.model, 'change:prefix', this._setPrefix);
            this.listenTo(this.model, 'change:suffix', this._setSuffix);
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return Control.prototype.getValue.apply(this, arguments);
            } else if (this.getAttribute('numeric') && $.fn.autoNumeric) {
                if (this.ui.control.data('autoNumeric')) {
                    var value = parseFloat(this.ui.control.autoNumeric('get'));
                    return this.coerceValue(value);
                } else {
                    return this.coerceValue(0);
                }
            } else if (this.getAttribute('prefix') || this.getAttribute('suffix')) {
                var rawValue = Control.prototype.getValue.apply(this, arguments);
                if (!this.ui.control.affixValue) return rawValue;
                var plainValue = this.ui.control.affixValue();
                if (isBlank(plainValue) && !this.getAttribute('forceAffix')) return '';
                return this.coerceValue(this.getAttribute('affix') ? rawValue : plainValue);
            } else {
                return Control.prototype.getValue.apply(this, arguments);
            }
        },
        
        setPrefix: function(affix) {
            this.model.set('prefix', affix);
        },
        
        setSuffix: function(affix) {
            this.model.set('suffix', affix);
        },
        
        _finalizePlugins: function(plugins) {
            if (_.include(plugins, 'prefix') || _.include(plugins, 'suffix')) {
                if (this.ui.control.affixValue && !this.getAttribute('affix')) {
                    this.ui.control.affixValue(this.getValue(true));
                    this.setValue(this.getValue());
                }
            }
        },
        
        _setPrefix: function() {
            if (!this.ui.control.prefix) return;
            var affix = this.getAttribute('prefix');
            if (affix) this.ui.control.prefix(affix);
        },
        
        _setSuffix: function() {
            if (!this.ui.control.suffix) return;
            var affix = this.getAttribute('suffix');
            if (affix) this.ui.control.suffix(affix);
        },
        
        _detachPlugins: function() {
            if (this.ui.control.prefix) this.ui.control.prefix(true);
            if (this.ui.control.suffix) this.ui.control.suffix(true);
        }
        
    });
    
    var HiddenControl = Marionette.Form.HiddenControl = InputControl.extend({
        
        template: Templates.HiddenControl,
        
        defaults: {}
        
    });
    
    var TextareaControl = Marionette.Form.TextareaControl = Control.extend({
        
        template: Templates.TextareaControl,
        
        defaults: {
            label: '',
            rows: 5,
            maxlength: 0,
            extraClasses: [],
            helpMessage: null
        },
        
        ui: {
            control: 'textarea'
        },
        
        constructor: function() {
            Control.prototype.constructor.apply(this, arguments);
            this.on('label:click', function(event) {
                this.ui.control.focus();
            });
        }
        
    });
    
    // Base class for controls that render multiple values from a collection.
    
    var SelectionControl = Marionette.Form.SelectionControl = extendView(Marionette.CompositeView, _.extend({
        
        // List of options as [{label:<label>, value:<value>}, ...]
        
        formatter: JsonFormatter,
        
        buildChildView: function(model, ChildViewClass, childViewOptions) {
            var options = _.extend({ model: model, control: this }, childViewOptions);
            var childView = new ChildViewClass(options);
            this.initChildView(childView);
            return childView;
        },
        
        initChildView: function(view) {},
        
        getItemLabel: function(model) {
            if (_.isFunction(this.labelKey)) return this.labelKey(model);
            return formatDataLabel(model.toJSON(), this.labelKey, this.formatTemplate);
        },
        
        getItemValue: function(model) {
            if (_.isFunction(this.labelValue)) return this.labelValue(model);
            return model.get(this.valueKey);
        },
        
        isSelectedView: function(view) {
            var viewValue = view.getValue();
            var value = this.getValue(true);
            var values = [].concat(value);
            return _.include(values, viewValue);
        },
        
        getSelected: function() { // views
            return this.children.filter(function(child) {
                return child.isSelected();
            });
        },
        
        getSelection: function() { // models
            return _.map(this.getSelected(), function(child) {
                return child.model;
            });
        },
        
        getValues: function() { // all values
            return this.children.map(function(child) {
                return child.getValue();
            });
        },
        
        ensureValue: function() {
            var options = { viewCid: this.cid, silent: true };
            var values = this.getValues();
            var value = this.getValue(true);
            if (!_.include(values, value)) {
                this.setValue(this.getValue(), options);
            } else if (this.collection.isEmpty()) {
                this.setValue(this.getAttribute('value'), options);
            }
        },
        
        bindCollection: function(collection) {
            this.listenTo(collection, 'reset change update', function() {
                this.ensureValue();
                _.defer(this.render.bind(this));
            });
        },
        
        unbindCollection: function(collection) {
            this.stopListening(collection);
        },
        
        rebindCollection: function(options) {
            if (this.collection) this.unbindCollection(this.collection);
            this.collection = this.getCollection(options);
            this.bindCollection(this.collection);
            this.render();
            this.form.triggerChange();
        },
        
        // Core optimization
        
        attachElContent: function(html) {
            if (_.isString(html)) {
                this.el.innerHTML = html;
                return this;
            }
            
            this.$el.html(html);
            return this;
        }
        
    }, CollectionMixin), function(options) {
        this.labelKey = this.getAttribute('labelKey') || this.getOption('labelKey') || 'label';
        this.valueKey = this.getAttribute('valueKey') || this.getOption('valueKey') || 'id';
        
        this.collection = this.collection || this.getCollection(options);
        this.bindCollection(this.collection);
        
        var rebindCollection = this.rebindCollection.bind(this, options);
        this.listenTo(this.model, 'change:collection', rebindCollection);
        this.listenTo(this.model, 'change:options', rebindCollection);
        this.listenTo(this.model, 'change:url', rebindCollection);
        
        this.on('render:collection', this.ensureValue);
    });
    
    var ControlItem = Marionette.Form.ControlItem = Marionette.LayoutView.extend({
        
        template: _.template('<%- label %>'),
        
        ui: {
            control: 'input'
        },
        
        constructor: function(options) {
            options = options || {};
            if (options.control instanceof Backbone.View) {
                this.control = options.control;
            } else {
                throw new Error('Cannot create Option without Control View');
            }
            Marionette.LayoutView.prototype.constructor.call(this, _.omit(options, 'control'));
        },
        
        getLabel: function() {
            return this.control.getItemLabel(this.model);
        },
        
        getValue: function() {
            return this.control.getItemValue(this.model);
        },
        
        isSelected: function() {
            return this.control.isSelectedView(this);
        },
        
        setSelected: function(bool) {},
        
        serializeData: function() {
            var data = Marionette.ItemView.prototype.serializeData.apply(this, arguments);
            data.control = this.control.serializeData();
            data.label = this.getLabel();
            data.value = this.getValue();
            data = _.defaults(data, this.defaults);
            data.selected = this.isSelected(); // or checked
            data.disabled = evaluateCondition(this, data.disabled, data);
            data.readonly = evaluateCondition(this, data.readonly, data);
            
            if (_.isFunction(this._serializeData)) this._serializeData(data);
            
            this.triggerMethod('serialize:data', data);
            
            return data;
        }
        
    });
    
    var MultiControlItem = Marionette.Form.MultiControlItem = ControlItem.extend({
        
        // Baseclass for option and checkbox based views with multiple options
        
        template: Templates.MultiControlItem,
        
        tagName: 'label',
        
        className: function() {
            var type = this.control.getAttribute('type');
            return type + '-inline';
        },
        
        setSelected: function(bool) {
            this.ui.control.attr('checked', bool ? 'checked' : null);
        }
        
    });
    
    // Select and Multiple select
    
    var SelectControlItem = Marionette.Form.SelectControlItem = ControlItem.extend({
        
        template: Templates.SelectControlItem,
        
        tagName: 'option',
        
        attributes: function() {
            var data = this.serializeData();
            var attributes = {};
            attributes.value = data.value;
            if (data.selected) attributes.selected = 'selected';
            if (data.disabled) attributes.disabled = 'disabled';
            return attributes;
        },
        
        setSelected: function(bool) {
            this.$el.attr('selected', bool ? 'selected' : null);
        }
        
    });
    
    var SelectControl = Marionette.Form.SelectControl = SelectionControl.extend({
        
        // List of options as [{label:<label>, value:<value>}, ...]
        
        template: Templates.SelectControl,
        
        childView: SelectControlItem,
        
        childViewContainer: 'select',
        
        defaults: {
            label: '',
            multiple: false,
            helpMessage: null,
            extraClasses: []
        },
        
        ui: {
            control: 'select'
        },
        
        constructor: function(options) {
            SelectionControl.prototype.constructor.apply(this, arguments);
            this.listenTo(this.model, 'change:select2', this.render);
            this.listenTo(this.model, 'change:quickSelect', this.render);
            this.listenTo(this.collection, 'change:primary', this.render);
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return this.form.model.get(this.getKey());
            } else if (this.ui.control.is(':input')) {
                var value = this.ui.control.val();
                var coercedValue;
                if (_.isArray(value)) {
                    coercedValue = _.map(value, function(v) {
                        return this.coerceValue(v);
                    }.bind(this));
                } else {
                    coercedValue = this.coerceValue(value);
                }
                if (this.getAttribute('multiple')) {
                    return [].concat(coercedValue || []);
                } else if (_.isArray(coercedValue)) {
                    return _.first(coercedValue);
                } else {
                    return coercedValue;
                }
            }
        },
        
        onRenderControl: function() {
            var options;
            if (options = this.getPluginOptions('quickSelect')) {
                attachQuickSelect.call(this, options);
            } else if (options = this.getPluginOptions('select2')) {
                attachSelect2.call(this, options);
            }
        },
        
        getPluginOptions: function(type) {
            var options = this.getAttribute(type) || this.getOption(type);
             return _.isObject(options) ? options : ((options === true) ? {} : null);
        },
        
        showCollection: function() {
            if (!this.getAttribute('multiple') && this.isReadonly()) {
                var valueKey = this.valueKey;
                var value = this.getValue(true);
                var child = this.collection.find(function(model) {
                    return model.get(valueKey) === value;
                });
                if (child) {
                    var ChildView = this.getChildView(child);
                    this.addChild(child, ChildView);
                } else {
                    this.showEmptyView();
                }
            } else {
                SelectionControl.prototype.showCollection.apply(this, arguments);
            }
        }
        
    });
    
    var TagControl = Marionette.Form.TagControl = InputControl.extend(_.extend({
        
        defaults: {
            type: 'hidden',
            label: '',
            minlength: 2,
            maxlength: 4096,
            extraClasses: [],
            helpMessage: null
        },
        
        formatter: JsonFormatter,
        
        collectionConstructor: NestedCollection,
        
        constructor: function(options) {
            if (!$.fn.select2) throw new Error('Select2 is not available');
            InputControl.prototype.constructor.apply(this, arguments);
            this.labelKey = this.getAttribute('labelKey') || this.getOption('labelKey') || 'label';
            this.valueKey = this.getAttribute('valueKey') || this.getOption('valueKey') || 'id';
            this.collection = this.collection || this.getCollection(this.getCollectionData());
        },
        
        getCollectionData: function() {
            return this.getAttribute('collection') || this.getAttribute('options');
        },
        
        getTags: function() {
            return this.formatData(this.collection.models);
        },
        
        formatData: function(models) {
            var labelKey = this.labelKey;
            var valueKey = this.valueKey;
            var template = this.formatTemplate;
            return _.map(models, function(model) {
                var label = formatDataLabel(model.toJSON(), labelKey, template);
                return { id: model.get(valueKey), text: label };
            });
        },
        
        createItem: function(value) {
            var minlength = this.getAttribute('minlength') || 0;
            if (_.isEmpty(value) || value.length < minlength) return;
            return _.extend({ _created: true }, this.buildItem(value, 'text', 'id'));
        },
        
        onRenderControl: function() {
            var options = _.extend({}, this.getAttribute('select2') || this.getOption('select2'));
            options.multiple = this.getAttribute('multiple') !== false;
            options.tags = this.getTags.bind(this);
            options.createSearchChoice = this._createItem.bind(this);
            attachSelect2.call(this, options);
            this.ui.control.on('change', this._handleChange.bind(this));
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return this.form.model.get(this.getKey());
            } else {
                var values = this.ui.control.val();
                if (_.isEmpty(values)) return [];
                return _.map(values.split(','), this.coerceValue.bind(this));
            }
        },
        
        _createItem: function(value) {
            if (this.getAttribute('create')) return this.createItem(value);
        },
        
        _handleChange: function(event) {
            if (_.isObject(event.added) && event.added._created) {
                var item = {};
                item[this.valueKey] = event.added.id;
                item[this.labelKey] = event.added.text;
                this.collection.add(item, { viewCid: this.cid });
            }
        }
        
    }, CollectionMixin));
    
    var Select2Control = Marionette.Form.Select2Control = InputControl.extend(_.extend({
        
        defaults: {
            type: 'hidden',
            label: '',
            minlength: 2,
            maxlength: 1024,
            extraClasses: [],
            helpMessage: null
        },
        
        formatter: JsonFormatter,
        
        constructor: function(options) {
            if (!$.fn.select2) throw new Error('Select2 is not available');
            InputControl.prototype.constructor.apply(this, arguments);
            
            this.resultTemplate = this.getAttribute('resultTemplate') || this.getOption('resultTemplate');
            this.selectionTemplate = this.getAttribute('selectionTemplate') || this.getOption('selectionTemplate');
            
            this.labelKey = this.getAttribute('labelKey') || this.getOption('labelKey') || 'label';
            this.valueKey = this.getAttribute('valueKey') || this.getOption('valueKey') || 'id';
            this.matchKey = this.getAttribute('matchKey') || this.getOption('matchKey') || this.labelKey;
            this.matcher = this.getOption('matcher') || $.fn.select2.defaults.matcher;
            
            this.collection = this.collection || this.getCollection(this.getCollectionData());
            
            if (this.collection) {
                this.listenTo(this.collection, 'reset change update', function() {
                    _.defer(this.render.bind(this));
                });
            }
            
            this.on('before:render:select', this._setupSelect);
        },
        
        getCollectionData: function() {
            return this.getAttribute('collection') || this.getAttribute('options');
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return this.form.model.get(this.getKey());
            } else if (this.getAttribute('multiple')) {
                var values = this.ui.control.val();
                if (_.isEmpty(values)) return [];
                return _.map(values.split(','), this.coerceValue.bind(this));
            } else {
                return InputControl.prototype.getValue.apply(this, arguments);
            }
        },
        
        clearValue: function(options) {
            this.ui.control.select2('val', '');
        },
        
        onRenderControl: function() {
            var options = _.extend({}, this.getAttribute('select2') || this.getOption('select2'));
            attachSelect2.call(this, options);
        },
        
        getItemLabel: function(object) {
            if (_.isFunction(this.labelKey)) return this.labelKey(object);
            return formatDataLabel(object, this.labelKey, this.formatTemplate);
        },
        
        getItemValue: function(object) {
            if (_.isFunction(this.valueKey)) return this.valueKey(object);
            return object[this.valueKey];
        },
        
        getItemId: function(object) {
            return this.getItemValue(object);
        },
        
        formatResult: function(object, container, query) {
            if (this.resultTemplate) {
                var data = _.extend({}, object);
                data.label = this.getItemLabel(object);
                return Marionette.Renderer.render(this.resultTemplate, data);
            } else {
                return this.getItemLabel(object);
            }
        },
        
        formatSelection: function(object, container) {
            if (this.selectionTemplate) {
                var data = _.extend({}, object);
                data.label = this.getItemLabel(object);
                return Marionette.Renderer.render(this.selectionTemplate, data);
            } else {
                return this.getItemLabel(object);
            }
        },
        
        _setupSelect: function(options) {
            options.id = this.getItemId.bind(this);
            options.formatResult = this.formatResult.bind(this);
            options.formatSelection = this.formatSelection.bind(this);
            if (this.collection instanceof Backbone.Collection) {
                options.data = { results: this.collection.toJSON(), text: this.labelKey };
            }
        }
        
    }, CollectionMixin));
    
    var RemoteSelectControl = Marionette.Form.RemoteSelectControl = Select2Control.extend({
        
        constructor: function(options) {
            Select2Control.prototype.constructor.apply(this, arguments);
            this.url = this.getAttribute('url') || this.getOption('url');
            if (_.isEmpty(this.url)) throw new Error('No AJAX url specified');
        },
        
        getAjaxOptions: function(options) {
            var ajax = { dataType: 'json', quietMillis: 200 };
            ajax.cache = Boolean(this.getAttribute('cache'));
            ajax.url = _.result(this, 'url');
            ajax.data = this.getRequestData.bind(this);
            ajax.results = this.parseResponseData.bind(this);
            ajax.params = this.getRequestOptions.bind(this, options);
            _.defaults(ajax, _.result(this, 'ajax'));
            return ajax;
        },
        
        // Methods to implement/override
        
        initSelection: function(element, callback) {
            var id = this.getValue();
            var formatResponseData = this.formatResponseData.bind(this);
            $.getJSON(this.getItemUrl(id), function(result) {
                callback(formatResponseData(result));
            }.bind(this));
        },
        
        getItemUrl: function(id) {
            return _.result(this, 'url') + '/' + id;
        },
        
        getRequestOptions: function(options) {
            return {};
        },
        
        getRequestData: function(term, page) {
            return { q: term, page: page };
        },
        
        parseResponseData: function(data, page, query) {
            if (!_.isArray(data)) data = [];
            var results = [];
            var labelKey = this.labelKey;
            var valueKey = this.valueKey;
            var matcher = this.matcher.bind(this);
            var formatResponseData = this.formatResponseData.bind(this);
            _.each(data, function(item) {
                if (!matcher(query.term, item[labelKey] || '')) return;
                results.push(formatResponseData(item));
            });
            return { results: results, text: labelKey };
        },
        
        formatResponseData: function(item) {
            return { id: item[this.valueKey], text: item[this.labelKey] };
        },
        
        getItemLabel: function(object) {
            return object.text;
        },
        
        getItemValue: function(object) {
            return object.id;
        },
        
        _setupSelect: function(options) {
            options.formatResult = this.formatResult.bind(this);
            options.formatSelection = this.formatSelection.bind(this);
            options.initSelection = this.initSelection.bind(this);
            options.ajax = this.getAjaxOptions(options);
        }
        
    });
    
    var QuerySelectControl = Marionette.Form.QuerySelectControl = Select2Control.extend({
        
        // This is a base class, which implements a bare-bones collection filter;
        // The 'query' method should be implemented to return a $.Deferred.
        
        query: function(query) {
            if (this.collection instanceof Backbone.Collection) {
                var filtered = this.filterCollection(query);
                var results = this.formatData(filtered);
                return $.Deferred().resolve(results).promise();
            } else {
                return $.Deferred().resolve([]).promise();
            }
        },
        
        initSelection: function(element, callback) {
            if (this.collection instanceof Backbone.Collection) {
                var method = _.isFunction(this.collection.walk) ? 'walk' : 'each';
                var findWhere = function() {
                    var values = [].concat(this.getValue() || []);
                    var matches = [];
                    this.collection[method](function(item) {
                        if (_.include(values, item.get(this.valueKey))) {
                            matches.push(item);
                        }
                    }.bind(this));
                    if (this.getAttribute('multiple')) {
                        callback(this.formatData(matches));
                    } else {
                        callback(this.formatData(matches)[0]);
                    }
                };
                if (this.collection.length === 0) {
                    this.collection.once('sync', findWhere, this);
                } else {
                    findWhere.call(this);
                }
            } else {
                callback();
            }
        },
        
        matchModel: function(query, model) {
            var value = String(model.get(this.matchKey) || '');
            return this.matcher(query.term, value);
        },
        
        filterCollection: function(query) {
            return this.collection.filter(this.matchModel.bind(this, query));
        },
        
        formatData: function(models) {
            var formatLabel = this.formatDataLabel.bind(this);
            var formatValue = this.formatDataValue.bind(this);
            return _.map(models, function(model) {
                return { id: formatValue(model), text: formatLabel(model) };
            });
        },
        
        formatDataLabel: function(model) {
            return model.get(this.labelKey);
        },
        
        formatDataValue: function(model) {
            return model.get(this.valueKey);
        },
        
        getItemLabel: function(object) {
            return object.text;
        },
        
        getItemValue: function(object) {
            return object.id;
        },
        
        _setupSelect: function(options) {
            var self = this;
            options.formatResult = this.formatResult.bind(this);
            options.formatSelection = this.formatSelection.bind(this);
            options.initSelection = this.initSelection.bind(this);
            options.query = function(query) {
                var dfd = self.query(query);
                dfd.then(function(results) {
                    self.triggerMethod('query:success', results);
                    if (_.isArray(results)) {
                        query.callback({ results: results });
                    } else if (_.isObject(results)) {
                        query.callback(results);
                    } else {
                        query.callback({ results: [] });
                    }
                }, function(err) {
                    self.triggerMethod('query:error', err);
                });
            };
        }
        
    });
    
    // Integer
    
    var IntegerControl = Marionette.Form.IntegerControl = InputControl.extend({
        
        controlDefaults: {
            type: 'number',
            formatter: 'integer'
        }
        
    });
    
    // Checkbox (single)
    
    var BooleanControl = Marionette.Form.BooleanControl = InputControl.extend({
        
        template: Templates.BooleanControl,
        
        defaults: {
            type: 'checkbox',
            label: '',
            controlLabel: '&nbsp;',
            controlClassName: '',
            extraClasses: []
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return Boolean(this.form.model.get(this.getKey()));
            } else {
                return this.coerceValue(this.ui.control.is(':checked'));
            }
        }
        
    });
    
    var CheckboxControl = Marionette.Form.CheckboxControl = BooleanControl;
    
    // Checkbox and Radio
    
    var MultiOptionControl = Marionette.Form.MultiOptionControl = SelectionControl.extend({
        
        template: Templates.MultiControl,
        
        childView: MultiControlItem,
        
        childViewContainer: '.control-options',
        
        ui: {
            control: 'input' // important!
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return this.form.model.get(this.getKey());
            } else {
                return this.coerceValue(this.$('input:checked').val());
            }
        },
        
        commit: function() {
            this.setValue(this.getValue());
        },
        
        _serializeData: function(data) {
            var type = this.getAttribute('type');
            var controlsClassName = [].concat(data.controlsClassName || []);
            controlsClassName.push(type);
            data.controlsClassName = controlsClassName.join(' ');
        }
        
    });
    
    var RadioControl = Marionette.Form.RadioControl = MultiOptionControl.extend({
        
        defaults: {
            type: 'radio',
            label: '',
            extraClasses: [],
            helpMessage: null
        }
        
    });
    
    var MultiCheckboxControl = Marionette.Form.MultiCheckboxControl = MultiOptionControl.extend({
        
        defaults: {
            type: 'checkbox',
            label: '',
            extraClasses: [],
            helpMessage: null
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return this.form.model.get(this.getKey());
            } else {
                var self = this;
                var values = [];
                this.$('input:checked').each(function() {
                    values.push(self.coerceValue($(this).val()));
                });
                return values;
            }
        }
        
    });
    
    var ButtonControl = Marionette.Form.ButtonControl = Control.extend({
        
        template: Templates.ButtonControl,
        
        defaults: {
            type: 'button',
            action: 'submit',
            label: 'Submit',
            status: undefined, // error or success
            message: undefined,
            buttonType: 'default',
            extraClasses: []
        },
        
        ui: {
            button: 'button'
        },
        
        constructor: function() {
            Control.prototype.constructor.apply(this, arguments);
            this.on('render', this._update);
            this.listenTo(this.model, 'change:status', this._update);
            this.listenTo(this.model, 'change:message', this._update);
            if (this.getAttribute('autoDisable')) {
                this.listenTo(this.form, 'change validated', this._update);
            }
        },
        
        ensureDefaultValue: function() {},
        
        _update: function() {
            var successClass = this.getClassName('buttonStatusSuccess');
            var errorClass = this.getClassName('buttonStatusError');
            var status = this.evaluateAttribute('status');
            var $message = this.$('[role="message"]').addClass('status');
            $message.toggleClass(successClass, status === 'success');
            $message.toggleClass(errorClass, status === 'error');
            if (this.getAttribute('autoDisable')) {
                this.ui.button.prop('disabled', this.form.hasErrors());
            }
        }
        
    });
    
    // Array
    
    var EmptyListControl = Marionette.Form.EmptyListControl = StaticControl.extend({
        
        templateAttribute: 'emptyTemplate',
        
        template: Templates.EmptyListControl,
        
    });
    
    var ListControl = Marionette.Form.ListControl = extendView(Marionette.CompositeView, _.defaults({
        
        template: Templates.ListControl,
        
        formatter: JsonFormatter,
        
        collectionConstructor: NestedCollection,
        
        childViewContainer: '.nested-controls',
        
        childViewEventPrefix: 'item',
        
        emptyView: EmptyListControl,
        
        defaultControl: 'immutable',
        
        defaults: {
            label: '',
            itemLabel: '',
            itemKey: 'value',
            extraClasses: []
        },
        
        registerCollection: true,
        
        getCollectionData: function() {
            return this.getAttribute('collection') || formatName(this.getKey());
        },
        
        createCollection: function(items, options) {
            var collectionConstructor = this.getCollectionConstructor(options);
            items = this.buildItems(items);
            if (collectionConstructor && collectionConstructor.prototype instanceof Backbone.Collection) {
                return new collectionConstructor(items, options);
            } else if (_.isFunction(collectionConstructor)) {
                return collectionConstructor(items, options);
            } else {
                return new NestedCollection(items, options);
            }
        },
        
        getClassName: function(key) {
            return this.form.getClassName(this.model, key);
        },
        
        getChildView: function() {
            var itemOptions = _.extend({}, this.getAttribute('item'));
            var control = _.isString(itemOptions.control) ? itemOptions.control : null;
            control = control || this.model.get('itemControl') || this.getOption('defaultControl');
            return this.form.getControl(control);
        },
        
        buildChildView: function(model, ChildViewClass, childViewOptions) {
            var index = this.collection.indexOf(model);
            var config = this.getControlConfig();
            config.key = this.getItemKey(config, index);
            config.parentLabel = this.getLabel();
            config.label = this.getItemLabel();
            config.index = index;
            config.itemId = model.id;
            config.nested = true;
            _.extend(config, this.getAttribute('item'));
            var field = new Field(config);
            var options = _.extend({ model: field, form: this.form, parent: this }, childViewOptions);
            this.ensureValue(config.key, model);
            var childView = new ChildViewClass(options);
            childView.itemModel = model;
            this.initChildView(childView);
            return childView;
        },
        
        initChildView: function(view) {},
        
        getControlConfig: function() {
            return _.defaults({}, this.model.toJSON(), this.defaults);
        },
        
        getItemKey: function(config, index) {
            var itemKey = this.getAttribute('itemKey') || 'value';
            return config.key + '[' + keyToJSON(index) + ']' + itemKey;
        },
        
        getItemLabel: function(model) {
            return this.getAttribute('itemLabel');
        },
        
        getItemModel: function(childView) {
            return this.collection.get(childView.model.get('itemId'));
        },
        
        ensureValue: function(key, model) {
            var itemKey = this.getAttribute('itemKey') || 'value';
            var options = { viewCid: this.cid };
            var value = model.get(itemKey);
            if (_.isEmpty(this.getFormValue(key))) {
                this.setFormValue(key, value, options);
            }
        },
        
        commit: function() {}, // disabled
        
        updateValue: function() {
            var options = { viewCid: this.cid };
            this.setValue(this.collection.toJSON(), options);
        },
        
        getChildViewContainer: function(containerView, childView) {
            if (!!containerView.$childViewContainer) {
                return containerView.$childViewContainer;
            } else if (this.getAttribute('insertControls')) {
                var container = containerView.$el;
                return containerView.$childViewContainer = container;
            }
            return Marionette.CompositeView.prototype.getChildViewContainer.apply(this, arguments);
        },
        
        updateChildView: function(childView, data) {
            if (childView.itemModel && _.isObject(data)) childView.itemModel.set(data);
        },
        
        destroyChildView: function(childView) {
            if (childView.itemModel) this.collection.remove(childView.itemModel);
        },
        
        resetChildView: function(childView) {
            var model = childView.itemModel;
            if (model && this.collection.contains(model)) {
                var keys = _.keys(_.omit(model.attributes, model.idAttribute));
                var attrs = {};
                _.each(keys, function(key) { attrs[key] = void 0; });
                model.set(attrs, { unset: true });
            }
        },
        
        // child/item view actions
        
        onItemActionRemove: function(childView, event) {
            if (!_.isFunction(childView.onActionRemove)) {
                this.destroyChildView(childView);
            }
        },
        
        bindCollection: function(collection) {
            this.listenTo(collection, 'reset change update', function() {
                 this.updateValue();
                 _.defer(this.render.bind(this));
            });
            this.listenTo(collection, 'reorder', this.triggerMethod.bind(this, 'reorder'));
        },
        
        unbindCollection: function(collection) {
            this.stopListening(collection);
        },
        
        // Core optimization
        
        attachElContent: function(html) {
            if (_.isString(html)) {
                this.el.innerHTML = html;
                return this;
            }
            
            this.$el.html(html);
            return this;
        }
        
    }, CollectionMixin), function(options) {
        this.collection = this.collection || this.getCollection(options);
        this.bindCollection(this.collection);
    });
    
    // Collection control
    
    var CollectionControl = Marionette.Form.CollectionControl = ListControl.extend({
        
        defaultControl: 'nested',
        
        constructor: function(options) {
            ListControl.prototype.constructor.apply(this, arguments);
            this.observeKey(this.getKey(), this.onSourceChange);
        },
        
        getItemKey: function(config, index) {
            return config.key + '[' + keyToJSON(index) + ']';
        },
        
        ensureValue: function(key, model) {
            var options = { viewCid: this.cid };
            var value = this.getFormValue(key);
            if (!_.isObject(value) && this.collection.length > 0) {
                this.setFormValue(key, model.toJSON(), options);
            }
        },
        
        onSourceChange: function(model, items, options) {
            if (model.collection === this.collection) return;
            if (options.viewCid === this.cid) return;
            options.viewCid = options.viewCid || this.cid;
            this.collection.set(items, options);
        }
        
    });
    
    var ReferencesControl = Marionette.Form.ReferencesControl = ListControl.extend({
        
        defaultControl: 'nested',
        
        constructor: function(options) {
            ListControl.prototype.constructor.apply(this, arguments);
            
            var resolver = this.getAttribute('resolver') || this.getAttribute('collection');
            if (_.isString(resolver) && this.form.hasResolver(resolver)) {
                this.resolveReference = this.form.getResolver(resolver);
            } else if (_.isString(resolver) && this.form.hasCollection(resolver)) {
                this.resolver = this.form.getCollection(resolver);
            } else if (_.isString(resolver) && _.isFunction(this[resolver])) {
                this.resolveReference = this[resolver].bind(this);
            } else if (_.isString(resolver) && _.isFunction(this.form[resolver])) {
                this.resolveReference = this.form[resolver].bind(this.form);
            } else if (_.isFunction(resolver)) {
                this.resolveReference = resolver;
            }
            
            this.listenTo(this.collection, 'add', function(model, collection, options) {
                if (options && options.__internal) return;
                this.resolveModel(model);
            });
            
            var references = this.getValue(true);
            references = _.isArray(references) ? references : [];
            this.collection.set(this.buildReferences(references));
            this.observeKey(this.getKey(), this.onSourceChange);
        },
        
        getItemKey: function(config, index) {
            return config.key + '[' + keyToJSON(index) + ']';
        },
        
        getCollection: function(options) {
            return this.createCollection();
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return this.getFormValue(this.getKey());
            } else {
                return this.collection.pluck('id');
            }
        },
        
        ensureValue: function(key, model) {
            // disabled
        },
        
        updateValue: function() {
            var options = _.last(arguments) || {};
            if (options.__internal || options.viewCid === this.cid) return;
            var ids = this.collection.pluck('id');
            this.setValue(ids, options);
        },
        
        serializeItemValue: function(childView) {
            var model = this.getItemModel(childView);
            if (model) {
                var serializeMethods = [].concat(this.getAttribute('serialize') || []);
                var data = model.toJSON();
                this.triggerMethod('serializeItemValue', model, data);
                _.each(serializeMethods, function(method) {
                    if (_.isFunction(model[method])) {
                        data[method] = model[method]();
                    }
                });
                return data;
            } else {
                return {};
            }
        },
        
        addValue: function(ref) {
            return this.collection.add(this.buildReference(ref));
        },
        
        resolveReference: function(model, index) {
            // fallback implementation - needs override.
            var data = _.omit(model.toJSON(), '__resolving');
            return $.Deferred().resolve(data).promise();
        },
        
        resolvedReference: function(model) {
            if (!_.isObject(model)) return; // not a model or plain object
            var options = { __internal: true };
            var m = this.collection.get(model.id);
            var childView = this.children.find(function(v) {
                return v.itemModel && v.itemModel.id === model.id;
            });
            if (childView) childView.$el.hide();
            var index = this.collection.indexOf(m);
            if (index !== -1) this.collection.remove(m, options);
            if (model instanceof Backbone.Model) {
                model.unset('__resolving', { silent: true });
            }
            var model = this.collection.add(model, _.extend({ at: index }, options));
            if (childView) childView.itemModel = model;
            this.triggerMethod('resolve:done', model);
        },
        
        resolveCollection: function() {
            this.collection.each(this.resolveModel.bind(this));
        },
        
        resolveModelById: function(id) {
            return this.resolver.get(id, { deep: true });
        },
        
        resolveModel: function(model) {
            if (!model || !model.get('__resolving')) return;
            var resolved;
            if (this.resolver instanceof Backbone.Collection) {
                function resolveFn() {
                    resolved = this.resolveModelById(model.id);
                    if (resolved) {
                        this.resolvedReference(resolved);
                    } else {
                        this.triggerMethod('resolve:fail', model);
                    }
                };
                var resolve = resolveFn.bind(this);
                if (this.resolver.cache && _.isFunction(this.resolver.cache.done)) {
                    this.resolver.cache.done(function() { setTimeout(resolve, 0); });
                } else {
                    setTimeout(resolve, 0);
                }
            } else {
                var resolvedReference = this.resolvedReference.bind(this);
                $.when(this.resolveReference(model)).done(function(resolved) {
                    setTimeout(function() { resolvedReference(resolved); }, 0);
                }.bind(this)).fail(this.triggerMethod.bind(this, 'resolve:fail', model));
            }
        },
        
        onSourceChange: function(model, items, options) {
            if (options.viewCid === this.cid) return;
            var ids = this.collection.pluck('id');
            var added = _.difference(items, ids);
            var removed = _.difference(ids, items);
            if (_.isEmpty(added) && _.isEmpty(removed)) return;
            this.collection.remove(removed, options);
            var references = this.buildReferences(added);
            this.collection.set(references, _.extend(options, { remove: false }));
        },
        
        buildReferences: function(items) {
            return _.map(items, this.buildReference.bind(this));
        },
        
        buildReference: function(ref) {
            return { id: ref, __resolving: true };
        }
        
    });
    
    // Nested Form View
    
    var NestedControl = Marionette.Form.NestedControl = extendView(Marionette.CompositeView, {
        
        formatter: JsonFormatter,
        
        collectionConstructor: NestedCollection,
        
        defaultControl: 'immutable',
        
        childViewContainer: '.nested-controls',
        
        childViewEventPrefix: 'item',
        
        defaults: {
            label: '',
            extraClasses: []
        },
        
        commit: function() {}, // disabled
        
        getTemplate: function() {
            if (this.getAttribute('template') || this.getOption('template')) {
                return Marionette.CompositeView.prototype.getTemplate.apply(this, arguments);
            }
            return this.parent ? Templates.NestedControl : Templates.ListControl;
        },
        
        getChildViewContainer: function(containerView, childView) {
            if (!!containerView.$childViewContainer) {
                return containerView.$childViewContainer;
            } else if (this.getAttribute('insertControls')) {
                var container = containerView.$el;
                return containerView.$childViewContainer = container;
            }
            return Marionette.CompositeView.prototype.getChildViewContainer.apply(this, arguments);
        },
        
        getChildView: function(model) {
            var control = model.get('control') || this.getOption('defaultControl');
            return this.form.getControl(control);
        },
        
        buildChildView: function(model, ChildViewClass, childViewOptions) {
            var options = _.extend({ model: model, form: this.form, parent: this }, childViewOptions);
            options.keyPrefix = this.getKey() + '.';
            var childView = new ChildViewClass(options);
            this.initChildView(childView);
            return childView;
        },
        
        attachHtml: function(collectionView, childView, index) {
            if (this.getAttribute('insertControls') || this.getOption('insertControls')) {
                insertControls(collectionView, childView, index);
            } else {
                Marionette.CompositeView.prototype.attachHtml.apply(this, arguments);
            }
        },
        
        initChildView: function() {},
        
        observeKey: function() {},
        
        // Core optimization
        
        attachElContent: function(html) {
            if (_.isString(html)) {
                this.el.innerHTML = html;
                return this;
            }
            
            this.$el.html(html);
            return this;
        }
        
    }, function(options) {
        var fields = this.collection || this.getAttribute('fields');
        fields = fields || _.result(this, 'fields');
        if (!(fields instanceof Backbone.Collection)) {
            fields = new Fields(fields);
        }
        if (_.isArray(options.fields)) {
            fields.set(options.fields, { remove: false });
        }
        this.collection = fields;
    });
    
    var GroupControl = Marionette.Form.GroupControl = NestedControl.extend({
        
        // A group control unwraps nested items from their own layout.
        
        unwrap: true,
        
        defaults: {
            label: false,
            extraClasses: []
        },
        
        childViewOptions: {
            groupClassName: 'groupItem',
            unwrap: true
        }
        
    });
    
    // Date and Time
    
    var DateRangeControl = Marionette.Form.DateRangeControl = InputControl.extend({
        
        template: Templates.DateControl,
        
        defaults: {
            label: '',
            extraClasses: [],
            format: 'D MMMM, YYYY', // moment.js formatting
            helpMessage: null
        },
        
        ui: {
            picker: '.picker',
            button: '[data-target="picker"]'
        },
        
        formatter: DateFormatter,
        
        constructor: function(options) {
            if (!$.fn.daterangepicker) throw new Error('Bootstrap DateRange picker is not available');
            InputControl.prototype.constructor.apply(this, arguments);
            this.on('destroy', this.onDestroyControl);
        },
        
        isInvalidDate: function(date) {
            return false; // hook method
        },
        
        picker: function() {
            return this.ui.picker.data('daterangepicker');
        },
        
        getValue: function(fromModel) {
            var singleDatePicker = Boolean(this.getAttribute('single'));
            if (fromModel) {
                if (singleDatePicker) {
                    return this.coerceValue(this.getFormValue(this.getKey()));
                } else {
                    var start = this.coerceValue(this.getFormValue(this.getStartKey()));
                    var end = this.coerceValue(this.getFormValue(this.getEndKey()));
                    if (!start || !end) return [];
                    return [start, end];
                }
            } else if (singleDatePicker) {
                return this.getStartDate();
            } else {
                return [this.getStartDate(), this.getEndDate()];
            }
        },
        
        getStartDate: function() {
            var picker = this.picker();
            return picker && this.coerceValue(picker.startDate);
        },
        
        getEndDate: function() {
            var picker = this.picker();
            return picker && this.coerceValue(picker.endDate);
        },
        
        getStartKey: function() {
            return this.getAttribute('startKey') || (this.getKey() + 'Start');
        },
        
        getEndKey: function() {
            return this.getAttribute('endKey') || (this.getKey() + 'End');
        },
        
        getRanges: function() {
            var ranges = this.getAttribute('ranges') || _.result(this, 'ranges');
            if (ranges === true) {
                return {
                    'Today': [moment(), moment()],
                    'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Last 7 Days': [moment().subtract(6, 'days'), moment()],
                    'Last 30 Days': [moment().subtract(29, 'days'), moment()],
                    'This Month': [moment().startOf('month'), moment().endOf('month')],
                    'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                };
            } else if (_.isObject(ranges)) {
                return ranges;
            }
        },
        
        onRenderControl: function() {
            var self = this;
            this.onDestroyControl();
            var options = _.extend({}, this.getAttribute('picker') || this.getOption('picker'));
            options.timePicker = Boolean(this.getAttribute('time'));
            options.singleDatePicker = this.getAttribute('single');
            options.locale = _.extend({}, _.result(this, 'locale'), this.getAttribute('locale'));
            options.locale.format = options.locale.format || this.getAttribute('format');
            options.isInvalidDate = this.isInvalidDate.bind(this);
            options.ranges = this.getRanges();
            
            _.defaults(options, { timePicker24Hour: true, timePickerIncrement: 15 });
            
            var startDate, endDate;
            
            if (options.singleDatePicker) {
                startDate = this.getFormValue(this.getKey());
            } else {
                startDate = this.getFormValue(this.getStartKey());
                endDate = this.getFormValue(this.getEndKey());
            }
            
            if (startDate) options.startDate = this.coerceValue(startDate);
            if (endDate) options.endDate = this.coerceValue(endDate);
            
            this.triggerMethod('before:render:picker', options);
            
            this.ui.picker.daterangepicker(options, this._onPickerChange.bind(this));
            
            this.ui.button.on('click', function(ev) {
                ev.preventDefault();
                self.ui.picker.trigger('click');
            });
            
            var opts = { viewCid: this.cid };
            
            if (options.singleDatePicker) {
                if (_.isEmpty(startDate)) this.setValue(this.getStartDate(), opts);
            } else {
                if (_.isEmpty(startDate)) this.setFormValue(this.getStartKey(), this.getStartDate(), opts);
                if (_.isEmpty(endDate)) this.setFormValue(this.getEndKey(), this.getEndDate(), opts);
            }
            
            if (!this.isEditable()) this.picker().isShowing = true;
            
            this.triggerMethod('init:picker', this.picker());
            this.triggerMethod('render:picker', this.ui.picker);
        },
        
        onDestroyControl: function() {
            var picker = this.picker();
            if (picker) picker.remove();
        },
        
        _onPickerChange: function(start, end, label) {
            var options = { viewCid: this.cid };
            if (Boolean(this.getAttribute('single'))) {
                this.setValue(this.formatter.toRaw(start, this.form.model), options);
            } else {
                this.setFormValue(this.getStartKey(), this.formatter.toRaw(start, this.form.model), options);
                this.setFormValue(this.getEndKey(), this.formatter.toRaw(end, this.form.model), options);
            }
            this.triggerMethod('picker:change', start, end, label);
        }
        
    });
    
    var DateControl = Marionette.Form.DateControl = DateRangeControl.extend({
        
        defaults: {
            label: '',
            extraClasses: [],
            single: true,
            format: 'D MMMM, YYYY',
            helpMessage: null
        },
        
    });
    
    var DateTimeControl = Marionette.Form.DateTimeControl = DateRangeControl.extend({
        
        defaults: {
            label: '',
            extraClasses: [],
            single: true,
            time: true,
            format: 'lll',
            helpMessage: null
        },
        
    });
    
    // Files and Images
    
    var FileControl = Marionette.Form.FileControl = InputControl.extend({
        
        // Encode as base64 by default
        
        template: Templates.FileControl,
        
        defaults: {
            label: '',
            accept: '',
            base64: true,
            multiple: false,
            extraClasses: [],
            helpMessage: null
        },
        
        commit: function() {
            var file = this.getValue();
            var isFile = file instanceof File;
            if (isFile && this.getAttribute('base64')) {
                var reader = new FileReader();
                reader.onloadend = function() {
                    this.setValue(reader.result);
                }.bind(this);
                reader.readAsDataURL(file);
            } else if (isFile) {
                this.setValue(file);
            } else {
                this.setValue(null);
            }
        },
        
        getValue: function(fromModel) {
            if (fromModel) {
                return this.getFormValue(this.getKey());
            } else if (this.ui.control && this.ui.control.is(':file')) {
                return this.ui.control[0].files[0];
            }
        },
        
        onRenderControl: function() {
            if (!$.fn.filestyle) return;
            var options = _.extend({}, this.getAttribute('filestyle'));
            options.disabled = Boolean(this.getAttribute('disabled'));
            this.ui.control.filestyle(options);
        }
        
    });
    
    var ImageControl = Marionette.Form.ImageControl = Control.extend({
        
        template: Templates.ImageControl,
        
        defaults: {
            label: '',
            style: 'rounded',
            fallback: TransparantPixel,
            extraClasses: [],
            caption: null
        },
        
        _serializeData: function(data) {
            var fallback = false;
            if (!(_.isString(data.value)
                && (data.value.match(/^data:image\//) || data.value.match(/^http(s)?:\/\//)))) {
                data.value = this.getAttribute('fallback') || TransparantPixel;
                fallback = true;
            } else if (_.isString(data.value) && data.value.match(/~(\d+)\/$/)) {
                data.value = data.value + 'nth/0/'; // Uploadcare FileGroup url
            }
            var urlSuffix = this.getAttribute('urlSuffix');
            if (!fallback && urlSuffix) data.value = joinUrl(data.value, urlSuffix) + '/';
        }
        
    });
    
    // Main Form View
    
    Marionette.Form.View = Marionette.CompositeView.extend({
        
        tagName: 'form',
        
        template: _.template(''),
        
        defaultControl: 'immutable',
        
        childViewEventPrefix: 'control',
        
        modelConstructor: Marionette.Form.Model,
        
        enforceDefinitions: true,
        
        overlayView: Marionette.Form.OverlayView,
        
        constructor: function(options) {
            options = _.extend({}, options);
            var opts = _.omit(options, 'fields', 'parent', 'errors', 'classes', 'collections', 'formDelegate');
            
            var defaultClasses = _.extend({}, Marionette.Form.classes);
            
            if (options.layout === 'vertical' || this.getOption('layout') === 'vertical') {
                _.extend(defaultClasses, verticalFormClasses);
            }
            
            if (_.isObject(options.formDelegate)) this.formDelegate = options.formDelegate;
            
            this.classes = _.extend({}, defaultClasses, _.result(this, 'classes'), options.classes);
            
            if (options.parent instanceof Backbone.View) this.parent = options.parent;
            
            this.collections = options.collections || {};
            this.viewRegistry = options.viewRegistry || {}; // lookup for views
            this.registry = options.registry || {}; // lookup for controls
            this.helpers = options.helpers || {};
            this.resolvers = options.resolvers || {};
            
            Marionette.CompositeView.prototype.constructor.call(this, opts);
            
            var rootKey = this.getOption('rootKey');
            
            var fields = this.collection || options.fields || _.result(this, 'fields');
            var isProxy = _.isObject(fields) && _.isObject(fields._superset);
            if (!(fields instanceof Backbone.Collection) && !isProxy) {
                fields = new Fields(fields);
            }
            if (_.isArray(options.fields)) {
                fields.set(options.fields, { remove: false });
            }
            
            this.collection = fields;
            
            if (this.model instanceof Backbone.Model) {
                this.modelConstructor = this.model.constructor;
            }
            
            if (!(this.model instanceof Backbone.Model)) {
                this.model = new this.modelConstructor();
            } else if (!_.isEmpty(rootKey)) {
                var source = this.model;
                var data = source.get(rootKey);
                this.model = new this.modelConstructor(data);
                
                this.model.listenTo(source, 'change:' + rootKey, function(model, data, options) {
                    if (options && options.source === this) return;
                    options = _.extend({}, options);
                    options.source = options.source || this;
                    this.set(data, options);
                });
                
                source.listenTo(this.model, 'change', function(model, options) {
                    if (options && options.source === this) return;
                    options = _.extend({}, options);
                    options.source = options.source || this;
                    this.set(rootKey, model.toJSON(), options);
                });
            }
            
            this.bindValidation(this.model);
            
            this.listenTo(this.model, 'change', this.triggerMethod.bind(this, 'change'));
            this.listenTo(this.model, 'validated', this.onModelValidated);
            this.listenTo(this.model, 'invalid', this.onModelInvalid);
            
            this.listenTo(this.model, 'request', this.triggerMethod.bind(this, 'request'));
            this.listenTo(this.model, 'sync', this.triggerMethod.bind(this, 'sync'));
            this.listenTo(this.model, 'error', this.triggerMethod.bind(this, 'error'));
            
            this.on('destroy', this.destroyOverlay);
            
            if (this.getOption('autoValidate')) this.on('change', this.isValid);
            
            var submitFn = this.triggerMethod.bind(this, 'submit');
            this.on('control:action:submit', submitFn);
            
            this.on('control:focus', function(control) {
                this.lastActiveControl = control;
            });
            
            this.errors = options.errors || _.result(this, 'errors');
            this.errors = this.errors || new Backbone.NestedModel();
            
            this.listenTo(this.errors, 'change', this.onErrorsChange);
            
            this.triggerMethod('initialize', options);
            
            this.observeWindowResize();
        },
        
        id: function() {
            return _.uniqueId('form-');
        },
        
        getId: function() {
            return this.$el.attr('id') || _.result(this, 'id');
        },
        
        className: function() {
            var className = this.getClassName(null, 'form');
            if (this.isReadonly()) className += ' readonly';
            if (this.isDisabled()) className += ' disabled';
            var formClassName = _.result(this, 'formClassName') || this.getOption('formClassName');
            return _.isEmpty(formClassName) ? className : (className + ' ' + formClassName);
        },
        
        observeWindowResize: function() {
            var onResize = _.debounce(this.updateLayout.bind(this), 50);
            if (this.parent && _.isFunction(this.parent.observeWindowResize)) {
                this.on('resize', onResize);
            } else {
                var eventName = 'resize.form-' + this.cid;
                $(window).on(eventName, this.triggerMethod.bind(this, 'resize'));
                function updateLayout() { _.defer(this.updateLayout.bind(this), arguments[0]); };
                this.on('resize', onResize);
                this.on('destroy', function() { $(window).off(eventName); });
                this.on('control:render', updateLayout);
            }
        },
        
        updateLayout: function() {
            var elem = arguments[0] instanceof Backbone.View ? arguments[0] : this;
            elem.$('.form-control.immutable').each(function() {
                var $el = $(this);
                if ($el.parent().is('.input-group')) {
                    var containerWidth = $el.closest('.col-controls').width();
                    var width = 0;
                    $el.siblings('.input-group-addon, .input-group-btn').each(function() {
                        width += $(this).outerWidth();
                    });
                    $el.css('maxWidth', (containerWidth - width) + 'px');
                }
            });
        },
        
        setReadonly: function(bool) {
            var isReadonly = this.isReadonly();
            this.options.readonly = Boolean(bool || arguments.length === 0);
            if (this.options.readonly !== isReadonly) this.children.invoke('render');
        },
        
        isReadonly: function(key) {
            return Boolean(this.getOption('readonly'));
        },
        
        setDisabled: function(bool) {
            var isDisabled = this.isDisabled();
            this.options.disabled = Boolean(bool || arguments.length === 0);
            if (this.options.disabled !== isDisabled) this.children.invoke('render');
        },
        
        isDisabled: function(key) {
            return Boolean(this.getOption('disabled'));
        },
        
        hasValue: function(key) {
            if (!_.isString(key)) return false;
            if (key === '*') return true;
            return this.model.has(key);
        },
        
        getValueOf: function(key) {
            if (!_.isString(key)) return;
            if (key === '*') return this.model.toJSON();
            return this.model.get(key);
        },
        
        getValuesOf: function(keys) {
            return _.reduce(keys, function(hash, key) {
                hash[key] = this.getValueOf(key);
                return hash;
            }.bind(this), {});
        },
        
        setValueOf: function(key, value, options) {
            if (key === '*') {
                if (_.isObject(value)) this.model.set(value, options);
            } else {
                this.model.set(key, value, options);
            }
        },
        
        unsetValueOf: function(key, options) {
            this.model.unset(key, options);
        },
        
        hasChanged: function(key) {
            var changed = this.model.changedAttributes();
            return _.isObject(changed) && _.has(changed, key);
        },
        
        evaluateAttributeOf: function(id, attr, data) {
            var field = this.getField(id);
            return field && field.evaluateAttribute(attr, data);
        },
        
        field: function(id, config, options) {
            var field = this.buildField(id, config);
            return this.collection.add(field, options);
        },
        
        buildField: function(id, config) {
            return new Field(_.extend({ id: id }, config));
        },
        
        getField: function(id, autoCreate) {
            var def = this.getFieldModel(id);
            var field = def && this.children.findByModel(def);
            if (field) {
                return field;
            } else if (def && autoCreate === true) {
                return this.createChildView(def);
            } else if (_.isObject(autoCreate)) {
                def = this.field(id, autoCreate);
                return this.createChildView(def);
            }
        },
        
        getFieldModel: function(id) {
            return this.collection.get(id);
        },
        
        getFieldLabel: function(id, options) {
            return; // Hook method for i18n of labels
        },
        
        getFieldByKey: function(key) {
            return this.children.find(function(field) {
                return field.getKey() === key;
            });
        },
        
        getKeys: function() {
            var keys = this.children.map(function(field) {
                return field.getKey();
            });
            return _.compact(_.uniq(keys));
        },
        
        getControl: function(name) {
            var controlClass = this.registry[name] || this.callDelegate('getControl', name);
            if (controlClass) return controlClass;
            return resolveNameToClass(name, 'Control');
        },
        
        getFormatter: function(formatter, options) {
            if (_.isString(formatter)) formatter = resolveNameToClass(formatter, 'Formatter');
            if (formatter && !_.isFunction(formatter.fromRaw) && !_.isFunction(formatter.toRaw)) {
                return new formatter(options);
            } else {
                return formatter || new ControlFormatter(options);
            }
        },
        
        getClassName: function(field, key) {
            return this.classes[key] || '';
        },
        
        getChildView: function(field) {
            var control = field.get('control') || this.getOption('defaultControl');
            return this.getControl(control);
        },
        
        createChildView: function(field, options) {
            if (!(field instanceof Backbone.Model)) {
                field = new NestedModel(_.isObject(field) ? field : {});
            }
            var ChildView = this.getChildView(field);
            var childViewOptions = this.getOption('childViewOptions');
            return this.buildChildView(field, ChildView, _.extend({}, childViewOptions, options));
        },
        
        buildChildView: function(model, ChildViewClass, childViewOptions) {
            var options = _.extend({ model: model, form: this }, childViewOptions);
            var childView = new ChildViewClass(options);
            this.triggerMethod('control:build', childView);
            this.initChildView(childView);
            return childView;
        },
        
        initChildView: function() {},
        
        reset: function(data) {
            data = _.extend({}, data);
            this.model.clear({ reset: true });
            this.triggerMethod('reset', data);
            this.model.set(data);
        },
        
        serializeData: function() {
            var data = Marionette.CompositeView.prototype.serializeData.apply(this);
            var serialized = {};
            serialized.id = _.result(this, 'id') || this.cid;
            serialized.layout = this.getOption('layout');
            serialized.data = data;
            return serialized;
        },
        
        getData: function(asModel, options) {
            if (_.isObject(asModel)) options = asModel, asModel = false;
            options = options || {};
            asModel = asModel || options.asModel;
            var copy = new this.modelConstructor();
            var hasGetDataFn = _.isFunction(this.model.getData);
            if (hasGetDataFn) {
                copy.set(this.model.getData(options), options);
            } else {
                copy.set(this.model.toJSON(options), options);
            }
            this.children.each(function(field) {
                if (field.evaluateAttribute('ignore')) return; // skip
                var key = field.getKey();
                if (key && copy.has(key) && field.evaluateAttribute('omit')) {
                    copy.unset(key);
                } else if (!hasGetDataFn && key && copy.has(key)) {
                    copy.set(key, field.getData());
                }
            });
            return asModel ? copy : copy.toJSON(options);
        },
        
        setData: function(data, options) {
            this.model.set(data, options);
        },
        
        getUrl: function() {
            if (this.model.isNew()) return _.result(this.model, 'url');
            return _.result(this.model, 'url') + '/' + this.model.id;
        },
        
        triggerChange: function(key, value, options) {
            if (key) {
                this.model.trigger('change:' + key, this.model, value, options || {});
            } else {
                this.model.trigger('change', this.model, options || {});
            }
        },
        
        callDelegate: function(methodName) {
            var method = this.formDelegate && this.formDelegate[methodName];
            if (_.isFunction(method)) return method.apply(this.formDelegate, _.rest(arguments));
        },
        
        // Views
        
        registerView: function(name, viewClass) {
            this.viewRegistry[name] = viewClass;
        },
        
        getRegisteredView: function(name) {
            var View = this.callDelegate('getRegisteredView', name);
            return View || this.viewRegistry[name] || resolveNameToClass(name, 'View');
        },
        
        // Controls
        
        registerControl: function(name, controlClass) {
            this.registry[name] = controlClass;
        },
        
        // Collections
        
        getCollectionConstructor: function(childView) {
            // Hook method - only calls delegate
            return this.callDelegate('getCollectionConstructor', childView);
        },
        
        getCollection: function(name) {
            var collection = this.callDelegate('getCollection', name);
            collection = collection || this.collections[name] || __collections[name];
            if (!collection) {
                throw new Error('Invalid collection: ' + name);
            }
            return collection;
        },
        
        hasCollection: function(name) {
            if (this.callDelegate('hasCollection', name)) return true;
            return _.has(this.collections, name) || _.has(__collections, name);
        },
        
        registerCollection: function(name, collection, global) {
            var collections = global ? __collections : this.collections;
            if (collection instanceof Backbone.Collection) {
                collections[name] = collection;
            } else if (_.isArray(collection)) {
                collections[name] = new NestedCollection(collection);
            } else if (collection === true) {
                collections[name] = this.bindCollection(name);
            } else if (_.isString(collection)) { // url
                var collectionConstructor = this.getOption('collectionConstructor');
                if (!_.isFunction(collectionConstructor)) collectionConstructor = NestedCollection;
                var Collection = collectionConstructor.extend({ url: collection });
                collections[name] = new Collection();
                collections[name].fetch();
            } else {
                collections[name] = new NestedCollection();
            }
            return collections[name];
        },
        
        unregisterCollection: function(name, global) {
            var collections = global ? __collections : this.collections;
            delete collections[name];
        },
        
        bindCollection: function(key, options) {
            var collection = this.callDelegate('bindCollection', key, options);
            if (collection) return collection;
            options = _.extend({}, options);
            var formatter = this.getFormatter(options.formatter, options);
            
            var collectionConstructor = options.collection || this.getOption('collectionConstructor');
            if (!_.isFunction(collectionConstructor)) collectionConstructor = NestedCollection;
            if (_.isString(options.url)) {
                collectionConstructor = collectionConstructor.extend({ url: options.url });
            }
            
            if (!this.model.has(key)) {
                this.model.set(key, []);
            } else if (!_.isArray(this.model.get(key))) {
                throw new Error('Cannot bind to key: ' + key);
            }
            
            collection = new collectionConstructor(this.model.get(key));
            collection.listenTo(this.model, 'change:' + key, function(model, values, options) {
                if (options.bound) return; // self-inflicted change - skip
                options.bound = true;
                this.set(formatter.fromRaw(values, collection), options);
            });
            this.listenTo(collection, 'reset change update', function() {
                var options = _.last(arguments) || {};
                if (options.bound) return; // self-inflicted change - skip
                options.bound = true;
                var items = collection.toJSON();
                this.model.set(key, formatter.toRaw(items, collection), options);
            });
            if (_.isString(options.as)) this.registerCollection(options.as, collection, options.global);
            return collection;
        },
        
        // Resolvers
        
        getResolver: function(name) {
            var resolver = this.callDelegate('getResolver', name);
            resolver = resolver || this.resolvers[name] || __resolvers[name];
            if (!resolver) {
                throw new Error('Invalid resolver: ' + name);
            }
            return _.isFunction(resolver) ? resolver.bind(this) : resolver;
        },
        
        hasResolver: function(name) {
            if (this.callDelegate('hasResolver', name)) return true;
            return _.has(this.resolvers, name) || _.has(__resolvers, name);
        },
        
        registerResolver: function(name, resolver, global) {
            var resolvers = global ? __resolvers : this.resolvers;
            if (_.isFunction(resolver) || resolver instanceof Backbone.Collection) {
                resolvers[name] = resolver;
            }
            return resolvers[name];
        },
        
        unregisterResolver: function(name, global) {
            var resolvers = global ? __resolvers : this.resolvers;
            delete resolvers[name];
        },
        
        // Template helpers
        
        registerHelper: function(name, fn) {
            this.helpers[name] = fn;
        },
        
        mixinTemplateHelpers: function(data) {
            data = Marionette.CompositeView.prototype.mixinTemplateHelpers.apply(this, arguments);
            return _.defaults(data, this.helpers);
        },
        
        // Validation
        
        bindValidation: function(model) {
            var form = this;
            if (_.isFunction(model.validation)) {
                var validation = model.validation;
                model.validation = function() {
                    var rules = validation.apply(this, arguments);
                    if (_.isObject(rules)) rules = _.pick(rules, form.getKeys());
                    return rules;
                };
            } else if (_.isObject(model.validation)) {
                var rules = _.extend({}, model.validation);
                model.validation = function() {
                    return _.pick(rules, form.getKeys());
                };
            }
        },
        
        validate: function(key, options) {
            // Hook method - use set/addError
            return true;
        },
        
        isValid: function(options) {
            var isValid = this._validate(null, _.extend({}, options));
            isValid = isValid && this.model.isValid(true);
            if (isValid) this.resetErrors();
            return isValid;
        },
        
        validateValueOf: function(key, options) {
            var isValid = this._validate(key, _.extend({}, options));
            if (isValid && _.isFunction(this.model.preValidate)) {
                var errors = this.model.preValidate(key, this.getValueOf(key));
                isValid = _.isEmpty(errors);
            } else if (isValid) {
                var allValid = this.model.isValid({ silent: true });
                if (!allValid && _.isObject(this.model.validationError)) {
                    isValid = _.isEmpty(this.model.validationError[key]); // return errors, if any
                } else {
                    isValid = true;
                }
            }
            if (isValid) this.unsetError(key);
            return isValid;
        },
        
        onModelValidated: function(isValid, model, errors) {
            if (isValid) this.resetErrors();
        },
        
        onModelInvalid: function(model, errors, options) {
            options = options || {};
            if (options.silent) return;
            var errors = options.validationError || this.model.validationError;
            if (_.isObject(errors)) {
                this.setErrors(errors);
            } else {
                this.resetErrors();
            }
        },
        
        onErrorsChange: function() {
            var errors = this.errors.toJSON();
            var isValid = _.isEmpty(errors);
            this.triggerMethod('validated', isValid, errors);
            this.triggerMethod('validated:' + (isValid ? 'valid' : 'invalid'), errors);
        },
        
        _validate: function(key, options) {
            this.triggerMethod('validate', key, options);
            if (options.validateRequired || this.getOption('validateRequired')) {
                var setError = this.setError.bind(this);
                var unsetError = this.unsetError.bind(this);
                var failed = 0;
                _.each(this.getRequiredFields(), function(field) {
                    var fieldKey = field.getKey();
                    if (key && fieldKey !== key) return; // skip
                    if (field.isBlank()) {
                        setError(fieldKey, 'can\'t be blank', 'presence');
                        failed++;
                    } else {
                        unsetError(fieldKey, 'presence');
                    }
                });
                if (failed > 0) return false;
            }
            if (key && this.hasError(key)) return false;
            return this.validate(key, options);
        },
        
        // Error getters/setters
        
        getRequiredFields: function() {
            return this.children.filter(function(field) {
                return field.isRequired();
            }.bind(this));
        },
        
        getErrorFields: function() {
            return this.children.filter(function(field) {
                return this.hasError(field.getKey());
            }.bind(this));
        },
        
        hasErrors: function(key) {
            if (key) return this.hasError(key);
            return !_.isEmpty(this.getErrors());
        },
        
        getErrors: function(key) {
            if (!key) return this.errors.toJSON();
            return this.errors.get(key) || [];
        },
        
        setErrors: function(key, errors) {
            var self = this;
            if (_.isString(key) && _.isObject(errors)) {
                this.errors.set(key, errors);
                var rootKey = key.split(/(\.|\[)/)[0];
                if (_.isEmpty(this.errors.get(rootKey))) this.errors.unset(rootKey);
            } else if (_.isString(key)) {
                var rootKey = key.split(/(\.|\[)/)[0];
                if (this.errors.has(rootKey)) this.errors.unset(key);
                if (_.isEmpty(this.errors.get(rootKey))) this.errors.unset(rootKey);
            } else if (_.isObject(key)) { 
                this.errors.clear({ reset: true });
                this.errors.set(normalizeErrors(key, errors === true));
            }
        },
        
        hasError: function(key) {
            return this.errors.has(key);
        },
        
        getError: function(key) {
            return _.first(this.errors.get(key) || []);
        },
        
        setError: function(key, message, code) {
            var error = normalizeError(message, code);
            this.errors.set(key, [error]);
        },
        
        unsetError: function(key, code) {
            if (key && _.isString(code)) {
                var rootKey = key.split(/(\.|\[)/)[0];
                var errors = this.getErrors(key);
                this.errors.set(key, _.reject(errors, function(err) {
                    return err.code === code;
                }));
                if (_.isEmpty(this.errors.get(rootKey))) this.errors.unset(rootKey);
            } else if (key) {
                this.resetErrors(key);
            }
        },
        
        addError: function(key, message, code) {
            if (!this.errors.has(key)) this.errors.set(key, [], { silent: true });
            this.errors.add(key, { message: message, code: code || 'invalid' });
        },
        
        resetErrors: function(key) {
            if (arguments.length > 0) {
                this.setErrors(key);
            } else {
                this.errors.clear({ reset: true });
            }
        },
        
        // Interaction
        
        setFocus: function(id) {
            if (arguments.length === 0) {
                var field = this.children.findByIndex(0);
            } else {
                var field = this.getField(id);
            }
            if (field) field.setFocus();
        },
        
        commit: function() {
            this.children.invoke('commit', true);
            return this.isValid();
        },
        
        toggleSection: function(section, collapse, omitElem) {
            var toggleSectionEl = this.toggleSectionEl.bind(this);
            var sel = section === '*' ? '> *' : '[data-section="' + section + '"]';
            this.$(sel).not(omitElem).each(function() {
                var elem = $(this);
                if (elem.is('.control-header')) return; // skip
                toggleSectionEl(elem, collapse);
            });
        },
        
        toggleSectionEl: function(elem, collapse) {
            collapse ? elem.hide() : elem.show();
        },
        
        // Overlay
        
        showOverlay: function(view, options) {
            view = view || this.getOption('overlayView');
            if (!this.overlay) this.setupOverlay();
            if (this.overlay && view instanceof Backbone.View) {
                return $.when(this.overlay.show(view, options));
            } else if (this.overlay) {
                var View = _.isString(view) ? this.getRegisteredView(view) : view;
                if (_.isObject(view) && view.prototype instanceof Backbone.View) {
                    var view = new View({ model: this.model, form: this });
                    return $.when(this.overlay.show(view, options));
                }
            }
            return $.Deferred().reject().promise();
        },
        
        hideOverlay: function(options) {
            if (this.overlay && this.overlay.hasView()) {
                return $.when(this.overlay.empty(options)).then(function() {
                    this.triggerMethod('hide:overlay', this.overlay);
                }.bind(this));
            } else {
                return $.Deferred().reject().promise();
            }
        },
        
        toggleOverlay: function(view, options) {
            if (this.overlay && this.overlay.hasView()) {
                return this.hideOverlay(options);
            } else {
                return this.showOverlay(view, options);
            }
        },
        
        onShowOverlay: function(overlay) {
            overlay.$el.removeClass('hidden');
        },
        
        onHideOverlay: function(overlay) {
            overlay.$el.addClass('hidden');
        },
        
        setupOverlay: function() {
            this.destroyOverlay(); // always cleanup first
            
            var regionClass = this.getOption('regionClass') || 'default';
            if (_.isString(regionClass)) regionClass = resolveNameToClass(regionClass, 'Region');
            if (_.isObject(regionClass) && (regionClass === Marionette.Region || regionClass.prototype instanceof Marionette.Region)) {
                var overlayId = _.result(this, 'id') + '-overlay';
                var $overlay = this.$('#' + overlayId);
                if ($overlay.length === 0) {
                    $overlay = $('<div id="' + overlayId + '" class="form-overlay"></div>');
                    $overlay.appendTo(this.el);
                }
                this.overlay = new regionClass(_.extend({}, this.getOption('regionOptions'), { el: $overlay }));
                this.listenTo(this.overlay, 'all', function(eventName) {
                    var args = [eventName + ':overlay', this.overlay].concat(_.rest(arguments));
                    this.triggerMethod.apply(this, args);
                });
            } else {
                throw new Error('Invalid Region');
            }
        },
        
        destroyOverlay: function() {
            if (this.overlay) {
                this.stopListening(this.overlay);
                this.overlay.destroy();
                this.overlay = null;
            }
        },
        
        // Rendering
        
        render: function() {
            var options = _.last(arguments) || {};
            if (options.rendering === false || this.getOption('rendering') === false) {
                this.triggerMethod('refresh');
                return this;
            }
            return Marionette.CompositeView.prototype.render.apply(this, arguments);
        },
        
        formatLabel: function(label) {
            label = String(label).replace(/\./g, ' ').replace(/([A-Z])/g, ' $1');
            label = label.replace(/^./, function(label) { return label.toUpperCase(); });
            return label;
        },
        
        attachHtml: function(collectionView, childView, index) {
            if (childView.hasAttribute('el')) {
                // already attached, skip
            } else if (this.getOption('insertControls')) {
                insertControls(collectionView, childView, index);
            } else if (this.getOption('replaceControls')) {
                replaceControls(collectionView, childView, index);
            } else {
                Marionette.CompositeView.prototype.attachHtml.apply(this, arguments);
            }
        }
        
    }, {
        
        // Needs Backbone.BootstrapModal
        
        showInModal: function(options, modalOptions) {
            var dfd = $.Deferred();
            options = _.extend({}, options);
            if (options.model instanceof Backbone.Model) {
                var model = options.model;
                options.model = model.clone();
            } else {
                var model = new Marionette.Form.Model();
            }
            var form = new this(options);
            var dialog = new Backbone.BootstrapModal(_.extend({
                content: form, enterTriggersOk: true,
                focusOk: false, animate: true
            }, modalOptions));
            dialog.on('all', function(eventName) {
                form.triggerMethod('modal:' + eventName, _.rest(arguments));
            });
            dialog.on('shown', function() {
                form.$(':input:enabled:visible').filter(function() {
                    return !$(this).prop('readonly');
                }).first().focus();
            });
            dialog.on('cancel', dfd.reject.bind(dfd, form));
            dialog.open(function() {
                if (form.commit()) {
                    model.set(form.getData());
                    dfd.resolve(form, model);
                } else {
                    dialog.preventClose();
                }
            });
            return dfd.promise();
        }
        
    });
    
    // LayoutView
    
    var LayoutView = Marionette.Form.LayoutView = Marionette.LayoutView.extend({
        
        constructor: function() {
            Marionette.LayoutView.prototype.constructor.apply(this, arguments);
            this.on('render', this._setupRegions);
            this.on('add:region', this._listenToRegion);
            this.on('remove:region', this._stopListeningToRegion);
        },
        
        getCurrentView: function(regionName) {
            var region = this.getRegion(regionName || 'main');
            return region.hasView() && region.currentView;
        },
        
        _setupRegions: function() {
            var regions = _.result(this, 'regionNames');
            var defaults = { regionClass: this.getOption('regionClass') };
            var instances = _.map(regions, function(name) {
                var el = this.$('[data-region="' + name + '"]');
                var region = this.addRegion(name, _.extend({}, defaults, { el: el }));
                this.triggerMethod('setup:' + name + ':region', region);
                return region;
            }.bind(this));
            this.triggerMethod('setup:regions', instances);
        },
        
        _listenToRegion: function(name, region) {
            var observe = this.getOption('observeRegions');
            if (!observe || (_.isArray(observe) && !_.include(observe, name))) return;
            this.listenTo(region, 'show', function(view) {
                region.stopListening(view);
                region.listenTo(view, 'all', function(eventName) {
                    var args = [eventName].concat(_.rest(arguments));
                    region.triggerMethod.apply(region, args);
                });
            });
            this.listenTo(region, 'empty', function(view) {
                region.stopListening(view);
            });
        },
        
        _stopListeningToRegion: function(name, region) {
            this.stopListening(region);
        }
        
    });
    
    // CollectionView
    
    var ItemView = Marionette.Form.ItemView = Marionette.Form.View.extend({
        
    });
    
    var CollectionView = Marionette.Form.CollectionView = Marionette.CompositeView.extend({
        
        layout: 'vertical',
        
        className: 'form-collection',
        
        template: _.template(''),
        
        childView: ItemView,
        
        childViewEventPrefix: 'row',
        
        constructor: function(options) {
            options = _.extend({}, options);
            Marionette.CompositeView.prototype.constructor.call(this, _.omit(options, 'itemView', 'fields'));
            
            this.collections = {}; // registry
            
            this.model = this.model || new NestedModel(_.extend({}, _.result(this, 'defaults')));
            
            if (_.isObject(options.itemView) || _.isFunction(options.itemView) || _.isString(options.itemView)) {
                this.itemView = options.itemView;
            }
            
            var fields = options.fields || _.result(this, 'fields');
            if (!(fields instanceof Backbone.Collection)) {
                fields = new Fields(fields);
            }
            if (_.isArray(options.fields)) {
                fields.set(options.fields, { remove: false });
            }
            
            this.fields = fields;
            this.listenTo(this.fields, 'reset change update', this.triggerMethod.bind(this, 'fields:change'));
            
            this.observeWindowResize();
        },
        
        getData: function(asCollection) {
            var collection = new NestedCollection();
            this.children.each(function(row) {
                collection.add(row.getData(true));
            }.bind(this));
            return asCollection ? collection : collection.toJSON();
        },
        
        getChildView: function(row) {
            var baseClass = Marionette.CompositeView.prototype.getChildView.apply(this, arguments);
            if (_.isString(this.itemView)) {
                return Marionette.Form.getForm(this.itemView) || baseClass;  // lookup by name
            } else if (_.isFunction(this.itemView) && this.itemView.prototype instanceof Marionette.Form.View) {
                return this.itemView;                             // constructor
            } else if (_.isFunction(this.itemView)) {
                return this.itemView.call(this, baseClass, row);  // factory
            } else if (_.isObject(this.itemView)) {
                return baseClass.extend(this.itemView);
            } else {
                return baseClass;
            }
        },
        
        buildChildView: function(model, ChildViewClass, childViewOptions) {
            childViewOptions = _.extend({}, childViewOptions, _.result(this, 'formOptions'));
            var options = _.extend({ model: model, collection: this.fields }, childViewOptions);
            options.layout = options.layout || this.getOption('layout') || 'vertical';
            options.defaultControl = options.defaultControl || this.getOption('defaultControl');
            options.formDelegate = this;
            options.parent = this;
            var childView = new ChildViewClass(options);
            this.initChildView(childView);
            return childView;
        },
        
        initChildView: function() {},
        
        observeWindowResize: function() {
            var eventName = 'resize.form-' + this.cid;
            $(window).on(eventName, this.triggerMethod.bind(this, 'resize'));
            this.on('destroy', function() { $(window).off(eventName); });
        },
        
        // Fields
        
        field: function(id, config, options) {
            var field = this.buildField(id, config);
            return this.fields.add(field, options);
        },
        
        buildField: function(id, config) {
            return new Field(_.extend({ id: id }, config));
        },
        
        // Collections
        
        getCollection: function(name) {
            return this.collections[name] || __collections[name];
        },
        
        hasCollection: function(name) {
            return _.has(this.collections, name) || _.has(__collections, name);
        },
        
        registerCollection: function(name, collection, global) {
            var collections = global ? __collections : this.collections;
            if (collection instanceof Backbone.Collection) {
                collections[name] = collection;
            } else if (_.isArray(collection)) {
                collections[name] = new NestedCollection(collection);
            } else if (collection === true) {
                throw new Error('Cannot register collection with option: true');
            } else if (_.isString(collection)) { // url
                var collectionConstructor = this.getOption('collectionConstructor');
                if (!_.isFunction(collectionConstructor)) collectionConstructor = NestedCollection;
                var Collection = collectionConstructor.extend({ url: collection });
                collections[name] = new Collection();
                collections[name].fetch();
            } else {
                collections[name] = new NestedCollection();
            }
            return collections[name];
        },
        
        unregisterCollection: function(name, global) {
            var collections = global ? __collections : this.collections;
            delete collections[name];
        },
        
        // Delegate methods
        
        getControlIdPrefix: function(control) {
            return control.form.cid + '-';
        },
        
        // Defer rendering
        
        _renderChildren: function() {
            _.defer(Marionette.CompositeView.prototype._renderChildren.bind(this));
        },
        
        // Core optimization
        
        attachElContent: function(html) {
            if (_.isString(html)) {
                this.el.innerHTML = html;
                return this;
            }
            
            this.$el.html(html);
            return this;
        }
        
    });
    
    return Marionette.Form;
    
    function insertControls(collectionView, childView, index) {
        var section = childView.model.get('section') || 'default';
        var controlId = formatName(childView.model.id);
        var container = collectionView.$('[data-control="' + controlId + '"]');
        if (section && !container.is('*')) {
            container = collectionView.$('[data-block="' + section + '"]');
        } else {
            container.empty();
        }
        container.append(childView.el);
    };
    
    function replaceControls(collectionView, childView, index) {
        var controlId = formatName(childView.model.id);
        var elem = collectionView.$('[data-control="' + controlId + '"]');
        if (elem.is('*')) {
            childView.$el.attr('data-control', controlId);
            elem.replaceWith(childView.el);
        }
    };
    
    function attachSelect2(options) {
        if (!$.fn.select2) return console.warn('Select2 is not available');
        _.defaults(options, _.result(this, 'select2'));
        _.defaults(options, this.getAttributes('placeholder', 'multiple'));
        options.maximumSelectionSize = this.maximumSelectionSize || function() {
            var limit = this.getAttribute('limit');
            if (_.isNumber(limit)) return limit;
            return 0; // no limit
        }.bind(this);
        if (this instanceof SelectionControl) delete options.multiple;
        var escapeMarkup = this.getAttribute('escapeMarkup') || this.getAttribute('escape');
        if (this.resultTemplate || this.selectionTemplate || escapeMarkup === true) {
            options.escapeMarkup = function (m) { return m; };
        }
        this.triggerMethod('before:render:select', options);
        this.ui.control.select2(options);
        this.ui.control.select2('enable', !this.isDisabled());
        this.ui.control.select2('readonly', this.isReadonly());
        this.triggerMethod('render:select', this.ui.control);
        this.once('before:destroy', function() {
            this.ui.control.select2('destroy');
        });
    };
    
    function attachQuickSelect(options) {
        if (!$.fn.quickselect) return console.warn('QuickSelect is not available');
        var defaults = {
            selectDefaultText: this.getAttribute('placeholder'),
            activeButtonClass: 'btn-primary active',
            buttonClass: 'btn btn-default',
            wrapperClass: 'btn-group'
        };
        _.defaults(options, _.result(this, 'quickSelect'), defaults);
        if (_.isEmpty(options.selectDefaultText)) delete options.selectDefaultText;
        
        var primaryValues = [].concat(_.result(this, 'primaryValues') || []);
        primaryValues = primaryValues.concat(this.getOption('primaryValues') || []);
        primaryValues = primaryValues.concat(this.getAttribute('primaryValues') || []);
        primaryValues = _.uniq(primaryValues);
        
        if (_.isEmpty(primaryValues)) {
            this.collection.each(function(model) {
                if (!model.get('primary')) return;
                primaryValues.push(model.get(this.valueKey));
            }.bind(this))
        }
        
        options.breakOutValues = _.uniq(primaryValues);
        
        this.triggerMethod('before:render:select', options);
        this.ui.control.quickselect(options);
        this.triggerMethod('render:select', this.ui.control);
    };
    
    function normalizeError(message, code) {
        if (_.isObject(message)) {
            return _.defaults(message, { code: 'invalid' });
        } else {
            return { message: message, code: code || 'invalid' };
        }
    };
    
    function normalizeErrors(errors, loopback) {
        var errs = {};
        if (_.isObject(errors) && loopback) {
            _.each(errors.codes, function(codes, key) {
                errs[key] = errs[key] || [];
                _.each(codes, function(code, idx) {
                    var err = { code: code };
                    if (errors.messages && _.has(errors.messages, key)
                        && errors.messages[key][idx]) {
                        err.message = errors.messages[key][idx];
                    }
                    errs[key].push(err);
                });
            });
        } else if (_.isObject(errors)) {
            _.each(errors, function(error, key) {
                errs[key] = errs[key] || [];
                _.each([].concat(error || []), function(err) {
                    errs[key].push(normalizeError(err));
                });
            });
        }
        return errs;
    };
    
    function keyToJSON(key) {
        return JSON.stringify(key);
    };
    
    // Utils
    
    function formatName(str) {
        return (str || '').replace(/_/g, '-')
            .replace(/ /g, '-')
            .replace(/:/g, '-')
            .replace(/\\/g, '-')
            .replace(/\//g, '-')
            .replace(/\./g, '-')
            .replace(/[^a-zA-Z0-9\-]+/g, '')
            .replace(/-{2,}/g, '-')
            .toLowerCase();
    };
    
    function evaluateCondition(context, condition, data) {
        var negate = false;
        if (_.isString(condition) && condition.indexOf('!') === 0) {
            condition = condition.slice(1);
            negate = true;
        }
        var bool = false;
        if (_.isBoolean(condition)) {
            bool = condition;
        } else if (_.isString(condition)
            && _.isFunction(context[condition])) {
            bool = !!context[condition](data);
        } else if (_.isString(condition) && context.form
            && _.isFunction(context.form[condition])) {
            bool = !!context.form[condition](data, context);
        } else if (_.isString(condition) && context.form) {
            bool = !!context.form.getValueOf(condition);
        } else if (_.isFunction(condition)) {
            bool = !!condition(data, context);
        } else {
            bool = false;
        }
        return negate ? !bool : bool;
    };
    
    function pickAttributes(model, attrs) {
        var attributes = {};
        _.each(_.flatten(_.rest(arguments)), function(attr) {
            if (!model.has(attr)) return;
            attributes[attr] = model.get(attr);
        });
        return attributes;
    };
    
    function formatDataLabel(data, labelKey, template) {
        data = _.isObject(data) ? data : {};
        if (_.isFunction(template)) {
            return template(data);
        } else {
            var key = labelKey || _.keys(data)[0];
            var keys = [].concat(key || []);
            var values = _.values(_.pick(data, keys));
            return _.compact(values).join(' ');
        }
    };
    
    function camelize(str) {
        return _.map(String(str).split('-'), function(e) {
            return e.slice(0, 1).toUpperCase() + e.slice(1);
        }).join('');
    };
    
    function resolveNameToClass(name, suffix) {
        if (_.isString(name)) {
            var key = camelize(name) + suffix;
            var klass = Marionette.Form[key];
            if (_.isUndefined(klass)) {
                throw new ReferenceError('Class "' + key + '" not found');
            }
            return klass;
        }
        return name;
    };
    
    function isBlank(obj) {
        if (_.isNumber(obj)) return false;
        return _.isNull(obj) || _.isUndefined(obj) || _.isEmpty(obj) ||
            (_.isString(obj) && /^[\s\t\r\n]*$/.test(obj));
    };
    
    function truncate(text, max) {
        var head, tail;
        if (_.isString(text) && text.length > max) {
            head = Math.ceil((max - 3) / 2);
            tail = Math.floor((max - 3) / 2);
            return text.slice(0, head) + '...' + text.slice(-tail);
        } else {
            return text;
        }
    };
    
    function joinUrl(url) {
        var segments = _.compact(_.flatten(arguments));
        return _.map(segments, function(segment, index) {
            segment = String(segment);
            if (index > 0 && segment.indexOf('/') === 0) segment = segment.slice(1);
            if (segment.lastIndexOf('/') === segment.length -1) segment = segment.slice(0, -1);
            return segment;
        }).join('/');
    };
    
});