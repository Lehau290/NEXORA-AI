import json
from flask import Blueprint, request, jsonify, g
from database import get_db
from auth import token_required
from multi_agent import MultiAgentOrchestrator

workflow_bp = Blueprint("workflow_bp", __name__)

@workflow_bp.route("", methods=["GET"])
@token_required
def get_user_workflows():
    conn = get_db()
    workflows = conn.execute("""
        SELECT w.*,
               (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = w.id) AS total_steps,
               (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = w.id AND status = 'completed') AS completed_steps
        FROM workflows w
        WHERE w.user_id = ?
        ORDER BY w.updated_at DESC, w.id DESC
    """, (g.current_user["id"],)).fetchall()
    conn.close()

    result = []
    for wf in workflows:
        wf_dict = dict(wf)
        total = wf_dict.get("total_steps", 0)
        done = wf_dict.get("completed_steps", 0)
        wf_dict["progress_percent"] = round((done / total * 100)) if total > 0 else 0
        result.append(wf_dict)

    return jsonify({"success": True, "workflows": result})

@workflow_bp.route("/create", methods=["POST"])
@token_required
def create_workflow():
    data = request.get_json() or {}
    goal = data.get("goal", "").strip()
    title = data.get("title", "").strip()
    agents = data.get("agents", [])  # list of agent slugs

    if not goal:
        return jsonify({"success": False, "error": "Mục tiêu dự án không được để trống."}), 400

    if not title:
        title = goal[:50] + ("..." if len(goal) > 50 else "")

    user_id = g.current_user["id"]
    workflow_id = MultiAgentOrchestrator.create_workflow(
        user_id=user_id,
        title=title,
        goal=goal,
        participating_agents=agents
    )

    # Start multi-agent execution asynchronously
    MultiAgentOrchestrator.start_workflow_async(workflow_id)

    return jsonify({
        "success": True,
        "message": "Đã khởi động quy trình Multi-Agent thành công!",
        "workflow_id": workflow_id
    }), 201

@workflow_bp.route("/<int:wf_id>", methods=["GET"])
@token_required
def get_workflow_details(wf_id: int):
    conn = get_db()
    workflow = conn.execute("""
        SELECT * FROM workflows WHERE id = ? AND user_id = ?
    """, (wf_id, g.current_user["id"])).fetchone()

    if not workflow:
        conn.close()
        return jsonify({"success": False, "error": "Không tìm thấy quy trình làm việc."}), 404

    steps = conn.execute("""
        SELECT s.*, a.name AS agent_name, a.avatar AS agent_avatar, a.slug AS agent_slug, a.role_desc
        FROM workflow_steps s
        JOIN agents a ON s.agent_id = a.id
        WHERE s.workflow_id = ?
        ORDER BY s.step_order ASC
    """, (wf_id,)).fetchall()

    tasks = conn.execute("""
        SELECT t.*, a.name AS agent_name, a.avatar AS agent_avatar
        FROM agent_tasks t
        JOIN agents a ON t.agent_id = a.id
        WHERE t.workflow_id = ?
        ORDER BY t.id ASC
    """, (wf_id,)).fetchall()
    conn.close()

    step_list = [dict(s) for s in steps]
    total_steps = len(step_list)
    completed_steps = sum(1 for s in step_list if s["status"] == "completed")
    progress = round((completed_steps / total_steps * 100)) if total_steps > 0 else 0

    return jsonify({
        "success": True,
        "workflow": dict(workflow),
        "steps": step_list,
        "tasks": [dict(t) for t in tasks],
        "progress_percent": progress
    })

@workflow_bp.route("/<int:wf_id>/pause", methods=["POST"])
@token_required
def pause_workflow(wf_id: int):
    conn = get_db()
    conn.execute("UPDATE workflows SET status = 'paused' WHERE id = ? AND user_id = ?", (wf_id, g.current_user["id"]))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Đã tạm dừng quy trình."})

@workflow_bp.route("/<int:wf_id>/resume", methods=["POST"])
@token_required
def resume_workflow(wf_id: int):
    conn = get_db()
    conn.execute("UPDATE workflows SET status = 'running' WHERE id = ? AND user_id = ?", (wf_id, g.current_user["id"]))
    conn.commit()
    conn.close()
    MultiAgentOrchestrator.start_workflow_async(wf_id)
    return jsonify({"success": True, "message": "Đã tiếp tục thực hiện quy trình."})

@workflow_bp.route("/<int:wf_id>/stop", methods=["POST"])
@token_required
def stop_workflow(wf_id: int):
    conn = get_db()
    conn.execute("UPDATE workflows SET status = 'failed' WHERE id = ? AND user_id = ?", (wf_id, g.current_user["id"]))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Đã dừng quy trình làm việc."})

@workflow_bp.route("/<int:wf_id>", methods=["DELETE"])
@token_required
def delete_workflow(wf_id: int):
    conn = get_db()
    conn.execute("DELETE FROM workflows WHERE id = ? AND user_id = ?", (wf_id, g.current_user["id"]))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Đã xóa quy trình thành công."})

