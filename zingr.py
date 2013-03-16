#!/usr/bin/python

from __future__ import print_function

from flask import Flask, send_from_directory, request
app = Flask(__name__)

from threading import Thread
from Queue import Queue

import json

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

my_feeds = [{"title": "alex", "url": "alexUrl"},
         {"title": "max", "url": "maxUrl"}]

@app.route("/")
def index():
    return send_from_directory(app.root_path, "index.html")

@app.route("/r/<path:filename>")
def resource(filename):
    return send_from_directory("r", filename)

@app.route("/feeds")
def feeds():
    return json.dumps(my_feeds)

@app.route("/addfeed")
def addFeed():
    url = request.args.get("url")
    console.write("Adding feed %s" % (url,))
    my_feeds.append({"title": url, "url": url})
    return json.dumps(my_feeds)

#####################
# Feeds
#####################

def periodically_fetch_feeds():
    console.write("- Feed fetcher started")

#####################
# Main
#####################

def main():
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
