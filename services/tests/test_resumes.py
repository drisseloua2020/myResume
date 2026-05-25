from time import sleep

def create_user_and_token(client):
    response = client.post('/auth/signup', json={'name': 'Resume User', 'email': 'resume@example.com', 'password': 'secret123', 'plan': 'free'})
    assert response.status_code == 201, response.text
    return response.json()['token']

def test_resume_crud_flow(client):
    token = create_user_and_token(client)
    headers = {'Authorization': f'Bearer {token}'}
    created = client.post('/resumes/', headers=headers, json={'templateId': 'modern_tech', 'title': 'My Resume', 'content': {'summary': 'hello'}})
    assert created.status_code == 201, created.text
    resume_id = created.json()['id']
    listed = client.get('/resumes/', headers=headers)
    assert listed.status_code == 200, listed.text
    assert len(listed.json()['resumes']) == 1
    fetched = client.get(f'/resumes/{resume_id}', headers=headers)
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()['resume']['title'] == 'My Resume'
    second = client.post('/resumes/', headers=headers, json={'templateId': 'classic_pro', 'title': 'Second Resume', 'content': {'summary': 'second'}})
    assert second.status_code == 201, second.text
    sleep(1.1)
    updated = client.put(f'/resumes/{resume_id}', headers=headers, json={'title': 'Updated Resume', 'content': {'summary': 'updated'}})
    assert updated.status_code == 200, updated.text
    latest = client.get('/resumes/latest', headers=headers)
    assert latest.status_code == 200, latest.text
    assert latest.json()['resume']['id'] == resume_id
    assert latest.json()['resume']['title'] == 'Updated Resume'
    deleted = client.delete(f'/resumes/{resume_id}', headers=headers)
    assert deleted.status_code == 200, deleted.text

def test_latest_resume_returns_null_when_user_has_no_resumes(client):
    token = create_user_and_token(client)
    latest = client.get('/resumes/latest', headers={'Authorization': f'Bearer {token}'})
    assert latest.status_code == 200, latest.text
    assert latest.json()['resume'] is None
