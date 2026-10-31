#!/bin/bash
# Takes a simulator screenshot for every request file the capture tour drops.
#   site_shot_host.sh <udid> <shot dir> [max seconds]
UDID="$1"; DIR="$2"; MAX="${3:-2400}"
mkdir -p "$DIR/req"
end=$((SECONDS + MAX))
while [ $SECONDS -lt $end ]; do
  for f in "$DIR"/req/*; do
    [ -e "$f" ] || continue
    n=$(basename "$f")
    sleep 0.25
    xcrun simctl io "$UDID" screenshot "$DIR/$n.png" >/dev/null 2>&1
    rm -f "$f"
    echo "shot $n $(date +%H:%M:%S)"
  done
  [ -e "$DIR/STOP" ] && { rm -f "$DIR/STOP"; echo stopped; break; }
  sleep 0.15
done
