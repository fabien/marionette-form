define([
    'backbone',
    'marionette',
    'marionette.form',
    'backbone.filtered-collection'
], function(Backbone, Marionette, Form, FilteredCollection) {
    
    Form.PartialView = Form.LayoutView.extend({
        
        // Base Layout with a source form and derived forms (partial fields)
        
        constructor: function(options) {
            options = _.extend({}, options);
            this.initOptions = _.omit(options, 'form');
            Form.LayoutView.prototype.constructor.call(this, this.initOptions);
            this.model = new Backbone.NestedModel(); // internal state
            if (options.form instanceof this.formView) {
                this.form = options.form;
            } else {
                this.form = new this.formView(options);
            }
            this.fields = new FilteredCollection(this.form.collection);
            this.fields.filterBy(this.fieldFilter.bind(this));
        },
        
        formView: Form.View,
        
        fieldFilter: function(model) {
            return true;
        },
        
        getCurrentView: function() {
            var region = this.getRegion('main');
            return region.hasView() && region.currentView;
        },
        
        createPartialForm: function(name, options) {
            options = _.extend({}, options);
            var formOptions = _.extend({}, this.initOptions);
            formOptions.branch = name;
            formOptions.fields = this.fields;
            formOptions.model = options.model || this.createPartialModel(name);
            var form = new this.formView(_.extend(formOptions, options));
            form.$el.attr('data-branch', name);
            return form;
        },
        
        createPartialModel: function(name) {
            var Model = this.form.model.constructor;
            return new Model();
        }
        
    });
    
    return Form.PartialView;
    
});
