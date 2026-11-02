import json
import time
import threading
from typing import Dict, Any, List
from database import get_db
from ai_service import get_ai_provider, AIProviderException

class MultiAgentOrchestrator:
    """Real Multi-Agent Orchestration Engine executing concurrent & sequential AI agent tasks."""

    DEFAULT_AGENTS = [
        {"role": "manager", "name": "Manager Agent (Điều Phối)", "slug": "general-assistant", "desc": "Phân rã nhiệm vụ và tổng hợp kết quả cuối cùng"},
        {"role": "researcher", "name": "Research Agent (Nghiên Cứu)", "slug": "research-agent", "desc": "Khảo sát thị trường, đối thủ cạnh tranh và dữ liệu ngành"},
        {"role": "analyst", "name": "Data Analyst (Phân Tích Số Liệu)", "slug": "data-analyst", "desc": "Mô hình hóa tài chính, chi phí, doanh thu dự kiến và ROI"},
        {"role": "marketer", "name": "Marketing Agent (Tiếp Thị)", "slug": "marketing-agent", "desc": "Xây dựng chân dung khách hàng, USP và chiến lược Go-To-Market"},
        {"role": "writer", "name": "Writing Agent (Tổng Hợp)", "slug": "writing-agent", "desc": "Biên tập bản kế hoạch hoàn chỉnh với định dạng chuyên nghiệp"}
    ]

    @staticmethod
    def create_workflow(user_id: int, title: str, goal: str, participating_agents: List[str] = None) -> int:
        """Create a new workflow record in DB with its planned steps."""
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO workflows (user_id, title, goal, status)
            VALUES (?, ?, ?, 'pending')
        """, (user_id, title or goal[:60], goal))
        workflow_id = cursor.lastrowid

        # Selected agents or default team
        agent_list = participating_agents or ["general-assistant", "research-agent", "data-analyst", "marketing-agent", "writing-agent"]

        step_definitions = [
            ("Lập kế hoạch phân bổ nhiệm vụ", "general-assistant", "Phân tích yêu cầu và phân rã các đầu mục công việc chuyên môn."),
            ("Nghiên cứu thị trường & khảo sát dữ kiện", "research-agent", "Thu thập dữ liệu thực tế, xu hướng ngành và phân tích đối thủ."),
            ("Mô hình hóa số liệu & phân tích tài chính", "data-analyst", "Định lượng chỉ số, ước tính chi phí, điểm hòa vốn và rủi ro."),
            ("Thiết kế chiến lược tiếp thị & Go-To-Market", "marketing-agent", "Xác định định vị thương hiệu, kênh tiếp cận và thông điệp truyền thông."),
            ("Biên soạn hồ sơ báo cáo tổng hợp", "writing-agent", "Tổng hợp toàn bộ phát hiện của các Agent thành báo cáo chuyên nghiệp."),
            ("Đánh giá nghiệm thu & phê duyệt của Manager", "general-assistant", "Tổng duyệt chất lượng, tóm tắt điều hành và kết luận khả thi.")
        ]

        order = 1
        for step_name, agent_slug, desc in step_definitions:
            # Find agent id
            cursor.execute("SELECT id FROM agents WHERE slug = ?", (agent_slug,))
            agent_row = cursor.fetchone()
            agent_id = agent_row["id"] if agent_row else 1

            cursor.execute("""
                INSERT INTO workflow_steps (workflow_id, step_order, agent_id, step_name, status)
                VALUES (?, ?, ?, ?, 'pending')
            """, (workflow_id, order, agent_id, step_name))

            cursor.execute("""
                INSERT INTO agent_tasks (workflow_id, agent_id, name, description, status)
                VALUES (?, ?, ?, ?, 'pending')
            """, (workflow_id, agent_id, step_name, desc))

            order += 1

        conn.commit()
        conn.close()
        return workflow_id

    @staticmethod
    def run_step_ai(agent_slug: str, step_name: str, goal: str, previous_context: str, user_api_key: str = None) -> str:
        """Execute AI call for a specific agent step with previous team context."""
        provider = get_ai_provider(user_api_key=user_api_key)

        prompts = {
            "general-assistant": f"""Bạn là Quản lý dự án cao cấp (Manager Agent) tại NEXORA AI.
MỤC TIÊU DỰ ÁN: {goal}
NHIỆM VỤ CỦA BẠN: Phân rã mục tiêu này thành một đề cương kế hoạch hành động chi tiết.
- Xác định phạm vi dự án, các mốc quan trọng (milestones).
- Chỉ định rõ câu hỏi trọng tâm mà Research, Data Analyst, Marketing và Writing Agent cần giải quyết.
- Trình bày dạng bullet points sắc bén, rõ ràng bằng tiếng Việt.""",

            "research-agent": f"""Bạn là AI Research Agent tại NEXORA AI.
MỤC TIÊU DỰ ÁN: {goal}
BỐI CẢNH CỦA MANAGER:
{previous_context}

NHIỆM VỤ CỦA BẠN:
- Khảo sát chuyên sâu thị trường, quy mô ngành và xu hướng tiêu dùng mới nhất.
- Phân tích 3 đối thủ cạnh tranh điển hình (thế mạnh, điểm yếu).
- Xác định các cơ hội thị trường chưa được khai thác (market gap) và rào cản gia nhập.
- Trình bày có dẫn chứng số liệu ước tính cụ thể.""",

            "data-analyst": f"""Bạn là AI Data Analyst tại NEXORA AI.
MỤC TIÊU DỰ ÁN: {goal}
DỮ LIỆU NGHIÊN CỨU TỪ RESEARCH AGENT:
{previous_context}

NHIỆM VỤ CỦA BẠN:
- Xây dựng bảng dự toán chi phí đầu tư ban đầu (CAPEX) và chi phí vận hành hàng tháng (OPEX).
- Ước tính mô hình doanh thu theo 3 kịch bản: Thận trọng (Conservative), Cơ sở (Base), và Tăng trưởng (Optimistic).
- Tính toán thời gian hoàn vốn (Payback Period) và điểm hòa vốn (Break-even point).
- Lập bảng Markdown trực quan hiển thị các chỉ số tài chính chủ chốt.""",

            "marketing-agent": f"""Bạn là AI Marketing Agent & Growth Strategist tại NEXORA AI.
MỤC TIÊU DỰ ÁN: {goal}
BÁO CÁO TÀI CHÍNH & NGHIÊN CỨU TỪ ĐỘI NGŨ:
{previous_context}

NHIỆM VỤ CỦA BẠN:
- Xác định Chân dung khách hàng mục tiêu (Target Persona) và Insight cốt lõi.
- Xây dựng Tuyên ngôn giá trị độc nhất (USP - Unique Selling Proposition).
- Thiết kế chiến lược Go-To-Market (GTM) theo 3 giai đoạn: Pre-launch, Launch và Growth.
- Đề xuất phân bổ ngân sách marketing theo các kênh (Social, Influencer, Performance, OOH/Events).""",

            "writing-agent": f"""Bạn là AI Writing Agent tại NEXORA AI.
MỤC TIÊU DỰ ÁN: {goal}
KẾT QUẢ ĐÃ THỰC HIỆN BỞI CÁC AGENT:
{previous_context}

NHIỆM VỤ CỦA BẠN:
- Tổng hợp toàn bộ phát hiện của Research, Data Analyst và Marketing thành một bản BÁO CÁO KẾ HOẠCH KINH DOANH HOÀN CHỈNH.
- Sử dụng văn phong doanh nghiệp cao cấp, mạch lạc, tiêu đề phân cấp H1, H2, H3, bảng biểu so sánh và danh sách hành động.
- Trình bày cuốn hút và sẵn sàng trình bày trước nhà đầu tư.""",
        }

        agent_prompt = prompts.get(agent_slug, f"Thực hiện bước {step_name} cho mục tiêu: {goal}\nBối cảnh: {previous_context}")

        try:
            res = provider.generate(
                prompt=agent_prompt,
                system_prompt="Bạn là một AI Agent chuyên trách trong hệ thống Multi-Agent NEXORA AI. Hãy hoàn thành nhiệm vụ với chất lượng chuyên gia cao nhất.",
                temperature=0.7
            )
            return res.get("text", "")
        except AIProviderException as e:
            return f"⚠️ [Lưu ý cấu hình]: {str(e)}\n\n(Vui lòng cấu hình API Key để kích hoạt kết nối thời gian thực với AI Provider)."

    @staticmethod
    def execute_workflow_sync(workflow_id: int, user_api_key: str = None):
        """Execute all steps of the workflow in background thread, updating status in DB."""
        conn = get_db()
        cursor = conn.cursor()

        # Update workflow status to running
        cursor.execute("UPDATE workflows SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (workflow_id,))
        conn.commit()

        # Fetch workflow details
        workflow = cursor.execute("SELECT id, user_id, title, goal FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
        if not workflow:
            conn.close()
            return

        steps = cursor.execute("""
            SELECT s.id, s.step_order, s.step_name, s.status, a.slug AS agent_slug, a.name AS agent_name
            FROM workflow_steps s
            JOIN agents a ON s.agent_id = a.id
            WHERE s.workflow_id = ?
            ORDER BY s.step_order ASC
        """, (workflow_id,)).fetchall()

        previous_outputs = []

        for step in steps:
            # Check if workflow was cancelled or paused
            curr_wf = cursor.execute("SELECT status FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
            if curr_wf and curr_wf["status"] in ("paused", "failed"):
                break

            # Mark step running
            cursor.execute("UPDATE workflow_steps SET status = 'running' WHERE id = ?", (step["id"],))
            cursor.execute("UPDATE agent_tasks SET status = 'running' WHERE workflow_id = ? AND name = ?", (workflow_id, step["step_name"]))
            conn.commit()

            start_t = time.time()
            context = "\n\n".join(previous_outputs[-2:]) if previous_outputs else "Bắt đầu khởi tạo dự án."
            
            # Execute AI generation
            result_text = MultiAgentOrchestrator.run_step_ai(
                agent_slug=step["agent_slug"],
                step_name=step["step_name"],
                goal=workflow["goal"],
                previous_context=context,
                user_api_key=user_api_key
            )
            duration_ms = int((time.time() - start_t) * 1000)

            # Store result
            cursor.execute("""
                UPDATE workflow_steps 
                SET status = 'completed', result = ? 
                WHERE id = ?
            """, (result_text, step["id"]))

            cursor.execute("""
                UPDATE agent_tasks 
                SET status = 'completed', output_result = ?, duration_ms = ?
                WHERE workflow_id = ? AND name = ?
            """, (result_text, duration_ms, workflow_id, step["step_name"]))

            previous_outputs.append(f"### {step['agent_name']} ({step['step_name']}):\n{result_text}")
            conn.commit()

        # Final master summary
        summary = f"# BÁO CÁO TỔNG HỢP MULTI-AGENT NEXORA AI\n\n**Mục tiêu**: {workflow['goal']}\n**Số lượng Agent tham gia**: {len(steps)}\n\n" + "\n\n---\n\n".join(previous_outputs)

        cursor.execute("""
            UPDATE workflows 
            SET status = 'completed', summary = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (summary, workflow_id))

        conn.commit()
        conn.close()

    @staticmethod
    def start_workflow_async(workflow_id: int, user_api_key: str = None):
        """Run workflow in detached thread so HTTP call returns immediately."""
        t = threading.Thread(
            target=MultiAgentOrchestrator.execute_workflow_sync,
            args=(workflow_id, user_api_key),
            daemon=True
        )
        t.start()
        return t

