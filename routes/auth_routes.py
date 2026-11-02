import re
import json
from flask import Blueprint, request, jsonify, g
from database import get_db, hash_password, verify_password
from auth import create_access_token, token_required

auth_bp = Blueprint("auth_bp", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

    # Validation
    if not full_name or not email or not username or not password:
        return jsonify({"success": False, "error": "Vui lòng điền đầy đủ các thông tin bắt buộc."}), 400

    if len(username) < 3:
        return jsonify({"success": False, "error": "Username phải có ít nhất 3 ký tự."}), 400

    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"success": False, "error": "Địa chỉ Email không hợp lệ."}), 400

    if len(password) < 6:
        return jsonify({"success": False, "error": "Mật khẩu phải có độ dài tối thiểu 6 ký tự."}), 400

    if password != confirm_password:
        return jsonify({"success": False, "error": "Xác nhận mật khẩu không trùng khớp."}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Check existing user or email
    existing = cursor.execute("SELECT id, email, username FROM users WHERE email = ? OR username = ?", (email, username)).fetchone()
    if existing:
        conn.close()
        if existing["email"] == email:
            return jsonify({"success": False, "error": "Email này đã được đăng ký tài khoản khác."}), 409
        else:
            return jsonify({"success": False, "error": "Tên đăng nhập (username) này đã tồn tại."}), 409

    hashed_pw = hash_password(password)
    cursor.execute("""
        INSERT INTO users (full_name, email, username, password_hash, role, plan, avatar)
        VALUES (?, ?, ?, ?, 'user', 'Free', '⚡')
    """, (full_name, email, username, hashed_pw))
    user_id = cursor.lastrowid

    # Create subscription
    cursor.execute("""
        INSERT INTO subscriptions (user_id, plan_name, tokens_limit, tokens_used)
        VALUES (?, 'Free', 50000, 0)
    """, (user_id,))

    conn.commit()
    conn.close()

    token = create_access_token(user_id, username, "user")
    return jsonify({
        "success": True,
        "message": "Đăng ký tài khoản thành công!",
        "token": token,
        "user": {
            "id": user_id,
            "full_name": full_name,
            "email": email,
            "username": username,
            "role": "user",
            "plan": "Free",
            "avatar": "⚡"
        }
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    identifier = data.get("identifier", "").strip().lower()  # email or username
    password = data.get("password", "")

    if not identifier or not password:
        return jsonify({"success": False, "error": "Vui lòng nhập Email/Username và Mật khẩu."}), 400

    conn = get_db()
    user = conn.execute("""
        SELECT id, full_name, email, username, password_hash, role, plan, avatar, is_active
        FROM users 
        WHERE email = ? OR username = ?
    """, (identifier, identifier)).fetchone()
    conn.close()

    if not user:
        return jsonify({"success": False, "error": "Tài khoản hoặc mật khẩu không chính xác."}), 401

    if not user["is_active"]:
        return jsonify({"success": False, "error": "Tài khoản đã bị tạm khóa. Vui lòng liên hệ Admin."}), 403

    if not verify_password(user["password_hash"], password):
        return jsonify({"success": False, "error": "Tài khoản hoặc mật khẩu không chính xác."}), 401

    token = create_access_token(user["id"], user["username"], user["role"])

    return jsonify({
        "success": True,
        "message": "Đăng nhập thành công!",
        "token": token,
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "username": user["username"],
            "role": user["role"],
            "plan": user["plan"],
            "avatar": user["avatar"] or "👤"
        }
    })

@auth_bp.route("/me", methods=["GET"])
@token_required
def get_current_user_profile():
    conn = get_db()
    user_id = g.current_user["id"]
    
    user = conn.execute("""
        SELECT u.id, u.full_name, u.email, u.username, u.role, u.plan, u.avatar, u.created_at,
               s.tokens_limit, s.tokens_used
        FROM users u
        LEFT JOIN subscriptions s ON u.id = s.user_id
        WHERE u.id = ?
    """, (user_id,)).fetchone()

    # Get conversation count
    conv_count = conn.execute("SELECT COUNT(*) AS total FROM conversations WHERE user_id = ?", (user_id,)).fetchone()["total"]
    # Get custom agents count
    agent_count = conn.execute("SELECT COUNT(*) AS total FROM agents WHERE user_id = ?", (user_id,)).fetchone()["total"]
    # Get documents count
    doc_count = conn.execute("SELECT COUNT(*) AS total FROM documents WHERE user_id = ?", (user_id,)).fetchone()["total"]
    conn.close()

    return jsonify({
        "success": True,
        "user": dict(user),
        "stats": {
            "conversations": conv_count,
            "custom_agents": agent_count,
            "documents": doc_count
        }
    })

@auth_bp.route("/update-profile", methods=["POST"])
@token_required
def update_profile():
    data = request.get_json() or {}
    full_name = data.get("full_name", "").strip()
    avatar = data.get("avatar", "").strip()
    new_password = data.get("new_password", "").strip()
    current_password = data.get("current_password", "").strip()

    conn = get_db()
    cursor = conn.cursor()
    user_id = g.current_user["id"]

    if new_password:
        user = cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
        if not current_password or not verify_password(user["password_hash"], current_password):
            conn.close()
            return jsonify({"success": False, "error": "Mật khẩu hiện tại không đúng."}), 400
        
        if len(new_password) < 6:
            conn.close()
            return jsonify({"success": False, "error": "Mật khẩu mới phải có ít nhất 6 ký tự."}), 400

        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_password), user_id))

    if full_name:
        cursor.execute("UPDATE users SET full_name = ? WHERE id = ?", (full_name, user_id))

    if avatar:
        cursor.execute("UPDATE users SET avatar = ? WHERE id = ?", (avatar, user_id))

    cursor.execute("UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Cập nhật hồ sơ tài khoản thành công!"})

