import os
import uuid
from pathlib import Path
from flask import Blueprint, request, jsonify, g
from werkzeug.utils import secure_filename
from config import Config
from database import get_db
from auth import token_required
from rag_service import RAGService

rag_bp = Blueprint("rag_bp", __name__)

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "csv", "xlsx", "md"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@rag_bp.route("/documents", methods=["GET"])
@token_required
def get_documents():
    user_id = g.current_user["id"]
    agent_id = request.args.get("agent_id")
    search = request.args.get("search", "").strip().lower()

    conn = get_db()
    query = """
        SELECT d.*, a.name AS agent_name, a.avatar AS agent_avatar
        FROM documents d
        LEFT JOIN agents a ON d.agent_id = a.id
        WHERE d.user_id = ?
    """
    params = [user_id]

    if agent_id:
        query += " AND d.agent_id = ?"
        params.append(agent_id)

    if search:
        query += " AND LOWER(d.original_name) LIKE ?"
        params.append(f"%{search}%")

    query += " ORDER BY d.id DESC"
    docs = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify({"success": True, "documents": [dict(d) for d in docs]})

@rag_bp.route("/upload", methods=["POST"])
@token_required
def upload_document():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "Vui lòng chọn file để tải lên."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "error": "Chưa chọn file nào."}), 400

    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Định dạng file không được hỗ trợ. Chỉ chấp nhận PDF, DOCX, TXT, CSV, XLSX, MD."}), 400

    agent_id = request.form.get("agent_id")
    agent_id = int(agent_id) if agent_id and agent_id.isdigit() else None

    original_name = file.filename
    ext = original_name.rsplit(".", 1)[1].lower()
    unique_filename = f"{uuid.uuid4().hex}_{secure_filename(original_name)}"
    saved_path = Config.UPLOAD_FOLDER / unique_filename

    # Save file to disk
    file.save(saved_path)
    file_size = os.path.getsize(saved_path)

    # Insert document record
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO documents (user_id, agent_id, filename, original_name, file_type, file_size)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (g.current_user["id"], agent_id, unique_filename, original_name, ext, file_size))
    doc_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # Index document chunks for RAG
    chunk_count = RAGService.process_and_index_document(doc_id, str(saved_path), ext)

    return jsonify({
        "success": True,
        "message": f"Tải lên và xử lý thành công tài liệu '{original_name}' ({chunk_count} phân đoạn tri thức)!",
        "document": {
            "id": doc_id,
            "original_name": original_name,
            "file_type": ext,
            "file_size": file_size,
            "chunk_count": chunk_count
        }
    }), 201

@rag_bp.route("/documents/<int:doc_id>", methods=["DELETE"])
@token_required
def delete_document(doc_id: int):
    conn = get_db()
    cursor = conn.cursor()
    doc = cursor.execute("SELECT * FROM documents WHERE id = ? AND user_id = ?", (doc_id, g.current_user["id"])).fetchone()

    if not doc:
        conn.close()
        return jsonify({"success": False, "error": "Không tìm thấy tài liệu."}), 404

    # Delete physical file
    file_path = Config.UPLOAD_FOLDER / doc["filename"]
    if file_path.exists():
        try:
            os.remove(file_path)
        except Exception:
            pass

    # Delete from DB
    cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Đã xóa tài liệu khỏi kho kiến thức."})

@rag_bp.route("/search", methods=["POST"])
@token_required
def search_knowledge():
    """Test RAG retrieval on user documents."""
    data = request.get_json() or {}
    query = data.get("query", "").strip()
    agent_id = data.get("agent_id")

    if not query:
        return jsonify({"success": False, "error": "Vui lòng nhập từ khóa tìm kiếm."}), 400

    chunks = RAGService.search_relevant_chunks(
        query=query,
        user_id=g.current_user["id"],
        agent_id=agent_id,
        top_k=5
    )

    return jsonify({
        "success": True,
        "query": query,
        "results": chunks,
        "count": len(chunks)
    })

