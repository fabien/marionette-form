var express = require('express');
var path = require('path');
var multer = require('multer');
var mime = require('mime');
var fs = require('fs');
var jsonServer = require('json-server');

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

// Set default middlewares (logger, static, cors and no-cache)
app.use(jsonServer.defaults());

app.post('/files', upload.single('file'), function(req, res) {
    if (!req.file) return res.status(500).end();
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

app.all('/:primary/:id/:secondary/:fk', function(req, res, next) {
    req.url = '/' + req.params.secondary + '/' + req.params.fk;
    next();
});

app.use(jsonServer.router('db.json'));

app.listen(5000);
