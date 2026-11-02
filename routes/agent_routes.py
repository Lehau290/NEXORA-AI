import json
import re
from flask import Blueprint, request, jsonify, g
from database import get_db
from auth import token_required
from ai_service import get_ai_provider, AIProviderException

agent_bp = Blueprint("agent_bp", __name__)

@agent_bp.route("/categories", methods=["GET"])
def get_categories():
    conn = get_db()
    categories = conn.execute("SELECT * FROM agent_categories ORDER BY id ASC").fetchall()
    conn.close()
    return jsonify({
        "success": True,
        "categories": [dict(c) for c in categories]
    })

@agent_bp.route("", methods=["GET"])
def get_agents():
    category_slug = request.args.get("category", "").strip()
    search = request.args.get("search", "").strip().lower()
    user_id = None

    # Check token if available
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        from auth import decode_access_token
        payload = decode_access_token(auth_header.split(" ")[1])
        if "sub" in payload:
            user_id = payload["sub"]

    conn = get_db()
    
    query = """
        SELECT a.*, c.name AS category_name, c.slug AS category_slug,
               EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = ? AND f.target_type = 'agent' AND f.target_id = a.id) AS is_favorite
        FROM agents a
        LEFT JOIN agent_categories c ON a.category_id = c.id
        WHERE a.is_active = 1
    """
    params = [user_id or 0]

    if category_slug and category_slug != "all":
        query += " AND c.slug = ?"
        params.append(category_slug)

    if search:
        query += " AND (LOWER(a.name) LIKE ? OR LOWER(a.description) LIKE ? OR LOWER(a.expertise) LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    query += " ORDER BY a.is_system DESC, a.id ASC"
    agents = conn.execute(query, params).fetchall()
    conn.close()

    result = []
    for row in agents:
        ag = dict(row)
        try:
            ag["tools_enabled"] = json.loads(ag["tools_enabled"])
        except Exception:
            ag["tools_enabled"] = []
        result.append(ag)

    return jsonify({
        "success": True,
        "agents": result,
        "count": len(result)
    })

@agent_bp.route("/<int:agent_id>", methods=["GET"])
def get_agent_detail(agent_id: int):
    conn = get_db()
    agent = conn.execute("""
        SELECT a.*, c.name AS category_name, c.slug AS category_slug
        FROM agents a
        LEFT JOIN agent_categories c ON a.category_id = c.id
        WHERE a.id = ?
    """, (agent_id,)).fetchone()
    conn.close()

    if not agent:
        return jsonify({"success": False, "error": "Không tìm thấy AI Agent."}), 404

    ag_dict = dict(agent)
    try:
        ag_dict["tools_enabled"] = json.loads(ag_dict["tools_enabled"])
    except Exception:
        ag_dict["tools_enabled"] = []

    return jsonify({"success": True, "agent": ag_dict})

@agent_bp.route("/create", methods=["POST"])
@token_required
def create_agent():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    avatar = data.get("avatar", "🤖").strip()
    description = data.get("description", "").strip()
    category_id = data.get("category_id")
    system_instructions = data.get("system_instructions", "").strip()
    role_desc = data.get("role_desc", "Trợ lý AI chuyên môn").strip()
    expertise = data.get("expertise", "Chuyên môn tổng quát").strip()
    response_tone = data.get("response_tone", "Chuyên nghiệp và chi tiết").strip()
    ai_model = data.get("ai_model", "gemini-2.0-flash").strip()
    tools_enabled = data.get("tools_enabled", ["rag"])

    if not name or not description or not system_instructions:
        return jsonify({"success": False, "error": "Tên Agent, Mô tả và Hướng dẫn hệ thống không được để trống."}), 400

    base_slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') + f"-{g.current_user['id']}"
    slug = base_slug

    conn = get_db()
    cursor = conn.cursor()

    # Ensure unique slug
    suffix = 1
    while cursor.execute("SELECT id FROM agents WHERE slug = ?", (slug,)).fetchone():
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    cursor.execute("""
        INSERT INTO agents 
        (name, slug, avatar, description, category_id, system_instructions, role_desc, expertise, response_tone, ai_model, tools_enabled, is_system, is_active, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
    """, (
        name, slug, avatar, description, category_id or 1,
        system_instructions, role_desc, expertise, response_tone,
        ai_model, json.dumps(tools_enabled), g.current_user["id"]
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Tạo thành công AI Agent '{name}'!",
        "agent_id": new_id
    }), 201

@agent_bp.route("/<int:agent_id>/update", methods=["POST"])
@token_required
def update_agent(agent_id: int):
    conn = get_db()
    cursor = conn.cursor()

    agent = cursor.execute("SELECT id, user_id, is_system FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not agent:
        conn.close()
        return jsonify({"success": False, "error": "Không tìm thấy Agent."}), 404

    # System agents can only be edited by admin; custom agents by creator or admin
    if agent["is_system"] and g.current_user["role"] != "admin":
        conn.close()
        return jsonify({"success": False, "error": "Chỉ Quản trị viên Admin mới có quyền sửa Agent mặc định hệ thống."}), 403

    if not agent["is_system"] and agent["user_id"] != g.current_user["id"] and g.current_user["role"] != "admin":
        conn.close()
        return jsonify({"success": False, "error": "Bạn không có quyền chỉnh sửa Agent của người dùng khác."}), 403

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    avatar = data.get("avatar", "🤖").strip()
    description = data.get("description", "").strip()
    category_id = data.get("category_id")
    system_instructions = data.get("system_instructions", "").strip()
    role_desc = data.get("role_desc", "").strip()
    expertise = data.get("expertise", "").strip()
    response_tone = data.get("response_tone", "").strip()
    ai_model = data.get("ai_model", "").strip()
    tools_enabled = data.get("tools_enabled", [])

    cursor.execute("""
        UPDATE agents SET
            name = COALESCE(NULLIF(?, ''), name),
            avatar = COALESCE(NULLIF(?, ''), avatar),
            description = COALESCE(NULLIF(?, ''), description),
            category_id = COALESCE(?, category_id),
            system_instructions = COALESCE(NULLIF(?, ''), system_instructions),
            role_desc = COALESCE(NULLIF(?, ''), role_desc),
            expertise = COALESCE(NULLIF(?, ''), expertise),
            response_tone = COALESCE(NULLIF(?, ''), response_tone),
            ai_model = COALESCE(NULLIF(?, ''), ai_model),
            tools_enabled = ?
        WHERE id = ?
    """, (name, avatar, description, category_id, system_instructions, role_desc, expertise, response_tone, ai_model, json.dumps(tools_enabled), agent_id))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Cập nhật Agent thành công!"})

@agent_bp.route("/<int:agent_id>/delete", methods=["POST", "DELETE"])
@token_required
def delete_agent(agent_id: int):
    conn = get_db()
    cursor = conn.cursor()

    agent = cursor.execute("SELECT id, user_id, is_system FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not agent:
        conn.close()
        return jsonify({"success": False, "error": "Không tìm thấy Agent."}), 404

    if agent["is_system"]:
        conn.close()
        return jsonify({"success": False, "error": "Không thể xóa Agent mặc định của hệ thống."}), 403

    if agent["user_id"] != g.current_user["id"] and g.current_user["role"] != "admin":
        conn.close()
        return jsonify({"success": False, "error": "Bạn không có quyền xóa Agent này."}), 403

    cursor.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Đã xóa AI Agent thành công!"})

@agent_bp.route("/<int:agent_id>/duplicate", methods=["POST"])
@token_required
def duplicate_agent(agent_id: int):
    conn = get_db()
    cursor = conn.cursor()

    agent = cursor.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not agent:
        conn.close()
        return jsonify({"success": False, "error": "Không tìm thấy Agent."}), 404

    new_name = f"{agent['name']} (Bản sao)"
    new_slug = re.sub(r'[^a-z0-9]+', '-', new_name.lower()).strip('-') + f"-{g.current_user['id']}"

    cursor.execute("""
        INSERT INTO agents 
        (name, slug, avatar, description, category_id, system_instructions, role_desc, expertise, response_tone, ai_model, tools_enabled, is_system, is_active, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
    """, (
        new_name, new_slug, agent["avatar"], agent["description"], agent["category_id"],
        agent["system_instructions"], agent["role_desc"], agent["expertise"], agent["response_tone"],
        agent["ai_model"], agent["tools_enabled"], g.current_user["id"]
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Đã nhân bản Agent thành công!", "new_agent_id": new_id})

@agent_bp.route("/<int:agent_id>/test", methods=["POST"])
@token_required
def test_agent_sandbox(agent_id: int):
    """Test custom agent in sandbox drawer with real AI provider."""
    data = request.get_json() or {}
    test_prompt = data.get("prompt", "Hãy giới thiệu bản thân và cách bạn có thể giúp tôi.").strip()

    conn = get_db()
    agent = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    conn.close()

    if not agent:
        return jsonify({"success": False, "error": "Không tìm thấy Agent."}), 404

    provider = get_ai_provider()
    try:
        res = provider.generate(
            prompt=test_prompt,
            system_prompt=agent["system_instructions"],
            model=agent["ai_model"]
        )
        return jsonify({"success": True, "response": res["text"]})
    except AIProviderException as e:
        return jsonify({"success": False, "error": str(e), "code": e.code}), 400

