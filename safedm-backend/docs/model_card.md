# Model card — SafeDM local classifier

## Overview

On-device / offline classifier over a **50-dim uint8** feature vector extracted
from notification or pasted message text. Official publishable artefact is a
**signed integer logistic regression JSON** (`make train`). TFLite float32 is an
optional export for the current Expo runtime only.

## Intended use

- First-pass risk score on Android (SAFE / UNCERTAIN / DANGEROUS).
- Never the sole authority when cloud enrichment is available and consented.

## Training data

- Current corpus: ~28 labeled SMS-like messages
  (`data/processed/labeled_messages.json`, sourced from
  `tests/fixtures/jev_benchmark_baseline.json`).
- Labels: benign (`legitimate`, `benign_marketing`) vs malicious.

## Metrics

Reported via `make evaluate` (cross-validation). With the toy corpus the model
is often marked **research / non-deployable** (FPR or recall gates). Do not
advertise production-grade phishing detection until the dataset grows.

## Limitations

- Tiny dataset → high variance; integer logistic underfits complex phishing.
- Feature `known_bad_url` is usually 128 (unverified) on device.
- TFLite path uses float32; scores may differ slightly from the signed JSON
  integer path.

## Ethical / privacy notes

- Training data must not include real user PII without consent and scrubbing.
- Runtime analysis does not persist message content on the API path unless the
  user explicitly reports.
