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

    self.addFeedClicked = function(e) {
        self.addingFeed(!self.addingFeed());
        if (self.addingFeed()) {
            self.newFeedUrl("");
        } else {
            self.addFeed(self.newFeedUrl());
        }
    }

    self.addFeed = function(url) {
        log("Adding feed: ", url);
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
