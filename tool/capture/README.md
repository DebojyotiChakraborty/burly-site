# Re-capturing the app screens

The phone mockups use real simulator screenshots of the Burly app, one set per
theme in `media/screens/{dark,light}/`. To refresh them:

1. Copy `site_capture_tour_test.dart` into the app repo's `integration_test/`.
2. Shift the sample backup so the latest session was yesterday:
   `python3 shift_sample_dates.py <app>/tool/samples/burly-sample-backup.json /tmp/shifted.json`
3. Boot an iPhone 17 simulator, clean its status bar:
   `xcrun simctl status_bar <udid> override --time 9:41 --wifiBars 3 --cellularBars 4 --batteryState charged --batteryLevel 100`
4. Start the watcher: `./site_shot_host.sh <udid> /tmp/shots/dark &`
5. Run the tour from the app repo (fresh install, one theme per run):
   ```
   FLUTTER_XCODE_ARCHS=arm64 FLUTTER_XCODE_ONLY_ACTIVE_ARCH=YES \
   flutter test integration_test/site_capture_tour_test.dart -d <udid> \
     --dart-define=SAMPLE_PATH=/tmp/shifted.json \
     --dart-define=SHOT_DIR=/tmp/shots/dark --dart-define=SITE_THEME=dark
   ```
6. Repeat for `light`, then `./to_webp.py /tmp/shots/dark ../../media/screens/dark`
   (and the same for light): 1206 x 2622 PNG to 804 x 1748 WebP at quality 84.

The tour drops a request file per stop; the watcher takes `simctl io screenshot`
(status bar and Dynamic Island included) and removes the request.
