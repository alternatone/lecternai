#!/usr/bin/env python3
"""
Simple HTTP server with no-cache headers to prevent glitchy loads
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class NoCacheHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable all caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress logging for cleaner output
        pass

if __name__ == '__main__':
    PORT = 8000
    os.chdir('/Users/micah/LecternAI')

    server = HTTPServer(('', PORT), NoCacheHTTPRequestHandler)
    print(f'Server running at http://localhost:{PORT}/')
    print('Press Ctrl+C to stop')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
        server.shutdown()
