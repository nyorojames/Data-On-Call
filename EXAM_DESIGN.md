# Exam & Scenario Design (SINAV_TASARIMI)

## 1. Exam Scenario

During the verification of Data On-Call v2, a test engineer evaluates client-side risk inference for an on-call student entering Scene 2 under Experienced mode. For the feature vector `[1, 0, 2, 0, 1, 0, 28.4]`, the in-browser ONNX Runtime Web engine yields:
$$\hat{p}_{\text{web}} = 0.769459$$
Meanwhile, the Python training pipeline (`tests/parity.py` using Scikit-Learn and native `onnxruntime`) computes:
$$\hat{p}_{\text{python}} = 0.769461$$

---

## 2. Exam Question

> **Question:**  
> 1. Is this discrepancy a software defect (bug)? Explain your reasoning based on the observed numbers.  
> 2. What specific testing technique identified this discrepancy? What serves as the test oracle here?  
> 3. What technical factors would you investigate first to explain the numerical difference?  
> 4. What absolute error tolerance would you establish for this system, and why is this tolerance safe for downstream gameplay decisions?

---

## 3. Expected Core Concepts & Grading Rubric

A complete, high-scoring response must correctly demonstrate and connect four software engineering and testing principles:

1. **Differential Testing (Back-to-Back Testing):**
   - The student recognizes that identical inputs were provided to two distinct implementations/runtimes of the exact same specification (Python C-runtime vs. browser WebAssembly). The test compares their outputs without relying on hardcoded expected values.
2. **Pseudo-Oracle / Reference Oracle:**
   - In machine learning deployment, ground truth labels are absent during runtime inference. The Python training pipeline and scikit-learn model serve as the reference test oracle against which the client-side JavaScript/WASM deployment is verified.
3. **Tolerance & Floating-Point Representation ($10^{-4}$):**
   - The observed difference is $|\hat{p}_{\text{web}} - \hat{p}_{\text{python}}| = |0.769459 - 0.769461| = 2 \times 10^{-6}$.
   - This difference is **not a bug**; it is expected numerical variation arising from 32-bit single-precision (`float32`) arithmetic in WebAssembly matrix kernels versus 64-bit double-precision (`float64`) arithmetic in native Python/NumPy, as well as distinct compilation flags (SIMD vectorization, fused multiply-add orders).
   - A tolerance threshold of $\epsilon = 10^{-4}$ ($0.0001$) is standard and appropriate because it is two orders of magnitude tighter than the game's decision boundary margins ($p = 0.50$ adaptive coach trigger and $p = 0.75$ timer-pause threshold).
4. **Verification vs. Validation:**
   - **Verification ("Did we build the system right?"):** Parity testing verifies that the ONNX WebAssembly engine faithfully evaluates the mathematical weights learned during training.
   - **Validation ("Did we build the right system?"):** Cross-validation accuracy gates and player outcome evaluations validate whether the risk predictions actually improve student learning and game engagement.

---

## 4. Distractors and Common Misconceptions

- **Distractor 1: Calling it "Regression Testing"**
  - *Why students pick it:* The parity check runs inside continuous integration before release, looking similar to a regression suite that prevents breaking changes.
  - *Why it is incorrect/incomplete:* Regression testing checks whether existing functionality broke across code versions over time. Parity testing here is cross-implementation differential testing across two active runtime environments at the same point in time.
- **Distractor 2: "The model is wrong / underperforming"**
  - *Why students pick it:* Learners frequently conflate statistical error (loss function, classification error against real human labels) with numerical calculation error (IEEE 754 precision differences between runtimes).
  - *Why it is incorrect:* Both runtimes evaluate the exact same model weights. A difference of $2 \times 10^{-6}$ has zero relationship to model accuracy or predictive capacity.
- **Distractor 3: Demanding Exact Equality (`actual === expected`)**
  - *Why students pick it:* Habit from deterministic unit testing where strings or integers must match bit-for-bit.
  - *Why it is incorrect:* Exact equality assertions on floating-point predictions across compilers and hardware architectures create fragile, brittle tests that fail on valid executions.

---

## 5. Why This Question Resists Memorization

This question cannot be solved by reciting definitions:
- It requires the student to compute and contextualize the numerical delta ($0.000002$) relative to the decision thresholds ($0.50$ and $0.75$).
- The student must evaluate whether a microscopic deviation impacts state machine transitions in the gameplay loop (both $0.769459$ and $0.769461$ exceed $0.75$, triggering the proactive coach and pausing the countdown timer identically).
- It forces differentiation between software verification (mathematical parity across runtimes) and machine learning validation (statistical generalization on student telemetry).
