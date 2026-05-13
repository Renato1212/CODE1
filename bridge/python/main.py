"""
TapeFeel ↔ Rithmic bridge.

Speaks the TapeFeel JSON-over-WebSocket protocol to browser clients on the
left, and the Rithmic R-API|+ Protocol Buffers protocol to Rithmic on the
right. Re-broadcasts every trade with an aggressor side inferred from the
current NBBO snapshot.

Run with `docker compose up` (see Dockerfile / docker-compose.yml in this
directory) or directly:

    pip install -r requirements.txt
    RITHMIC_USER=xxx RITHMIC_PASSWORD=xxx python main.py

Default WebSocket listen: 0.0.0.0:8787. Point TapeFeel at ws://<host>:8787/.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
from dataclasses import dataclass
from typing import Optional

import websockets
from websockets.server import WebSocketServerProtocol

# `async-rithmic` is the maintained community async client.
# pip install async-rithmic
from async_rithmic import RithmicClient, Gateway, DataType  # type: ignore

LOG = logging.getLogger("tapefeel-bridge")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

LISTEN_HOST = os.getenv("LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.getenv("LISTEN_PORT", "8787"))
DEFAULT_SYSTEM = os.getenv("RITHMIC_SYSTEM", "Rithmic Paper Trading")
DEFAULT_GATEWAY = os.getenv("RITHMIC_GATEWAY", "TEST")  # TEST | CHICAGO | EUROPE


@dataclass
class Nbbo:
    bid: Optional[float] = None
    ask: Optional[float] = None

    def classify(self, price: float) -> str:
        if self.ask is not None and price >= self.ask:
            return "buy"
        if self.bid is not None and price <= self.bid:
            return "sell"
        mid = ((self.bid or price) + (self.ask or price)) / 2
        return "buy" if price >= mid else "sell"


class Session:
    """One browser tab. Owns a Rithmic client for its lifetime."""

    def __init__(self, ws: WebSocketServerProtocol):
        self.ws = ws
        self.client: Optional[RithmicClient] = None
        self.nbbo: dict[str, Nbbo] = {}
        self.last_side: dict[str, str] = {}
        self.subscribed: set[tuple[str, str]] = set()

    async def send(self, payload: dict) -> None:
        try:
            await self.ws.send(json.dumps(payload))
        except websockets.ConnectionClosed:
            pass

    async def login(self, system: str, user: str, password: str) -> None:
        gateway = getattr(Gateway, DEFAULT_GATEWAY, Gateway.TEST)
        self.client = RithmicClient(
            user=user,
            password=password,
            system_name=system,
            app_name="TapeFeel-Bridge",
            app_version="1.0.0",
            gateway=gateway,
        )
        await self.client.connect()
        self.client.on_tick += self._on_tick
        self.client.on_best_bid_offer += self._on_bbo
        await self.send({"type": "status", "message": f"logged in to {system}"})

    async def subscribe(self, symbol: str, exchange: str) -> None:
        assert self.client is not None
        key = (symbol, exchange)
        if key in self.subscribed:
            return
        front = await self.client.get_front_month_contract(symbol, exchange)
        await self.client.subscribe_to_market_data(
            front, exchange, DataType.LAST_TRADE | DataType.BBO
        )
        self.subscribed.add(key)
        await self.send({"type": "status", "message": f"subscribed {symbol} ({front}) on {exchange}"})

    async def _on_bbo(self, data: dict) -> None:
        sym = data.get("symbol") or ""
        self.nbbo.setdefault(sym, Nbbo())
        if "bid_price" in data:
            self.nbbo[sym].bid = float(data["bid_price"])
        if "ask_price" in data:
            self.nbbo[sym].ask = float(data["ask_price"])

    async def _on_tick(self, data: dict) -> None:
        sym = data.get("symbol") or ""
        price = float(data.get("trade_price", 0))
        size = float(data.get("trade_size", 0))
        if price == 0 or size == 0:
            return
        nbbo = self.nbbo.get(sym, Nbbo())
        if nbbo.bid is None and nbbo.ask is None:
            side = self.last_side.get(sym, "buy")
        else:
            side = nbbo.classify(price)
        self.last_side[sym] = side
        ts_ns = data.get("ssboe", 0) * 1_000_000_000 + data.get("usecs", 0) * 1_000
        ts_ms = ts_ns // 1_000_000 if ts_ns else None
        await self.send({
            "type": "trade",
            "symbol": _root_of(sym),
            "ts": ts_ms,
            "price": price,
            "size": size,
            "side": side,
        })

    async def close(self) -> None:
        if self.client:
            try:
                await self.client.disconnect()
            except Exception:  # noqa: BLE001
                LOG.exception("rithmic disconnect failed")


def _root_of(contract: str) -> str:
    """ESM5 → ES, MNQU5 → MNQ. Strips the 1- or 2-char month+year suffix."""
    if len(contract) >= 3 and contract[-1].isdigit() and contract[-2].isalpha():
        return contract[:-2]
    return contract


async def handle(ws: WebSocketServerProtocol) -> None:
    session = Session(ws)
    LOG.info("client connected %s", ws.remote_address)
    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError as e:
                await session.send({"type": "error", "message": f"bad json: {e}"})
                continue
            kind = msg.get("type")
            try:
                if kind == "login":
                    await session.login(
                        msg.get("system") or DEFAULT_SYSTEM,
                        msg.get("user") or os.getenv("RITHMIC_USER", ""),
                        msg.get("password") or os.getenv("RITHMIC_PASSWORD", ""),
                    )
                elif kind == "subscribe":
                    await session.subscribe(msg["symbol"], msg.get("exchange", "CME"))
                else:
                    await session.send({"type": "error", "message": f"unknown type: {kind}"})
            except Exception as e:  # noqa: BLE001
                LOG.exception("handler error")
                await session.send({"type": "error", "message": str(e)})
    finally:
        await session.close()
        LOG.info("client disconnected %s", ws.remote_address)


async def main() -> None:
    stop = asyncio.Event()
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    LOG.info("listening on ws://%s:%d/", LISTEN_HOST, LISTEN_PORT)
    async with websockets.serve(handle, LISTEN_HOST, LISTEN_PORT, ping_interval=20):
        await stop.wait()


if __name__ == "__main__":
    asyncio.run(main())
