requirejs.config({
    baseUrl: 'js',
    paths: {
        // Lib dependencies (these should be kept in sync with mano-client)
        'autoNumeric': 'lib/autoNumeric',
        'backbone': 'lib/backbone.extended',
        'backbone.file-upload': 'lib/backbone.model-file-upload',
        'backbone.filtered-collection': 'lib/backbone.filtered-collection',
        'backbone.branches': 'lib/backbone.branches',
        'backbone.tracking': 'lib/backbone.tracking',
        'backbone.nested-model': 'lib/backbone.nested-model',
        'backbone.operation-queue': 'lib/operation-queue',
        'backbone.treeview': 'lib/backbone.treeview',
        'backbone.uri-sync': 'lib/backbone.uri-sync',
        'behave': 'lib/behave',
        'bootstrap-combobox': 'lib/bootstrap-combobox',
        'bootstrap-switch': 'lib/bootstrap-switch',
        'comparators': 'lib/comparators',
        'countable': 'lib/countable',
        'filesize': 'lib/filesize',
        'jquery.affix': 'lib/jquery.affix',
        'jquery.animate-enhanced': 'lib/jquery.animate-enhanced',
        'jquery.maskedinput': 'lib/jquery.maskedinput',
        'jquery.quickselect': 'lib/jquery.quickselect',
        'js.cookie': 'lib/js.cookie',
        'marionette.morphdom': 'lib/marionette.morphdom',
        'marionette.sort': 'lib/marionette.sort',
        'marionette.sortable': 'lib/marionette.sortable',
        'morphdom': 'lib/morphdom',
        'intl-tel-input': 'lib/intl-tel-input',
        'object-path': 'lib/object-path',
        'rison': 'lib/rison',
        'urlify': 'lib/urlify',
        // Customized Select2
        'select4': 'select4/select4',
        'select4-i18n': 'select4/i18n',
        // Vendor dependencies (should be kept in sync in mano-client)
        'backbone-tree-model': 'vendor/backbone-tree-model/src/backbone.treemodel',
        'backbone-tree-view': 'vendor/backbone-tree-view/lib/backbone-tree-view',
        'backbone.bootstrap-modal': 'vendor/backbone-bootstrap-modal/src/backbone.bootstrap-modal',
        'backbone.googlemaps': 'vendor/backbone.googlemaps/lib/backbone.googlemaps',
        'backbone.original': 'vendor/backbone/backbone',
        'backbone.syphon': 'vendor/backbone.syphon/lib/backbone.syphon',
        'backbone.validation': 'vendor/backbone.validation/dist/backbone-validation-amd',
        'bootstrap': 'vendor/bootstrap/dist/js/bootstrap',
        'bootstrap-datepicker': 'vendor/bootstrap-datepicker/dist/js/bootstrap-datepicker',
        'bootstrap-daterangepicker': 'vendor/bootstrap-daterangepicker/daterangepicker',
        'bootstrap-filestyle': 'vendor/bootstrap-filestyle/src/bootstrap-filestyle',
        'clipboard': 'lib/clipboard', // in lib, but is simply vendored
        'dragula': 'vendor/dragula.js/dist/dragula',
        'dropzone': 'vendor/dropzone/dist/dropzone-amd-module',
        'ion.rangeslider': 'vendor/ion.rangeslider/js/ion.rangeslider',
        'jquery': 'vendor/jquery/dist/jquery',
        'jquery.fileupload': 'vendor/blueimp-file-upload/js/jquery.fileupload',
        'jquery.iframe-transport': 'vendor/blueimp-file-upload/js/jquery.iframe-transport',
        'jquery.ui.widget': 'vendor/blueimp-file-upload/js/vendor/jquery.ui.widget',
        'marionette': 'vendor/marionette/lib/backbone.marionette',
        'moment': 'vendor/moment/moment',
        'select2': 'vendor/select2/select2',
        'underscore': 'vendor/underscore/underscore',
        // Marionette Form
        'marionette.form': 'marionette-form/marionette.form',
        'marionette.form.editable': 'marionette-form/forms/editable',
        'marionette.form.html': 'marionette-form/forms/html',
        'marionette.form.view.branched': 'marionette-form/views/branched',
        'marionette.form.view.json': 'marionette-form/views/json',
        'marionette.form.view.partial': 'marionette-form/views/partial',
        'marionette.form.view.table': 'marionette-form/views/table',
        'marionette.form.view.pane': 'marionette-form/views/pane',
        'marionette.control.binding': 'marionette-form/controls/binding',
        'marionette.form.control.code': 'marionette-form/controls/code',
        'marionette.form.control.combobox': 'marionette-form/controls/combobox',
        'marionette.form.control.dropdown': 'marionette-form/controls/dropdown',
        'marionette.form.control.dropzone': 'marionette-form/controls/dropzone',
        'marionette.form.control.filter': 'marionette-form/controls/filter',
        'marionette.form.control.geo': 'marionette-form/controls/geo',
        'marionette.form.control.modal': 'marionette-form/controls/modal',
        'marionette.form.control.object': 'marionette-form/controls/object',
        'marionette.form.control.phone': 'marionette-form/controls/phone',
        'marionette.form.control.redactor': 'marionette-form/controls/redactor',
        'marionette.form.control.reference': 'marionette-form/controls/reference',
        'marionette.form.control.slider': 'marionette-form/controls/slider',
        'marionette.form.control.switch': 'marionette-form/controls/switch',
        'marionette.form.control.text': 'marionette-form/controls/text',
        'marionette.form.control.tree': 'marionette-form/controls/tree',
        'marionette.form.control.upload': 'marionette-form/controls/upload',
        'marionette.form.control.uploadcare': 'marionette-form/controls/uploadcare',
        'marionette.form.control.urlify': 'marionette-form/controls/urlify'
    },
    shim: {
        autoNumeric: {
            deps: ['jquery']
        },
        rison: { exports: 'rison' },
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
        'ion.rangeslider': {
            deps: ['jquery']
        },
        'jquery.affix': {
            deps: ['jquery']
        },
        'jquery.animate-enhanced': {
            deps: ['jquery']
        },
        'jquery.quickselect': {
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
        },
        'bootstrap-combobox': {
            deps: ['jquery']
        },
        'bootstrap-switch': {
            deps: ['jquery']
        }
    }
});