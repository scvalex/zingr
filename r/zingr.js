function log() {
    if (console && console.log) {
        console.log.apply(console.log, arguments);
    }
}

function Feed(title, url) {
    var self = this;

    self.title = title;
    self.url = url;
}

function AppViewModel() {
    var self = this;

    self.feeds = ko.observable([new Feed("alex", "alexUrl"), new Feed("max", "maxUrl")]);
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
}

document.addEvent("domready", function() {
    ko.applyBindings(new AppViewModel());
    log("document loaded");
});
