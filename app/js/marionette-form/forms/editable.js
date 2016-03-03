define([
    'moment',
    'backbone',
    'marionette',
    'marionette.form',
    'marionette.form.control.object',
    'marionette.sortable',
    'backbone.bootstrap-modal',
    'bootstrap-daterangepicker',
    'select2'
], function(moment, Backbone, Marionette, Form) {
    
    Form.Templates.EditableForm = _.template([
        '<div class="form-controls form-editable"></div>',
        '<div class="form-footer row">',
        '  <div class="col-sm-3">',
        '    <input name="new-attr" type="text" class="form-control label-input" placeholder="Attribute">',
        '  </div>',
        '  <div class="col-sm-9">',
        '    <div class="input-group">',
        '      <input name="new-value" type="text" class="form-control" placeholder="Value (JSON)">',
        '      <div class="input-group-btn">',
        '        <button data-action="add-field" type="button" class="btn btn-default"><span class="glyphicon glyphicon-plus" aria-hidden="true"></span> Add</button>',
        '      </div>',
        '    </div>',
        '  </div>',
        '</div>'
    ].join('\n'));
    
    var EditableForm = Form.Editable = Form.View.extend({
        
        template: Form.Templates.EditableForm,
        
        childViewContainer: '.form-controls',
        
        behaviors: {
            sortable: {
                behaviorClass: Marionette.SortableBehavior,
                handle: '.control-label',
                removeOnSpill: true
            }
        },
        
        ui: {
            addButton: '[data-action="add-field"]',
            attrField: 'input[name="new-attr"]',
            valueField: 'input[name="new-value"]'
        },
        
        events: {
            'click @ui.addButton': 'onAddField',
            'keypress @ui.valueField': 'onKeyPress'
        },
        
        modalViewOptions: {
            layout: 'vertical',
            dragMirrorContainer: false
        },
        
        onInitialize: function(options) {
            this.fieldValueParser = this.getFormatter('json');
            this.listenTo(this.collection, 'reorder', this.triggerChange.bind(this, null));
            this.listenTo(this.model, 'change', this.updateFields);
            this.updateFields();
        },
        
        onAddField: function(event) {
            event.preventDefault();
            this.createFieldFromUI();
        },
        
        onKeyPress: function(event) {
            if (event.which === 13) {
                event.preventDefault();
                this.createFieldFromUI();
            }
        },
        
        onSortableRemove: function(model, collection) {
            var key = model.get('key');
            if (key) this.unsetValueOf(key);
        },
        
        onControlLabelClick: function(control, event) {
            if (event.altKey && control.model) {
                event.preventDefault();
                this.collection.remove(control.model);
                var key = control.model.get('key');
                if (key) this.unsetValueOf(key);
                this.triggerChange(); // manually
            }
        },
        
        getData: function(asModel) {
            var copy = new this.modelConstructor();
            this.collection.each(function(model) {
                var field = this.children.findByModel(model);
                var key = field.getKey();
                if (key && !field.evaluateAttribute('omit')) {
                    copy.set(key, field.getData());
                }
            }.bind(this));
            return asModel ? copy : copy.toJSON();
        },
        
        updateFields: function() {
            _.each(this.model.attributes, function(value, attr) {
                this.fieldFromAttribute(attr, value);
            }.bind(this));
        },
        
        createFieldForAttribute: function(attr, value) {
            // Hook method - return true if created here
        },
        
        createFieldFromUI: function() {
            var attr = this.ui.attrField.val();
            var value = this.ui.valueField.val();
            if (_.isEmpty(attr)) return;
            attr = this.fieldValueParser.toRaw(attr);
            if (_.isNumber(attr)) return;
            value = this.fieldValueParser.toRaw(value);
            this.setValueOf(attr, value);
            this.fieldFromAttribute(attr, value);
            this.ui.attrField.val('').focus();
            this.ui.valueField.val('');
            this.triggerChange();
        },
        
        fieldFromAttribute: function(attr, value) {
            var field = this.createFieldForAttribute(attr, value);
            if (field instanceof Form.Field || field === false) return;
            if (_.isArray(value) && _.isObject(value[0])) {
                var modalViewOptions = _.extend({}, _.result(this, 'modalViewOptions'));
                this.field(attr, {
                    control: 'object-list', modalView: this.constructor,
                    removable: true, sortable: true, synopsisLength: 2,
                    overwrite: true, modalViewOptions: modalViewOptions
                });
            } else if (_.isArray(value)) {
                this.field(attr, {
                    control: 'tag', create: true, options: value, minlength: 0
                });
            } else if (_.isObject(value)) {
                var modalViewOptions = _.extend({}, _.result(this, 'modalViewOptions'));
                this.field(attr, {
                    control: 'object', modalView: this.constructor,
                    removable: true, synopsisLength: 2,
                    overwrite: true, modalViewOptions: modalViewOptions
                });
            } else if (_.isBoolean(value)) {
                this.field(attr, {
                    control: 'checkbox', controlLabel: this.formatLabel(attr), label: false
                });
            } else if (_.isString(value)
                && value.match(/^(\d{4})\D(\d{2})\D(\d{2})/) && moment(value).isValid()) {
                this.field(attr, { control: 'date-time' });
            } else if (_.isString(value) && value.length > 128) {
                this.field(attr, { control: 'textarea' });
            } else {
                var type = _.isNumber(value) ? 'number' : 'text';
                type = attr === 'email' ? 'email' : type;
                var config = { control: 'input', type: type, formatter: 'json' };
                this.field(attr, config);
            }
        }
        
    });
    
    Form.ObjectView = Form.Editable; // for use as (modal) view
    
    return EditableForm;
    
});