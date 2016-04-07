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
        'branchIdAttribute', 'branchAttributes',
        'mergeMainBranch', 'sparseBranches',
        'embedBranches', 'branchesAttribute'
    ]
    
    Backbone.Branch = TrackingModel.extend({
        
        isEmpty: function() {
            var data = _.omit(this.serialize(), this.collection.branchIdAttribute);
            return _.isEmpty(data);
        },
        
        isCurrentBranch: function() {
            return this.collection && this.collection.isCurrentBranch(this);
        },
        
        isMainBranch: function() {
            return this.collection && this.collection.isMainBranch(this);
        },
        
        serialize: function(options) {
            var data = this.toJSON(options);
            return this.collection.isSparse() ? compactObject(data) : data;
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
            this.on('remove', this._onRemove);
            if (!_.isEmpty(this.branchesAttribute)) {
                var eventName = 'change:' + this.branchesAttribute;
                this.listenTo(this.source, eventName, this.preload.bind(this));
                this.preload(this.source);
            }
        },
        
        branch: function(id) {
            return arguments.length === 1 && _.isString(id) ? this.get(id) : this.current;
        },
        
        default: function() {
            return this.branch(this.mainBranch);
        },
        
        switch: function(branch) {
            if (!this.isValidBranch(branch) || this.current === branch) {
                return this.current;
            }
            this.trigger('before:switch', branch, this.current);
            if (this.current) this.commit(this.source);
            
            this.current = branch;
            
            if (branch.isEmpty()) { // clear all existing values
                this.clearSource();
            } else {
                var attributes = this.getData(this.current);
                if (!this.isSparse()) {
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
                var branchIdAttribute = this.branchIdAttribute;
                var branches = source.get(this.branchesAttribute);
                if (_.isArray(branches)) {
                    this.set(_.filter(branches, function(obj) {
                        return _.isObject(obj) && !_.isEmpty(obj[branchIdAttribute]);
                    }), { remove: false });
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
        
        build: function(id, attrs, options) {
            options = _.extend({}, options, { merge: true });
            var data = {};
            data[this.branchIdAttribute] = id;
            return this.add(_.extend({}, attrs, data), options);
        },
        
        isMainBranch: function(branch) {
            branch = branch || (_.isString(branch) ? this.get(branch) : this.current);
            if (!this.isValidBranch(branch)) return false;
            return branch.id === this.mainBranch;
        },
        
        isCurrentBranch: function(branch) {
            branch = branch || (_.isString(branch) ? this.get(branch) : null);
            if (!this.isValidBranch(branch)) return false;
            return branch === this.current;
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
        
        isSparse: function() {
            return !_.result(this, 'sparseBranches');
        },
        
        hasChanges: function(branch) {
            return this.any(function(branch) { return branch.hasChanges(); });
        },
        
        getChanged: function() {
            return this.filter(function(branch) { return branch.hasChanges(); });
        },
        
        clearSource: function() {
            var keys = _.without(_.keys(this.source.attributes), this.source.idAttribute);
            var branchAttributes = _.result(this, 'branchAttributes') || [];
            if (_.isArray(branchAttributes) && !_.isEmpty(branchAttributes)) {
                keys = _.intersection(keys, branchAttributes);
            }
            this.source.set(_.object(keys, []));
        },
        
        commit: function(source, options) {
            source = source || this.source;
            if (!this.current || !source) return; // skip
            var attrs = this.extractData(source.changedAttributes() || {});
            attrs = _.omit(attrs, this.branchIdAttribute);
            this.trigger('before:commit', this.current, attrs);
            if (!_.isEmpty(attrs)) {
                this.current.set(attrs, options);
                this.trigger('commit', this.current, attrs);
            }
        },
        
        merge: function(branch) {
            if (_.isString(branch)) branch = this.branch(branch);
            if (this.current && this.isValidBranch(branch)) {
                this.current.set(branch.serialize());
            }
        },
        
        serialize: function(branch) {
            branch = branch || (_.isString(branch) ? this.get(branch) : this.current);
            if (!this.isValidBranch(branch)) return null;
            var data = branch.serialize();
            this.trigger('serialize', branch, data);
            var isEmpty = _.isEmpty(_.omit(data, this.branchIdAttribute));
            return isEmpty ? null : data;
        },
        
        serializeAll: function(branchNames) {
            if (!_.isArray(branchNames) || _.isEmpty(branchNames)) {
                branchNames = _.without(this.pluck(this.branchIdAttribute), this.mainBranch);
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
            return this.build(id, attrs, options);
        },
        
        _prepareModel: function(attrs, options) {
            attrs = this.extractData(attrs, [this.branchIdAttribute]);
            return Backbone.Collection.prototype._prepareModel.call(this, attrs, options);
        },
        
        _onRemove: function(branch) {
            if (this.isCurrentBranch(branch)) {
                // fix issue whete get()/branch() will still return the removed model
                this._removeReference(branch);
                this.switch(this._ensureMainBranch());
            }
        },
        
        _ensureMainBranch: function(options) {
            return this.branch(this.mainBranch) || this.build(this.mainBranch);
        }
        
    }, {
        
        branchIdAttribute: 'id',            // attribute to use as Branch idAttribute
        
        branchUrl: '/versions/',            // url prefix
        
        mainBranch: 'main',                 // default branch name
        
        mergeMainBranch: false,             // when true, merge default branch values
        
        sparseBranches: true,               // when true, keep branch data sparse
        
        branchesAttribute: 'versions',      // embedded branch array attribute
        
        embedBranches: false,
        
        mixin: function(model, options) {
            var config = _.extend({}, _.pick(model, configurableAttributes));
            _.extend(config, _.pick(options, configurableAttributes));
            
            config.branchIdAttribute = config.branchIdAttribute || this.branchIdAttribute;
            config.branchUrl = config.branchUrl || this.branchUrl;
            config.mainBranch = config.mainBranch || this.mainBranch;
            config.branchesAttribute = config.branchesAttribute || this.branchesAttribute;
            config.comparator = config.branchIdAttribute;
            
            config.model = config.model || Backbone.Branch;
            config.model = this.buildBranchModel(config.model, config);
            
            if (_.isFunction(config.branchUrl)) {
                config.url = config.branchUrl.bind(null, model, _.omit(config, 'branchUrl'));
            } else {
                config.url = this.buildBranchUrl.bind(this, model, config);
            }
            
            // Create copy of initial model attrs
            var attrs = model.toJSON();
            if (_.isEmpty(attrs[config.branchIdAttribute])) {
                attrs[config.branchIdAttribute] = config.mainBranch;
            }
            
            var Branches = this.extend(config);
            
            model.branches = new Branches([], { source: model });
            model.url = this.buildSourceUrl.bind(this, model, config);
            model.getData = this.getDataFromSource.bind(this, model, config);
            
            model.listenTo(model.branches, 'all', function(eventName) {
                var args = ['branches:' + eventName].concat(_.rest(arguments));
                this.trigger.apply(this, args);
            });
            
            var branchId = attrs[config.branchIdAttribute] || config.mainBranch;
            model.branches.load(branchId, attrs);
        },
        
        getDataFromSource: function(source, config, options) {
            getData = source.constructor.prototype.getData || source.toJSON;
            var data = getData.call(source, options);
            if (((options && options.branches) || config.embedBranches) && !_.isEmpty(config.branchesAttribute)) {
                _.extend(data, source.branches.serialize(source.branches.default()));
                delete data[config.branchIdAttribute];
                data[config.branchesAttribute] = source.branches.serializeAll(options.branches);
            }
            return data;
        },
        
        buildBranchModel: function(Model, config) {
            return Model.extend(_.extend(_.pick(config, configurableAttributes), {
                idAttribute: config.branchIdAttribute
            }));
        },
        
        buildSourceUrl: function(source, config) {
            if (source.isNew() || source.branches.isMainBranch() || config.embedBranches) {
                var url = source.constructor.prototype.url;
                return _.isFunction(url) ? url.call(source) : url;
            } else {
                return source.branches.current.url();
            }
        },
        
        buildBranchUrl: function(source, config) {
            var url = source.constructor.prototype.url;
            url = _.isFunction(url) ? url.call(source) : url;
            return url + _.result(config, 'branchUrl');
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