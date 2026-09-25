#!/bin/bash
# Double-click to serve Trap Room to phones, tablets and computers on your
# home Wi-Fi. Only devices on the same network can reach it; your router
# keeps it off the public internet. Keep this window open while playing,
# and close it (or press Ctrl+C) to stop.

cd "$(dirname "$0")" || exit 1
PORT=8080
IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)

echo ""
echo "  Trap Room is running on your home network."
echo "  On any device on your Wi-Fi, open one of these:"
echo ""
echo "    http://$(scutil --get LocalHostName).local:$PORT"
echo "    http://$IP:$PORT"
echo ""
echo "  Keep this window open while playing. Close it to stop."
echo ""

# caffeinate keeps the Mac from falling asleep (which would cut players off)
# for as long as the server runs.
exec caffeinate -i python3 - "$PORT" <<'PY'
import http.server
import sys

class GameOnly(http.server.SimpleHTTPRequestHandler):
    # Serve the game, not hidden folders (.git, .claude) or notes.
    def send_head(self):
        path = self.path.split('?')[0].split('#')[0]
        if any(part.startswith('.') for part in path.split('/')) or path.endswith(('.md', '.rules', '.command')):
            self.send_error(404)
            return None
        return super().send_head()

    # Always check for a newer copy, so devices pick up game updates.
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *args):
        pass

http.server.ThreadingHTTPServer(('0.0.0.0', int(sys.argv[1])), GameOnly).serve_forever()
PY
