import os
import json
import time
import requests
from typing import Generator, Dict, Any, List
from config import Config
from database import get_db

class AIProviderException(Exception):
    def __init__(self, message: str, code: str = "AI_ERROR"):
        super().__init__(message)
        self.code = code

class BaseAIProvider:
    def generate(self, prompt: str, system_prompt: str = "", model: str = None, **kwargs) -> Dict[str, Any]:
        raise NotImplementedError

    def stream_generate(self, messages: List[Dict[str, str]], system_prompt: str = "", model: str = None, **kwargs) -> Generator[str, None, None]:
        raise NotImplementedError

class GeminiProvider(BaseAIProvider):
    """Google Gemini AI Provider with real REST streaming and standard completions."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or Config.GEMINI_API_KEY

    def _check_key(self):
        if not self.api_key:
            raise AIProviderException(
                "Chưa cấu hình Google Gemini API Key. Vui lòng vào Cài đặt (Settings) hoặc thêm GEMINI_API_KEY vào file .env để kích hoạt mô hình AI.",
                code="API_KEY_REQUIRED"
            )

    def stream_generate(self, messages: List[Dict[str, str]], system_prompt: str = "", model: str = None, **kwargs) -> Generator[str, None, None]:
        self._check_key()
        model = model or Config.DEFAULT_AI_MODEL or "gemini-2.0-flash"

        # Format messages for Gemini API
        contents = []
        for msg in messages:
            role = "user" if msg["role"] in ("user", "human") else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={self.api_key}"
        
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": kwargs.get("temperature", 0.7),
                "maxOutputTokens": kwargs.get("max_tokens", 4096),
                "topP": 0.95
            }
        }
        if system_prompt:
            payload["systemInstruction"] = {
                "parts": [{"text": system_prompt}]
            }

        headers = {"Content-Type": "application/json"}
        try:
            response = requests.post(url, headers=headers, json=payload, stream=True, timeout=60)
            if response.status_code != 200:
                err_detail = response.text
                try:
                    err_json = response.json()
                    err_detail = err_json.get("error", {}).get("message", err_detail)
                except Exception:
                    pass
                raise AIProviderException(f"Google Gemini API Error ({response.status_code}): {err_detail}")

            for line in response.iter_lines(decode_unicode=True):
                if line:
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data_json = json.loads(data_str)
                            candidates = data_json.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for p in parts:
                                    text = p.get("text", "")
                                    if text:
                                        yield text
                        except json.JSONDecodeError:
                            continue
        except requests.exceptions.RequestException as e:
            raise AIProviderException(f"Không thể kết nối đến Google Gemini API: {str(e)}")

    def generate(self, prompt: str, system_prompt: str = "", model: str = None, **kwargs) -> Dict[str, Any]:
        self._check_key()
        model = model or Config.DEFAULT_AI_MODEL or "gemini-2.0-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": kwargs.get("temperature", 0.7),
                "maxOutputTokens": kwargs.get("max_tokens", 4096)
            }
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        try:
            res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=60)
            if res.status_code != 200:
                raise AIProviderException(f"Gemini API Error: {res.text}")
            data = res.json()
            candidates = data.get("candidates", [])
            text = ""
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join([p.get("text", "") for p in parts])
            tokens = data.get("usageMetadata", {}).get("totalTokenCount", 0)
            return {"text": text, "tokens": tokens, "model": model}
        except requests.exceptions.RequestException as e:
            raise AIProviderException(f"Lỗi kết nối Gemini: {str(e)}")

class OpenAIProvider(BaseAIProvider):
    """OpenAI API Provider (GPT-4o, GPT-4o-mini)."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or Config.OPENAI_API_KEY

    def _check_key(self):
        if not self.api_key:
            raise AIProviderException(
                "Chưa cấu hình OpenAI API Key. Vui lòng cấu hình OPENAI_API_KEY để sử dụng mô hình GPT.",
                code="API_KEY_REQUIRED"
            )

    def stream_generate(self, messages: List[Dict[str, str]], system_prompt: str = "", model: str = None, **kwargs) -> Generator[str, None, None]:
        self._check_key()
        model = model or "gpt-4o-mini"
        formatted = []
        if system_prompt:
            formatted.append({"role": "system", "content": system_prompt})
        formatted.extend(messages)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": formatted,
            "stream": True,
            "temperature": kwargs.get("temperature", 0.7)
        }
        try:
            res = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, stream=True, timeout=60)
            if res.status_code != 200:
                raise AIProviderException(f"OpenAI API Error ({res.status_code}): {res.text}")
            
            for line in res.iter_lines(decode_unicode=True):
                if line and line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        data_json = json.loads(data_str)
                        choices = data_json.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                    except json.JSONDecodeError:
                        continue
        except requests.exceptions.RequestException as e:
            raise AIProviderException(f"Không thể kết nối đến OpenAI API: {str(e)}")

    def generate(self, prompt: str, system_prompt: str = "", model: str = None, **kwargs) -> Dict[str, Any]:
        self._check_key()
        model = model or "gpt-4o-mini"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"model": model, "messages": messages, "temperature": kwargs.get("temperature", 0.7)}
        try:
            res = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=60)
            if res.status_code != 200:
                raise AIProviderException(f"OpenAI API Error: {res.text}")
            data = res.json()
            text = data["choices"][0]["message"]["content"]
            tokens = data.get("usage", {}).get("total_tokens", 0)
            return {"text": text, "tokens": tokens, "model": model}
        except requests.exceptions.RequestException as e:
            raise AIProviderException(f"Lỗi OpenAI: {str(e)}")

class AnthropicProvider(BaseAIProvider):
    """Anthropic Claude API Provider (claude-3-5-sonnet)."""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or Config.ANTHROPIC_API_KEY

    def _check_key(self):
        if not self.api_key:
            raise AIProviderException(
                "Chưa cấu hình Anthropic API Key. Vui lòng cấu hình ANTHROPIC_API_KEY để sử dụng mô hình Claude.",
                code="API_KEY_REQUIRED"
            )

    def stream_generate(self, messages: List[Dict[str, str]], system_prompt: str = "", model: str = None, **kwargs) -> Generator[str, None, None]:
        self._check_key()
        model = model or "claude-3-5-sonnet-20241022"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": model,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "messages": messages,
            "stream": True
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            res = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload, stream=True, timeout=60)
            if res.status_code != 200:
                raise AIProviderException(f"Anthropic API Error ({res.status_code}): {res.text}")
            
            for line in res.iter_lines(decode_unicode=True):
                if line and line.startswith("data: "):
                    data_str = line[6:].strip()
                    try:
                        data_json = json.loads(data_str)
                        if data_json.get("type") == "content_block_delta":
                            text = data_json.get("delta", {}).get("text", "")
                            if text:
                                yield text
                    except json.JSONDecodeError:
                        continue
        except requests.exceptions.RequestException as e:
            raise AIProviderException(f"Không thể kết nối đến Anthropic API: {str(e)}")

    def generate(self, prompt: str, system_prompt: str = "", model: str = None, **kwargs) -> Dict[str, Any]:
        self._check_key()
        model = model or "claude-3-5-sonnet-20241022"
        headers = {"x-api-key": self.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        payload = {
            "model": model,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "messages": [{"role": "user", "content": prompt}]
        }
        if system_prompt:
            payload["system"] = system_prompt
        try:
            res = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload, timeout=60)
            if res.status_code != 200:
                raise AIProviderException(f"Anthropic Error: {res.text}")
            data = res.json()
            text = "".join([c.get("text", "") for c in data.get("content", [])])
            tokens = data.get("usage", {}).get("output_tokens", 0) + data.get("usage", {}).get("input_tokens", 0)
            return {"text": text, "tokens": tokens, "model": model}
        except requests.exceptions.RequestException as e:
            raise AIProviderException(f"Lỗi Anthropic: {str(e)}")

def get_ai_provider(provider_name: str = None, user_api_key: str = None) -> BaseAIProvider:
    """Factory to retrieve appropriate AI Provider based on settings and user override."""
    # Check system settings first if not explicitly provided
    if not provider_name:
        conn = get_db()
        setting = conn.execute("SELECT value FROM system_settings WHERE key = 'default_provider'").fetchone()
        conn.close()
        provider_name = setting["value"] if setting else Config.DEFAULT_AI_PROVIDER

    provider_name = (provider_name or "gemini").lower()
    
    if "gemini" in provider_name:
        return GeminiProvider(api_key=user_api_key)
    elif "openai" in provider_name or "gpt" in provider_name:
        return OpenAIProvider(api_key=user_api_key)
    elif "claude" in provider_name or "anthropic" in provider_name:
        return AnthropicProvider(api_key=user_api_key)
    else:
        return GeminiProvider(api_key=user_api_key)

def check_available_keys() -> Dict[str, bool]:
    """Check which API keys are currently configured in environment or settings."""
    return {
        "gemini": bool(Config.GEMINI_API_KEY.strip()),
        "openai": bool(Config.OPENAI_API_KEY.strip()),
        "anthropic": bool(Config.ANTHROPIC_API_KEY.strip())
    }

