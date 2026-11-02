import sys
import json
import io
from app import app
from database import get_db

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_tests():
    client = app.test_client()
    print("=== BAT DAU KIEM THU HE THONG NEXORA AI ===")

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

    # 4. Test Agents List
    res = client.get("/api/agents")
    assert res.status_code == 200
    agents = res.get_json().get("agents", [])
    assert len(agents) >= 8, f"Expected at least 8 agents, got {len(agents)}"
    print(f"✓ 4. Thư viện 8 AI Agents chuẩn: OK ({len(agents)} agents)")

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
    print(f"✓ 9. Knowledge Base Upload & RAG Chunking: OK (Created {upload_res['document']['chunk_count']} chunks)")

    # 10. Test RAG Semantic Search
    res = client.post("/api/knowledge/search", json={
        "query": "nền tảng Multi-Agent thế hệ mới"
    }, headers={"Authorization": f"Bearer {demo_token}"})
    assert res.status_code == 200
    search_res = res.get_json()
    assert len(search_res["results"]) > 0, "RAG search returned 0 results"
    print(f"✓ 10. RAG Search & Chunk Retrieval: OK (Found {len(search_res['results'])} matching chunks)")

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

    print("\n🎉 TAT CA 12/12 BAI KIEM THU DEU THANH CONG 100%!")

if __name__ == "__main__":
    run_tests()
