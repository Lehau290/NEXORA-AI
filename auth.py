from functools import wraps
from datetime import datetime, timedelta
import jwt
from flask import request, jsonify, g
from config import Config
from database import get_db

def create_access_token(user_id: int, username: str, role: str) -> str:
    """Generate JWT access token valid for Config.JWT_EXPIRATION_HOURS."""
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=Config.JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm=Config.JWT_ALGORITHM)

def decode_access_token(token: str) -> dict:
    """Decode and validate JWT access token."""
    try:
        return jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return {"error": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."}
    except jwt.InvalidTokenError:
        return {"error": "Token xác thực không hợp lệ."}

def token_required(f):
    """Decorator to enforce authenticated requests."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = None

        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        elif request.cookies.get("nexora_token"):
            token = request.cookies.get("nexora_token")
        elif request.args.get("token"):
            token = request.args.get("token")

        if not token:
            return jsonify({
                "success": False,
                "error": "Thiếu mã xác thực. Vui lòng đăng nhập."
            }), 401

        payload = decode_access_token(token)
        if "error" in payload:
            return jsonify({
                "success": False,
                "error": payload["error"]
            }), 401

        # Retrieve user from DB to verify active status
        conn = get_db()
        user_id = int(payload["sub"])
        user = conn.execute(
            "SELECT id, full_name, email, username, role, plan, avatar, is_active FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()
        conn.close()

        if not user or not user["is_active"]:
            return jsonify({
                "success": False,
                "error": "Tài khoản không tồn tại hoặc đã bị khóa."
            }), 403

        # Attach user info to Flask globals
        g.current_user = dict(user)
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator to enforce Admin role."""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if g.current_user.get("role") != "admin":
            return jsonify({
                "success": False,
                "error": "Bạn không có quyền truy cập trang quản trị Admin."
            }), 403
        return f(*args, **kwargs)
    return decorated
