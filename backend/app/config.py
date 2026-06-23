from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "VulnScope"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/vulnscope"
    jwt_secret: str = "change_me_vulnscope_secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    frontend_origin: str = "http://localhost:5174"
    use_nmap: bool = True
    enable_live_cve_lookup: bool = False
    nvd_api_url: str = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    class Config:
        env_file = ".env"


settings = Settings()
