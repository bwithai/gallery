import app.main
import json
import sys

# Generate the OpenAPI schema
app_instance = app.main.app
openapi_schema = app_instance.openapi()

# Write with explicit UTF-8 encoding
with open('../frontend/openapi.json', 'w', encoding='utf-8') as f:
    json.dump(openapi_schema, f, indent=2, ensure_ascii=False)

print('OpenAPI schema generated successfully!')