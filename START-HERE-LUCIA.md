# Hi Lucia! 💖 Your complete setup guide (from absolute zero)

This guide assumes you have **never used a developer tool in your life**.
That's fine. You'll copy-paste maybe 8 commands, click a few buttons, and
at the end you'll be able to say *"add a game where..."* to Claude and
watch it appear on both our phones. Estimated time: ~30 minutes.

If anything looks scary or errors out: screenshot it and send it to Riu.
Nothing here can break your computer.

---

## Part 0: How this all works (2-minute crash course)

Before the buttons, the big picture — five words you'll see everywhere:

- **Repository ("repo")** — a shared project folder that remembers every
  version of every file, forever. Ours lives on GitHub (a website that
  hosts repos) and contains basically one important file: `index.html`,
  which IS the whole app.
- **Commit** — a save point, like a checkpoint in a game. "Added 10
  questions" = one commit. You can always go back to any checkpoint,
  which is why you can't really break anything.
- **Push / Pull** — sync. *Push* = upload your new commits to GitHub.
  *Pull* = download the latest ones (e.g. things I built while you slept).
- **Pull Request ("PR")** — a proposed change, shown side-by-side with
  what it changes, that the other person can look at before it goes live.
  Think "hey, look this over before we ship it." For small safe stuff we
  skip PRs and push directly; for bigger things a PR is polite.
- **Deploy** — making the change live on the real website. Ours is
  automatic: the moment anything lands on the `main` branch of our repo,
  a service called **Vercel** notices and updates
  https://lucia-riu-app.vercel.app within about a minute. There is no
  "upload" step. Push → wait 60 seconds → refresh phone → it's live.

So the whole lifecycle of a feature is:

```
you describe idea → Claude edits index.html → you test it in your browser
→ commit → push (maybe via a PR) → Vercel deploys → we both refresh 💞
```

That's it. Everything below is just installing the tools that let your
Mac do the middle steps.

---

## Part 1: Meet the Terminal

The Terminal is a text window where you type commands instead of clicking.
Developers live here. You'll only visit.

1. Press **⌘ + Space** (Command + Space) to open Spotlight search.
2. Type `terminal` and press **Enter**.
3. A window opens with something like `lucia@Lucias-MacBook ~ %` and a
   blinking cursor. That's the "prompt" — it's waiting for you.

**How to use it:** copy a command from this guide, click the Terminal
window, paste with **⌘ + V**, press **Enter**, wait until the prompt
comes back. That's the entire skill.

> 💡 Tip: keep this guide open on your phone or in a browser half-screen
> next to Terminal.

---

## Part 2: Install the Apple developer basics

This gives your Mac `git` (the tool that does commits/pushes). Paste:

```
xcode-select --install
```

A popup appears → click **Install** → agree → wait (5–10 min). If it says
*"already installed"*, even better — skip ahead.

---

## Part 3: Install Homebrew

Homebrew is an app store for developer tools, used from the Terminal.
Paste this whole line (it's one command, from the official site
[brew.sh](https://brew.sh)):

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

- It will ask for your **Mac login password**. Type it — the cursor won't
  move and nothing will appear as you type. That's normal. Press Enter.
- Press **Enter** again when it asks to confirm.
- ⚠️ **Important:** when it finishes, it prints a section called
  **"Next steps"** with 2 commands to paste (they start with `echo` and
  `eval`, and put brew on your PATH). Paste those two lines too, or
  your Mac won't find the `brew` command afterward.

Check it worked:

```
brew --version
```

If you see a version number, you now have developer superpowers.

---

## Part 4: Install the GitHub tool (`gh`)

```
brew install gh
```

`gh` lets your Terminal talk to GitHub (log in, clone our repo, open PRs)
without you ever touching passwords or keys manually.

---

## Part 5: Your GitHub account + our repo

1. If you don't have a GitHub account: go to [github.com](https://github.com)
   → **Sign up** (use any email, pick a fun username).
2. Check your email for the invitation to **RiuCH/LuciaRiuApp** →
   click **Accept invitation**. (No email? Tell Riu to re-invite you.)

---

## Part 6: Connect your Mac to GitHub (the SSH key, the easy way)

**What's an SSH key?** A matched pair of files: a *private key* that stays
on your Mac (like your house key) and a *public key* you give to GitHub
(like the lock that only your key opens). Once GitHub has your public key,
your Mac can push/pull without typing a password ever again.

The `gh` tool does the whole ceremony for you:

```
gh auth login
```

It will ask questions — answer with arrow keys + Enter:

1. **What account do you want to log into?** → `GitHub.com`
2. **Preferred protocol?** → `SSH`
3. **Generate a new SSH key to add to your GitHub account?** → `Yes`
4. **Enter a passphrase** → just press **Enter** (empty is fine for us)
5. **Title for your SSH key** → press **Enter** to accept the default
6. **How to authenticate?** → `Login with a web browser`
7. It shows a **one-time code** like `AB12-CD34`. Copy it, press Enter —
   your browser opens github.com → paste the code → **Authorize**.

Verify the handshake:

```
ssh -T git@github.com
```

First time it asks *"Are you sure you want to continue connecting?"* —
type `yes` + Enter. Success looks like:
`Hi <your-username>! You've successfully authenticated...` 🎉

<details>
<summary>😤 The manual way (only if <code>gh</code> misbehaves — click to expand)</summary>

```
ssh-keygen -t ed25519 -C "your-email@example.com"
```
Press Enter at every question. Then copy your public key to the clipboard:
```
pbcopy < ~/.ssh/id_ed25519.pub
```
Now on github.com: click your avatar (top-right) → **Settings** →
**SSH and GPG keys** → **New SSH key** → Title: "Lucia's MacBook" →
paste into the Key box (⌘+V) → **Add SSH key**.
Then test with `ssh -T git@github.com` as above.
</details>

---

## Part 7: Get the app onto your Mac

```
cd ~/Desktop
gh repo clone RiuCH/LuciaRiuApp
cd LuciaRiuApp
```

(`cd` means "go into this folder".) You now have the whole app on your
Desktop in a folder called `LuciaRiuApp`. Peek at it working:

```
open index.html
```

The app opens in your browser, straight from the file. That's the entire
"development environment" — no servers, nothing else to run.

---

## Part 8: Install Claude Code

Claude Code is Claude living in your Terminal, with permission to edit
files and run commands. Install ([docs](https://claude.com/claude-code)):

```
curl -fsSL https://claude.ai/install.sh | bash
```

Then close the Terminal window entirely (⌘+Q) and open a fresh one
(Part 1 again) so it picks up the new command.

> 🖥️ Prefer clicking to typing? The **Claude desktop app**
> (claude.ai/download) has Claude Code built in — you can point it at the
> `LuciaRiuApp` folder instead. Everything else in this guide still
> applies; only the window looks different.

---

## Part 9: One-time project setup, then BUILD

```
cd ~/Desktop/LuciaRiuApp
bash setup-claude.sh
claude
```

First run of `claude` asks you to log in with your Claude account
(browser opens, click approve). Then you're in a chat — in the Terminal!
Say:

> **Read CLAUDE.md, then let's build.**

Claude reads the project rules and our skills, and from then on you just
talk:

> *"Add 10 more funny questions but make them about food"*
> *"I want a game where we both get the same daily dare"*
> *"Make an 'our songs' tab where each day recommends one song"*

Claude knows the house rules (no build step, keep it cute, don't break
the daily question) and the whole workflow — including checking
`SESSIONS.md` so we don't collide if we're both building at once.

---

## Part 10: Your everyday loop (after today, this is ALL you do)

1. Open Terminal → `cd ~/Desktop/LuciaRiuApp` → `claude`
2. Ask Claude to **pull the latest** ("pull first!") — it grabs anything
   I've shipped since your last session.
3. Describe your idea. Chat until it's right.
4. Test: `open index.html` (or ask Claude to open it) — click around,
   make sure it works and nothing exploded.
5. Tell Claude: **"commit and push"** (small change) or
   **"create a PR"** (big change you want me to see first — I'll get a
   notification, review it, and merge).
6. ~1 minute later the live app is updated. Refresh your phone. Text me
   something smug. 😌

### Cheat sheet

| You want to... | Type / say |
|---|---|
| Go into the app folder | `cd ~/Desktop/LuciaRiuApp` |
| Start Claude | `claude` |
| See the app locally | `open index.html` |
| Get my latest changes | tell Claude: *"pull the latest"* |
| Ship your change | tell Claude: *"commit and push"* |
| Propose instead of ship | tell Claude: *"create a PR"* |
| Panic button | screenshot → send to Riu 💌 |

### If something goes wrong

- **`command not found: brew`** → redo the two "Next steps" lines from
  Part 3, or just close Terminal and open a new one.
- **`Permission denied (publickey)`** → Part 6 didn't finish; run
  `gh auth login` again and choose SSH → Yes.
- **Password prompt shows nothing when typing** → normal! Type it blind
  and press Enter.
- **App looks broken after your change** → tell Claude *"undo that last
  change"* or *"revert to the last commit"*. Checkpoints, remember?
- **Anything else** → Claude is sitting right there. Paste the error into
  the chat and ask. Debugging is 90% of what it's good at.

---

Welcome to the dev team. Population: 2. 💞
