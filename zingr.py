#!/usr/bin/python

from __future__ import print_function

from flask import Flask, Response, send_from_directory, request, json
app = Flask(__name__)

from threading import Thread
import xml.dom.minidom
import sqlite3, os, urllib2, time, logging

DB_NAME = "zingr.db"

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
        for feed in saved_feeds:
            count = db.execute("SELECT COUNT(*) FROM entries WHERE feed=? AND read=0",
                               [feed["url"]]).fetchone()[0]
            feed["count"] = count
    return Response(json.dumps(saved_feeds), mimetype="application/json")

@app.route("/add-feed", methods=["POST"])
def addFeed():
    url = request.form.get("url")
    if url:
        app.logger.info("Adding feed %s" % (url,))
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
    return Response(json.dumps(entries), mimetype="application/json")

@app.route("/mark-read", methods=["POST"])
def markRead():
    feed_url = request.args.get("feed_url")
    url = request.args.get("url")
    if feed_url is not None and url is not None:
        with sqlite3.connect(DB_NAME) as db:
            db.execute("UPDATE entries SET read=1 WHERE feed=? AND url=?", [feed_url, url])
    return "ok"

def addFeedToDb(feedUrl, db):
    if db.execute("SELECT * FROM feeds WHERE url = ?", [feedUrl]).fetchone() is not None:
        app.logger.warning("Feed %s already exists" % (feedUrl,))
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
        app.logger.info("Fetching feed %s" % (url,))
        feed = urllib2.urlopen(url, timeout=10)
        with sqlite3.connect(DB_NAME) as db:
            dom = xml.dom.minidom.parse(feed)
            feedTitle = get_text(dom.getElementsByTagName("title")[0].childNodes)
            db.execute("UPDATE feeds SET title=? WHERE url=?", [feedTitle, url])
            newEntries = 0
            for entry in dom.getElementsByTagName("entry") + dom.getElementsByTagName("item"):
                title = get_text(entry.getElementsByTagName("title")[0].childNodes)
                content = "No content"
                link = "unknown"
                updated = "1970-00-00T00:00:00"
                contentElems = entry.getElementsByTagName("content")
                if len(contentElems) > 0:
                    # This looks like RSS
                    content = get_text(contentElems[0].childNodes)
                    alternates = [l
                                  for l in entry.getElementsByTagName("link")
                                  if l.getAttribute("rel") == "alternate"]
                    if len(alternates) > 0:
                        link = alternates[0].getAttribute("href")
                    else:
                        link = entry.getElementsByTagName("link")[0].getAttribute("href")
                    get_text(entry.getElementsByTagName("updated")[0].childNodes)
                else:
                    # This looks like Atom
                    content = get_text(entry.getElementsByTagName("description")[0].childNodes)
                    updated = get_text(entry.getElementsByTagName("pubDate")[0].childNodes)
                    link = get_text(entry.getElementsByTagName("link")[0].childNodes)

                try:
                    db.execute("INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?)",
                               [updated, url, title, link, content, 0])
                    newEntries += 1
                except Exception, e:
                    # We're ignoring entry updates for now.
                    # app.logger.warning("problem inserting %s into %s" % (link, url))
                    pass
            db.commit()
            app.logger.info("Inserted %d new entries" % (newEntries,))
        app.logger.info("Fetched feed %s" % (url,))
    except Exception, e:
        app.logger.warning("Error processing feed %s:\n%s" % (url, str(e)))

def fetch_feeds():
    """Fetch all feeds in database."""
    with sqlite3.connect(DB_NAME) as db:
        for url in (row[0] for row in db.execute("SELECT url FROM feeds").fetchall()):
            fetch_feed(url)

def periodically_fetch_feeds():
    app.logger.info("Feed fetcher started")
    while True:
        fetch_feeds()
        time.sleep(10 * 60)     # sleep for 10min

#####################
# Main
#####################

def init_db():
    """Initialise the database, if it does not already exist."""
    if not os.path.exists(DB_NAME):
        with sqlite3.connect(DB_NAME) as db:
            db.execute("CREATE TABLE feeds ( title TEXT, url TEXT PRIMARY KEY ) ")
            db.execute("CREATE TABLE entries ( updated TEXT, feed TEXT, title TEXT, url TEXT, content TEXT, read INTEGER, CONSTRAINT entries_pkey PRIMARY KEY ( feed, url ) )")
            db.commit()

def main():
    init_db()

    # Setup logging.
    file_handler = logging.FileHandler("zingr.log")
    log_format = "%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]"
    file_handler.setFormatter(logging.Formatter(log_format))
    app.debug_log_format = log_format
    app.logger.setLevel(logging.INFO)
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.info("zingr starting")

    webserver = Thread(target = start_server)
    webserver.daemon = True
    webserver.start()
    feed_fetcher = Thread(target = periodically_fetch_feeds)
    feed_fetcher.daemon = True
    feed_fetcher.start()
    app.logger.info("zingr started")

    # see http://www.regexprn.com/2010/05/killing-multithreaded-python-programs.html
    while True:
        try:
            webserver.join(100)
            feed_fetcher.join(100)
        except KeyboardInterrupt as e:
            break

if __name__ == "__main__":
    main()
