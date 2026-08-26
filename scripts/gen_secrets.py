import secrets
api_key = "sp_live_" + secrets.token_hex(32)
salt = secrets.token_hex(32)
print(f"API_KEY={api_key}")
print(f"SALT={salt}")
