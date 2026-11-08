import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
from flask import Flask, render_template, send_from_directory, jsonify, request
from flask_cors import CORS
from config import Config
from database import init_db, get_db
from ai_service import check_available_keys

# Route blueprints
from routes.auth_routes import auth_bp
from routes.agent_routes import agent_bp
from routes.chat_routes import chat_bp
from routes.workflow_routes import workflow_bp
from routes.rag_routes import rag_bp
from routes.admin_routes import admin_bp
from routes.favorite_routes import fav_bp

def create_app():
    # Initialize DB tables & seed data
    init_db()

    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates"
    )
    app.config.from_object(Config)

    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(agent_bp, url_prefix="/api/agents")
    app.register_blueprint(chat_bp, url_prefix="/api/chat")
    app.register_blueprint(workflow_bp, url_prefix="/api/workflows")
    app.register_blueprint(rag_bp, url_prefix="/api/knowledge")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(fav_bp, url_prefix="/api/favorites")

    # Serve Main Application SPA
    @app.route("/")
    def index():
        return render_template("index.html")

    # System Status & Health Check
    @app.route("/api/system/status", methods=["GET"])
    def system_status():
        keys_status = check_available_keys()

        # If user passed token, check their personal user_api_keys too
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from auth import decode_access_token
                payload = decode_access_token(auth_header.split(" ")[1])
                user_id = payload.get("sub")
                if user_id:
                    conn_u = get_db()
                    u_keys = conn_u.execute("SELECT provider, is_active FROM user_api_keys WHERE user_id = ? AND is_active = 1", (user_id,)).fetchall()
                    conn_u.close()
                    for uk in u_keys:
                        prov = uk["provider"].lower()
                        if "claude" in prov: prov = "anthropic"
                        keys_status[prov] = True
            except Exception:
                pass

        conn = get_db()
        settings = conn.execute("SELECT key, value FROM system_settings").fetchall()
        settings_map = {row["key"]: row["value"] for row in settings}
        conn.close()

        return jsonify({
            "status": "online",
            "version": settings_map.get("system_version", "2.5.0-pro"),
            "site_name": settings_map.get("site_name", "NEXORA AI"),
            "tagline": settings_map.get("site_tagline", "One Platform. Multiple AI Agents. Infinite Possibilities."),
            "default_provider": settings_map.get("default_provider", "gemini"),
            "default_model": settings_map.get("default_model", "gemini-2.0-flash"),
            "keys_configured": keys_status,
            "has_active_ai_key": any(keys_status.values())
        })

    # Save User / Admin Custom API Key
    @app.route("/api/system/save-key", methods=["POST"])
    def save_api_key():
        from auth import token_required, g
        @token_required
        def handle():
            data = request.get_json() or {}
            provider = data.get("provider", "gemini").lower()
            api_key = data.get("api_key", "").strip()

            if not api_key:
                return jsonify({"success": False, "error": "Vui lòng nhập API Key hợp lệ."}), 400

            # Update in-memory config, environment, and user_api_keys table
            canonical_prov = "gemini"
            if "gemini" in provider:
                Config.GEMINI_API_KEY = api_key
                env_key = "GEMINI_API_KEY"
                canonical_prov = "gemini"
            elif "openai" in provider:
                Config.OPENAI_API_KEY = api_key
                env_key = "OPENAI_API_KEY"
                canonical_prov = "openai"
            elif "anthropic" in provider or "claude" in provider:
                Config.ANTHROPIC_API_KEY = api_key
                env_key = "ANTHROPIC_API_KEY"
                canonical_prov = "anthropic"
            elif "deepseek" in provider:
                os.environ["DEEPSEEK_API_KEY"] = api_key
                env_key = "DEEPSEEK_API_KEY"
                canonical_prov = "deepseek"
            else:
                return jsonify({"success": False, "error": "Nhà cung cấp AI không được hỗ trợ."}), 400

            # Also persist to user_api_keys table in SQLite
            try:
                db_k = get_db()
                db_k.execute("""
                    INSERT INTO user_api_keys (user_id, provider, api_key_encrypted, is_active, updated_at)
                    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id, provider) DO UPDATE SET
                        api_key_encrypted = excluded.api_key_encrypted,
                        is_active = 1,
                        updated_at = CURRENT_TIMESTAMP
                """, (g.current_user["id"], canonical_prov, api_key))
                db_k.commit()
                db_k.close()
            except Exception as e:
                print(f"Error persisting key to user_api_keys: {e}")

            # Persist to .env if writable
            env_path = Config.BASE_DIR / ".env"
            lines = []
            if env_path.exists():
                with open(env_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()

            key_found = False
            new_lines = []
            for line in lines:
                if line.startswith(f"{env_key}="):
                    new_lines.append(f"{env_key}={api_key}\n")
                    key_found = True
                else:
                    new_lines.append(line)

            if not key_found:
                new_lines.append(f"{env_key}={api_key}\n")

            with open(env_path, "w", encoding="utf-8") as f:
                f.writelines(new_lines)

            return jsonify({
                "success": True,
                "message": f"Đã lưu API Key cho {provider.upper()} thành công! Bạn có thể bắt đầu trò chuyện trực tiếp ngay bây giờ."
            })

        return handle()

    # Serve uploaded knowledge files securely
    @app.route("/uploads/<filename>")
    def uploaded_file(filename):
        return send_from_directory(Config.UPLOAD_FOLDER, filename)

    return app

app = create_app()

if __name__ == "__main__":
    print(f"🚀 Khởi động NEXORA AI tại http://localhost:{Config.PORT}")
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)

