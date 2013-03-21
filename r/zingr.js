function log() {
    if (console && console.log) {
        console.log.apply(console.log, arguments);
    }
}

function Feed(feed) {
    var self = this;

    self.title = feed.title;
    self.url = feed.url;
    self.selected = ko.observable(false);
}

function AppViewModel() {
    var self = this;

    self.feeds = ko.observable([]);
    self.addingFeed = ko.observable(false);
    self.newFeedUrl = ko.observable("");
    self.importingOpml = ko.observable(false);
    self.selectedFeed = ko.observable(null);

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

    self.setFeeds = function(feeds) {
        var newFeeds = [];
        Array.each(feeds, function(feed) {
            newFeeds.push(new Feed(feed));
        });
        self.feeds(newFeeds);
    }

    self.addFeed = function(url) {
        log("Adding feed: ", url);
        (new Request.JSON({
            url: "/add-feed",
            onSuccess: function(feeds) {
                log("Added feed: ", url);
                self.setFeeds(feeds);
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
            self.setFeeds(feeds);
        };
        req.send(formData);
    }

    self.reload = function() {
        (new Request.JSON({
            url: "/feeds",
            onSuccess: function(feeds) {
                log("Reloaded feeds: ", feeds);
                self.setFeeds(feeds);
                if (self.feeds().length > 0) {
                    self.selectFeed(self.feeds()[0]);
                }
            }
        })).get();
    }

    self.selectFeed = function(feed) {
        log("Select feed ", feed);
        if (self.selectedFeed()) {
            self.selectedFeed().selected(false);
        }
        feed.selected(true);
        self.selectedFeed(feed);

        $("feedContent").set("text", feed.title);
    }
}

function setupLayout() {
    $("feeds").setStyle("height", document.getSize().y + "px");
    $("feedContent").setStyle("height", document.getSize().y + "px");
}

document.addEvent("domready", function() {
    setupLayout();

    var model = new AppViewModel();
    ko.applyBindings(model);
    model.reload();
    log("document loaded");
});
