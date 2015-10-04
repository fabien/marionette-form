(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['underscore', 'object-path'], function(_, objectPath) {
            return factory(_, objectPath);
        });
    } else if (typeof exports !== 'undefined') {
        module.exports = factory(require('underscore'), require('object-path'));
    } else {
        factory(root._, root.objectPath);
    }
}(this, function(_, objectPath) {
    
    var comparators = {};
    
    // Plain objects
    
    function sortByProperty(property, sortOrder) {
        sortOrder = sortOrder || 1;
        var fn;
        return function fn(a,b) {
            var result;
            var aValue = objectPath.get(a, property);
            var bValue = objectPath.get(b, property);
            if (aValue < bValue) result = -1;
            if (aValue > bValue) result = 1;
            if (aValue === bValue) result = 0;
            return result * sortOrder;
        }
    };
    
    function sortByProperties() {
        var specs = _.toArray(arguments);
        return createMultiSortFn(specs, sortByProperty);
    };
    
    // Backbone Models (anything with a get function)
    
    function sortByAttribute(property, sortOrder) {
        sortOrder = sortOrder || 1;
        var fn;
        return function fn(a,b) {
            var result;
            var aValue = a.get(property);
            var bValue = b.get(property);
            if (aValue < bValue) result = -1;
            if (aValue > bValue) result = 1;
            if (aValue === bValue) result = 0;
            return result * sortOrder;
        }
    };
    
    function sortByAttributes() {
        var specs = _.toArray(arguments);
        return createMultiSortFn(specs, sortByAttribute);
    };
    
    comparators.sortByProperty = sortByProperty;
    comparators.sortByProperties = sortByProperties;
    
    comparators.sortByAttribute = sortByAttribute;
    comparators.sortByAttributes = sortByAttributes;
    
    return comparators;
    
    // Specs is an array:
    //
    // ['property', 'nested.property', ['prop', -1]]
    
    function createMultiSortFn(specs, sortFn) {
        var comparators = [];
        _.each(specs, function(spec) {
            if (_.isArray(spec) && !_.isEmpty(spec)) {
                comparators.push(sortFn(spec[0], spec[1]));
            } else if (_.isString(spec)) {
                comparators.push(sortFn(spec));
            }
        });
        
        return function fn(obj1, obj2) {
            var comparatorCount = comparators.length;
            var result = 0;
            var i = 0;
            while (result === 0 && i < comparatorCount) {
                var comparator = comparators[i];
                result = comparator(obj1, obj2);
                i++;
            }
            return result;
        };
    }
    
}));