define([
    'backbone',
    'marionette',
    'marionette.form',
    'backbone.filtered-collection'
], function(Backbone, Marionette, Form, FilteredCollection) {
    
    Form.PartialView = Form.LayoutView.extend({
        
        // Base Layout with a source form and derived forms (partial fields)
        
        formView: Form.View,
        
        dataAttribute: 'data-branch',
        
        constructor: function(options) {
            options = _.extend({}, options);
            this.initOptions = _.omit(options, 'form');
            Form.LayoutView.prototype.constructor.call(this, this.initOptions);
            this.model = new Backbone.NestedModel(); // internal state
            var FormView = this.getOption('formView');
            if (options.form instanceof FormView) {
                this.form = options.form;
            } else {
                this.form = new FormView(options);
            }
            this.fields = new FilteredCollection(this.form.collection);
            this.fields.filterBy(this.fieldFilter.bind(this));
            this.options.fields = [].concat(this.options.fields || []);
        },
        
        fieldFilter: function(model) {
            if (_.isEmpty(this.options.fields)) return true;
            return _.include(this.options.fields, model.get('key'));
        },
        
        createPartialForm: function(name, options) {
            options = _.extend({}, options);
            var formOptions = _.extend({}, this.initOptions);
            formOptions.branch = name;
            formOptions.fields = this.fields;
            formOptions.model = options.model || this.getPartialModel(name);
            var FormView = this.getOption('formView');
            var form = new FormView(_.extend(formOptions, options));
            form.$el.attr(this.getOption('dataAttribute'), name);
            return form;
        },
        
        getPartialModel: function(name) {
            var Model = this.form.model.constructor;
            return new Model();
        }
        
    });
    
    return Form.PartialView;
    
});
