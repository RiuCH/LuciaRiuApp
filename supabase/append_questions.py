#!/usr/bin/env python3
"""Append newly-added BANK questions to a Supabase project that already has rows.

Why not just re-run seed_questions.sql? Because `delete from questions` +
re-insert renumbers every id, and loadQuestions() rebuilds the bank in id
order — a full reseed is fine, but appending is non-destructive and keeps
per-category order aligned with BANK as long as new questions are added at
the END of their category array (which is the convention).

    export LR_TOKEN="$(open the app, sign in, run authToken() in the console)"
    python3 supabase/append_questions.py            # dry run: shows the diff
    python3 supabase/append_questions.py --apply    # actually insert

Reads SUPABASE_URL / SUPABASE_ANON_KEY from js/supabase.js.

AUTHENTICATION — read this before running it.
Since supabase/auth_policies.sql (v10), `questions` is `to authenticated
using (public.is_us())` and there is NO policy for anon. The anon key
therefore reads ZERO rows — PostgREST returns an empty array rather than an
error — so this script used to conclude the table was empty and offer to
append the entire bank. Running that against a populated table would have
duplicated every question and desynced the online and offline decks forever.

So it now needs a real user token in LR_TOKEN. Get one by opening the
deployed app, signing in, and running authToken() in the browser console;
it lasts about an hour, which is plenty. Without it the script refuses to
do anything rather than guessing.
"""
import json
import os
import re
import sys
import urllib.request

from generate_seed import CATS, ROOT, load_bank


def config():
    src = open(os.path.join(ROOT, "js", "supabase.js"), encoding="utf-8").read()
    url = re.search(r'SUPABASE_URL\s*=\s*"([^"]*)"', src).group(1)
    key = re.search(r'SUPABASE_ANON_KEY\s*=\s*"([^"]*)"', src).group(1)
    assert url and key, "Supabase is not configured in js/supabase.js"
    return url.rstrip("/"), key


def bearer(key):
    """The user JWT if we were given one, else the anon key.

    RLS is the reason: `questions` is us-only, so the anon key can neither
    read nor write it. The anon key path is kept only for a project that
    hasn't run auth_policies.sql yet.
    """
    return os.environ.get("LR_TOKEN") or key


def request(url, key, path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url + "/rest/v1/" + path, data=data, method=method)
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + bearer(key))
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=representation")
    with urllib.request.urlopen(req) as res:
        text = res.read().decode()
    return json.loads(text) if text else None


def main():
    apply = "--apply" in sys.argv
    url, key = config()
    bank = load_bank()
    rows = request(url, key, "questions?select=id,category,text&order=id.asc")

    # An empty read is far more likely to be RLS silently filtering us out
    # than a genuinely empty table — the anon key gets exactly this result on
    # any project that has run auth_policies.sql. Appending the whole bank on
    # that assumption would duplicate every existing row, so refuse.
    if not rows and not os.environ.get("LR_TOKEN"):
        sys.exit(
            "ABORT: read 0 questions with the anon key.\n"
            "Since auth_policies.sql, `questions` is us-only and anon sees nothing —\n"
            "so this is almost certainly a permissions problem, not an empty table.\n"
            "Set LR_TOKEN to a signed-in user's JWT (authToken() in the browser\n"
            "console) and try again. For a genuinely fresh project, use\n"
            "generate_seed.py + seed_questions.sql instead."
        )

    db = {}
    for r in rows:
        db.setdefault(r["category"], []).append(r["text"])

    to_add = []
    for cat in CATS:
        have, want = db.get(cat, []), bank[cat]
        # the rows already stored must be a prefix of BANK, or order has drifted
        if have != want[:len(have)]:
            sys.exit(
                "ABORT: stored '%s' questions are not a prefix of BANK — order has\n"
                "drifted, so appending would desync online and offline phones.\n"
                "Fix BANK, or do a full reseed (see docs/SUPABASE.md)." % cat
            )
        for q in want[len(have):]:
            to_add.append({"category": cat, "text": q})
        print("%-9s db=%-4d bank=%-4d new=%d" % (cat, len(have), len(want), len(want) - len(have)))

    if not to_add:
        print("\nNothing to add — the DB already matches BANK.")
        return
    print("\n%d question(s) to append." % len(to_add))
    if not apply:
        print("Dry run. Re-run with --apply to insert them.")
        return
    request(url, key, "questions", method="POST", body=to_add)
    print("Inserted. Verifying…")
    rows = request(url, key, "questions?select=id,category,text&order=id.asc")
    db = {}
    for r in rows:
        db.setdefault(r["category"], []).append(r["text"])
    ok = all(db.get(c) == bank[c] for c in CATS)
    print("DB now matches BANK exactly:", ok, "| total", len(rows))
    if not ok:
        sys.exit("MISMATCH — inspect the questions table before shipping.")


if __name__ == "__main__":
    main()
