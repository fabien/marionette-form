define([
    'backbone',
    'marionette',
    'marionette.form',
    'backbone.filtered-collection'
], function(Backbone, Marionette, Form, FilteredCollection) {
    
    var utils = Form.utils;
    
    Form.Templates.Branched = _.template([
        '<div data-region="header"></div>',
        '<div data-region="main"></div>'
    ].join('\n'));
    
    Form.BranchedHeaderView = Form.View.extend({
        
        fields: [
            { id: 'branch', control: 'select', collection: 'branches' }
        ]
        
    });
    
    Form.Branched = Marionette.LayoutView.extend({
        
        branchIdAttribute: '_version',      // attribute to use as Branch idAttribute
        
        branchUrl: '/versions/',            // url prefix
        
        mainBranch: 'main',
        
        template: Form.Templates.Branched,
        
        headerView: Form.BranchedHeaderView,
        
        formView: Form.View,
        
        branchModel: null,
        
        regionNames: ['header', 'main'],
        
        constructor: function(options) {
            this.initOptions = _.extend({}, options);
            options = _.extend({}, options, { branch: this.getOption('mainBranch') });
            Marionette.LayoutView.prototype.constructor.call(this, this.initOptions);
            
            this.model = new Backbone.NestedModel(); // internal state
            this.form = new this.formView(options);
            this.fields = new FilteredCollection(this.form.collection);
            this.fields.filterBy(this.fieldFilter.bind(this));
            
            if (options.branches instanceof Backbone.Collection) {
                this.branches = options.branches;
            } else if (_.isString(options.branches)) {
                this.branches = Form.getCollection(options.branches) ||
                    new Backbone.Collection();
            } else {
                this.branches = new Backbone.Collection();
            }
            
            this.on('render', this._setupRegions);
            this.listenTo(this.model, 'change:branch', function(model, name, options) {
                this.changeBranch(name, options);
            });
        },
        
        fieldFilter: function(model) {
            return model.get('branch') === true;
        },
        
        getCurrentView: function() {
            var region = this.getRegion('main');
            return region.hasView() && region.currentView;
        },
        
        getData: function(options) {
            var view = this.getCurrentView();
            if (!view) return null;
            var keys = [this.getOption('branchIdAttribute')].concat(view.getKeys());
            return _.pick(view.getData(options), keys);
        },
        
        getBranch: function() {
            var region = this.getRegion('main');
            var currentView = region.hasView() && region.currentView;
            if (currentView) return currentView.getOption('branch');
            return this.model.get('branch');
        },
        
        setBranch: function(name, options) {
            return this.model.set('branch', name, options);
        },
        
        changeBranch: function(name, options) {
            options = _.extend({}, options, { previous: this.getBranch() })
            if (name === options.previous) {
                return $.Deferred().reject().promise();
            } else {
                var promise = this.triggerMethod('change:branch', name, options);
                return $.when(promise).then(function() {
                    return this.showBranch(name, options);
                }.bind(this)).fail(function() {
                    this.showBranch(options.previous, options);
                }.bind(this));
            }
        },
        
        isMainBranch: function(branch) {
            var mainBranch = this.getOption('mainBranch');
            branch = branch || this.getBranch() || mainBranch;
            if (_.isObject(branch)) branch.get(this.getOption('branchIdAttribute'));
            return branch === mainBranch;
        },
        
        isValidBranch: function(branch) {
            if (_.isObject(branch)) branch.get(this.getOption('branchIdAttribute'));
            if (this.branches.isEmpty()) return true;
            return _.isString(branch) && !!this.branches.get(branch);
        },
        
        showMainBranch: function(options) {
            return this.showBranch(this.getOption('mainBranch'), options);
        },
        
        showBranch: function(name, options) {
            options = _.extend({}, options);
            var dfd = $.Deferred();
            var containerView = this;
            var currentView = this.getCurrentView();
            var currentBranch = currentView && currentView.getOption('branch');
            var mainBranch = this.getOption('mainBranch');
            var isValidBranch = this.isValidBranch(name);
            if (isValidBranch && (currentBranch !== name || options.force)) {
                options.preventDestroy = currentBranch === mainBranch;
                this.model.set('branch', name);
                var view;
                
                if (name === mainBranch) {
                    view = this.form;
                } else {
                    view = this.createBranchView(name);
                }
                
                $.when(containerView.beforeShowBranch(name, view, options)).then(function() {
                    return $.when(containerView.showBranchView(view, options)).then(function() {
                        return containerView.afterShowBranch(name, view, options).then(dfd.resolve.bind(dfd));
                    });
                }).fail(function(resp) {
                    options.status = _.isObject(resp) && _.isNumber(resp.status) ? resp.status : 500;
                    if (options.status === 404) {
                        containerView.ensureBranch(name, view, options).then(dfd.resolve.bind(dfd), dfd.reject.bind(dfd)).fail(function() {
                            containerView.model.set('branch', currentBranch);
                        });
                    } else {
                        containerView.model.set('branch', currentBranch);
                        containerView.rejectBranch(name, view, options).then(dfd.reject.bind(dfd)); // always fail
                    }
                });
                
                return dfd.promise();
            } else if (isValidBranch) {
                containerView.model.set('branch', currentBranch); // enforce state
                return dfd.resolve().promise(); // treat as OK (unchanged)
            } else {
                return dfd.reject().promise();
            }
        },
        
        showBranchView: function(view, options) {
            this.model.set('branch', view.getOption('branch'));
            return this.showChildView('main', view, options)
        },
        
        beforeShowBranch: function(name, view, options) {
            var promises = [];
            promises.push(this.triggerMethod('before:show:branch', name, view, options));
            promises.push(view.triggerMethod('before:show:branch', name, this, options));
            return $.when.apply($, promises);
        },
        
        afterShowBranch: function(name, view, options) {
            var promises = [];
            promises.push(this.triggerMethod('show:branch', name, view, options));
            promises.push(view.triggerMethod('show:branch', name, this, options));
            return $.when.apply($, promises);
        },
        
        ensureBranch: function(name, view, options) {
            var promises = [];
            promises.push(this.triggerMethod('ensure:branch', name, view, options));
            promises.push(view.triggerMethod('ensure:branch', name, this, options));
            if (_.compact(promises).length === 0) { // reject unless promises
                return $.Deferred().reject().promise();
            } else {
                return $.when.apply($, promises);
            }
        },
        
        rejectBranch: function(name, view, options) {
            var promises = [];
            promises.push(this.triggerMethod('reject:branch', name, view, options));
            promises.push(view.triggerMethod('reject:branch', name, this, options));
            return $.when.apply($, promises);
        },
        
        // Branch View/Model
        
        createBranchView: function(name) {
            var formOptions = _.extend({}, this.initOptions);
            formOptions.branch = name;
            formOptions.fields = this.fields;
            formOptions.model = this.createBranchModel(name); // create new
            return new this.formView(formOptions);
        },
        
        createBranchModel: function(name) {
            var self = this;
            var branchIdAttribute = this.getOption('branchIdAttribute');
            var Base = this.getOption('branchModel') || this.form.model.constructor;
            
            var Model = Base.extend({
                
                sync: function(method, model, options) {
                    options = options || {};
                    if (!options.url && method === 'read') options.url = this.url({ fullUrl: true });
                    return Base.prototype.sync.call(this, method, model, options);
                },
                
                url: function(options) {
                    return self.getBranchUrl(name, this, options);
                },
                
                toJSON: function(options) {
                    var data = Base.prototype.toJSON.apply(this, arguments);
                    data[branchIdAttribute] = name; // enforce
                    return data;
                }
                
            });
            
            return new Model();
        },
        
        getBranchUrl: function(name, branch, options) {
            options = options || {};
            var branchIdAttribute = this.getOption('branchIdAttribute');
            var branchUrl = this.getOption('branchUrl');
            var urlRoot = _.result(this.form.model, 'url');
            if (branch.isNew() && !options.fullUrl) {
                return utils.joinUrl(urlRoot, branchUrl);
            } else {
                return utils.joinUrl(urlRoot, branchUrl, name);
            }
        },
        
        // Regions
        
        onSetupHeaderRegion: function(region) {
            var view = new this.headerView({
                layout: this.form.getOption('layout'),
                model: this.model,
                container: this
            });
            if (view.registerCollection) view.registerCollection('branches', this.branches);
            region.show(view);
        },
        
        onSetupMainRegion: function(region) {
            this.showBranch(this.getOption('branch') || this.getOption('mainBranch'));
        },
        
        _setupRegions: function() {
            var regions = _.result(this, 'regionNames');
            var defaults = { regionClass: this.getOption('regionClass') };
            _.each(regions, function(name) {
                var el = this.$('[data-region="' + name + '"]');
                var region = this.addRegion(name, _.extend({}, defaults, { el: el }));
                this.triggerMethod('setup:' + name + ':region', region);
            }.bind(this));
        }
        
    });
    
    return Form.Branched;
    
});
