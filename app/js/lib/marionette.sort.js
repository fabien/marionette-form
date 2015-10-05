(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['backbone.marionette', 'underscore', 'comparators'], function(Marionette, _, comparators) {
            return factory(Marionette, _, comparators);
        });
    } else if (typeof exports !== 'undefined') {
        module.exports = factory(require('backbone.marionette'), require('underscore'), require('comparators'));
    } else {
        factory(root.Marionette, root._, root.comparators);
    }
}(this, function(Marionette, _, comparators) {
    
    var SortMixin = {
        
        setDefaultComparator: function() {
            var defaultComparator = Marionette.getOption(this, 'comparator');
            if (defaultComparator) this.setComparator(defaultComparator);
        },
        
        setComparator: function(comparator) {
            if (_.isFunction(comparator)) {
                this._setComparator(comparator);
            } else if (_.isArray(comparator)) {
                this._setComparator(comparators.sortByAttribute(comparator[0], comparator[1]));
            } else if (_.isString(comparator)) {
                this._setComparator(comparators.sortByAttribute(comparator));
            }
        },
        
        sortByAttribute: function(attribute, direction) {
            if (attribute === false) {
                this.sortConfig = [];
            } else if (direction === 0) {
                this.sortConfig = _.reject(this.sortConfig, function(spec) {
                    return spec.attr === attribute;
                });
            } else if (arguments.length === 1 || direction === -1 || direction === 1) {
                direction = direction || 1; // default: ASC
                var spec = _.where(this.sortConfig, { attr: attribute })[0];
                if (spec) {
                    spec.dir = direction;
                } else if (Marionette.getOption(this, 'sortByMultiple')) {
                    this.sortConfig.push({ attr: attribute, dir: direction });
                } else {
                    this.sortConfig = [{ attr: attribute, dir: direction }];
                }
            }
            if (_.isEmpty(this.sortConfig)) {
                delete this.viewComparator;
                this.setDefaultComparator();
            } else {
                this.sortByAttributes(this.sortConfig);
            }
        },
        
        sortByAttributes: function(config) {
            this.sortConfig = _.isArray(config) ? config : [];
            var specs = _.map(this.sortConfig, function(spec) {
                return [spec.attr, spec.dir];
            });
            this.setComparator(comparators.sortByAttributes.apply(null, specs));
        },
        
        getSortConfig: function() {
            return this.sortConfig || (this.sortConfig = []);
        },
        
        getSortDirection: function(attribute) {
            var spec = _.where(this.sortConfig, { attr: attribute })[0];
            return (spec && spec.dir) || 0;
        },
        
        _setComparator: function(comparator) {
            this.comparator = comparator;
            this.sort();
        }
        
    };
    
    var CollectionViewMixin = {
        
        _setComparator: function(comparator) {
            this.viewComparator = comparator;
            this.render();
        }
        
    };
    
    Marionette.Sort = {};
    
    Marionette.Sort.CollectionMixin = {
        
        extend: function(collection, sortByMultiple) {
            _.extend(collection, SortMixin, { sortConfig: [] });
            if (sortByMultiple) collection.sortByMultiple = true;
            collection.setDefaultComparator();
        }
        
    };
    
    Marionette.Sort.CollectionViewMixin = {
        
        extend: function(view, sortByMultiple) {
            if (view instanceof Marionette.CollectionView) {
                _.extend(view, SortMixin, { sortConfig: [] });
                _.extend(view, CollectionViewMixin);
                if (sortByMultiple) view.sortByMultiple = true;
                view.setDefaultComparator();
            } else {
                throw new Error('Invalid view - not a Marionette.CollectionView');
            }
        }
        
    };
    
    return Marionette.Sort;
    
}));