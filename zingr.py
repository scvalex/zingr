#!/usr/bin/python

from __future__ import print_function

from flask import Flask, send_from_directory, request
app = Flask(__name__)

from threading import Thread
from Queue import Queue
import xml.dom.minidom
import json, sqlite3, os, urllib2, time

DB_NAME = "zingr.db"

#####################
# Console printer
#####################

class Console(Thread):
    """Thread safe printing"""
    def __init__(self):
        super(Console, self).__init__()

        self.daemon = True
        self.queue = Queue()

    def write(self, s):
        """Write the given string to the console"""
        self.queue.put(s)

    def run(self):
        while True:
            s = self.queue.get(True, None)
            print(s)
console = Console()

#####################
# Web front-end
#####################

def start_server():
    app.run(debug=True, use_reloader=False)

@app.route("/")
def index():
    return send_from_directory(app.root_path, "index.html")

@app.route("/r/<path:filename>")
def resource(filename):
    return send_from_directory("r", filename)

@app.route("/feeds")
def feeds():
    saved_feeds = {}
    with sqlite3.connect(DB_NAME) as db:
        saved_feeds = [{"title": title,
                        "url": url}
                       for title, url in db.execute("SELECT title, url FROM feeds").fetchall()]
    return json.dumps(saved_feeds)

@app.route("/add-feed", methods=["POST"])
def addFeed():
    url = request.form.get("url")
    if url:
        console.write("Adding feed %s" % (url,))
        with sqlite3.connect(DB_NAME) as db:
            addFeedToDb(url, db)
    return feeds()

@app.route("/import-opml", methods=["POST"])
def importOpml():
    opmlFile = request.files.get("opml-file")
    if opmlFile:
        dom = xml.dom.minidom.parse(opmlFile)
        feedElements = dom.getElementsByTagName("outline")
        with sqlite3.connect(DB_NAME) as db:
            for fe in feedElements:
                addFeedToDb(fe.getAttribute("xmlUrl"), db)
    return feeds()

@app.route("/feed-entries")
def feedEntries():
    feed_url = request.args.get("url")
    entries = []
    if feed_url is not None:
        with sqlite3.connect(DB_NAME) as db:
            entries = [{"updated": updated,
                        "title": title,
                        "link": link,
                        "content": content}
                       for (updated, title, link, content)
                       in db.execute("SELECT updated, title, url, content FROM entries WHERE feed=?",
                                     [feed_url]).fetchall()]
    return json.dumps(entries)

def addFeedToDb(feedUrl, db):
    if db.execute("SELECT * FROM feeds WHERE url = ?", [feedUrl]).fetchone() is not None:
        console.write("Feed %s already exists" % (feedUrl,))
    else:
        db.execute("INSERT INTO feeds VALUES (?, ?)", [feedUrl, feedUrl])
        db.commit()

#####################
# Feeds
#####################

def fetch_feed(url):
    """Fetch feed, insert new entries into database."""
    def get_text(nodes):
        rc = []
        for node in nodes:
            rc.append(node.data)
        return ''.join(rc)

    try:
        console.write("Fetching feed %s" % (url,))
        feed = urllib2.urlopen(url, timeout=10)
        with sqlite3.connect(DB_NAME) as db:
            dom = xml.dom.minidom.parse(feed)
            feedTitle = get_text(dom.getElementsByTagName("title")[0].childNodes)
            db.execute("UPDATE feeds SET title=? WHERE url=?", [feedTitle, url])
            newEntries = 0
            for entry in dom.getElementsByTagName("entry"):
                title = get_text(entry.getElementsByTagName("title")[0].childNodes)
                content = get_text(entry.getElementsByTagName("content")[0].childNodes)
                alternates = [l
                              for l in entry.getElementsByTagName("link")
                              if l.getAttribute("rel") == "alternate"]
                link = "unknown"
                if len(alternates) > 0:
                    link = alternates[0].getAttribute("href")
                else:
                    link = entry.getElementsByTagName("link")[0].getAttribute("href")
                updated = get_text(entry.getElementsByTagName("updated")[0].childNodes)
                try:
                    db.execute("INSERT INTO entries VALUES (?, ?, ?, ?, ?)",
                               [updated, url, title, link, content])
                    newEntries += 1
                except Exception, e:
                    # We're ignoring entry updates for now.
                    # console.write("problem inserting %s into %s" % (link, url))
                    pass
            db.commit()
            console.write("Inserted %d new entries" % (newEntries,))
        console.write("Fetched feed %s" % (url,))
    except Exception, e:
        console.write("Error processing feed %s:\n%s" % (url, str(e)))

def fetch_feeds():
    """Fetch all feeds in database."""
    with sqlite3.connect(DB_NAME) as db:
        for url in (row[0] for row in db.execute("SELECT url FROM feeds").fetchall()):
            fetch_feed(url)

def periodically_fetch_feeds():
    console.write("- Feed fetcher started")
    while True:
        fetch_feeds()
        time.sleep(10 * 60)     # sleep for 10min

#####################
# Main
#####################

def init_db():
    """Initialise the database, if it does not already exist."""
    if not os.path.exists(DB_NAME):
        with sqlite3.connect("zingr.db") as db:
            db.execute("CREATE TABLE feeds ( title TEXT, url TEXT PRIMARY KEY ) ")
            db.execute("CREATE TABLE entries ( updated TEXT, feed TEXT, title TEXT, url TEXT, content TEXT, CONSTRAINT entries_pkey PRIMARY KEY ( feed, url ) )")
            db.commit()

def main():
    init_db()

    console.start()
    webserver = Thread(target = start_server)
    webserver.daemon = True
    webserver.start()
    feed_fetcher = Thread(target = periodically_fetch_feeds)
    feed_fetcher.daemon = True
    feed_fetcher.start()
    console.write("+ zingr started")

    # see http://www.regexprn.com/2010/05/killing-multithreaded-python-programs.html
    while True:
        try:
            webserver.join(100)
            feed_fetcher.join(100)
        except KeyboardInterrupt as e:
            break

if __name__ == "__main__":
    main()
