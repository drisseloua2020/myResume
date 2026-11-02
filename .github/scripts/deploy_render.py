"""Request Git-backed Render deploys only for the tested main push commit."""
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class DeploymentPolicyError(ValueError):
    pass


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, new_url):
        return None


def pinned_hook_url(hook: str, commit: str) -> str:
    try:
        parsed = urlsplit(hook)
        valid = (parsed.scheme == 'https' and parsed.hostname == 'api.render.com'
                 and parsed.port in {None, 443} and not parsed.username and not parsed.password
                 and parsed.path.startswith('/deploy/') and not parsed.fragment)
    except ValueError:
        valid = False
    if not valid:
        raise DeploymentPolicyError('Expected an HTTPS Render deploy hook')
    if not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})', commit):
        raise DeploymentPolicyError('A full tested commit SHA is required')
    query = parse_qsl(parsed.query, keep_blank_values=True)
    if not any(key == 'key' and value for key, value in query):
        raise DeploymentPolicyError('Deploy hook is missing its key')
    if any(key == 'imgURL' for key, _ in query):
        raise DeploymentPolicyError('This workflow requires Git-backed services, not an image override')
    query = [(key, value) for key, value in query if key != 'ref']
    query.append(('ref', commit))
    return urlunsplit(parsed._replace(query=urlencode(query)))


def deploy(environment, *, open_url=None):
    if environment.get('GITHUB_EVENT_NAME') != 'push' or environment.get('GITHUB_REF') != 'refs/heads/main':
        raise DeploymentPolicyError('Production deploys require a push to main')
    commit = environment.get('GITHUB_SHA', '')
    # Validate both destinations before contacting either service.
    targets = [(label, pinned_hook_url(environment.get(variable, ''), commit)) for label, variable in (
        ('API', 'RENDER_API_DEPLOY_HOOK'), ('UI', 'RENDER_UI_DEPLOY_HOOK'))]
    if open_url is None:
        open_url = build_opener(NoRedirects()).open
    for label, url in targets:
        with open_url(Request(url, method='POST'), timeout=30) as response:
            if response.status not in {200, 202}:
                raise DeploymentPolicyError('Render did not accept the deployment request')
        print(f'{label}: Render accepted the main commit {commit[:12]} deployment request.')


def main():
    try:
        deploy(os.environ)
        return 0
    except HTTPError as error:
        print(f'Render rejected the deployment request (HTTP {error.code}).', file=sys.stderr)
    except (DeploymentPolicyError, URLError, TimeoutError, OSError) as error:
        # Exception strings can contain the secret hook URL; never print them.
        print(f'Production deployment request failed ({type(error).__name__}). Check branch policy and service configuration.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
