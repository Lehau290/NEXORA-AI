import json
import time
from flask import Blueprint, request, jsonify, Response, stream_with_context, g
from database import get_db
from auth import token_required
from ai_service import get_ai_provider, FreeUniversalAIProvider, AIProviderException
from rag_service import RAGService

chat_bp = Blueprint("chat_bp", __name__)

@chat_bp.route("/conversations", methods=["GET"])
@token_required
def get_conversations():
    user_id = g.current_user["id"]
    agent_id = request.args.get("agent_id")
    is_fav = request.args.get("favorite")

    conn = get_db()
    query = """
        SELECT c.*, a.name AS agent_name, a.avatar AS agent_avatar, a.slug AS agent_slug,
               (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) AS last_message,
               (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) AS last_message_time,
               (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) AS message_count
        FROM conversations c
        JOIN agents a ON c.agent_id = a.id
        WHERE c.user_id = ?
    """
    params = [user_id]

    if agent_id:
        query += " AND c.agent_id = ?"
        params.append(agent_id)

    if is_fav == "1":
        query += " AND c.is_favorite = 1"

    query += " ORDER BY c.updated_at DESC, c.id DESC"
    conversations = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify({
        "success": True,
        "conversations": [dict(c) for c in conversations]
    })

@chat_bp.route("/conversations/create", methods=["POST"])
@token_required
def create_conversation():
    data = request.get_json() or {}
    agent_id = data.get("agent_id")
    title = data.get("title", "").strip()

    conn = get_db()
    cursor = conn.cursor()

    if not agent_id:
        # Default to general assistant
        agent = cursor.execute("SELECT id FROM agents WHERE slug = 'general-assistant'").fetchone()
        agent_id = agent["id"] if agent else 1
    else:
        agent = cursor.execute("SELECT id, name FROM agents WHERE id = ?", (agent_id,)).fetchone()
        if not agent:
            conn.close()
            return jsonify({"success": False, "error": "Agent không tồn tại."}), 404

    if not title:
        title = f"Cuộc trò chuyện mới ({time.strftime('%H:%M %d/%m')})"

    cursor.execute("""
        INSERT INTO conversations (user_id, agent_id, title)
        VALUES (?, ?, ?)
    """, (g.current_user["id"], agent_id, title))
    conv_id = cursor.lastrowid
    conn.commit()

    new_conv = cursor.execute("""
        SELECT c.*, a.name AS agent_name, a.avatar AS agent_avatar, a.slug AS agent_slug
        FROM conversations c
        JOIN agents a ON c.agent_id = a.id
        WHERE c.id = ?
    """, (conv_id,)).fetchone()
    conn.close()

    return jsonify({
        "success": True,
        "conversation": dict(new_conv)
    }), 201

@chat_bp.route("/conversations/<int:conv_id>", methods=["GET"])
@token_required
def get_conversation_messages(conv_id: int):
    conn = get_db()
    user_id = g.current_user["id"]

    conv = conn.execute("""
        SELECT c.*, a.name AS agent_name, a.avatar AS agent_avatar, a.slug AS agent_slug,
               a.description AS agent_description, a.ai_model, a.tools_enabled, a.role_desc
        FROM conversations c
        JOIN agents a ON c.agent_id = a.id
        WHERE c.id = ? AND c.user_id = ?
    """, (conv_id, user_id)).fetchone()

    if not conv:
        conn.close()
        return jsonify({"success": False, "error": "Cuộc trò chuyện không tồn tại."}), 404

    messages = conn.execute("""
        SELECT id, conversation_id, sender_type, content, model_used, tokens_used, feedback, citations, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY id ASC
    """, (conv_id,)).fetchall()
    conn.close()

    conv_dict = dict(conv)
    try:
        conv_dict["tools_enabled"] = json.loads(conv_dict["tools_enabled"])
    except Exception:
        conv_dict["tools_enabled"] = []

    msg_list = []
    for m in messages:
        m_dict = dict(m)
        try:
            m_dict["citations"] = json.loads(m_dict["citations"]) if m_dict["citations"] else []
        except Exception:
            m_dict["citations"] = []
        msg_list.append(m_dict)

    return jsonify({
        "success": True,
        "conversation": conv_dict,
        "messages": msg_list
    })

@chat_bp.route("/conversations/<int:conv_id>/rename", methods=["POST"])
@token_required
def rename_conversation(conv_id: int):
    data = request.get_json() or {}
    new_title = data.get("title", "").strip()
    if not new_title:
        return jsonify({"success": False, "error": "Tiêu đề không được để trống."}), 400

    conn = get_db()
    conn.execute("""
        UPDATE conversations 
        SET title = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND user_id = ?
    """, (new_title, conv_id, g.current_user["id"]))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Đã đổi tên cuộc trò chuyện thành công!"})

@chat_bp.route("/conversations/<int:conv_id>/favorite", methods=["POST"])
@token_required
def toggle_favorite_conversation(conv_id: int):
    conn = get_db()
    cursor = conn.cursor()
    conv = cursor.execute("SELECT is_favorite FROM conversations WHERE id = ? AND user_id = ?", (conv_id, g.current_user["id"])).fetchone()
    if not conv:
        conn.close()
        return jsonify({"success": False, "error": "Không tìm thấy cuộc trò chuyện."}), 404

    new_fav = 0 if conv["is_favorite"] else 1
    cursor.execute("UPDATE conversations SET is_favorite = ? WHERE id = ?", (new_fav, conv_id))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "is_favorite": new_fav})

@chat_bp.route("/conversations/<int:conv_id>/delete", methods=["POST", "DELETE"])
@token_required
def delete_conversation(conv_id: int):
    conn = get_db()
    conn.execute("DELETE FROM conversations WHERE id = ? AND user_id = ?", (conv_id, g.current_user["id"]))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Đã xóa cuộc trò chuyện."})

@chat_bp.route("/conversations/<int:conv_id>/export", methods=["GET"])
@token_required
def export_conversation(conv_id: int):
    export_format = request.args.get("format", "txt").lower()
    conn = get_db()
    conv = conn.execute("""
        SELECT c.title, a.name AS agent_name, c.created_at
        FROM conversations c
        JOIN agents a ON c.agent_id = a.id
        WHERE c.id = ? AND c.user_id = ?
    """, (conv_id, g.current_user["id"])).fetchone()

    if not conv:
        conn.close()
        return jsonify({"success": False, "error": "Không tìm thấy cuộc trò chuyện."}), 404

    messages = conn.execute("""
        SELECT sender_type, content, created_at FROM messages
        WHERE conversation_id = ? ORDER BY id ASC
    """, (conv_id,)).fetchall()
    conn.close()

    if export_format == "txt":
        lines = [
            f"=== NEXORA AI CONVERSATION EXPORT ===",
            f"Chủ đề: {conv['title']}",
            f"Trợ lý: {conv['agent_name']}",
            f"Thời gian: {conv['created_at']}",
            "=" * 40,
            ""
        ]
        for m in messages:
            sender = "BẠN (USER)" if m["sender_type"] == "user" else f"AI ({conv['agent_name']})"
            lines.append(f"[{m['created_at']}] {sender}:")
            lines.append(m["content"])
            lines.append("-" * 30)

        txt_content = "\n".join(lines)
        return Response(
            txt_content,
            mimetype="text/plain; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=conversation_{conv_id}.txt"}
        )

    return jsonify({"success": True, "title": conv["title"], "messages": [dict(m) for m in messages]})

@chat_bp.route("/stream", methods=["POST"])
@token_required
def stream_chat():
    """Real SSE streaming chat response with RAG context and persistent history."""
    data = request.get_json() or {}
    conv_id = data.get("conversation_id")
    user_prompt = data.get("message", "").strip()
    agent_id = data.get("agent_id")
    user_id = g.current_user["id"]

    if not user_prompt:
        return jsonify({"success": False, "error": "Nội dung câu hỏi không được để trống."}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Create conversation if not specified
    if not conv_id:
        if not agent_id:
            gen_agent = cursor.execute("SELECT id FROM agents WHERE slug = 'general-assistant'").fetchone()
            agent_id = gen_agent["id"] if gen_agent else 1
        
        cursor.execute("""
            INSERT INTO conversations (user_id, agent_id, title)
            VALUES (?, ?, ?)
        """, (user_id, agent_id, user_prompt[:45] + ("..." if len(user_prompt) > 45 else "")))
        conv_id = cursor.lastrowid
        conn.commit()

    # Verify conversation ownership and fetch agent
    conv = cursor.execute("""
        SELECT c.id, c.title, c.agent_id, a.name AS agent_name, a.avatar AS agent_avatar,
               a.system_instructions, a.ai_model, a.tools_enabled
        FROM conversations c
        JOIN agents a ON c.agent_id = a.id
        WHERE c.id = ? AND c.user_id = ?
    """, (conv_id, user_id)).fetchone()

    if not conv:
        conn.close()
        return jsonify({"success": False, "error": "Cuộc trò chuyện không tồn tại."}), 404

    # 1. Save user message to database
    cursor.execute("""
        INSERT INTO messages (conversation_id, sender_type, content, model_used)
        VALUES (?, 'user', ?, 'user')
    """, (conv_id, user_prompt))
    user_msg_id = cursor.lastrowid

    # Update conversation title if first message
    msg_count = cursor.execute("SELECT COUNT(*) AS total FROM messages WHERE conversation_id = ?", (conv_id,)).fetchone()["total"]
    if msg_count <= 2:
        clean_title = user_prompt.replace("\n", " ").strip()
        short_title = clean_title[:45] + ("..." if len(clean_title) > 45 else "")
        cursor.execute("UPDATE conversations SET title = ? WHERE id = ?", (short_title, conv_id))

    cursor.execute("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (conv_id,))
    conn.commit()

    # 2. Build multi-turn context (last 6 messages)
    past_messages = cursor.execute("""
        SELECT sender_type, content FROM messages
        WHERE conversation_id = ? AND id < ?
        ORDER BY id DESC LIMIT 6
    """, (conv_id, user_msg_id)).fetchall()

    history = []
    for pm in reversed(past_messages):
        role = "user" if pm["sender_type"] == "user" else "assistant"
        history.append({"role": role, "content": pm["content"]})
    history.append({"role": "user", "content": user_prompt})

    # 3. Retrieve RAG context from uploaded knowledge docs
    rag_context, citations = RAGService.build_rag_context(user_prompt, user_id, conv["agent_id"])

    system_prompt = conv["system_instructions"]
    if rag_context:
        system_prompt = f"{system_prompt}\n\n{rag_context}"

    agent_model = conv["ai_model"]
    conn.close()

    def generate_sse():
        full_response_parts = []
        start_time = time.time()
        
        # Send initial event with conversation_id & citations
        yield f"event: init\ndata: {json.dumps({'conversation_id': conv_id, 'citations': citations})}\n\n"

        try:
            # Determine appropriate provider based on model
            prov_name = "gemini"
            if "gpt" in agent_model.lower() or "openai" in agent_model.lower():
                prov_name = "openai"
            elif "claude" in agent_model.lower() or "anthropic" in agent_model.lower():
                prov_name = "anthropic"
            elif "deepseek" in agent_model.lower():
                prov_name = "deepseek"

            # Check user personal API key from user_api_keys table
            user_api_key = None
            try:
                db_k = get_db()
                k_row = db_k.execute("SELECT api_key_encrypted FROM user_api_keys WHERE user_id = ? AND provider = ? AND is_active = 1", (user_id, prov_name)).fetchone()
                if not k_row:
                    k_row = db_k.execute("SELECT provider, api_key_encrypted FROM user_api_keys WHERE user_id = ? AND is_active = 1 LIMIT 1", (user_id,)).fetchone()
                    if k_row:
                        prov_name = k_row["provider"]
                if k_row:
                    raw_k = k_row["api_key_encrypted"]
                    if raw_k and "testmock" not in raw_k.lower() and len(raw_k.strip()) > 10:
                        user_api_key = raw_k.strip()
                db_k.close()
            except Exception:
                pass

            provider = get_ai_provider(provider_name=prov_name, user_api_key=user_api_key)
            for chunk in provider.stream_generate(history, system_prompt=system_prompt, model=agent_model):
                full_response_parts.append(chunk)
                yield f"event: chunk\ndata: {json.dumps({'text': chunk})}\n\n"

        except (AIProviderException, Exception) as e:
            try:
                fallback_prov = FreeUniversalAIProvider()
                for chunk in fallback_prov.stream_generate(history, system_prompt=system_prompt, model=agent_model):
                    full_response_parts.append(chunk)
                    yield f"event: chunk\ndata: {json.dumps({'text': chunk})}\n\n"
            except Exception as inner_e:
                err_msg = f"\n\n> ⚠️ **Thông báo kết nối AI**: {str(inner_e or e)}\n\n*Gợi ý: Bạn có thể cập nhật API Key cá nhân trong mục Hồ sơ & Cài đặt (Profile & Settings) để tiếp tục.*"
                full_response_parts.append(err_msg)
                yield f"event: error\ndata: {json.dumps({'error': str(inner_e or e)})}\n\n"

        # Complete response & persist assistant message
        final_text = "".join(full_response_parts)
        duration_ms = int((time.time() - start_time) * 1000)
        tokens_est = max(10, len(final_text) // 4)

        if final_text:
            db = get_db()
            db_cursor = db.cursor()
            db_cursor.execute("""
                INSERT INTO messages (conversation_id, sender_type, content, model_used, tokens_used, citations)
                VALUES (?, 'assistant', ?, ?, ?, ?)
            """, (conv_id, final_text, agent_model, tokens_est, json.dumps(citations)))
            asst_msg_id = db_cursor.lastrowid

            # Record usage
            db_cursor.execute("""
                INSERT INTO usage_logs (user_id, action_type, model, tokens_in, tokens_out, duration_ms)
                VALUES (?, 'chat', ?, ?, ?, ?)
            """, (user_id, agent_model, len(user_prompt) // 4, tokens_est, duration_ms))

            # Update subscription usage
            db_cursor.execute("""
                UPDATE subscriptions SET tokens_used = tokens_used + ? WHERE user_id = ?
            """, (tokens_est, user_id))

            db.commit()
            db.close()

            yield f"event: done\ndata: {json.dumps({'message_id': asst_msg_id, 'tokens': tokens_est})}\n\n"

    return Response(
        stream_with_context(generate_sse()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )

@chat_bp.route("/messages/<int:msg_id>/feedback", methods=["POST"])
@token_required
def message_feedback(msg_id: int):
    data = request.get_json() or {}
    feedback = data.get("feedback")  # 'like', 'dislike', or None

    conn = get_db()
    conn.execute("UPDATE messages SET feedback = ? WHERE id = ?", (feedback, msg_id))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "feedback": feedback})

@chat_bp.route("/messages/<int:msg_id>", methods=["DELETE"])
@token_required
def delete_message(msg_id: int):
    conn = get_db()
    conn.execute("DELETE FROM messages WHERE id = ?", (msg_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Đã xóa tin nhắn."})

# ============================================================
# AI CONTINUOUS MEMORY / SELF-LEARNING (ChatGPT & Gemini Memory)
# ============================================================

@chat_bp.route("/memory", methods=["GET"])
@token_required
def get_user_memories():
    conn = get_db()
    memories = conn.execute("""
        SELECT id, topic, content, created_at 
        FROM ai_memories 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    """, (g.current_user["id"],)).fetchall()
    conn.close()
    return jsonify({"success": True, "memories": [dict(m) for m in memories]})

@chat_bp.route("/memory", methods=["POST"])
@token_required
def add_user_memory():
    data = request.get_json() or {}
    content = data.get("content", "").strip()
    topic = data.get("topic", "Kiến thức tự học").strip()
    if not content:
        return jsonify({"success": False, "error": "Nội dung ghi nhớ không được để trống."}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO ai_memories (user_id, topic, content)
        VALUES (?, ?, ?)
    """, (g.current_user["id"], topic, content))
    conn.commit()
    mem_id = cursor.lastrowid
    conn.close()
    return jsonify({"success": True, "message": "AI đã ghi nhớ kiến thức mới thành công!", "memory_id": mem_id})

@chat_bp.route("/memory/<int:mem_id>", methods=["DELETE"])
@token_required
def delete_user_memory(mem_id: int):
    conn = get_db()
    conn.execute("DELETE FROM ai_memories WHERE id = ? AND user_id = ?", (mem_id, g.current_user["id"]))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Đã xóa ký ức khỏi bộ nhớ AI."})

