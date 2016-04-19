define([
    'backbone',
    'marionette',
    'marionette.form',
    'marionette.form.view.partial'
], function(Backbone, Marionette, Form) {
    
    var utils = Form.utils;
    
    Form.Templates.PaneView = _.template([
        '<div data-region="main"></div>'
    ].join('\n'));
    
    Form.Templates.Pane = _.template([
        '<div data-region="main"></div>'
    ].join('\n'));
    
    Form.Pane = Form.PartialView.extend({
        
        className: 'pane-pane',
        
        template: Form.Templates.Pane,
        
        regionNames: ['main'],
        
        dataAttribute: 'data-pane',
        
        allowUndefined: true,
        
        constructor: function(options) {
            Form.PartialView.prototype.constructor.apply(this, arguments);
            if (_.isEmpty(this.getOption('pane'))) throw new Error('No pane specified');
        },
        
        commit: function() {
            var currentView = this.getCurrentView('main');
            if (currentView && currentView.commit()) {
                this.form.model.set(currentView.getData());
                return true;
            } else {
                return false;
            }
        },
        
        getData: function() {
            var currentView = this.getCurrentView('main');
            if (currentView) {
                return currentView.getData();
            } else {
                return {};
            }
        },
        
        getPartialModel: function(name) {
            return this.form.model.clone();
        },
        
        fieldFilter: function(model) {
            var pane = this.getOption('pane');
            var panes = model.get('pane');
            if (_.isUndefined(panes) && this.getOption('allowUndefined')) {
                return true;
            } else {
                return _.include([].concat(panes || []), pane);
            }
        },
        
        onSetupMainRegion: function(region) {
            var view = this.createPartialForm(this.getOption('pane'));
            this.showChildView('main', view);
        }
        
    });
    
    Form.PaneView = Form.LayoutView.extend({
        
        className: 'pane-view',
        
        template: Form.Templates.PaneView,
        
        regionNames: ['main'],
        
        formView: Form.View,
        
        paneView: Form.Pane,
        
        observeRegions: true,
        
        constructor: function(options) {
            Form.LayoutView.prototype.constructor.apply(this, arguments);
            var FormView = this.getOption('formView');
            if (options.form instanceof FormView) {
                this.form = options.form;
            } else {
                this.form = new FormView(options);
            }
            if (!this.form.isRendered) this.form.render(); // important
            this.listenTo(this.form.model, 'sync', this.reloadPane);
        },
        
        getFirstPane: function() {
            var name;
            this.form.collection.find(function(model) {
                name = _.first([].concat(model.get('pane') || []));
                return _.isString(name);
            });
            return name;
        },
        
        getPane: function() {
            var currentView = this.getCurrentView('main');
            var pane = currentView && currentView.getOption('pane');
            return pane || this.getOption('pane');
        },
        
        getForm: function() {
            var currentPane = this.getCurrentView('main');
            return currentPane && currentPane.getCurrentView('main');
        },
        
        changePane: function(name, options) {
            var previousPane = this.getCurrentView('main');
            options = _.extend({}, options, { previous: this.getPane() });
            if (name === options.previous) {
                return $.Deferred().reject().promise();
            } else if (previousPane && !previousPane.commit()) {
                return $.Deferred().reject().promise();
            } else {
                var promise = this.triggerMethod('change:pane', name, options);
                return $.when(promise).then(function() {
                    return this.showPane(name, options);
                }.bind(this)).fail(function() {
                    this.showPane(options.previous, options);
                }.bind(this));
            }
        },
        
        reloadPane: function() {
            var currentPane = this.getPane();
            if (currentPane) {
                return this.showPane(currentPane);
            } else {
                return $.Deferred().reject().promise();
            }
        },
        
        createPane: function(name, options) {
            options = _.extend({}, options);
            options.pane = name;
            options.form = this.form;
            options.model = this.form.model;
            options.formView = this.form.constructor;
            var PaneView = this.getOption('paneView');
            return new PaneView(options);
        },
        
        showPane: function(name, options) {
            var containerView = this;
            options = _.extend({}, options);
            var view = this.createPane(name, options);
            return $.when(containerView.beforeShowPane(name, view, options)).then(function() {
                return $.when(containerView.showChildView('main', view, options)).then(function() {
                    return containerView.afterShowPane(name, view, options);
                });
            });
        },
        
        beforeShowPane: function(name, view, options) {
            var promises = [];
            promises.push(this.triggerMethod('before:show:pane', name, view, options));
            promises.push(view.triggerMethod('before:show:pane', name, this, options));
            return $.when.apply($, promises);
        },
        
        afterShowPane: function(name, view, options) {
            var promises = [];
            promises.push(this.triggerMethod('show:pane', name, view, options));
            promises.push(view.triggerMethod('show:pane', name, this, options));
            return $.when.apply($, promises);
        },
        
        onSetupMainRegion: function(region) {
            this.showPane(this.getOption('pane') || this.getFirstPane());
            this.listenTo(region, 'all', function(eventName) {
                if (eventName.indexOf('childview:') === 0) {
                    eventName = 'form:' + eventName.slice(10);
                    var args = [eventName].concat(_.rest(arguments));
                    this.triggerMethod.apply(this, args);
                }
            });
        }
        
    });
    
    return Form.PaneView;
    
});
