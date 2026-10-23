"""DNS-pinned, bounded public HTTP fetches. Also restrict egress at deployment."""
import http.client
import ipaddress
import socket
import ssl
from time import monotonic
from urllib.parse import urlsplit, urljoin


def fetch_public_text(url: str, max_bytes: int = 200000) -> tuple[str, str]:
    deadline = monotonic() + 15
    for _ in range(4):
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Use a public HTTP or HTTPS job URL")
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if port not in {80, 443}:
            raise ValueError("Job URLs must use standard HTTP ports")
        addresses = {item[4][0] for item in socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)}
        if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
            raise ValueError("Private and reserved destinations are not allowed")
        remaining = deadline - monotonic()
        if remaining <= 0:
            raise ValueError("Job source timed out")
        # Connect to the already validated address; never resolve the host again.
        connection = http.client.HTTPConnection(next(iter(addresses)), port, timeout=min(remaining, 5))
        try:
            connection.connect()
            if parsed.scheme == "https":
                connection.sock = ssl.create_default_context().wrap_socket(connection.sock, server_hostname=parsed.hostname)
            path = parsed.path or "/"
            if parsed.query:
                path += "?" + parsed.query
            connection.request("GET", path, headers={"Host": parsed.netloc, "User-Agent": "MyResumes/1.0", "Accept-Encoding": "identity"})
            response = connection.getresponse()
            if response.status in {301, 302, 303, 307, 308}:
                location = response.getheader("Location")
                if not location:
                    raise ValueError("Invalid job source redirect")
                url = urljoin(url, location)
                continue
            if response.status >= 400 or response.getheader("Content-Encoding", "identity") != "identity":
                raise ValueError("Job source could not be read")
            content_type = response.getheader("Content-Type", "").lower()
            if not any(kind in content_type for kind in ("text/plain", "text/html", "application/xhtml")):
                raise ValueError("Job source must be a text or HTML page")
            data = bytearray()
            while len(data) <= max_bytes:
                remaining = deadline - monotonic()
                if remaining <= 0:
                    raise ValueError("Job source timed out")
                chunk = response.read(min(16384, max_bytes + 1 - len(data)))
                if not chunk:
                    break
                data.extend(chunk)
            if len(data) > max_bytes:
                raise ValueError("Job source is too large; paste its description instead")
            return data.decode("utf-8", errors="replace"), content_type
        finally:
            connection.close()
    raise ValueError("Too many job source redirects")
