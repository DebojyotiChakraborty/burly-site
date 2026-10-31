#!/usr/bin/env python3
"""Shifts every date in a Burly sample backup so the latest workout landed
yesterday evening: the home rings and the calendar then show a full week.

    shift_sample_dates.py <in.json> <out.json>
"""
import json
import re
import sys
from datetime import datetime, timedelta, timezone

ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$")
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse(s):
    return datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)


def main(src, dst):
    data = json.load(open(src))
    latest = max(parse(w["endedAt"]) for w in data["workouts"] if w.get("endedAt"))
    target = (datetime.now(timezone.utc) - timedelta(days=1)).replace(
        hour=18, minute=10, second=0, microsecond=0
    )
    delta = target - latest

    def shift(o):
        if isinstance(o, dict):
            return {k: shift(v) for k, v in o.items()}
        if isinstance(o, list):
            return [shift(x) for x in o]
        if isinstance(o, str) and ISO.match(o):
            return (parse(o) + delta).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        if isinstance(o, str) and DAY.match(o):
            return (datetime.strptime(o, "%Y-%m-%d") + delta).strftime("%Y-%m-%d")
        return o

    json.dump(shift(data), open(dst, "w"))
    print(f"shifted by {delta} -> latest session {target.date()}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
