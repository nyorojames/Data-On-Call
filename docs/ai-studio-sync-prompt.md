# Google AI Studio Applet Synchronization Prompt

Copy and paste the entire prompt below into the chat panel of your Google AI Studio applet to ensure its features, safeguards, and test IDs match the repository implementation exactly.

---

```text
Please update the Data On-Call application code to ensure complete synchronization with the repository implementation. Implement the following features, safeguards, and data-testid attributes:

1. AC7 Ending Features:
   - Weakest Skill: In the Ending screen (EndingScreen component), display the player's weakest skill using data-testid="weakest-skill".
     * If all three decisions were Good (0 risky choices), display: "Strong across all three".
     * If 1 or more decisions were risky, display the category of the FIRST risky decision made ("Pipeline architecture", "Data quality", or "Privacy").
   - Goal-Specific Next Step: Display a targeted recommendation based on playerGoal using data-testid="next-step":
     * "Internship prep": "Practice explaining your decision trade-offs aloud as if answering a technical interview question."
     * "Keep up with trends": "Read up on modern stream-processing idempotency patterns and schema drift monitoring."
     * "Use AI effectively": "Review guidelines on prompt boundary hygiene and human-in-the-loop verification before production changes."
   - Level-Change Recommendation Button:
     * If Beginner with 3 Good choices: show button "Try Experienced mode" with data-testid="change-level" that switches the level to "Experienced" and restarts the game.
     * If Experienced with 2 or 3 risky choices: show button "Try Beginner mode" with data-testid="change-level" that switches the level to "Beginner" and restarts the game.
     * Otherwise, do not display this button (or show regular Play Again).

2. "You ran out of time" Alert:
   - In Experienced mode, when the 60-second countdown reaches 0:
     * Automatically record the risky choice (Option B) for the current decision.
     * Open the consequence bottom sheet showing the consequence text along with the message:
       "You ran out of time! In Experienced mode, an on-call data incident forces a decision under pressure. A risky default option was recorded."
     * Wrap this text with data-testid="timeout-message".

3. Answer-Leak Safeguard:
   - Add a filter to both the backend /api/tutor handler and frontend SceneScreen component that intercepts any tutor reply containing recommendation phrases like "choose A", "choose B", "pick A", "pick B", "the answer is", or "yes, it is".
   - If detected, replace the text with the canonical guiding question for the current decision:
     * Decision 1: "Think about what a rollback restores. Does it also restore the data that was written meanwhile?"
     * Decision 2: "What is the smallest check you could run in two minutes that would tell you if the data is trustworthy?"
     * Decision 3: "Who needs to see the raw rider details to fix this, and who does not?"
   - The tutor reply must be displayed inside the container with data-testid="tutor-reply".

4. Ensure all Required data-testid Attributes Exist:
   - Top bar & scene:
     * data-testid="clock" (text "06:45")
     * data-testid="timer" (60s countdown, Experienced only)
     * data-testid="hint-button" (Beginner only)
     * data-testid="hint-text" (revealed hint message)
     * data-testid="option-a", data-testid="option-b", data-testid="option-c"
     * data-testid="consequence" (bottom sheet consequence text)
     * data-testid="next-decision" (button to advance to the next decision)
   - Tutor interface:
     * data-testid="tutor-reply" (container holding the tutor's reply or opening question)
     * data-testid="opening-question" (span containing the opening question or reply)
     * data-testid="tutor-input" (input field for typing questions to the tutor)
     * data-testid="tutor-submit" (submit button)
   - Ending screen:
     * data-testid="ending-title" ("Ending A: Data correct, report on time" or "Ending B: Risky shortcut caused data failure")
     * data-testid="result-architecture" ("Pipeline architecture: Good" or "Risky")
     * data-testid="result-quality" ("Data quality: Good" or "Risky")
     * data-testid="result-privacy" ("Privacy: Good" or "Risky")
     * data-testid="weakest-skill"
     * data-testid="next-step"
     * data-testid="change-level"
     * data-testid="play-again"

5. Model Configuration:
   - Ensure the Gemini API calls for the Socratic tutor use model: "gemini-3.5-flash" (matching process.env.GEMINI_MODEL with default "gemini-3.5-flash").
```
