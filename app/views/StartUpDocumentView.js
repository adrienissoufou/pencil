function StartUpDocumentView() {
    BaseTemplatedWidget.call(this);

    var gridViewCheck = Config.get("view.recentGridView");
    if (gridViewCheck == null) {
        Config.set("view.recentGridView", true);
        gridViewCheck = true;
    }
    if (gridViewCheck) this.currentRepeater = this.recentDocumentRepeater;
    else this.currentRepeater = this.recentDocumentRepeaterRow;

    this.currentRepeater.populator = function (doc, binding) {
        var filePath = doc.filePath;
        var handler = function (error, thumbPath) {
            var stats = fs.statSync(filePath);
            if (stats) {
                binding.name.innerHTML = Dom.htmlEncode(path.basename(filePath));
                binding.info.innerHTML = Dom.htmlEncode(moment(stats.mtime).fromNow());
                if (binding.path) {
                    binding.path.innerHTML = Dom.htmlEncode(filePath);
                }
                var pinFiles = Config.get("pin-documents");
                if (pinFiles.indexOf(filePath) >= 0) {
                    binding.pin.innerHTML = "";
                    binding.pin.appendChild(Dom.newDOMElement({
                            _name: "i",
                            _text: "star"
                    }));
                }
                if (thumbPath) {
                    window.setTimeout(function () {
                        Util.setupImage(binding.thumbnailImage, ImageData.filePathToURL(thumbPath), "center-crop", "allowUpscale");
                    }, 10);
                }
                binding._node._filePath = filePath;
                binding._node.setAttribute("title", filePath);
            }
        };

        if (doc.thumbPath) {
            handler(null, doc.thumbPath);
        } else {
            Pencil.controller.parseDocumentThumbnail(filePath, handler);
        }
    }

    var thiz = this;
    this.bind("click", function (event) {
        var node = Dom.findUpward(event.target, function(node) {
            if (node.getAttribute("command") == "pinDocument") return true;
            return false;
        })

        var filePath = Dom.findUpwardForData(event.target, "_filePath");
        if (!filePath) return;

        if (node) {
            var pinFiles = Config.get("pin-documents") || [];
            var pinMaps = Config.get("pin-documents-thumb-map") || {};
            var index = pinFiles.indexOf(filePath);
            if (index < 0) {
                if (pinFiles.length >= 8) {
                    pinMaps[pinFiles[7]] = null;
                    pinFiles.pop();
                }
                pinFiles.push(filePath);
                var recentMap = Config.get("recent-documents-thumb-map") || null;
                if (recentMap) {
                    pinMaps[filePath] = recentMap[filePath];
                }
            } else {
                pinFiles.splice(index,1);
                pinMaps[filePath] = null;
            }
            Config.set("pin-documents", pinFiles);
            Config.set("pin-documents-thumb-map", pinMaps);
            thiz.reload();
            return;
        }

        function handler() {
            Pencil.controller.loadDocument(filePath);
        }
        if (Pencil.controller.modified) {
            Pencil.controller.confirmAndSaveDocument(handler);
            return;
        }
        handler();

    }, this.currentRepeater);

    Dom.doOnAllChildRecursively(this.node(), function (n) {
        if (!n.getAttribute || !n.getAttribute("command")) return;
        var command = n.getAttribute("command");
        UICommandManager.installControl(command, n);
    });

}

__extend(BaseTemplatedWidget, StartUpDocumentView);

StartUpDocumentView.prototype.reload = function () {
    var recentFiles = Config.get("recent-documents") || [];
    var pinFiles = Config.get("pin-documents") || [];

    var pinMap = Config.get("pin-documents-thumb-map") || {};
    var recentMap = Config.get("recent-documents-thumb-map") || {};

    var recentDocs = [];
    var pinDocs = [];

    var loadFiles = function (files, deletedFiles, pinFlag) {
        var doc = [];
        for (var i = 0; i < Math.min(files.length, 8); i++) {
            var checkExist = fs.existsSync(files[i]);
            if(!checkExist) {
                deletedFiles.push(files[i]);
            } else {
                if (!pinFlag && pinFiles.indexOf(files[i]) >= 0 ) continue;
                doc.push({
                    filePath: files[i],
                    thumbPath: (pinFlag == true) ? (pinMap[files[i]] || null) : (recentMap[files[i]] || null)
                });

            }
        }
        return doc;
    }

    var deleteFiles = [];
    if (recentFiles) {
        recentDocs = loadFiles(recentFiles, deleteFiles);
        if (deleteFiles.length > 0) {
            for (var i = 0; i < deleteFiles.length; i++) {
                Pencil.controller.removeRecentFile(deleteFiles[i]);
            }
        }
    }

    deleteFiles = [];
    if (pinFiles) {
        pinDocs = loadFiles(pinFiles, deleteFiles, true);
        if (deleteFiles.length > 0) {
            for (var i = 0; i < deleteFiles.length; i++) {
                pinMap[deleteFiles[i]] = null;
                pinFiles.splice(i, 1);
            }
            Config.set("pin-documents", pinFiles);
            Config.set("pin-documents-thumb-map", pinMap);
        }
    }
    var startDocs = pinDocs.concat(recentDocs);
    startDocs = startDocs.slice(0, 8);
    var thiz = this;
    this.currentRepeater.node().style.visibility = "hidden";
    setTimeout(function () {
        thiz.currentRepeater.setItems(startDocs);
        thiz.currentRepeater.node().style.visibility = "inherit";
    }, 200);
};
