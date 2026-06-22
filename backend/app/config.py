from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "VulnScope"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/vulnscope"
    jwt_secret: str = "change_me_vulnscope_secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    frontend_origin: str = "http://localhost:5174"

    class Config:
        env_file = ".env"


settings = Settings()
