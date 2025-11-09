import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import BIN_KEY, BIN_SEC
from .state import config
from .background import refresh_candles_loop, stream_prices_loop, refresh_balances_loop, execution_loop
from .exchange import make_client
from .routes.config_routes import router as config_router
from .routes.data_routes import router as data_router
from .routes.signal_routes import router as signal_router
from .routes.order_routes import router as order_router
from .routes.autotrade_routes import router as autotrade_router

def create_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], allow_credentials=True,
        allow_methods=["*"], allow_headers=["*"],
    )

    # routes
    app.include_router(config_router)
    app.include_router(data_router)
    app.include_router(signal_router)
    app.include_router(order_router)
    app.include_router(autotrade_router)

    @app.on_event("startup")
    async def on_startup():
        app.state.stop_event = asyncio.Event()
        # shared WS client for price sockets
        app.state.shared_client = await make_client(BIN_KEY, BIN_SEC) if (BIN_KEY and BIN_SEC) else await make_client(None, None)
        app.state.tasks = [
            asyncio.create_task(stream_prices_loop(app.state.stop_event, app.state.shared_client)),
            asyncio.create_task(refresh_candles_loop(app.state.stop_event, lambda: make_client(BIN_KEY, BIN_SEC))),
            asyncio.create_task(refresh_balances_loop(app.state.stop_event, lambda: make_client(BIN_KEY, BIN_SEC))),
            asyncio.create_task(execution_loop(app.state.stop_event, lambda: make_client(BIN_KEY, BIN_SEC))),
        ]

    @app.on_event("shutdown")
    async def on_shutdown():
        app.state.stop_event.set()
        for t in getattr(app.state, "tasks", []):
            t.cancel()
            try:
                await t
            except Exception:
                pass
        if getattr(app.state, "shared_client", None):
            try:
                await app.state.shared_client.close_connection()
            except Exception:
                pass

    return app
