import sys
import json
import io
from app import app
from database import get_db

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_tests():
    client = app.test_client()
    print("=== BAT DAU KIEM THU TOAN DIEN BACKEND & DATABASE NEXORA AI ===")

    # 1. Test Index HTML
    res = client.get("/")
    assert res.status_code == 200, f"Index failed: {res.status_code}"
    assert b"NEXORA AI" in res.data, "Title not found in index"
    print("✓ 1. Trang chu Index & UI HTML: OK (200)")

    # 2. Test System Status
    res = client.get("/api/system/status")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "online"
    print(f"✓ 2. API He thong Status: OK (version {data['version']}, provider: {data['default_provider']})")

    # 3. Test Categories
    res = client.get("/api/agents/categories")
    assert res.status_code == 200
    cats = res.get_json().get("categories", [])
    assert len(cats) >= 8, f"Expected 8 categories, got {len(cats)}"
    print(f"✓ 3. Thư viện danh mục Agents: OK ({len(cats)} categories)")

    # 4. Test Agents List (includes standard agents + DeepSeek Muse)
    res = client.get("/api/agents")
    assert res.status_code == 200
    agents = res.get_json().get("agents", [])
    assert len(agents) >= 9, f"Expected at least 9 agents, got {len(agents)}"
    muse_agent = next((a for a in agents if a["slug"] == "dsh-muse-agent"), None)
    assert muse_agent is not None, "DeepSeek Harness Muse agent not found in database"
    print(f"✓ 4. Thư viện AI Agents & DeepSeek Muse: OK ({len(agents)} agents)")

    # 5. Test Demo User Login
    res = client.post("/api/auth/login", json={
        "identifier": "demo@nexora.ai",
        "password": "demo123"
    })
    assert res.status_code == 200, f"Demo login failed: {res.data}"
    demo_data = res.get_json()
    demo_token = demo_data["token"]
    assert demo_token, "No token returned for demo user"
    print("✓ 5. Dang nhap Demo User: OK (JWT token generated)")

    # 6. Test Admin User Login
    res = client.post("/api/auth/login", json={
        "identifier": "admin@nexora.ai",
        "password": "admin123"
    })
    assert res.status_code == 200, f"Admin login failed: {res.data}"
    admin_data = res.get_json()
    admin_token = admin_data["token"]
    assert admin_data["user"]["role"] == "admin"
    print("✓ 6. Dang nhap Admin User: OK (Role admin verified)")

    # 7. Test Admin Stats
    res = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200, f"Admin stats failed: {res.data}"
    stats_data = res.get_json()
    assert "stats" in stats_data
    print(f"✓ 7. Admin Dashboard API & Stats: OK (Total users: {stats_data['stats']['total_users']})")

    # 8. Test Conversations List
    res = client.get("/api/chat/conversations", headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200
    convs = res.get_json().get("conversations", [])
    print(f"✓ 8. API Hoi thoai Chat: OK ({len(convs)} active conversations)")

    # 9. Test Knowledge Base Upload & RAG Chunking
    test_content = "NEXORA AI là nền tảng Multi-Agent thế hệ mới. Hệ thống tích hợp 8 chuyên gia AI và hỗ trợ điều phối đa tác nhân xử lý các bài toán phức tạp từ nghiên cứu, số liệu, tiếp thị tới viết báo cáo."
    file_data = (io.BytesIO(test_content.encode("utf-8")), "nexora_intro.txt")
    res = client.post(
        "/api/knowledge/upload",
        data={"file": file_data},
        content_type="multipart/form-data",
        headers={"Authorization": f"Bearer {demo_token}"}
    )
    assert res.status_code in (200, 201), f"Upload failed: {res.data}"
    upload_res = res.get_json()
    assert upload_res["success"] is True
    doc_id = upload_res["document"]["id"]
    print(f"✓ 9. Knowledge Base Upload & RAG Chunking: OK (Created {upload_res['document']['chunk_count']} chunks)")

    # 10. Test RAG Semantic Search
    res = client.post("/api/knowledge/search", json={
        "query": "nền tảng Multi-Agent thế hệ mới"
    }, headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200
    search_res = res.get_json()
    assert len(search_res["results"]) > 0, "RAG search returned 0 results"
    print(f"✓ 10. RAG Search & Chunk Retrieval: OK (Found {len(search_res['results'])} matching chunks)")

    # Clean up uploaded test document from database
    client.delete(f"/api/knowledge/documents/{doc_id}", headers={"Authorization": f"Bearer {demo_token}"})

    # 11. Test Multi-Agent Workflow Creation
    res = client.post("/api/workflows/create", json={
        "goal": "Lập kế hoạch kinh doanh mở chuỗi quán cà phê công nghệ tại TP.HCM"
    }, headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code in (200, 201), f"Workflow create failed: {res.data}"
    wf_res = res.get_json()
    assert "workflow_id" in wf_res
    print(f"✓ 11. Khoi tao Multi-Agent Workflow Backend: OK (Workflow ID: {wf_res['workflow_id']})")

    # 12. Test Agent Studio Creation
    res = client.post("/api/agents/create", json={
        "name": "AI Startup Advisor",
        "avatar": "🚀",
        "description": "Cố vấn khởi nghiệp và mô hình Lean Startup",
        "system_instructions": "Bạn là chuyên gia cố vấn khởi nghiệp tại NEXORA AI. Giúp người dùng tinh gọn mô hình kinh doanh.",
        "role_desc": "Cố vấn khởi nghiệp",
        "expertise": "Lean Startup, Pitching, MVP",
        "response_tone": "Truyền cảm hứng, sắc sảo",
        "ai_model": "gemini-2.0-flash",
        "tools_enabled": ["rag", "web_search"]
    }, headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code in (200, 201), f"Agent create failed: {res.data}"
    print("✓ 12. Agent Studio (Tự tạo Custom Agent): OK")

    # 13. Test User Personal API Keys Management (Gemini / OpenAI / DeepSeek)
    res = client.post("/api/auth/keys", json={
        "provider": "gemini",
        "api_key": "AIzaSyTestMockKey12345"
    }, headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200, f"Save user key failed: {res.data}"
    
    res = client.get("/api/auth/keys", headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200
    keys_res = res.get_json().get("keys", {})
    assert keys_res.get("gemini") is True
    print("✓ 13. Quan ly User Personal API Keys (user_api_keys): OK")

    # 14. Test Continuous Self-Learning Memory (ChatGPT / Gemini Memory)
    res = client.post("/api/chat/memory", json={
        "topic": "Sở thích lập trình",
        "content": "Người dùng là lập trình viên chuyên sâu C++ và AI Agents"
    }, headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200
    mem_res = res.get_json()
    assert mem_res["success"] is True
    mem_id = mem_res["memory_id"]

    res = client.get("/api/chat/memory", headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200
    memories = res.get_json().get("memories", [])
    assert any(m["id"] == mem_id for m in memories)
    print("✓ 14. AI Continuous Self-Learning Memory (ai_memories): OK")

    # 15. Test Conversation Management (Rename, Favorite, Export)
    # Create conversation
    res = client.post("/api/chat/conversations/create", json={
        "title": "Hội thoại thử nghiệm Backend"
    }, headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 201
    c_id = res.get_json()["conversation"]["id"]

    # Rename
    res = client.post(f"/api/chat/conversations/{c_id}/rename", json={
        "title": "Hội thoại đã đổi tên thành công"
    }, headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200

    # Toggle favorite
    res = client.post(f"/api/chat/conversations/{c_id}/favorite", headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200
    assert res.get_json()["is_favorite"] == 1

    # Export conversation as TXT
    res = client.get(f"/api/chat/conversations/{c_id}/export?format=txt", headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200
    assert b"NEXORA AI CONVERSATION EXPORT" in res.data
    print("✓ 15. Quan ly hoi thoai (Doi ten, Yeu thich, Export TXT): OK")

    # 16. Test Token Refresh
    res = client.post("/api/auth/refresh-token", headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200
    assert "token" in res.get_json()
    print("✓ 16. Refresh JWT Token API: OK")

    # 17. Verify WAL Journal Mode on live connection
    conn = get_db()
    journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
    conn.close()
    assert journal_mode.lower() == "wal", f"Expected WAL mode, got {journal_mode}"
    print(f"✓ 17. SQLite Concurrency (WAL Mode): OK ({journal_mode.upper()})")

    print("\n🎉 TAT CA 17/17 BAI KIEM TRA BACKEND & DATABASE DEU THANH CONG 100%!")

if __name__ == "__main__":
    run_tests()
