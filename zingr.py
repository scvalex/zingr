#!/usr/bin/python

from __future__ import print_function

from flask import Flask
app = Flask(__name__)

from threading import Thread

#####################
# Web front-end
#####################

@app.route("/")
def index():
    return "Works"

#####################
# Feeds
#####################

def periodically_fetch_feeds():
    print("- Feed fetcher started")

#####################
# Main
#####################

def main():
    webserver = Thread(target = app.run)
    webserver.daemon = True
    webserver.start()
    feed_fetcher = Thread(target = periodically_fetch_feeds)
    feed_fetcher.daemon = True
    feed_fetcher.start()
    print("+ zingr started")

    # see http://www.regexprn.com/2010/05/killing-multithreaded-python-programs.html
    while True:
        try:
            webserver.join(100)
            feed_fetcher.join(100)
        except KeyboardInterrupt as e:
            break

if __name__ == "__main__":
    main()
