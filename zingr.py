#!/usr/bin/python

from __future__ import print_function

from flask import Flask, send_from_directory, request
app = Flask(__name__)

from threading import Thread
from Queue import Queue

import json

import sqlite3

import os

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

@app.route("/addfeed")
def addFeed():
    url = request.args.get("url")
    if url:
        console.write("Adding feed %s" % (url,))
        with sqlite3.connect(DB_NAME) as db:
            db.execute("INSERT INTO feeds VALUES (?, ?)", [url, url])
            db.commit()
    return feeds()

#####################
# Feeds
#####################

def periodically_fetch_feeds():
    console.write("- Feed fetcher started")

#####################
# Main
#####################

def init_db():
    if not os.path.exists(DB_NAME):
        db = sqlite3.connect("zingr.db")
        db.execute("CREATE TABLE FEEDS ( title TEXT, url TEXT )")
        db.close()

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
