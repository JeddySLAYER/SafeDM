# Model training

```bash
cd safedm-backend
make train      # → models/artifacts/trained_models/safedm_local_patch.json + registry
make evaluate   # → outputs/reports/last_evaluate.json
```

- Feature extraction source of truth: `app/utils/feature_extraction.py`
- Training code: `ml/models/training.py`
- Config knobs: `config/model.yaml`

Dataset preference: `data/processed/labeled_messages.json` if present, else
`tests/fixtures/jev_benchmark_baseline.json`.
