from pydantic import BaseModel, Field


class MlDatasetCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    source: str = Field(default="upload", max_length=64)
    # JSON string, list of cases, or CSV text
    content: str | list | dict


class MlReviewQueueDatasetRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class MlTrainStartRequest(BaseModel):
    dataset_id: int
    promote_canary: bool = False


class MlTryMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    run_id: int | None = None


class MlTfliteEvaluateRequest(BaseModel):
    dataset_id: int
    run_id: int | None = None
    mobile_features: list[list[int]] | None = Field(default=None, max_length=5000)
    mobile_results: list[dict] | None = Field(default=None, max_length=5000)
    mobile_messages: list[str] | None = Field(default=None, max_length=5000)


class ModelReceiptRequest(BaseModel):
    version: str = Field(min_length=1, max_length=128)
    device_identifier: str = Field(min_length=3, max_length=255)
    app_version: str = Field(min_length=1, max_length=32)
