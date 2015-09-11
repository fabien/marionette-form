requirejs.config({
    baseUrl: 'js',
    paths: {
        'autoNumeric': 'lib/autoNumeric',
        'filesize': 'lib/filesize',
        'behave': 'lib/behave',
        'urlify': 'lib/urlify',
        'dragula': 'vendor/dragula.js/dist/dragula',
        'dropzone': 'vendor/dropzone/dist/dropzone-amd-module',
        'select2': 'vendor/select2/select2',
        'moment': 'vendor/moment/moment',
        'underscore': 'vendor/underscore/underscore',
        'jquery': 'vendor/jquery/dist/jquery',
        'jquery.maskedinput': 'lib/jquery.maskedinput',
        'jquery.fileupload': 'vendor/blueimp-file-upload/js/jquery.fileupload',
        'jquery.iframe-transport': 'vendor/blueimp-file-upload/js/jquery.iframe-transport',
        'jquery.ui.widget': 'vendor/blueimp-file-upload/js/vendor/jquery.ui.widget',
        'bootstrap': 'vendor/bootstrap/dist/js/bootstrap',
        'bootstrap-filestyle': 'vendor/bootstrap-filestyle/src/bootstrap-filestyle',
        'bootstrap-datepicker': 'vendor/bootstrap-datepicker/dist/js/bootstrap-datepicker',
        'bootstrap-daterangepicker': 'vendor/bootstrap-daterangepicker/daterangepicker',
        'backbone': 'lib/backbone.extended',
        'backbone.original': 'vendor/backbone/backbone',
        'backbone.validation': 'vendor/backbone.validation/dist/backbone-validation-amd',
        'backbone.googlemaps': 'vendor/backbone.googlemaps/lib/backbone.googlemaps',
        'backbone.syphon': 'vendor/backbone.syphon/lib/backbone.syphon',
        'backbone.nested-model': 'vendor/backbone-nested-model/backbone-nested',
        'backbone.file-upload': 'vendor/backbone-model-file-upload/backbone-model-file-upload',
        'backbone.bootstrap-modal': 'vendor/backbone-bootstrap-modal/src/backbone.bootstrap-modal',
        'backbone.treeview': 'lib/backbone.treeview',
        'backbone-tree-view': 'vendor/backbone-tree-view/lib/backbone-tree-view',
        'backbone-tree-model': 'vendor/backbone-tree-model/src/backbone.treemodel',
        'backbone.marionette': 'vendor/marionette/lib/backbone.marionette',
        'marionette.sortable': 'lib/marionette.sortable',
        'marionette.form': 'marionette.form/marionette.form',
        'marionette.form.editable': 'marionette.form/forms/editable',
        'marionette.form.view.json': 'marionette.form/views/json',
        'marionette.form.control.modal': 'marionette.form/controls/modal',
        'marionette.form.control.object': 'marionette.form/controls/object',
        'marionette.form.control.reference': 'marionette.form/controls/reference',
        'marionette.form.control.urlify': 'marionette.form/controls/urlify',
        'marionette.form.control.code': 'marionette.form/controls/code',
        'marionette.form.control.tree': 'marionette.form/controls/tree',
        'marionette.form.control.geo': 'marionette.form/controls/geo',
        'marionette.form.control.dropzone': 'marionette.form/controls/dropzone',
        'marionette.form.control.upload': 'marionette.form/controls/upload'
    },
    shim: {
        autoNumeric: {
            deps: ['jquery']
        },
        bootstrap: {
            deps: ['jquery']
        },
        backbone: {
            deps: ['jquery', 'underscore'],
            exports: 'Backbone'
        },
        underscore: {
            exports: '_'
        },
        select2: {
            deps: ['jquery']
        },
        'bootstrap-filestyle': {
            deps: ['jquery']
        },
        'bootstrap-datepicker': {
            deps: ['jquery']
        },
        'bootstrap-daterangepicker': {
            deps: ['jquery']
        }
    }
});