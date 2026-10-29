# questions.md: Tutor question bank (level x goal)

The tutor's **opening question** for each decision is pre-written from this table, so the app behaves the same way every time (and Cypress can test it). The AI tutor (Gemini) only handles the player's **follow-up replies**, and it is told the player's level and goal.

## How the two settings work

- **Level changes the depth.** Beginner asks about concepts and meaning. Experienced asks about trade-offs, edge cases and production decisions.
- **Goal changes the content, not only the wording.** Each goal pulls the same incident toward a different set of skills:
  - **Internship prep:** the fundamentals that junior data engineering interviews commonly cover (what a pipeline is, safe re-runs, data checks, handling personal data). Framed as "An interviewer asks".
  - **Keep up with trends:** current practice (streaming vs batch, data contracts, data observability, privacy by default).
  - **Use AI effectively:** verifying, bounding and owning AI-generated work.

## Decision 1: Architecture (roll back vs patch live)

| Goal | Beginner | Experienced |
|---|---|---|
| Internship prep | "An interviewer asks: what is a data pipeline, and what could break in it when the database structure changes in a new release?" | "An interviewer asks: how do you make a pipeline safe to re-run, so that a retry or rollback never duplicates or loses data?" |
| Keep up with trends | "Many teams now process data as a live stream instead of in nightly batches. What is the difference, and why does it matter when a release breaks something?" | "Data contracts are a growing practice. How would an agreed contract between the app team and your pipeline have caught this change before it shipped?" |
| Use AI effectively | "If an AI assistant told you to patch the live system, what would you want to check before trusting it?" | "An AI agent proposes a hot patch with a clean diff. What evidence would you require before it touches production, and who owns that decision?" |

## Decision 2: Data quality (validate a sample vs backfill everything)

| Goal | Beginner | Experienced |
|---|---|---|
| Internship prep | "An interviewer asks: what are three simple checks you would run on a new dataset to see whether it can be trusted?" | "An interviewer asks: how would you validate a backfill before it overwrites production tables, and how would you undo it if it went wrong?" |
| Keep up with trends | "Teams now watch data the way they watch servers (data observability). What would you monitor to know the data is fresh and complete?" | "How would automated freshness, volume and schema alerts have caught this before the ops manager did, and which would you set up first?" |
| Use AI effectively | "An AI suggests a quick fix for the bad readings. How could you check it worked without trusting it blindly?" | "The AI's fix passes its own tests. How do you build an independent check, and what would its tests not catch?" |

## Decision 3: Privacy (mask vs share as-is)

| Goal | Beginner | Experienced |
|---|---|---|
| Internship prep | "An interviewer asks: what is personal data, and why shouldn't it appear in logs shared with the whole team?" | "An interviewer asks: how would you design logging so personal data never appears, instead of masking it afterwards?" |
| Keep up with trends | "Many companies now mask personal data by default, and laws like Kenya's Data Protection Act push them to. What does 'by default' change about how you build a pipeline?" | "Compare masking, tokenizing and dropping fields at ingestion. What does each cost you when debugging?" |
| Use AI effectively | "If you paste these logs into an AI assistant, where might the data go, and what should you remove first?" | "Your team wants an LLM for incident triage. What data boundary would you set, and how would you enforce it in the pipeline?" |

## Hints (Beginner only, one per decision, always a question)

1. "Think about what a rollback restores. Does it also restore the data that was written meanwhile?"
2. "What is the smallest check you could run in two minutes that would tell you if the data is trustworthy?"
3. "Who needs to see the raw rider details to fix this, and who does not?"

## Consequence text depth

- **Beginner:** the "What happened and why" panel defines the key term in plain words (for example, what a backfill is).
- **Experienced:** the panel is two sentences and names the trade-off, with no definitions.
