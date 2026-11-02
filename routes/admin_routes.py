import json
from flask import Blueprint, request, jsonify, g
from database import get_db
from auth import admin_required

admin_bp = Blueprint("admin_bp", __name__)

@admin_bp.route("/stats", methods=["GET"])
@admin_required
def get_admin_stats():
    conn = get_db()
    
    total_users = conn.execute("SELECT COUNT(*) AS total FROM users").fetchone()["total"]
    total_agents = conn.execute("SELECT COUNT(*) AS total FROM agents").fetchone()["total"]
    total_conversations = conn.execute("SELECT COUNT(*) AS total FROM conversations").fetchone()["total"]
    total_messages = conn.execute("SELECT COUNT(*) AS total FROM messages").fetchone()["total"]
    total_workflows = conn.execute("SELECT COUNT(*) AS total FROM workflows").fetchone()["total"]
    total_documents = conn.execute("SELECT COUNT(*) AS total FROM documents").fetchone()["total"]

    tokens_row = conn.execute("SELECT SUM(tokens_used) AS total_tokens FROM subscriptions").fetchone()
    total_tokens = tokens_row["total_tokens"] or 0

    # Recent active users
    recent_users = conn.execute("""
        SELECT id, full_name, email, username, role, plan, is_active, created_at
        FROM users
        ORDER BY id DESC LIMIT 5
    """).fetchall()

    # Recent activity logs
    recent_logs = conn.execute("""
        SELECT l.*, u.username
        FROM usage_logs l
        JOIN users u ON l.user_id = u.id
        ORDER BY l.id DESC LIMIT 10
    """).fetchall()

    # Model usage distribution
    model_dist = conn.execute("""
        SELECT model, COUNT(*) AS count
        FROM usage_logs
        WHERE model IS NOT NULL
        GROUP BY model
    """).fetchall()

    conn.close()

    return jsonify({
        "success": True,
        "stats": {
            "total_users": total_users,
            "total_agents": total_agents,
            "total_conversations": total_conversations,
            "total_messages": total_messages,
            "total_workflows": total_workflows,
            "total_documents": total_documents,
            "total_tokens": total_tokens
        },
        "recent_users": [dict(u) for u in recent_users],
        "recent_logs": [dict(l) for l in recent_logs],
        "model_distribution": [dict(m) for m in model_dist]
    })

@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_users():
    search = request.args.get("search", "").strip().lower()
    conn = get_db()
    
    query = """
        SELECT u.id, u.full_name, u.email, u.username, u.role, u.plan, u.is_active, u.created_at,
               s.tokens_limit, s.tokens_used,
               (SELECT COUNT(*) FROM conversations WHERE user_id = u.id) AS conv_count
        FROM users u
        LEFT JOIN subscriptions s ON u.id = s.user_id
    """
    params = []
    if search:
        query += " WHERE LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.username) LIKE ?"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    query += " ORDER BY u.id ASC"
    users = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify({"success": True, "users": [dict(u) for u in users]})

@admin_bp.route("/users/<int:user_id>/toggle-status", methods=["POST"])
@admin_required
def toggle_user_status(user_id: int):
    if user_id == g.current_user["id"]:
        return jsonify({"success": False, "error": "Không thể tự khóa tài khoản quản trị viên của chính bạn."}), 400

    conn = get_db()
    cursor = conn.cursor()
    user = cursor.execute("SELECT is_active FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"success": False, "error": "Người dùng không tồn tại."}), 404

    new_status = 0 if user["is_active"] else 1
    cursor.execute("UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_status, user_id))
    conn.commit()
    conn.close()

    status_str = "mở khóa" if new_status else "khóa"
    return jsonify({"success": True, "message": f"Đã {status_str} tài khoản người dùng.", "is_active": new_status})

@admin_bp.route("/users/<int:user_id>/role", methods=["POST"])
@admin_required
def change_user_role(user_id: int):
    if user_id == g.current_user["id"]:
        return jsonify({"success": False, "error": "Không thể tự thay đổi vai trò của chính bạn."}), 400

    data = request.get_json() or {}
    new_role = data.get("role")
    if new_role not in ("admin", "user"):
        return jsonify({"success": False, "error": "Vai trò không hợp lệ."}), 400

    conn = get_db()
    conn.execute("UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_role, user_id))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Đã cập nhật vai trò người dùng thành '{new_role}'."})

@admin_bp.route("/settings", methods=["GET"])
@admin_required
def get_system_settings():
    conn = get_db()
    settings = conn.execute("SELECT * FROM system_settings ORDER BY id ASC").fetchall()
    conn.close()
    return jsonify({"success": True, "settings": [dict(s) for s in settings]})

@admin_bp.route("/settings", methods=["POST"])
@admin_required
def update_system_settings():
    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()

    for key, val in data.items():
        cursor.execute("""
            UPDATE system_settings 
            SET value = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE key = ?
        """, (str(val), key))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Cấu hình hệ thống đã được cập nhật thành công!"})

