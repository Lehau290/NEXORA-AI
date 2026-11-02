import os
import re
import math
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict, Any, Tuple
from pypdf import PdfReader
from database import get_db

class RAGService:
    @staticmethod
    def extract_text_from_file(file_path: str, file_type: str) -> str:
        """Extract clean text content from supported file types."""
        file_type = file_type.lower().replace(".", "")
        
        try:
            if file_type == "pdf":
                reader = PdfReader(file_path)
                text_parts = []
                for i, page in enumerate(reader.pages):
                    page_text = page.extract_text() or ""
                    if page_text.strip():
                        text_parts.append(f"[Trang {i+1}]\n{page_text}")
                return "\n\n".join(text_parts)

            elif file_type in ("txt", "md", "csv"):
                # Try UTF-8 first, fallback to latin-1
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        return f.read()
                except UnicodeDecodeError:
                    with open(file_path, "r", encoding="latin-1") as f:
                        return f.read()

            elif file_type == "docx":
                # Extract word/document.xml from docx zip
                with zipfile.ZipFile(file_path) as docx:
                    xml_content = docx.read("word/document.xml")
                    tree = ET.fromstring(xml_content)
                    paragraphs = []
                    # Word text tags are w:t
                    for elem in tree.iter():
                        if elem.tag.endswith("}t") and elem.text:
                            paragraphs.append(elem.text)
                    return " ".join(paragraphs)

            elif file_type == "xlsx":
                # Extract strings from xl/sharedStrings.xml or sheets
                try:
                    with zipfile.ZipFile(file_path) as xlsx:
                        shared_xml = xlsx.read("xl/sharedStrings.xml")
                        tree = ET.fromstring(shared_xml)
                        strings = [elem.text for elem in tree.iter() if elem.tag.endswith("}t") and elem.text]
                        return "\n".join(strings)
                except Exception:
                    return "Không thể trích xuất toàn bộ dữ liệu bảng tính XLSX."

            else:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()
        except Exception as e:
            print(f"Error extracting text from {file_path}: {e}")
            return ""

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
        """Split text into overlapping chunks by words/sentences for RAG indexing."""
        if not text.strip():
            return []

        # Split into sentences or lines
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        words = []
        for p in paragraphs:
            words.extend(p.split())

        chunks = []
        i = 0
        while i < len(words):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk.strip())
            i += (chunk_size - overlap)
            if i >= len(words) and not chunks:
                chunks.append(" ".join(words))
                break

        return chunks

    @staticmethod
    def process_and_index_document(document_id: int, file_path: str, file_type: str) -> int:
        """Extract text, create chunks, and insert into document_chunks table."""
        text = RAGService.extract_text_from_file(file_path, file_type)
        chunks = RAGService.chunk_text(text)

        conn = get_db()
        cursor = conn.cursor()

        # Delete any existing chunks for this document
        cursor.execute("DELETE FROM document_chunks WHERE document_id = ?", (document_id,))

        for idx, chunk in enumerate(chunks):
            meta = json.dumps({"chunk_index": idx, "length": len(chunk)})
            cursor.execute("""
                INSERT INTO document_chunks (document_id, chunk_index, content, metadata)
                VALUES (?, ?, ?, ?)
            """, (document_id, idx, chunk, meta))

        # Update chunk_count in documents table
        cursor.execute("""
            UPDATE documents SET chunk_count = ? WHERE id = ?
        """, (len(chunks), document_id))

        conn.commit()
        conn.close()
        return len(chunks)

    @staticmethod
    def search_relevant_chunks(query: str, user_id: int, agent_id: int = None, top_k: int = 4) -> List[Dict[str, Any]]:
        """Retrieve most relevant document chunks for user and agent using BM25-style keyword matching."""
        if not query.strip():
            return []

        conn = get_db()
        
        # Build query for documents accessible to this user
        if agent_id:
            docs = conn.execute("""
                SELECT d.id, d.original_name, c.id AS chunk_id, c.chunk_index, c.content
                FROM documents d
                JOIN document_chunks c ON d.id = c.document_id
                WHERE d.user_id = ? AND (d.agent_id IS NULL OR d.agent_id = ?)
            """, (user_id, agent_id)).fetchall()
        else:
            docs = conn.execute("""
                SELECT d.id, d.original_name, c.id AS chunk_id, c.chunk_index, c.content
                FROM documents d
                JOIN document_chunks c ON d.id = c.document_id
                WHERE d.user_id = ?
            """, (user_id,)).fetchall()

        conn.close()

        if not docs:
            return []

        # Tokenize query
        query_words = set(re.findall(r'\w+', query.lower()))
        if not query_words:
            return []

        scored_chunks = []
        for row in docs:
            content = row["content"].lower()
            # Calculate match score based on term frequency and matching density
            score = 0
            for word in query_words:
                if len(word) > 1:
                    occurrences = content.count(word)
                    if occurrences > 0:
                        score += (1 + math.log(occurrences)) * (len(word) ** 0.5)

            if score > 0:
                scored_chunks.append({
                    "chunk_id": row["chunk_id"],
                    "document_id": row["id"],
                    "document_name": row["original_name"],
                    "chunk_index": row["chunk_index"],
                    "content": row["content"],
                    "score": round(score, 3)
                })

        # Sort descending by score
        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        return scored_chunks[:top_k]

    @staticmethod
    def build_rag_context(query: str, user_id: int, agent_id: int = None) -> Tuple[str, List[Dict[str, Any]]]:
        """Format retrieved chunks into a prompt context section and citation list."""
        chunks = RAGService.search_relevant_chunks(query, user_id, agent_id, top_k=4)
        if not chunks:
            return "", []

        context_lines = [
            "--- THÔNG TIN TRA CỨU TỪ TÀI LIỆU KNOWLEDGE BASE (ƯU TIÊN SỬ DỤNG ĐỂ TRẢ LỜI) ---"
        ]
        citations = []
        for idx, c in enumerate(chunks, 1):
            context_lines.append(f"\n[Nguồn {idx}: {c['document_name']} (Đoạn #{c['chunk_index']})]:\n\"{c['content']}\"")
            citations.append({
                "source_index": idx,
                "document_name": c["document_name"],
                "chunk_index": c["chunk_index"],
                "snippet": c["content"][:160] + "..."
            })

        context_lines.append(
            "\n--- HẾT TÀI LIỆU ---\n"
            "Chỉ dẫn quan trọng: Hãy ưu tiên tổng hợp câu trả lời dựa trên các trích dẫn tài liệu ở trên. "
            "Nếu thông tin câu hỏi không có trong tài liệu, hãy trả lời rõ ràng rằng tài liệu không đề cập và phân tích thêm dựa trên kiến thức chung."
        )

        return "\n".join(context_lines), citations

