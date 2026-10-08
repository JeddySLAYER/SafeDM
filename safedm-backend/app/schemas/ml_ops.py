from pydantic import BaseModel, Field


class MlDatasetCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    source: str = Field(default="upload", max_length=64)
    # JSON string, list of cases, or CSV text
    content: str | list | dict


class MlTrainStartRequest(BaseModel):
    dataset_id: int
    promote_canary: bool = False
