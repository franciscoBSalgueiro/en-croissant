# Text-to-Speech Narration Guide

*This guide is also available in:
[Francais](TTS-GUIDE-fr.md) |
[Espanol](TTS-GUIDE-es.md) |
[Deutsch](TTS-GUIDE-de.md) |
[日本語](TTS-GUIDE-ja.md) |
[Русский](TTS-GUIDE-ru.md) |
[中文](TTS-GUIDE-zh.md)*

## Why TTS Changes How You Study Chess

When you're reviewing an annotated game, your eyes are doing double duty. You're trying to follow the pieces on the board *and* read the commentary at the same time. Your gaze bounces between the board and the annotation panel, and every time it does, you lose the position for a split second. You have to re-find the pieces, re-trace the lines, re-build the picture in your head.

Text-to-speech fixes this completely.

With TTS enabled, you step through a game and the annotations are *spoken to you*. Your eyes stay on the board. You watch the knight land on f3 while a voice tells you why it's a strong developing move. You see the pawn structure shift while the commentary explains the strategic idea behind it. The board and the words arrive together, the way a coach sitting across from you would teach.

This is especially powerful for:

- **Opening study** — hear the ideas behind each move while you watch the position develop
- **Game review** — step through your own annotated games and absorb the lessons naturally
- **Endgame practice** — keep your focus on the critical squares while the commentary guides you
- **Language immersion** — study chess in French, German, Spanish, Russian, Japanese, or Chinese with all chess terms properly translated. Hear "Cavalier f3, echec" instead of "Knight f3, check." Learn the game in the language you think in.
- **Accessibility** — for players who find it easier to listen than to read, or who want to study away from a desk

Once you try it, going back to silent annotations feels like watching a movie on mute.

## Choosing a Provider

This version ships with two TTS providers — Google Cloud and ElevenLabs. If there's another provider the community would like to see, let us know and we can add it. You only need one provider to get started — pick whichever suits you best.

|                        | Google Cloud                  | ElevenLabs                    |
|------------------------|-------------------------------|-------------------------------|
| **Free tier**          | 1,000,000 chars/month         | 10,000 chars/month            |
| **Voice quality**      | Very good (WaveNet)           | Excellent (premium AI voices) |
| **Voice selection**    | Male or Female per language   | Dozens of unique characters   |
| **Paid plans**         | Pay-as-you-go (pennies)       | $5/month and up               |
| **Best for**           | Most users                    | Voice quality enthusiasts     |
| **Setup difficulty**   | Moderate (Cloud Console)      | Easy (simple sign-up)         |

**Our recommendation:** Start with **Google Cloud**. The free tier gives you one million characters per month — that's hundreds of fully annotated games, for free. The WaveNet voices sound great. If you later find yourself wanting richer, more expressive narration with more voice personality, ElevenLabs is there for you.

## Setting Up Google Cloud TTS

This walkthrough takes about 5 minutes. You'll need a Google account (the same one you use for Gmail or YouTube works fine).

### Step 1: Sign in to Google Cloud Console

1. Open your browser and go to **[console.cloud.google.com](https://console.cloud.google.com/)**
2. Sign in with your Google account
3. If this is your first time, Google will ask you to agree to the Terms of Service. Check the box and click **Agree and Continue**

You should now see the Google Cloud Console dashboard. It looks busy — don't worry, we only need two things from here.

### Step 2: Set up billing

Google requires a billing account even for their free tier. **You will not be charged** unless you exceed 1 million characters in a month (that's very hard to do with chess annotations). Google shows you a warning well before that happens.

1. In the top search bar, type **"Billing"** and click **Billing** in the dropdown
2. Click **Link a billing account** (or **Create account** if you don't have one yet)
3. Follow the prompts to add a credit card or debit card
4. Once complete, you'll see a green checkmark next to your billing account

> **Note:** If you already have Google Cloud billing set up from another project, you can skip this step. Your existing billing account works fine.

### Step 3: Enable the Text-to-Speech API

This tells Google which service you want to use.

1. In the top search bar, type **"Text-to-Speech"**
2. In the dropdown results, click **Cloud Text-to-Speech API** (it has a blue API icon)
3. You'll land on the API details page. Click the big blue **Enable** button
4. Wait a few seconds. When the button changes to **Manage**, the API is enabled

### Step 4: Create an API key

The API key is what En Croissant uses to talk to Google's servers.

1. In the top search bar, type **"Credentials"** and click **Credentials** under "APIs & Services"
2. Near the top of the page, click **+ Create Credentials**
3. From the dropdown, select **API key**
4. A dialog pops up showing your new key. It looks something like: `AIzaSyC...about 35 characters...`
5. **Click the copy icon** next to the key to copy it to your clipboard
6. Click **Close**

> **Recommended: Restrict your key.** After creating the key, you'll see it listed on the Credentials page. Click the key name to open its settings. Under **API restrictions**, select **Restrict key**, then choose **Cloud Text-to-Speech API** from the dropdown and click **Save**. This means even if someone gets your key, they can only use it for TTS — nothing else.

### Step 5: Configure En Croissant

Almost there!

1. Open En Croissant and go to **Settings** (gear icon) > **Sound** tab
2. Scroll down to the TTS section
3. Set **TTS Provider** to **Google Cloud**
4. Click inside the **Google Cloud API Key** field and paste your key (Ctrl+V)
5. Set **Text-to-Speech** to **On**
6. Click the **Test** button next to the voice selector

You should hear a chess move spoken aloud. If you do — congratulations, you're set up!

> **Troubleshooting:** If the test is silent, double-check that (1) you pasted the full API key, (2) the Text-to-Speech API is enabled (Step 3), and (3) billing is linked (Step 2). The most common issue is forgetting to enable the API.

## Setting Up ElevenLabs

ElevenLabs is simpler to set up but has a smaller free tier (10,000 characters/month — enough for a few games to try it out).

### Step 1: Create an account

1. Open your browser and go to **[elevenlabs.io](https://elevenlabs.io/)**
2. Click **Sign Up** in the top right
3. You can sign up with Google, GitHub, or email — pick whatever's easiest
4. After signing up, you'll land on the ElevenLabs dashboard

### Step 2: Get your API key

1. In the bottom-left corner of the dashboard, click your **profile icon** (or your name)
2. Click **Profile + API key**
3. You'll see an API key section. Click **Reveal** to show your key, or **Generate** if you don't have one yet
4. The key looks like: `sk_...about 30 characters...`
5. **Click the copy icon** to copy it to your clipboard

### Step 3: Configure En Croissant

1. Open En Croissant and go to **Settings** (gear icon) > **Sound** tab
2. Scroll down to the TTS section
3. Set **TTS Provider** to **ElevenLabs**
4. Click inside the **ElevenLabs API Key** field and paste your key (Ctrl+V)
5. The **TTS Voice** dropdown will populate with your available voices. **Adam** is a great default — clear, natural, and works well for chess commentary
6. Set **Text-to-Speech** to **On**
7. Click the **Test** button next to the voice selector

You should hear a chess move spoken aloud.

> **About the free tier:** ElevenLabs gives you 10,000 characters/month on the free plan. A typical annotated game uses 2,000-4,000 characters, so you can review 2-5 games per month for free. If you find TTS valuable, their Starter plan at $5/month (30,000 characters) is a solid upgrade. The Pro plan ($22/month, 100,000 characters) covers heavy use.

## Settings Reference

All TTS settings are in **Settings > Sound**:

| Setting                  | What it does                                                                  |
|--------------------------|-------------------------------------------------------------------------------|
| **Text-to-Speech**       | Master on/off switch for all TTS features                                     |
| **Auto-Narrate on Move** | Automatically speak annotations when you step through moves with arrow keys   |
| **TTS Provider**         | Switch between ElevenLabs and Google Cloud                                    |
| **ElevenLabs API Key**   | Your ElevenLabs API key (only needed if using ElevenLabs)                     |
| **Google Cloud API Key** | Your Google Cloud API key (only needed if using Google)                        |
| **TTS Voice**            | ElevenLabs: choose from your voices. Google: choose Male or Female            |
| **TTS Language**         | Language for narration — all chess terms are translated automatically          |
| **TTS Volume**           | How loud the narration plays                                                  |
| **TTS Speed**            | Playback speed (0.5x to 2x) — adjusts instantly without re-generating audio   |
| **TTS Audio Cache**      | Clear cached audio to force re-generation (useful after editing annotations)  |

## Supported Languages

TTS narration currently supports seven languages with fully translated chess vocabulary:

| Language           | Chess example                                      |
|--------------------|-----------------------------------------------------|
| **English**        | Knight f3, check. A strong developing move.         |
| **Francais**       | Cavalier f3, echec. Un coup de developpement fort.  |
| **Espanol**        | Caballo f3, jaque. Un fuerte movimiento.            |
| **Deutsch**        | Springer f3, Schach. Ein starker Entwicklungszug.   |
| **日本語**          | ナイト f3、チェック。強い展開の手。                      |
| **Русский**        | Конь f3, шах. Сильный развивающий ход.              |
| **中文**            | 马 f3，将军。一步控制中心的强力出子。                    |

Every chess term — piece names, "check", "checkmate", "castles", "takes", move quality annotations like "Brilliant move" and "Blunder" — is spoken in the selected language. Comments in your PGN files are spoken as written, so annotate your games in the language you want to hear.

## Tips for the Best Experience

- **Use Auto-Narrate.** Turn on "Auto-Narrate on Move" and just use your arrow keys to step through games. The commentary arrives naturally as you move, like having a coach at your shoulder.

- **Annotate your own games.** TTS really shines when you're listening to commentary on *your* games. Annotate your games, then step through them with narration. Hearing "Grabbing the pawn looks tempting, but your entire kingside is still asleep" while staring at the position hits different than reading it.

- **Try different speeds.** Some players like 1x for careful study, others prefer 1.3x for faster review. The speed slider adjusts playback in real-time without using additional API characters — the audio is generated once and played back faster.

- **Use the speaker icon.** Every comment in the move list has a small speaker icon. Click it to hear just that one annotation without stepping through the whole game.

- **Switch languages to learn chess vocabulary.** If you're studying chess in a second language, set the TTS language to match. You'll naturally pick up terms like "Cavalier" (Knight), "echec" (check), and "mat" (checkmate) just by listening.

## About This Feature

En Croissant is an open-source chess study tool created by [Francisco Salgueiro](https://github.com/franciscoBSalgueiro). Francisco built something genuinely special — a free, powerful, community-driven platform for studying chess — and released it under the GPL-3.0 license so that anyone can use it, improve it, and share it. This TTS feature exists because of that generosity. We're grateful for the foundation he built, and we're proud to contribute back to it.

The TTS plugin was developed by Darrell at [Red Shed](mailto:darrell@redshed.ai), with the help of [Claude Code](https://claude.ai/claude-code). Multi-language support, dual-provider integration, translated chess vocabulary across seven languages — built from source, tested by hand, and contributed with care.

That's the beauty of open source. Someone builds something great. Someone else adds to it. Everyone benefits.

## Get in Touch

We're excited about this feature and we'd love to hear how it's working for you. Comments, suggestions, and feedback are always welcome.

- **Want a language we don't support yet?** Let us know — we can add new languages quickly.
- **Found a bug?** Tell us and we'll fix it fast.
- **Have an idea for another TTS provider?** We're happy to add it.
- **Just want to say it's working?** That's great to hear too.

Open an issue here on GitHub, or reach out directly at **[darrell@redshed.ai](mailto:darrell@redshed.ai)**.
