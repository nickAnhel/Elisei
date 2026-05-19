from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.setup_app import register_middleware


def test_register_middleware_allows_patch_method() -> None:
    app = FastAPI()
    register_middleware(app)

    cors_middleware = next(
        (middleware for middleware in app.user_middleware if middleware.cls is CORSMiddleware),
        None,
    )
    assert cors_middleware is not None
    allow_methods = cors_middleware.kwargs.get("allow_methods", [])
    assert "PATCH" in allow_methods
