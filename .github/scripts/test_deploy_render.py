import contextlib
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import Mock
from urllib.parse import parse_qs, urlsplit

spec = importlib.util.spec_from_file_location('deploy_render', Path(__file__).with_name('deploy_render.py'))
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


class DeploymentPolicyTests(unittest.TestCase):
    def environment(self, **changes):
        return {'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/main', 'GITHUB_SHA': 'a' * 40,
                'RENDER_API_DEPLOY_HOOK': 'https://api.render.com/deploy/srv-api?key=synthetic-api-key',
                'RENDER_UI_DEPLOY_HOOK': 'https://api.render.com/deploy/srv-ui?key=synthetic-ui-key', **changes}

    def test_non_main_pushes_and_non_push_events_never_contact_render(self):
        for ref, event in [('refs/heads/feature_dev', 'push'), ('refs/heads/stage', 'push'),
                           ('refs/tags/v1.0.0', 'push'), ('refs/pull/1/merge', 'pull_request'),
                           ('refs/heads/main', 'workflow_dispatch'), ('refs/heads/main', 'pull_request_target')]:
            with self.subTest(ref=ref, event=event):
                opener = Mock()
                with self.assertRaises(deployment.DeploymentPolicyError):
                    deployment.deploy(self.environment(GITHUB_REF=ref, GITHUB_EVENT_NAME=event), open_url=opener)
                opener.assert_not_called()

    def test_main_requests_pin_both_services_without_printing_keys(self):
        opener = Mock()
        opener.return_value.__enter__ = Mock(return_value=Mock(status=200))
        opener.return_value.__exit__ = Mock(return_value=False)
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            deployment.deploy(self.environment(), open_url=opener)
        self.assertEqual(opener.call_count, 2)
        for call in opener.call_args_list:
            request = call.args[0]
            self.assertEqual(request.method, 'POST')
            self.assertEqual(parse_qs(urlsplit(request.full_url).query)['ref'], ['a' * 40])
        self.assertNotIn('synthetic-api-key', output.getvalue())
        self.assertNotIn('synthetic-ui-key', output.getvalue())

    def test_stale_hook_ref_is_replaced_not_appended(self):
        hook = self.environment()['RENDER_API_DEPLOY_HOOK'] + '&ref=feature_dev&ref=old'
        query = parse_qs(urlsplit(deployment.pinned_hook_url(hook, 'a' * 40)).query)
        self.assertEqual(query['ref'], ['a' * 40])
        self.assertEqual(query['key'], ['synthetic-api-key'])

    def test_invalid_destination_or_commit_prevents_all_requests(self):
        cases = [
            {'GITHUB_SHA': 'feature_dev'}, {'GITHUB_SHA': ''},
            {'RENDER_UI_DEPLOY_HOOK': ''},
            {'RENDER_UI_DEPLOY_HOOK': 'http://api.render.com/deploy/srv-ui?key=synthetic'},
            {'RENDER_UI_DEPLOY_HOOK': 'https://api.render.com.attacker.example/deploy/srv-ui?key=synthetic'},
            {'RENDER_UI_DEPLOY_HOOK': 'https://api.render.com/deploy/srv-ui?key=synthetic&imgURL=other'},
        ]
        for changes in cases:
            with self.subTest(changes=changes):
                opener = Mock()
                with self.assertRaises(deployment.DeploymentPolicyError):
                    deployment.deploy(self.environment(**changes), open_url=opener)
                opener.assert_not_called()


if __name__ == '__main__':
    unittest.main()
