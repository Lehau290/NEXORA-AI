from flask import Blueprint, request, jsonify, g
from database import get_db
from auth import token_required

fav_bp = Blueprint("fav_bp", __name__)

@fav_bp.route("/toggle", methods=["POST"])
@token_required
def toggle_favorite():
    data = request.get_json() or {}
    target_type = data.get("target_type")  # 'agent', 'conversation', 'workflow'
    target_id = data.get("target_id")

    if not target_type or not target_id:
        return jsonify({"success": False, "error": "Thiếu thông tin đối tượng yêu thích."}), 400

    user_id = g.current_user["id"]
    conn = get_db()
    cursor = conn.cursor()

    existing = cursor.execute("""
        SELECT id FROM favorites WHERE user_id = ? AND target_type = ? AND target_id = ?
    """, (user_id, target_type, target_id)).fetchone()

    if existing:
        cursor.execute("DELETE FROM favorites WHERE id = ?", (existing["id"],))
        is_fav = False
        msg = "Đã bỏ khỏi danh sách yêu thích."
    else:
        cursor.execute("""
            INSERT INTO favorites (user_id, target_type, target_id)
            VALUES (?, ?, ?)
        """, (user_id, target_type, target_id))
        is_fav = True
        msg = "Đã thêm vào danh sách yêu thích!"

    # If target is conversation, sync is_favorite flag
    if target_type == "conversation":
        cursor.execute("UPDATE conversations SET is_favorite = ? WHERE id = ?", (1 if is_fav else 0, target_id))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "is_favorite": is_fav, "message": msg})

@fav_bp.route("", methods=["GET"])
@token_required
def get_user_favorites():
    user_id = g.current_user["id"]
    conn = get_db()

    fav_agents = conn.execute("""
        SELECT a.*, c.name AS category_name, 1 AS is_favorite
        FROM favorites f
        JOIN agents a ON f.target_id = a.id
        LEFT JOIN agent_categories c ON a.category_id = c.id
        WHERE f.user_id = ? AND f.target_type = 'agent'
    """, (user_id,)).fetchall()

    fav_conversations = conn.execute("""
        SELECT c.*, a.name AS agent_name, a.avatar AS agent_avatar, 1 AS is_favorite
        FROM favorites f
        JOIN conversations c ON f.target_id = c.id
        JOIN agents a ON c.agent_id = a.id
        WHERE f.user_id = ? AND f.target_type = 'conversation'
    """, (user_id,)).fetchall()

    conn.close()

    return jsonify({
        "success": True,
        "agents": [dict(a) for a in fav_agents],
        "conversations": [dict(c) for c in fav_conversations]
    })

