function log() {
    if (console && console.log) {
        console.log.apply(console.log, arguments);
    }
}

function Feed(feed) {
    var self = this;

    self.title = feed.title;
    self.url = feed.url;
    self.count = feed.count;
    self.selected = ko.observable(false);
}

function FeedEntry(entry) {
    var self = this;

    self.updated = entry.updated;
    self.link = entry.link;
    self.content = entry.content;
    self.title = entry.title;
}

function AppViewModel() {
    var self = this;

    self.feeds = ko.observable([]);
    self.addingFeed = ko.observable(false);
    self.newFeedUrl = ko.observable("");
    self.importingOpml = ko.observable(false);
    self.selectedFeed = ko.observable(null);
    self.selectedFeedEntries = ko.observable([]);

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
        self.feeds(feeds.map(function(feed) {
            return (new Feed(feed));
        }));
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
                if (self.feeds().length > 0 && !self.selectedFeed()) {
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

        self.getFeedEntries(feed);
    }

    self.getFeedEntries = function(feed) {
        (new Request.JSON({
            url: "/feed-entries",
            onSuccess: function(entries) {
                log("Got entries for ", feed, ": ", entries);

                self.selectedFeedEntries(entries.map(function(feed) {
                    return (new FeedEntry(feed));
                }));
            }
        })).get({url: feed.url});
    }

    self.checkRead = function() {
        // checking if feed entry is read
    }
}

function setupLayout() {
    var height = document.getSize().y - $$("header")[0].getSize().y - 20;;
    $("feeds").setStyle("height", height + "px");
    $("feedContent").setStyle("height", height + "px");
    var feedContentWidth = document.getSize().x - $("feeds").getSize().x - 28;
    $("feedContent").setStyle("width", feedContentWidth + "px");
}

document.addEvent("domready", function() {
    setupLayout();

    var model = new AppViewModel();
    ko.applyBindings(model);
    model.reload();
    log("document loaded");

    var updateInterval = 10000;
    var updater = function () {
        model.reload();
        this.delay(updateInterval, this);
    };
    updater.delay(updateInterval, updater);

    $("feedContent").addEvent("scroll", function() {
        model.checkRead();
    });
});
