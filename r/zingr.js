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

function FeedEntry(entry, feed) {
    var self = this;

    self.updated = entry.updated;
    self.link = entry.link;
    self.content = entry.content;
    self.title = entry.title;
    self.read = ko.observable(entry.read != 0);
    self.feed = feed;
}

function AppViewModel() {
    var self = this;

    self.feeds = ko.observable([]);

    self.setFeeds = function(feeds) {
        self.feeds(feeds.map(function(feed) {
            return (new Feed(feed));
        }));
    }

    self.addingFeed = ko.observable(false);
    self.newFeedUrl = ko.observable("");

    self.addFeedClicked = function(e) {
        self.addingFeed(!self.addingFeed());
        if (self.addingFeed()) {
            self.newFeedUrl("");
            $("newFeedInput").focus();
        } else {
            self.addFeed(self.newFeedUrl());
        }
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

    self.importingOpml = ko.observable(false);

    self.importOpmlClicked = function(e) {
        self.importingOpml(!self.importingOpml());
        if (self.importingOpml()) {
            $("opmlInput").focus();
        } else {
            self.importOpml($("opmlInput").files);
        }
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

    self.selectedFeed = ko.observable(null);

    self.selectFeed = function(feed) {
        log("Select feed ", feed);
        if (self.selectedFeed()) {
            self.selectedFeed().selected(false);
        }
        feed.selected(true);
        self.selectedFeed(feed);
        $("feedContent").scrollTo(0);

        self.getFeedEntries(feed);
    }

    self.selectedFeedEntries = ko.observable([]);

    self.getFeedEntries = function(feed) {
        (new Request.JSON({
            url: "/feed-entries",
            onSuccess: function(entries) {
                log("Got entries for ", feed, ": ", entries);

                self.selectedFeedEntries(entries.map(function(entry) {
                    return (new FeedEntry(entry, feed));
                }));
                self.checkRead();
            }
        })).send("url="+feed.url);
    }

    self.markRead = function(entry) {
        log("Marking as read: ", entry.title);
        (new Request({
            url: "/mark-read",
            onSuccess: function() {
                log("Marked as read: ", entry.title);
                entry.read(true);
            }
        })).send("feed_url="+entry.feed.url+"&url="+entry.link);
    }

    self.checkRead = function() {
        var feedContentE = $("feedContent");
        var feedEntriesE = feedContentE.getElements("li.feedEntry");
        self.selectedFeedEntries().reduce(function (totalHeight, entry, i) {
            // If an entry is fully visible, it is read.
            if (totalHeight < feedContentE.scrollTop + feedContentE.clientHeight
                && !entry.read()) {
                self.markRead(entry);
            }
            return totalHeight + feedEntriesE[i].getSize().y;
        }, 0);
    }
}

function setupLayout() {
    var height = document.getSize().y - $$("header")[0].getSize().y - 20;
    $("feeds").setStyle("height", height + "px");
    $("feedContent").setStyle("height", height + "px");
    var feedContentWidth = document.getSize().x - $("feeds").getSize().x - 28;
    $("feedContent").setStyle("width", feedContentWidth + "px");
}

document.addEvent("domready", function() {
    setupLayout();
    window.addEvent("resize", setupLayout);

    // Model is global.
    model = new AppViewModel();
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
