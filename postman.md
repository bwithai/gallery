1. Set request method & URL

Method: POST

URL: http://localhost:8000/api/v1/login/access-token

2. Headers

Go to the Headers tab and add:

Key	Value
accept	application/json
Content-Type	application/x-www-form-urlencoded
3. Body

Go to the Body tab → select x-www-form-urlencoded.

Then add these key-value pairs:

Key	Value
grant_type	password
username	admin@collection.com
password	collection
scope	(leave empty)
client_id	string
client_secret	string
___________________________________________________________

1. Set request method & URL

Method: POST

URL: http://localhost:8000/api/v1/collections/

2. Headers

In the Headers tab, add:

Key	Value
accept	application/json
Content-Type	application/json
Authorization	Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTgyNTE4NjcsInN1YiI6IjEifQ.KG_Vriqz5cjnf79hGFmekUlFRgyTf0kqgQ3smOqSY6o

3. Body

Go to Body → select raw → from the dropdown choose JSON.

Paste this:

{
  "name": "Dummy Collection",
  "description": "testing",
  "is_public": true
}