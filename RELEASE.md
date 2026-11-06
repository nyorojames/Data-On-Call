# Release Notes & Production Architecture - Data On-Call v2.0

---

## 1. What v2.0 Is

Data On-Call v2.0 integrates an automated machine learning inference pipeline and runtime adaptive tutoring into the scenario game. 

- **Demo Model on Synthetic Data:** The model deployed with this release is a **demo model** trained on synthetic simulation telemetry (`data/synthetic_dev.csv`) generated using [`scripts/make_synthetic.py`](scripts/make_synthetic.py) (seed `42`, base log-odds intercept `-0.85`, ~46% risky choice rate).
- **Real-Data Model Gate Failure:** In accordance with our pre-registered evaluation protocol, the model trained on genuine player data from `data/sessions.csv` strictly **failed** its evaluation gate (out-of-fold accuracy `0.4444` vs majority baseline `0.5741`, ROC AUC `0.4215`; threshold `0.60`). Therefore, **no model learned from real player data was published**. Full audit telemetry is preserved in [`docs/training_run1.txt`](docs/training_run1.txt) and provenance is documented in [`docs/DATA_DECISIONS.md`](docs/DATA_DECISIONS.md).
- **Transparent User Interface:** In-game adaptation is explicitly labeled in the UI as `Adaptive tutor (demo model, synthetic data): risk <p>` to ensure complete transparency.

---

## 2. Release Artifacts & Integrity

The production model artifacts are hosted on Hugging Face Hub, pinned immutably to git commit `59593ba0b88e0bc087ff8f66f3899120e7c35cec`.

- **Base URL:** `https://huggingface.co/Nyoro012/data-on-call-demo-model/resolve/59593ba0b88e0bc087ff8f66f3899120e7c35cec/`
- **Repository:** [Nyoro012/data-on-call-demo-model](https://huggingface.co/Nyoro012/data-on-call-demo-model)
- **Artifact Hashes:**
  - `model.onnx`: `91bca9e20ad87e43f5eec7b71356a4953feaef31c13ce129fd0665d078fb5c57`
  - `config.json`: `8a116bacdebfdcf51abdf32c50f4e1e6f1b131ae1528d42c123c2055e4539049`
  - Model Card: [`model/README.md`](model/README.md) documenting training provenance, features, and license.

All hashes match byte-for-byte across local build outputs and remote downloads.

---

## 3. Rollback & Fail-Safe Mechanisms

1. **Immediate Kill-Switch (`VITE_MODEL_ENABLED=false`):** Setting `VITE_MODEL_ENABLED=false` in `.env.production` immediately disables all model fetches and client-side inference. The client instantly returns to pure v1 gameplay behavior without touching any model assets.
2. **Commit-Pinned Rollback:** To roll back to an earlier model version, update the commit hash in `VITE_MODEL_BASE_URL` in `.env.production` to a prior commit SHA and trigger a deployment. Earlier commit hashes can be inspected in the Hugging Face repository commit history at `https://huggingface.co/Nyoro012/data-on-call-demo-model/commits/main`.
3. **Graceful Runtime Fallback:** If Hugging Face is unreachable, the network is offline, or ONNX WASM fails to initialize, `predictRisk()` catches all exceptions and returns `null`. The game continues uninterrupted with standard v1 behavior and displays no error banners to the player.

---

## 4. Safe Rollout Plan for Future Real Models (Planned, Not Yet Implemented)

> **Notice:** The following rollout strategy is a planned protocol for future production releases upon passing the evaluation gate; it is not yet active for the synthetic demo model.

1. **Shadow Deployment:** Run model inference silently in background playthroughs. The model calculates risk $p$ and logs it alongside the recorded choice without altering UI questions or timers. Shadow accuracy is evaluated against real player outcomes to verify real-world alignment.
2. **Canary Rollout (5%):** Enable active adaptations for 5% of sessions, deterministically assigned using `hash(session_id) % 100 < 5`.
3. **Progressive Rollout (25% → 50% → 100%):** Increment traffic exposure in stages, checking automated stop conditions at every stage.
4. **Automated Stop & Rollback Triggers:**
   - Out-of-fold or online accuracy drops below the pre-registered threshold (`0.60`).
   - Client-side model fetch or inference failure rate exceeds `1.0%`.
   - Prediction distribution drifts significantly from baseline ($D_{\text{KS}} > 0.15$ or median $p$ shifts by $> 0.20$).
   - Any unhandled exception originating from the inference session.

---

## 5. Architectural Trade-Off Matrix

We evaluate three deployment architectures against the three foundational questions:

| Evaluation Dimension | 1. In-Browser ONNX (`onnxruntime-web`) [Chosen] | 2. On-Device Mobile (`onnxruntime-react-native`) | 3. Dedicated Server API (Backend Inference) |
|---|---|---|---|
| **Network Need & Latency** | Model downloaded once and cached. Inference runs locally in $\approx 2\text{ ms}$ with zero network roundtrip per scene. | Zero network need after app installation. Offline inference runs with sub-millisecond native latency. | Requires network call for every decision ($\ge 150\text{ ms}$ latency depending on mobile connectivity). Fails if offline. |
| **Data Leaves Device (KVKK/Privacy)** | **Zero telemetry leaves device** for inference. Feature vector is constructed and evaluated in browser memory. | **Zero telemetry leaves device**. Strictly on-device processing. | Feature vector must be transmitted over HTTPS to backend server, introducing data transfer boundaries. |
| **Model Secrecy & IP Protection** | **Public by design.** Model weights and architecture are downloaded to client and inspectable via dev tools. | Model binary is embedded in app package; extraction requires reverse engineering, but is still possible. | **Highest secrecy.** Model weights stay on private server; only input/output exposed (still vulnerable to black-box extraction). |

### Justification for In-Browser Deployment
For a mobile web educational game running on GitHub Pages:
- **Zero backend operating cost and infinite scalability:** No GPU/CPU server hosting bills or uptime maintenance.
- **Privacy preservation:** Player features never leave the local browser session.
- **Cost of this choice:** The initial load must fetch WASM runtime assets (`~24 MB` uncompressed, cached after first load) and model weights cannot be kept secret. For our open-source pedagogical project, public transparency of model weights is an asset, not a detriment.

---

## 6. Known Limitations

1. **Demo Model:** Model behavior reflects synthetic generation assumptions rather than learned real human psychology.
2. **No Real-Player Generalization:** The real-data model failed its gate on the 54 collected samples; real-world efficacy remains unproven.
3. **Small Empirical Telemetry Sample:** Real data consists of 54 rows across 3 participants (18 sessions total).
4. **Static Page AI Tutor Fallback:** On static GitHub Pages hosting with no server backend, generative AI tutor responses fall back to curated, pre-written Socratic questions.
5. **WASM Cold-Start Latency:** Initial compilation of the single-threaded WebAssembly runtime on lower-end mobile devices can introduce a 1–2 second delay on first load.

---

## 7. The Three V's of Production ML

- **Velocity:** Automated end-to-end retraining and parity verification scripts execute in under 3 minutes (`train_demo.py` and `parity.py`).
- **Validation:** Strict, automated pre-registered gating rules (out-of-fold accuracy $\ge 0.60$ and $>$ majority-class baseline) mechanically blocked the failing real-data model from deployment.
- **Versioning:** Models, configs, and datasets are tracked immutably with SHA-256 digests and pinned to immutable git commit SHAs on Hugging Face Hub (`59593ba0b88e0bc087ff8f66f3899120e7c35cec`).
