(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['backbone', 'backbone.nested-model'], function(Backbone) {
            return factory(Backbone, Backbone.NestedModel);
        });
    } else if (typeof exports !== 'undefined') {
        module.exports = factory(require('backbone'), require('backbone.nested-model'));
    } else {
        factory(root.Backbone, root.Backbone.NestedModel);
    }
}(this, function(Backbone) {
    
    if (!Backbone.NestedModel) throw new Error('Backbone.NestedModel not loaded');
    
    Backbone.BranchedModel = Backbone.NestedModel.extend({
        
        
        
    });
    
}));