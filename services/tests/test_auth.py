def test_signup_login_and_me_flow(client):
    signup = client.post('/auth/signup', json={'name': 'Alice', 'email': 'alice@example.com', 'password': 'secret123', 'plan': 'free'})
    assert signup.status_code == 201, signup.text
    token = signup.json()['token']
    me = client.get('/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200, me.text
    assert me.json()['user']['email'] == 'alice@example.com'
    login = client.post('/auth/login', json={'email': 'alice@example.com', 'password': 'secret123'})
    assert login.status_code == 200, login.text
    assert login.json()['user']['name'] == 'Alice'
