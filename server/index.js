var express = require('express');
var path = require('path');
var multer = require('multer');
var mime = require('mime');
var fs = require('fs');

var fixtures = path.join(__dirname, 'files');
var dest = path.join(__dirname, 'uploads');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, dest + '/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
})

var upload = multer({ storage: storage });

var app = express();

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control');
    next();
});

app.get('/', function(req, res) {
    res.send('hello world');
});

app.post('/', upload.single('file'), function(req, res) {
    // if (!res.file) return res.status(500).end();
    console.log(req.body);
    console.log(req.file);
    res.json({
        id: req.file.filename,
        filename: req.file.originalname,
        filesize: req.file.size,
        filetype: req.file.mimetype,
        url: '/files/' + req.file.filename
    });
});

app.get('/files/document.txt', function(req, res) {
    res.sendFile(path.join(fixtures, 'document.txt'));
});

app.get('/files/sample.png', function(req, res) {
    res.sendFile(path.join(fixtures, 'sample.png'));
});

app.get('/files/:filename', function(req, res) {
    res.sendFile(path.join(dest, req.params.filename));
});

app.delete('/files/:filename', function(req, res, next) {
    var filepath = path.join(dest, req.params.filename);
    fs.exists(filepath, function(exists) {
        if (!exists) return res.status(404).end();
        fs.unlink(filepath, function(err) {
            if (err) return next(err);
            res.status(204).end();
        })
    });
});

app.listen(5000);
