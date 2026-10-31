"""Bound request bodies before parsing and avoid logging personal data."""
from collections import OrderedDict, deque
import json
import logging
from time import monotonic
from uuid import uuid4
from starlette.responses import JSONResponse
from app.core.config import settings

logger = logging.getLogger("myresume.requests")


class RequestPolicyMiddleware:
    def __init__(self, app):
        self.app = app
        self.attempts = OrderedDict()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = monotonic()
        request_id = uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        headers = dict(scope["headers"])
        async def reject(code, detail):
            response_headers = {"X-Request-ID": request_id, "X-Content-Type-Options": "nosniff",
                                "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "Cache-Control": "no-store"}
            if code == 429:
                response_headers["Retry-After"] = "60"
            if settings.app_env == "production":
                response_headers["Strict-Transport-Security"] = "max-age=31536000"
            await JSONResponse({"detail": detail}, status_code=code, headers=response_headers)(scope, receive, send)
        length = headers.get(b"content-length", b"0")
        if not length.isdigit():
            return await reject(400, "Invalid Content-Length")
        if int(length) > settings.max_request_bytes:
            return await reject(413, "Request exceeds upload limit")
        if scope["path"] in {"/auth/login", "/auth/signup", "/auth/forgot-password", "/auth/reset-password", "/auth/contact"} and scope["method"] == "POST":
            # The reverse proxy must also enforce a distributed limit across workers.
            ip = (scope.get("client") or ("unknown",))[0]
            attempts = self.attempts.setdefault(ip, deque())
            self.attempts.move_to_end(ip)
            while attempts and attempts[0] < started - 60:
                attempts.popleft()
            if len(self.attempts) > 10000:
                self.attempts.popitem(last=False)
            if len(attempts) >= settings.auth_requests_per_minute:
                return await reject(429, "Too many attempts. Try again in a minute.")
            attempts.append(started)
        size = 0
        async def limited_receive():
            nonlocal size
            message = await receive()
            size += len(message.get("body", b""))
            if size > settings.max_request_bytes:
                from starlette.exceptions import HTTPException
                raise HTTPException(413, "Request exceeds upload limit")
            return message
        async def secured_send(message):
            if message["type"] == "http.response.start":
                extra = [(b"x-request-id", request_id.encode()), (b"x-content-type-options", b"nosniff"),
                         (b"referrer-policy", b"no-referrer"), (b"x-frame-options", b"DENY"),
                         (b"cache-control", b"no-store")]
                if settings.app_env == "production":
                    extra.append((b"strict-transport-security", b"max-age=31536000"))
                message["headers"] = message.get("headers", []) + extra
                logger.info(json.dumps({"requestId": request_id, "method": scope["method"],
                                        "route": getattr(scope.get("route"), "path", "unmatched"),
                                        "status": message["status"], "durationMs": round((monotonic()-started)*1000)}))
            await send(message)
        await self.app(scope, limited_receive, secured_send)
