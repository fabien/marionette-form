define([
    'jquery',
    'underscore',
    'backbone',
    'backbone.marionette',
    'marionette.form',
    'backbone.bootstrap-modal'
], function($, _, Backbone, Marionette, Form, Behave) {
    
    // A modal view can implement the following interface methods to comply with ModalViewMixin:
    // 
    // - getData() - to retrieve the view's data
    // - setData() - to set the view's data
    // - commit()  - to validate and set data before getData() is called (optional)
    //               unless commit returns `true`, the dialog will not close on 'OK'
    
    var ModalViewMixin = Form.ModalViewMixin = {
        
        modalView: Form.DebugView,
        
        getModalViewContstructor: function(viewClass) {
            viewClass = viewClass || this.getAttribute('modalView') || this.getAttribute('modal');
            viewClass = viewClass || this.getOption('modalView');
            if (_.isString(viewClass)) viewClass = this.form.getRegisteredView(viewClass);
            viewClass = _.isFunction(viewClass) ? viewClass : Form.DebugView;
            return viewClass;
        },
        
        getModalViewData: function() {
            if (this.itemModel instanceof Backbone.Model) {
                return this.itemModel.toJSON();
            } else {
                return this.getValue(true);
            }
        },
        
        createModalView: function(viewClass, options) {
            viewClass = this.getModalViewContstructor(viewClass);
            options = _.extend({}, _.result(this, 'modalViewOptions'), this.getAttribute('modalViewOptions'), options);
            this.triggerMethod('modal:view:options', options, viewClass);
            var view = new viewClass(options);
            this.triggerMethod('modal:view', view, options);
            return view;
        },
        
        openModalWithView: function(view, modalOptions, callback) {
            if (_.isFunction(modalOptions)) callback = modalOptions, modalOptions = {};
            modalOptions = _.extend({}, _.result(this, 'modalOptions'), this.getAttribute('modalOptions'), modalOptions);
            callback = callback || _.noop;
            var dfd = $.Deferred();
            var dialog = new Backbone.BootstrapModal(_.extend({
                id: 'dialog-' + this.getId(),
                content: view, enterTriggersOk: true,
                focusOk: false, animate: true
            }, modalOptions));
            dialog.on('all', function(eventName) {
                var args = _.rest(arguments);
                this.triggerMethod.apply(this, ['modal:' + eventName, dialog, view].concat(args));
                view.triggerMethod.apply(view, ['modal:' + eventName, dialog, this].concat(args));
            }.bind(this));
            dialog.on('shown', function() {
                view.$(':input:enabled:visible:first').focus();
            });
            dialog.once('close', function(action) {
                if (action === 'cancel') {
                    dfd.reject(view);
                } else {
                    dfd.resolve(view);
                }
            }.bind(this));
            if (_.isFunction(view.setData)) view.setData(this.getModalViewData());
            this.triggerMethod('modal:init', dialog, view, modalOptions);
            view.triggerMethod('modal:init', dialog, this, modalOptions);
            if (_.isObject(view.deferred) && _.isFunction(view.deferred.promise)) {
                this.triggerMethod('modal:load:start', dialog, view);
                view.deferred.always(function() {
                    this.triggerMethod('modal:load:stop', dialog, view);
                }.bind(this));
                view.deferred.done(function() {
                    dialog.open(callback.bind(null, dialog));
                }.bind(this));
                view.deferred.fail(dfd.reject.bind(dfd, view));
            } else {
                dialog.open(callback.bind(null, dialog));
            }
            return dfd.promise();
        }
        
    };
    
    Form.ConfirmRemoveView = Marionette.ItemView.extend({
        
        template: _.template('Are you sure you want to delete this item?')
        
    });
    
    Form.Templates.ModalControl = _.template([
        '<% var isResolving = (obj.value && obj.value.__resolving) %>',
        '<% if (!nested) { %><label class="<%= labelClassName %>"><%= label %></label><% } %>',
        '<div class="<%= controlsClassName + (isResolving ? " loading" : "") %>">',
        '  <% if (editable || removable || sortable) { %>',
        '    <div class="input-group">',
        '      <span role="control" class="<%= controlClassName %> immutable">',
        '        <%= isResolving ? "loading..." : synopsis %>',
        '      </span>',
        '      <% if (sortable) { %><div class="input-group-addon drag-handle"><span class="glyphicon glyphicon-menu-hamburger" aria-hidden="true"></span></div><% } %>',
        '      <% if (editable || removable) { %>',
        '      <div class="input-group-btn" role="group">',
        '        <% if (editable) { %><button type="button" data-action="edit" class="btn btn-default" <%= isResolving ? "disabled" : "" %>><span class="<%= editIcon %>" aria-hidden="true"></span></button><% } %>',
        '        <% if (removable) { %><button type="button" data-action="remove" class="btn btn-default" <%= isResolving ? "disabled" : "" %>><span class="<%= removeIcon %>" aria-hidden="true"></span></button><% } %>',
        '      </div>',
        '      <% } %>',
        '    </div>',
        '  <% } else { %>',
        '    <span role="control" class="<%= controlClassName %> immutable">',
        '      <%= isResolving ? "loading..." : synopsis %>',
        '    </span>',
        '  <% } %>',
        '</div>'
    ].join('\n'));
    
    Form.ModalControl = Form.BaseControl.extend(_.defaults({
        
        template: Form.Templates.ModalControl,
        
        controlDefaults: {
            editable: true, removable: false, sortable: false, confirm: true,
            editIcon: 'glyphicon glyphicon-edit', synopsisLength: 1,
            removeIcon: 'glyphicon glyphicon-remove'
        },
        
        constructor: function(options) {
            Form.BaseControl.prototype.constructor.apply(this, arguments);
            this.synopsisKey = this.getAttribute('synopsisKey') || this.getOption('synopsisKey');
            var synopsis = this.getAttribute('synopsis') || this.getOption('synopsis');
            if (synopsis) this.getSynopsis = this.lookupTemplate(synopsis);
            this.on('serialize:data', this.serializeSynopsis);
        },
        
        serializeSynopsis: function(data) {
            if (_.isFunction(this.getSynopsis)) {
                data.synopsis = this.getSynopsis(data);
            } else {
                var value = this.getModalViewData();
                if (_.isObject(value)) {
                    var synopsisLength = this.getAttribute('synopsisLength') || 1;
                    var key = this.synopsisKey || _.keys(value).slice(0, synopsisLength);
                    var keys = [].concat(key || []);
                    var values = _.values(_.pick(value, keys));
                    data.synopsis = _.compact(values).join(' - ');
                } else {
                    data.synopsis = this.formatter.fromRaw(value);
                }
            }
            if (data.synopsis && data.synopsis.length > 128) {
                data.synopsis = data.synopsis.slice(0, 128);
            }
        },
        
        forceValue: function(data) {
            if (this.getAttribute('overwrite')) this.resetValue();
            if (this.parent && _.isFunction(this.parent.updateChildView)) {
                this.parent.updateChildView(this, data);
            } else {
                Form.BaseControl.prototype.forceValue.call(this, data);
            }
        },
        
        resetValue: function() {
            if (this.parent && _.isFunction(this.parent.resetChildView)) {
                this.parent.resetChildView(this);
            } else {
                Form.BaseControl.prototype.resetValue.call(this);
            }
        },
        
        unsetValue: function() {
            if (this.parent && _.isFunction(this.parent.destroyChildView)) {
                this.parent.destroyChildView(this);
            } else {
                this.form.unsetValueOf(this.getKey());
                this.form.collection.remove(this.model);
            }
        },
        
        // Modal integration
        
        modalViewOptions: function() {
            return {};
        },
        
        modalOptions: function() {
            var options = { title: this.getModalTitle() };
            return options;
        },
        
        getModalTitle: function() {
            if (this.parent) {
                var index = this.getAttribute('index') + 1;
                return this.parent.getLabel() + ' : ' + index;
            } else {
                return this.getLabel();
            }
        },
        
        updateValueFromModalView: function(dialog, view) {
            if (_.isFunction(view.commit) && _.isFunction(view.getData)) {
                if (view.commit()) {
                    this.forceValue(view.getData(), { action: 'edit' });
                } else {
                    dialog.preventClose();
                }
            } else if (_.isFunction(view.getData)) {
                this.forceValue(view.getData(), { action: 'edit' });
            }
        },
        
        // Action handlers
        
        onActionEdit: function(event) {
            if (this.modal) return; // singleton - only one dialog at a time
            var view = this.createModalView(); 
            this.modal = this.openModalWithView(view, function(dialog) {
                dialog.once('close', this.updateValueFromModalView.bind(this, dialog, view));
            }.bind(this)).always(function() {
                delete this.modal;
            }.bind(this));
        },
        
        onActionRemove: function(event) {
            if (!this.getAttribute('confirm')) return this.unsetValue();
            if (this.modal) return; // singleton - only one dialog at a time
            
            var options = {
                okText: 'Delete', okClass: 'btn-danger', allowCancel: true
            };
            
            var removeView = this.getAttribute('removeView') || 'confirm-remove';
            var view =  this.createModalView(removeView);
            this.modal = this.openModalWithView(view, options, function(dialog) {
                dialog.once('close', this.unsetValue.bind(this));
            }.bind(this)).always(function() {
                delete this.modal;
            }.bind(this));
        }
        
    }, ModalViewMixin));
    
    return Form.ModalControl;
    
});