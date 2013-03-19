function log() {
    if (console && console.log) {
        console.log.apply(console.log, arguments);
    }
}

function AppViewModel() {
    var self = this;

    self.feeds = ko.observable([]);
    self.addingFeed = ko.observable(false);
    self.newFeedUrl = ko.observable("");
    self.importingOpml = ko.observable(false);

    self.addFeedClicked = function(e) {
        self.addingFeed(!self.addingFeed());
        if (self.addingFeed()) {
            self.newFeedUrl("");
            $("newFeedInput").focus();
        } else {
            self.addFeed(self.newFeedUrl());
        }
    }

    self.importOpmlClicked = function(e) {
        self.importingOpml(!self.importingOpml());
        if (self.importingOpml()) {
            $("opmlInput").focus();
        } else {
            self.importOpml($("opmlInput").files);
        }
    }

    self.addFeed = function(url) {
        log("Adding feed: ", url);
        (new Request.JSON({
            url: "/add-feed",
            onSuccess: function(feeds) {
                log("Added feed: ", url);
                self.feeds(feeds);
            }
        })).send("url="+url);
    }

    self.importOpml = function(fs) {
        var f = fs[0];
        log("Adding OPML from file: ", f);
        var formData = new FormData();
        formData.append("opml-file", f);
        var req = new XMLHttpRequest();
        req.open("POST", "import-opml");
        req.onload = function(event) {
            feeds = JSON.parse(event.target.responseText);
            log("Got back feeds: ", feeds);
            self.feeds(feeds);
        };
        req.send(formData);
    }

    self.reload = function() {
        (new Request.JSON({
            url: "/feeds",
            onSuccess: function(feeds) {
                log("Reloaded feeds: ", feeds);
                self.feeds(feeds);
            }
        })).get();
    }
}

document.addEvent("domready", function() {
    var model = new AppViewModel();
    ko.applyBindings(model);
    model.reload();
    log("document loaded");
});
