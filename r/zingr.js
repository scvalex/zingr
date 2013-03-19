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
    self.addingOpml = ko.observable(false);

    self.addFeedClicked = function(e) {
        self.addingFeed(!self.addingFeed());
        if (self.addingFeed()) {
            self.newFeedUrl("");
            $("newFeedInput").focus();
        } else {
            self.addFeed(self.newFeedUrl());
        }
    }

    self.addOpmlClicked = function(e) {
        self.addingOpml(!self.addingOpml());
        if (self.addingOpml()) {
            $("opmlInput").focus();
        } else {
            self.addOpml($("opmlInput").files);
        }
    }

    self.addFeed = function(url) {
        log("Adding feed: ", url);
        (new Request.JSON({
            url: "/addfeed",
            onSuccess: function(feeds) {
                log("Added feed: ", url);
                self.feeds(feeds);
            }
        })).send("url="+url);
    }

    self.addOpml = function(fs) {
        var f = fs[0];
        log("Adding OPML from file: ", f);
        (new Request({
            url: "/importopml",
            onSuccess: function(resp) {
                log("Import OPML done: ", resp);
            }
        })).send(f);
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
