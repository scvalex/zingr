function log() {
    if (console && console.log) {
        console.log.apply(console.log, arguments);
    }
}

function requestJson(url, data, onSuccess) {
    (new Request.JSON({
            url: url,
            onSuccess: onSuccess
    })).get(data);
}

function AppViewModel() {
    var self = this;

    self.feeds = ko.observable([]);
    self.addingFeed = ko.observable(false);
    self.newFeedUrl = ko.observable("");
    self.addingOpml = ko.observable(false);
    self.opmlPath = ko.observable("");

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
            self.opmlPath("");
            $("opmlInput").focus();
        } else {
            self.addOpml(self.opmlPath());
        }
    }

    self.addFeed = function(url) {
        log("Adding feed: ", url);
        requestJson("/addfeed", {url: url}, function(feeds) {
            log("Added feed: ", url);
            self.feeds(feeds);
        });
    }

    self.addOpml = function(path) {
        log("Adding opml: ", path);
    }

    self.reload = function() {
        requestJson("/feeds", {}, function(feeds) {
            log("Reloaded feeds: ", feeds);
            self.feeds(feeds);
        });
    }
}

document.addEvent("domready", function() {
    var model = new AppViewModel();
    ko.applyBindings(model);
    model.reload();
    log("document loaded");
});
