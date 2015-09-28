(function (global) {
    
    // URI sync should be treated as a singleton datastore;
    // only a single model can actually keep in sync with it.
    
    // Optional dependency: rison.js
    
    var URI = {
        parse: function(string) {
            var hash = string || "",
                json = decodeURIComponent(hash),
                data = {};
            try {
                data = json ? JSON.parse(json) : {};
            }
            catch(e) {}
            return data;
        },
        stringify: function(data) {
            return encodeURIComponent(JSON.stringify(data));
        }
    };
    
    var uriSync = function(method, model, options) {
        var encode = global.rison ? global.rison.encode : URI.stringify;
        var decode = global.rison ? global.rison.decode : URI.parse;
        var string = window.location.href.split("#")[1] || (global.rison ? '()' : '');
        var resp = null;
        var data = decode(string) || {};
        switch (method) {
            case "read":
                model.set(data);
                resp = model.toJSON();
                break;
            case "create":
            case "update":
                resp = model.toJSON();
                window.location.hash = encode(resp);
                break;
            case "delete":
                model.clear();
                window.location.hash = '';
                break;
        }
        if (resp) {
            options.success(resp);
        } else {
            options.error("Record not found");
        }
    };
    
    // CommonJS, AMD, script tag
    if (typeof exports !== "undefined") {
        module.exports = uriSync;
    } else if (typeof define === "function") {
        define(function () {
            return uriSync;
        });
    } else {
        global.uriSync = uriSync;
    }
})(typeof global !== "undefined" ? global : window);
