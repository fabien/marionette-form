(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['backbone', 'backbone.nested-model', 'backbone.tracking'], function(Backbone) {
            return factory(Backbone, Backbone.NestedModel);
        });
    } else if (typeof exports !== 'undefined') {
        module.exports = factory(require('backbone'), require('backbone.nested-model'), require('backbone.tracking'));
    } else {
        factory(root.Backbone, root.Backbone.NestedModel, root.Backbone.TrackingModel);
    }
}(this, function(Backbone) {
    
    if (!Backbone.NestedModel) throw new Error('Backbone.NestedModel not loaded');
    
    var TrackingModel = Backbone.TrackingModel.mixin(Backbone.NestedModel);
    
    var configurableAttributes = [
        'branches', 'mainBranch', 'branchUrl',
        'branchDiscriminator', 'branchAttributes',
        'mergeMainBranch', 'sparseBranches',
        'branchesAttribute'
    ]
    
    Backbone.Branch = TrackingModel.extend({
        
        isEmpty: function() {
            var data = _.omit(this.toBranch(), this.collection.branchDiscriminator);
            return _.isEmpty(data);
        },
        
        isMainBranch: function() {
            return this.collection && this.collection.isMainBranch(this);
        },
        
        toBranch: function(options) {
            return compactObject(this.toJSON(options));
        }
        
    });
    
    Backbone.Branches = Backbone.Collection.extend({
        
        branches: [],
        
        current: null,
        
        model: Backbone.Branch,
        
        constructor: function(models, options) {
            options || (options = {});
            if (options.source instanceof Backbone.Model) {
                this.source = options.source;
            } else {
                throw new Error('Invalid source model');
            }
            Backbone.Collection.prototype.constructor.apply(this, arguments);
            this.branchesAttribute = options.branchesAttribute || this.branchesAttribute;
            this.listenTo(this.source, 'change', this.commit.bind(this));
            if (!_.isEmpty(this.branchesAttribute)) {
                var eventName = 'change:' + this.branchesAttribute;
                this.listenTo(this.source, eventName, this.preload.bind(this));
                this.preload(this.source);
            }
        },
        
        branch: function(id) {
            return _.isString(id) ? this.get(id) : this.current;
        },
        
        default: function() {
            return this.branch(this.mainBranch);
        },
        
        switch: function(branch) {
            if (!this.isValidBranch(branch)) return this.current;
            this.trigger('before:switch', branch, this.current);
            if (this.current) this.commit(this.source);
            
            this.current = branch;
            
            if (branch.isEmpty()) { // clear all existing values
                var keys = _.without(_.keys(this.source.attributes), this.source.idAttribute);
                var branchAttributes = _.result(this, 'branchAttributes') || [];
                if (_.isArray(branchAttributes) && !_.isEmpty(branchAttributes)) {
                    keys = _.intersection(keys, branchAttributes);
                }
                this.source.set(_.object(keys, []));
            } else {
                var attributes = this.getData(this.current);
                if (!_.result(this, 'sparseBranches')) {
                    this.current.set(attributes);
                    attributes = this.extractData(this.current);
                }
                this.source.set(attributes, { branch: this.current });
            }
            
            this.trigger('switch', this.current);
            return this.current;
        },
        
        delete: function(branch, options) {
            if (_.isString(branch)) branch = this.get(branch);
            if (this.isValidBranch(branch)) this.remove(branch, options);
        },
        
        preload: function(source) {
            if (!_.isEmpty(this.branchesAttribute)) {
                var branches = source.get(this.branchesAttribute);
                if (_.isArray(branches)) {
                    this.set(branches, { remove: false });
                }
            }
        },
        
        load: function(id, attrs, options) {
            if (this.isValidBranchId(id)) {
                options = _.extend({}, options);
                this.trigger('before:load', id, attrs, options);
                return $.when(this._load(id, attrs, options)).then(function(branch) {
                    if (this.isValidBranch(branch)) this.trigger('load', branch);
                    this.switch(branch);
                }.bind(this), function(error) {
                    this.trigger('load:fail', id, error);
                }.bind(this));
            } else {
                var error = new Error('Invalid branch: ' + (id || '[undefined]'));
                this.trigger('load:fail', id, error);
                return dfd.reject(error).promise();
            }
        },
        
        isMainBranch: function(branch) {
            branch = branch || (_.isString(branch) ? this.get(branch) : this.current);
            if (!this.isValidBranch(branch)) return false;
            return branch.id === this.mainBranch;
        },
        
        isValidBranchId: function(id) {
            var branches = _.result(this, 'branches');
            if (_.isArray(branches) && !_.isEmpty(branches)) {
                return _.include(branches, id);
            }
            return true;
        },
        
        isValidBranch: function(branch) {
            if (branch instanceof this.model) {
                return this.isValidBranchId(branch.id);
            } else {
                return false;
            }
        },
        
        hasChanges: function(branch) {
            return this.any(function(branch) { return branch.hasChanges(); });
        },
        
        getChanged: function() {
            return this.filter(function(branch) { return branch.hasChanges(); });
        },
        
        commit: function(source, options) {
            if (!this.current) return; // skip
            var attrs = this.extractData(source.changedAttributes() || {});
            attrs = _.omit(attrs, this.branchDiscriminator);
            this.trigger('before:commit', this.current, attrs);
            if (!_.isEmpty(attrs)) {
                this.current.set(attrs, options);
                this.trigger('commit', this.current, attrs);
            }
        },
        
        serialize: function(branch) {
            branch = branch || (_.isString(branch) ? this.get(branch) : this.current);
            if (!this.isValidBranch(branch)) return null;
            var data = _.isFunction(branch.toBranch) ? branch.toBranch() : branch.toJSON();
            this.trigger('serialize', branch, data);
            var isEmpty = _.isEmpty(_.omit(data, this.branchDiscriminator));
            return isEmpty ? null : data;
        },
        
        serializeAll: function(branchNames) {
            if (!_.isArray(branchNames) || _.isEmpty(branchNames)) {
                branchNames = _.without(this.pluck(this.branchDiscriminator), this.mainBranch);
            }
            var branches = [];
            this.each(function(branch) {
                if (this.isValidBranch(branch) && _.include(branchNames, branch.id)) {
                    var data = this.serialize(branch);
                    if (!_.isEmpty(data)) branches.push(data);
                }
            }.bind(this));
            return branches;
        },
        
        getData: function(branch, compact) {
            if (arguments.length === 0) branch = this.current;
            if (_.isString(branch)) branch = this.branch(branch);
            if (!this.isValidBranch(branch)) return {};
            
            var attributes = {};
            
            var branchAttributes = _.result(this, 'branchAttributes') || [];
            if (_.isArray(branchAttributes) && !_.isEmpty(branchAttributes)) {
                _.each(branchAttributes, function(attr) { // take blank into account
                    attributes[attr] = branch.get(attr);
                });
            } else {
                attributes = this.extractData(branch);
            }
            
            if (_.result(this, 'mergeMainBranch') && this.mainBranch) {
                 _.defaults(attributes, this.extractData(this.branch(this.mainBranch)));
            }
            
            return compact ? compactObject(attributes) : attributes;
        },
        
        extractData: function(attrs, allowed) {
            if (attrs instanceof Backbone.Model) attrs = this.serialize(attrs);
            if (!_.isObject(attrs)) return {}; // invalid attrs
            allowed = allowed || [];
            var branchAttributes = _.result(this, 'branchAttributes') || [];
            if (_.isArray(branchAttributes) && !_.isEmpty(branchAttributes)) {
                branchAttributes = branchAttributes.concat(allowed);
                attrs = _.pick(attrs, branchAttributes);
            }
            return this.branchesAttribute ? _.omit(attrs, this.branchesAttribute) : attrs;
        },
        
        _load: function(id, attrs, options) {
            options = _.extend({}, options, { merge: true });
            var data = {};
            data[this.branchDiscriminator] = id;
            return this.add(_.extend({}, attrs, data), options);
        },
        
        _prepareModel: function(attrs, options) {
            attrs = this.extractData(attrs, [this.branchDiscriminator]);
            return Backbone.Collection.prototype._prepareModel.call(this, attrs, options);
        }
        
    }, {
        
        branchDiscriminator: '_version',    // attribute to use as Branch idAttribute
        
        branchUrl: '/versions/',            // url prefix
        
        mainBranch: 'main',                 // default branch name
        
        mergeMainBranch: false,             // when true, merge default branch values
        
        sparseBranches: true,               // when true, keep branch data sparse
        
        branchesAttribute: null,            // when set, embed branch data
        
        mixin: function(model, options) {
            var config = _.extend({}, _.pick(model, configurableAttributes));
            _.extend(config, _.pick(options, configurableAttributes));
            
            config.branchDiscriminator = config.branchDiscriminator || this.branchDiscriminator;
            config.branchUrl = config.branchUrl || this.branchUrl;
            config.mainBranch = config.mainBranch || this.mainBranch;
            config.branchesAttribute = config.branchesAttribute || this.branchesAttribute;
            config.comparator = config.branchDiscriminator;
            
            config.model = config.model || Backbone.Branch;
            config.model = this.buildBranchModel(config.model, config);
            
            if (_.isFunction(config.branchUrl)) {
                config.url = config.branchUrl.bind(null, model, _.omit(config, 'branchUrl'));
            } else {
                config.url = this.buildBranchUrl.bind(this, model, config);
            }
            
            // Create copy of initial model attrs
            var attrs = model.toJSON();
            if (_.isEmpty(attrs[config.branchDiscriminator])) {
                attrs[config.branchDiscriminator] = config.mainBranch;
            }
            
            var Branches = this.extend(config);
            
            model.branches = new Branches([], { source: model });
            model.url = this.buildSourceUrl.bind(this, model, config);
            model.getData = this.getDataFromSource.bind(this, model, config);
            
            model.listenTo(model.branches, 'all', function(eventName) {
                var args = ['branches:' + eventName].concat(_.rest(arguments));
                this.trigger.apply(this, args);
            });
            
            model.branches.load(attrs[config.branchDiscriminator], attrs);
        },
        
        getDataFromSource: function(source, config, options) {
            getData = source.constructor.prototype.getData || source.toJSON;
            var data = getData.call(source, options);
            if (options && options.branches && !_.isEmpty(config.branchesAttribute)) {
                _.extend(data, source.branches.serialize(source.branches.default()));
                delete data[config.branchDiscriminator];
                data[config.branchesAttribute] = source.branches.serializeAll(options.branches);
            }
            return data;
        },
        
        buildBranchModel: function(Model, config) {
            return Model.extend(_.extend(_.pick(config, configurableAttributes), {
                idAttribute: config.branchDiscriminator
            }));
        },
        
        buildSourceUrl: function(source, config) {
            var url = source.constructor.prototype.url;
            url = _.isFunction(url) ? url.call(source) : url;
            if (source.isNew() || source.branches.isMainBranch() ||
                !_.isEmpty(config.branchesAttribute)) {
                return url;
            }
            return url + source.branches.current.url();
        },
        
        buildBranchUrl: function(source, config) {
            var modelUrl = _.result(source, 'url');
            return modelUrl + _.result(config, 'branchUrl');
        }
        
    });
    
    Backbone.BranchedModel = Backbone.NestedModel.extend({
        
        constructor: function(attributes, options) {
            Backbone.NestedModel.prototype.constructor.apply(this, arguments);
            Backbone.Branches.mixin(this, options);
        }
        
    });
    
    return Backbone.BranchedModel;
    
    function compactObject(o, voidOnly) {
        var clone = _.clone(o);
        _.each(clone, function(v, k) {
            if (voidOnly) {
                if (_.isNull(v) || _.isUndefined(v)) delete clone[k];
            } else if(!v) {
                delete clone[k];
            }
        });
        return clone;
    };
    
}));