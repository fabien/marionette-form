define([
    'jquery',
    'underscore',
    'backbone',
    'backbone.marionette',
    'marionette.form',
    'marionette.form.control.modal'
], function($, _, Backbone, Marionette, Form) {
    
    Form.Templates.ObjectList = _.template([
        '<div class="list-items">',
        '  <label class="<%= labelClassName %>"><%= label %></label>',
        '  <div class="<%= controlsClassName %> nested-controls"></div>',
        '</div>',
        '<% if (create) { %>',
        '<div class="list-controls">',
        '  <div class="col-sm-9 col-sm-offset-3">',
        '    <button type="button" data-action="add" class="btn btn-default pull-right"><span class="glyphicon glyphicon-plus" aria-hidden="true"></span> Add</button>',
        '  </div>',
        '</div>',
        '<% } %>'
    ].join('\n'));
    
    var ObjectControl = Form.ObjectControl = Form.ModalControl.extend({
        
        modalView: Form.View,
        
        modalViewOptions: function() {
            var options = Form.ModalControl.prototype.modalViewOptions.apply(this, arguments);
            options.formDelegate = this.form;
            options.validateRequired = true;
            options.fields = [].concat(this.getAttribute('fields') || []);
            return options;
        }
        
    });
    
    var ObjectListControl = Form.ObjectListControl = Form.CollectionControl.extend(_.defaults({
        
        template: Form.Templates.ObjectList,
        
        defaultControl: ObjectControl,
        
        modalView: Form.View,
        
        controlDefaults: {
            create: true
        },
        
        getModalTitle: function() {
            return this.getLabel();
        },
        
        modalViewOptions: function() {
            var options = _.extend({}, this.getAttribute('modalViewOptions'));
            options.formDelegate = this.form;
            options.validateRequired = true;
            options.fields = [].concat(this.getAttribute('fields') || []);
            return options;
        },
        
        getModalViewData: function() {
            return _.extend({}, _.result(this, 'defaultData'), this.getAttribute('defaultData'));
        },
        
        onActionAdd: function(event) {
            if (this.modal) return; // singleton - only one dialog at a time
            var options = { title: this.getModalTitle() + ' : New' };
            var view = this.createModalView();
            this.modal = this.openModalWithView(view, options, function(dialog) {
                if (view.commit()) {
                    this.collection.add(view.getData(), { action: 'add' });
                } else {
                    dialog.preventClose();
                }
            }.bind(this)).always(function() {
                delete this.modal;
            }.bind(this));
        }
        
    }, Form.ModalViewMixin));
    
    return ObjectControl;
    
});