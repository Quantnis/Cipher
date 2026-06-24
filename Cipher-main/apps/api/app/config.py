from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ShadowGraph KZ API"
    app_env: str = "development"
    demo_mode: bool = False
    enable_real_crawler: bool = True
    allowed_source_hosts: str = "synthetic.local,example.org"
    database_url: str = "sqlite:///./shadowgraph_kz.db"
    neo4j_uri: str = "bolt://neo4j:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "darktrace-kz-password"
    redis_url: str = "redis://redis:6379/0"
    openai_base_url: str | None = None
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"
    narrative_max_tokens: int = 3000
    narrative_temperature: float = 0.3
    search_api_provider: str | None = None
    search_api_key: str | None = None
    search_engine_id: str | None = None
    telegram_api_id: str | None = None
    telegram_api_hash: str | None = None
    telegram_session_name: str = "shadowgraph-kz"
    tg_bot_token: str | None = None
    hibp_api_key: str | None = None
    tor_proxy_url: str | None = None
    etherscan_api_key: str | None = None
    tronscan_api_key: str | None = None
    blockchain_provider: str | None = None
    mapbox_token: str | None = None
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    fingerprint_similarity_threshold: float = 0.82
    fingerprint_top_k: int = 10
    fingerprint_auto_analyze: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()



