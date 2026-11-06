import sqlite3
import json
import os
import hashlib
import hmac
from datetime import datetime
from config import Config

def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with salt."""
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        bytes.fromhex(salt),
        100000
    ).hex()
    return f"{salt}:{key}"

def verify_password(stored_password: str, provided_password: str) -> bool:
    """Verify stored salt:key against provided password."""
    try:
        salt, key = stored_password.split(':')
        new_key = hashlib.pbkdf2_hmac(
            'sha256',
            provided_password.encode('utf-8'),
            bytes.fromhex(salt),
            100000
        ).hex()
        return hmac.compare_digest(key, new_key)
    except Exception:
        return False

from contextlib import contextmanager

def get_db():
    """Get SQLite database connection with row factory, WAL mode and timeout."""
    conn = sqlite3.connect(Config.DATABASE_PATH, timeout=20.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn

@contextmanager
def db_transaction():
    """Context manager for atomic database transactions with auto-commit/rollback."""
    conn = get_db()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Initialize all 15 required tables and seed data."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
    -- 1. ROLES
    CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        permissions TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. USERS
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        plan TEXT DEFAULT 'Free',
        avatar TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role) REFERENCES roles (name) ON UPDATE CASCADE
    );

    -- 3. AGENT CATEGORIES
    CREATE TABLE IF NOT EXISTS agent_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        icon TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. AGENTS
    CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        avatar TEXT NOT NULL,
        description TEXT NOT NULL,
        category_id INTEGER,
        system_instructions TEXT NOT NULL,
        role_desc TEXT NOT NULL,
        expertise TEXT NOT NULL,
        response_tone TEXT DEFAULT 'Chuyên nghiệp và chi tiết',
        ai_model TEXT DEFAULT 'gemini-2.0-flash',
        tools_enabled TEXT DEFAULT '["web_search", "code_interpreter", "rag"]',
        is_system INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES agent_categories (id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- 5. CONVERSATIONS
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        agent_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        is_favorite INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
    );

    -- 6. MESSAGES
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_type TEXT NOT NULL, -- 'user', 'assistant', 'system'
        content TEXT NOT NULL,
        model_used TEXT,
        tokens_used INTEGER DEFAULT 0,
        feedback TEXT, -- 'like', 'dislike', NULL
        citations TEXT, -- JSON array of cited sources
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    );

    -- 7. WORKFLOWS (Multi-Agent Workflows)
    CREATE TABLE IF NOT EXISTS workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'paused'
        summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- 8. WORKFLOW STEPS
    CREATE TABLE IF NOT EXISTS workflow_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER NOT NULL,
        step_order INTEGER NOT NULL,
        agent_id INTEGER,
        step_name TEXT NOT NULL,
        status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE SET NULL
    );

    -- 9. AGENT TASKS
    CREATE TABLE IF NOT EXISTS agent_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER,
        agent_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
        input_prompt TEXT,
        output_result TEXT,
        duration_ms INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE SET NULL,
        FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
    );

    -- 10. DOCUMENTS (Knowledge Base)
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        agent_id INTEGER, -- NULL means global to user, or linked to specific agent
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        chunk_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE SET NULL
    );

    -- 11. DOCUMENT CHUNKS (For RAG)
    CREATE TABLE IF NOT EXISTS document_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    );

    -- 12. FAVORITES
    CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        target_type TEXT NOT NULL, -- 'agent', 'conversation', 'workflow'
        target_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, target_type, target_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- 13. SUBSCRIPTIONS
    CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        plan_name TEXT DEFAULT 'Free',
        status TEXT DEFAULT 'active',
        tokens_limit INTEGER DEFAULT 50000,
        tokens_used INTEGER DEFAULT 0,
        valid_until DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- 14. USAGE LOGS
    CREATE TABLE IF NOT EXISTS usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action_type TEXT NOT NULL, -- 'chat', 'workflow', 'rag_query', 'file_upload'
        model TEXT,
        tokens_in INTEGER DEFAULT 0,
        tokens_out INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- 15. SYSTEM SETTINGS
    CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 16. AI MEMORIES (Continuous Self-Learning Memory like ChatGPT Memory)
    CREATE TABLE IF NOT EXISTS ai_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        topic TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- 17. USER PERSONAL API KEYS (For Gemini, OpenAI, Claude, DeepSeek)
    CREATE TABLE IF NOT EXISTS user_api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        provider TEXT NOT NULL, -- 'gemini', 'openai', 'anthropic', 'deepseek'
        api_key_encrypted TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, provider),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- 18. AUDIT LOGS (Admin actions & security audit trail)
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE SET NULL
    );

    -- INDEXES FOR MAXIMUM QUERY SPEED
    CREATE INDEX IF NOT EXISTS idx_user_api_keys ON user_api_keys(user_id, provider);
    CREATE INDEX IF NOT EXISTS idx_ai_memories_user ON ai_memories(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_logs(user_id);
    """);

    # 1. Seed Roles
    roles = [
        ("admin", "Quản trị viên toàn quyền hệ thống", json.dumps(["*"])),
        ("user", "Người dùng tiêu chuẩn", json.dumps(["chat", "create_agent", "workflow", "upload_docs"]))
    ]
    for r in roles:
        cursor.execute("""
            INSERT OR IGNORE INTO roles (name, description, permissions)
            VALUES (?, ?, ?)
        """, r)

    # 2. Seed Users
    admin_pw = hash_password("admin123")
    demo_pw = hash_password("demo123")
    user_pw = hash_password("123456")

    cursor.execute("""
        INSERT OR IGNORE INTO users (id, full_name, email, username, password_hash, role, plan, avatar)
        VALUES (1, 'NEXORA Administrator', 'admin@nexora.ai', 'admin', ?, 'admin', 'Enterprise', '👑')
    """, (admin_pw,))

    cursor.execute("""
        INSERT OR IGNORE INTO users (id, full_name, email, username, password_hash, role, plan, avatar)
        VALUES (2, 'Alex Rivers', 'demo@nexora.ai', 'demouser', ?, 'user', 'Pro', '⚡')
    """, (demo_pw,))

    # Lê Trung Hậu
    cursor.execute("""
        INSERT OR IGNORE INTO users (id, full_name, email, username, password_hash, role, plan, avatar)
        VALUES (3, 'Lê Trung Hậu', 'letrunghau@nexora.ai', 'letrunghau', ?, 'user', 'Pro', '👨‍💻')
    """, (user_pw,))

    cursor.execute("""
        INSERT OR IGNORE INTO users (id, full_name, email, username, password_hash, role, plan, avatar)
        VALUES (4, 'Lê Trung Hậu (Admin)', 'admin.hau@nexora.ai', 'admin_hau', ?, 'admin', 'Enterprise', '👑')
    """, (admin_pw,))

    # Nguyễn Thị Bảo Ngọc
    cursor.execute("""
        INSERT OR IGNORE INTO users (id, full_name, email, username, password_hash, role, plan, avatar)
        VALUES (5, 'Nguyễn Thị Bảo Ngọc', 'baongoc@nexora.ai', 'baongoc', ?, 'user', 'Pro', '👩‍💼')
    """, (user_pw,))

    cursor.execute("""
        INSERT OR IGNORE INTO users (id, full_name, email, username, password_hash, role, plan, avatar)
        VALUES (6, 'Nguyễn Thị Bảo Ngọc (Admin)', 'admin.ngoc@nexora.ai', 'admin_ngoc', ?, 'admin', 'Enterprise', '👑')
    """, (admin_pw,))

    # 3. Seed Subscriptions
    cursor.execute("""
        INSERT OR IGNORE INTO subscriptions (user_id, plan_name, tokens_limit, tokens_used)
        VALUES (1, 'Enterprise', 10000000, 12500)
    """)
    cursor.execute("""
        INSERT OR IGNORE INTO subscriptions (user_id, plan_name, tokens_limit, tokens_used)
        VALUES (2, 'Pro', 500000, 3420)
    """)
    cursor.execute("""
        INSERT OR IGNORE INTO subscriptions (user_id, plan_name, tokens_limit, tokens_used)
        VALUES (3, 'Pro', 500000, 0)
    """)
    cursor.execute("""
        INSERT OR IGNORE INTO subscriptions (user_id, plan_name, tokens_limit, tokens_used)
        VALUES (4, 'Enterprise', 10000000, 0)
    """)
    cursor.execute("""
        INSERT OR IGNORE INTO subscriptions (user_id, plan_name, tokens_limit, tokens_used)
        VALUES (5, 'Pro', 500000, 0)
    """)
    cursor.execute("""
        INSERT OR IGNORE INTO subscriptions (user_id, plan_name, tokens_limit, tokens_used)
        VALUES (6, 'Enterprise', 10000000, 0)
    """)

    # 4. Seed Agent Categories
    categories = [
        ("Tổng quát", "general", "Compass", "Trợ lý đa năng, điều phối và hỗ trợ công việc thường ngày"),
        ("Lập trình", "programming", "Code2", "Lập trình, debug mã nguồn, kiến trúc phần mềm và thuật toán"),
        ("Nghiên cứu", "research", "Search", "Nghiên cứu học thuật, tổng hợp tài liệu và trích dẫn khoa học"),
        ("Viết lách", "writing", "PenTool", "Soạn thảo văn bản, email chuyên nghiệp, bài viết và báo cáo"),
        ("Học tập", "education", "GraduationCap", "Giải thích khái niệm, tạo quiz và lập lộ trình học tập cá nhân hóa"),
        ("Phân tích dữ liệu", "analytics", "BarChart3", "Xử lý dữ liệu bảng, phân tích thống kê và trực quan hóa"),
        ("Dịch thuật", "translation", "Languages", "Dịch thuật đa ngôn ngữ chuẩn ngữ cảnh, giải thích ngữ pháp"),
        ("Tiếp thị & Kinh doanh", "marketing", "Megaphone", "Chiến lược tiếp thị, sáng tạo nội dung quảng cáo và mô hình kinh doanh")
    ]
    for cat in categories:
        cursor.execute("""
            INSERT OR IGNORE INTO agent_categories (name, slug, icon, description)
            VALUES (?, ?, ?, ?)
        """, cat)

    # Map category names to IDs
    cursor.execute("SELECT id, slug FROM agent_categories")
    cat_map = {row["slug"]: row["id"] for row in cursor.fetchall()}

    # 5. Seed 8 Standard Agents
    agents = [
        (
            "AI General Assistant",
            "general-assistant",
            "✨",
            "Trợ lý trí tuệ nhân tạo toàn diện hàng đầu. Giải đáp mọi thắc mắc, phân tích logic, tư vấn giải pháp và hỗ trợ công việc thường ngày.",
            cat_map.get("general", 1),
            "Bạn là AI General Assistant - trợ lý thông minh cao cấp của nền tảng NEXORA AI. Bạn giao tiếp tự nhiên, phân tích vấn đề thấu đáo, đưa ra câu trả lời súc tích, chính xác và có tổ chức cao bằng tiếng Việt (hoặc ngôn ngữ người dùng yêu cầu). Sử dụng Markdown đẹp mắt, cấu trúc rõ ràng với tiêu đề và bullet points.",
            "Trợ lý đa năng toàn diện",
            "Giải đáp câu hỏi đa lĩnh vực, tư duy phân tích, lập kế hoạch, tổng quan kiến thức.",
            "Thân thiện, chuyên nghiệp, thông thái",
            "gemini-2.0-flash",
            json.dumps(["web_search", "code_interpreter", "rag"]),
            1, 1, 1
        ),
        (
            "AI Coding Agent",
            "coding-agent",
            "💻",
            "Kỹ sư phần mềm AI cấp cao. Viết mã sạch (Clean Code), gỡ lỗi thần tốc, tối ưu hóa thuật toán và giải thích kiến trúc phần mềm đa ngôn ngữ.",
            cat_map.get("programming", 2),
            "Bạn là AI Coding Agent - một Senior Principal Software Engineer tại NEXORA AI. Chuyên môn của bạn là viết code chuẩn Production, debug lỗi nhanh chóng, tối ưu hiệu năng và giải thích kiến trúc hệ thống rõ ràng. Luôn bao bọc mã nguồn trong Markdown code blocks có khai báo ngôn ngữ chính xác, giải thích ngắn gọn nguyên lý và best practices.",
            "Chuyên gia phát triển phần mềm & kiến trúc",
            "Python, JavaScript/TypeScript, Go, Rust, Java, C++, SQL, Docker, CI/CD, thuật toán, debug.",
            "Chính xác, kỹ thuật cao, súc tích",
            "gemini-2.0-flash",
            json.dumps(["code_interpreter", "rag", "web_search"]),
            1, 1, 1
        ),
        (
            "AI Research Agent",
            "research-agent",
            "🔬",
            "Nhà nghiên cứu khoa học chuyên sâu. Khám phá tài liệu, phân tích dữ kiện, tổng hợp báo cáo học thuật và luôn trích dẫn nguồn kiểm chứng rõ ràng.",
            cat_map.get("research", 3),
            "Bạn là AI Research Agent - một chuyên gia nghiên cứu khoa học và phân tích tài liệu của NEXORA AI. Nhiệm vụ của bạn là tổng hợp thông tin sâu sắc, phân tích đa chiều các dữ kiện, trình bày các luận điểm logic kèm số liệu và luôn trích dẫn nguồn dẫn chứng khách quan.",
            "Nhà nghiên cứu và thẩm định thông tin",
            "Phân tích học thuật, tổng hợp tài liệu chuyên sâu, xác thực dữ liệu, tổng quan thị trường.",
            "Học thuật, logic, trung lập và sâu sắc",
            "gemini-2.0-flash",
            json.dumps(["web_search", "rag"]),
            1, 1, 1
        ),
        (
            "AI Writing Agent",
            "writing-agent",
            "✍️",
            "Bậc thầy ngôn từ và sáng tạo nội dung. Soạn thảo email doanh nghiệp, viết bài SEO, biên tập bài phát biểu và định hình phong cách viết ấn tượng.",
            cat_map.get("writing", 4),
            "Bạn là AI Writing Agent - cây bút sáng tạo xuất sắc tại NEXORA AI. Bạn có khả năng nắm bắt giọng điệu linh hoạt: từ thư từ ngoại giao trang trọng, báo cáo quản trị sắc bén, cho tới bài viết truyền thông lôi cuốn và kịch bản truyền cảm hứng. Tinh chỉnh từ ngữ gãy gọn, giàu hình ảnh và thuyết phục.",
            "Chuyên gia sáng tạo nội dung & biên tập",
            "Copywriting, Storytelling, Email doanh nghiệp, Bài xã luận, Báo cáo chuyên đề, SEO Content.",
            "Lôi cuốn, tinh tế, giàu cảm xúc và sắc bén",
            "gemini-2.0-flash",
            json.dumps(["rag"]),
            1, 1, 1
        ),
        (
            "AI Study Agent",
            "study-agent",
            "🎓",
            "Gia sư trí tuệ nhân tạo tận tâm. Đơn giản hóa kiến thức phức tạp bằng phương pháp Feynman, tạo đề thi thử nghiệm và thiết kế lộ trình học tập cá nhân hóa.",
            cat_map.get("education", 5),
            "Bạn là AI Study Agent - một gia sư thông thái và tận tâm tại NEXORA AI. Phương châm của bạn là áp dụng kỹ thuật Feynman: giải thích mọi khái niệm hóc búa theo cách dễ hiểu nhất thông qua ví dụ thực tế và phép loại suy. Khi được yêu cầu, hãy chủ động tạo câu hỏi ôn tập, câu đố trắc nghiệm và gợi ý bài tập nâng cao.",
            "Cố vấn giáo dục và gia sư cá nhân",
            "Toán, Khoa học, Ngoại ngữ, Lịch sử, Kỹ năng tư duy phản biện, Xây dựng lộ trình ôn thi.",
            "Ân cần, khích lệ, dễ hiểu và sư phạm",
            "gemini-2.0-flash",
            json.dumps(["rag"]),
            1, 1, 1
        ),
        (
            "AI Data Analyst",
            "data-analyst",
            "📊",
            "Chuyên viên phân tích dữ liệu và thống kê. Đọc hiểu file CSV, Excel, bóc tách insight kinh doanh, tính toán chỉ số quan trọng và đề xuất biểu đồ trực quan.",
            cat_map.get("analytics", 6),
            "Bạn là AI Data Analyst - chuyên gia phân tích dữ liệu của NEXORA AI. Bạn phân tích dữ liệu dạng bảng, tính toán các chỉ số thống kê (Mean, Median, Std, CAGR, ROI, Conversion Rates), tìm kiếm mối tương quan, chỉ ra các điểm bất thường (outliers) và đề xuất các giải pháp kinh doanh mang tính hành động cao.",
            "Chuyên gia phân tích dữ liệu & BI",
            "Phân tích CSV/Excel, Thống kê mô tả, Mô hình hóa dự báo, Trực quan hóa dữ liệu, SQL insights.",
            "Dựa trên dữ liệu, khách quan, định lượng",
            "gemini-2.0-flash",
            json.dumps(["code_interpreter", "rag"]),
            1, 1, 1
        ),
        (
            "AI Translator",
            "translator-agent",
            "🌐",
            "Chuyên gia ngôn ngữ học và dịch thuật đa ngữ. Chuyển ngữ chuẩn văn phong bản địa, dịch tài liệu chuyên ngành và giải thích ngữ pháp chi tiết.",
            cat_map.get("translation", 7),
            "Bạn là AI Translator - chuyên gia dịch thuật đa ngữ cao cấp tại NEXORA AI. Bạn không dịch theo lối 'word-by-word' cơ học mà chuyển ngữ mượt mà theo đúng ngữ cảnh văn hóa, sắc thái tình cảm và thuật ngữ chuyên ngành (Y khoa, Luật, Công nghệ, Kinh tế). Đồng thời chỉ ra các thành ngữ hoặc lưu ý ngữ pháp hữu ích.",
            "Chuyên gia ngôn ngữ & dịch thuật quốc tế",
            "Dịch thuật Anh - Việt, Nhật, Hàn, Trung, Pháp, Đức; Chuyển ngữ thuật ngữ kỹ thuật, Hiệu đính bản dịch.",
            "Mượt mà, chuẩn văn hóa bản địa, tinh tế",
            "gemini-2.0-flash",
            json.dumps(["rag"]),
            1, 1, 1
        ),
        (
            "AI Marketing Agent",
            "marketing-agent",
            "🚀",
            "Chiến lược gia tiếp thị & tăng trưởng số. Lập kế hoạch Go-To-Market, định vị thương hiệu, viết kịch bản quảng cáo và tối ưu hóa phễu khách hàng.",
            cat_map.get("marketing", 8),
            "Bạn là AI Marketing Agent - một CMO và Chiến lược gia Tăng trưởng (Growth Strategist) của NEXORA AI. Chuyên môn của bạn là thiết kế chiến lược Go-To-Market (GTM), định vị thương hiệu khác biệt, xây dựng phễu chuyển đổi (AARRR), lên ý tưởng chiến dịch lan truyền (viral campaigns) và tối ưu hóa ngân sách tiếp thị số.",
            "Chiến lược gia Marketing & Tăng trưởng",
            "Go-To-Market, Phân khúc khách hàng (STP), Content Marketing, Performance Ads, Phễu chuyển đổi.",
            "Sáng tạo, đột phá, hướng kết quả, sắc sảo",
            "gemini-2.0-flash",
            json.dumps(["web_search", "rag"]),
            1, 1, 1
        )
    ]

    for ag in agents:
        cursor.execute("""
            INSERT OR IGNORE INTO agents 
            (name, slug, avatar, description, category_id, system_instructions, role_desc, expertise, response_tone, ai_model, tools_enabled, is_system, is_active, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ag)

    # 6. Seed System Settings
    settings = [
        ("site_name", "NEXORA AI", "Tên nền tảng"),
        ("site_tagline", "One Platform. Multiple AI Agents. Infinite Possibilities.", "Khẩu hiệu nền tảng"),
        ("default_provider", "gemini", "Nhà cung cấp AI mặc định"),
        ("default_model", "gemini-2.0-flash", "Mô hình AI mặc định"),
        ("allow_user_registration", "true", "Cho phép người dùng tự đăng ký"),
        ("max_daily_requests", "100", "Số yêu cầu tối đa mỗi ngày cho tài khoản Free"),
        ("enable_web_search", "true", "Bật tính năng tìm kiếm web cho AI"),
        ("system_version", "2.5.0-pro", "Phiên bản hệ thống")
    ]
    for s in settings:
        cursor.execute("""
            INSERT OR IGNORE INTO system_settings (key, value, description)
            VALUES (?, ?, ?)
        """, s)

    # 7. Seed a sample conversation for Demo User so dashboard has immediate live data
    cursor.execute("SELECT id FROM agents WHERE slug = 'general-assistant'")
    gen_agent = cursor.fetchone()
    if gen_agent:
        cursor.execute("""
            INSERT OR IGNORE INTO conversations (id, user_id, agent_id, title, is_favorite)
            VALUES (1, 2, ?, 'Kế hoạch phát triển dự án công nghệ AI Agents', 1)
        """, (gen_agent["id"],))

        cursor.execute("""
            INSERT OR IGNORE INTO messages (conversation_id, sender_type, content, model_used, tokens_used)
            VALUES 
            (1, 'user', 'Xin chào NEXORA AI! Hãy cho tôi biết tổng quan về nền tảng Multi-Agent này.', 'user', 0),
            (1, 'assistant', 'Chào mừng bạn đến với **NEXORA AI** – Nền tảng Đa Tác Nhân Trí Tuệ Nhân Tạo thế hệ mới! 🚀\\n\\nTại NEXORA AI, bạn không chỉ trò chuyện với một mô hình AI đơn lẻ, mà có cả một **đội ngũ chuyên gia AI chuyên trách** luôn sẵn sàng:\\n\\n- 💻 **AI Coding Agent**: Viết code, debug và giải thích thuật toán.\\n- 🔬 **AI Research Agent**: Nghiên cứu sâu sắc, trích dẫn tài liệu chuẩn xác.\\n- ✍️ **AI Writing Agent**: Soạn thảo văn bản, email và bài viết chuyên nghiệp.\\n- 📊 **AI Data Analyst**: Đọc bảng biểu, tính toán thống kê và trực quan hóa.\\n- 🚀 **Multi-Agent Workflow**: Phối hợp cùng lúc 5 AI Agents để giải quyết một dự án lớn từ A-Z!\\n\\nBạn cần tôi hỗ trợ việc gì ngay hôm nay?', 'gemini-2.0-flash', 185)
        """)

    # Run automatic column migrations
    cursor.execute("PRAGMA table_info(users)")
    user_cols = [row["name"] for row in cursor.fetchall()]
    if "last_login_at" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN last_login_at DATETIME")
    if "preferences" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'")

    # Seed DeepSeek Harness Muse Agent if not present
    cursor.execute("SELECT id FROM agents WHERE slug = 'dsh-muse-agent'")
    if not cursor.fetchone():
        cursor.execute("""
            INSERT INTO agents 
            (name, slug, avatar, description, category_id, system_instructions, role_desc, expertise, response_tone, ai_model, tools_enabled, is_system, is_active, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "DeepSeek Harness Muse",
            "dsh-muse-agent",
            "✨",
            "Trợ lý trí tuệ nhân tạo chuyên sâu DeepSeek Harness OS. Khám phá tri thức 未至之境, tối ưu hóa suy luận và kiến trúc hệ thống hiện đại.",
            cat_map.get("general", 1),
            "Bạn là DeepSeek Harness Muse - chuyên gia AI cốt lõi của không gian làm việc DeepSeek Harness kết hợp NEXORA AI. Bạn giải quyết mọi bài toán kỹ thuật, lập trình, toán học, phân tích hệ thống và sáng tạo nội dung với phong cách chuẩn xác, thanh lịch và thông tuệ.",
            "Chuyên gia AI DeepSeek Harness",
            "DeepSeek V3, Kiến trúc phần mềm, Thuật toán, Tối ưu hóa suy luận, Khoa học dữ liệu.",
            "Sắc bén, học thuật, sâu sắc và công nghệ cao",
            "gemini-2.0-flash",
            json.dumps(["web_search", "code_interpreter", "rag"]),
            1, 1, 1
        ))

    conn.commit()
    conn.close()
    print("Database initialized and seeded successfully.")

if __name__ == "__main__":
    init_db()

