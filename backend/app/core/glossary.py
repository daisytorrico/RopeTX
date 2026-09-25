"""Glosario técnico y directivas de traducción para Nerdearla / RopeTX Enterprise.
Centraliza los términos protegidos para customVocabulary de Gemini Live (ASR)
y para el prompt del traductor con el vocabulario real de conferencias tech.
"""
from typing import List, Dict

import json
from pathlib import Path

GLOSSARY_JSON_PATH = Path(__file__).parent.parent / "data" / "glossary.json"

def _load_glossary_data():
    """Carga los términos desde backend/app/data/glossary.json con fallback seguro."""
    if GLOSSARY_JSON_PATH.exists():
        try:
            with open(GLOSSARY_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return (
                    data.get("language_names", {}),
                    data.get("categories", {}),
                    data.get("preferred_translations", {})
                )
        except Exception:
            pass
    return {}, {}, {}

_json_langs, _json_categories, _json_preferred = _load_glossary_data()

# Nombre completo de cada idioma soportado
LANGUAGE_NAMES: Dict[str, str] = _json_langs or {
    "es": "español neutro latinoamericano",
    "en": "inglés (English, estilo neutro internacional)",
    "pt": "português (Português, variante brasileña neutra)",
}

# --- CATEGORÍAS TEMÁTICAS DE TÉRMINOS NO TRADUCIBLES ---
CLOUD_DEVOPS = _json_categories.get("cloud_devops", [
    "Kubernetes", "Docker", "Helm", "Ingress", "Pod", "Pods", "Service Mesh", "Istio",
    "Terraform", "Ansible", "AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud",
    "Cloudflare", "Lambda", "Serverless", "EC2", "S3", "IAM", "Prometheus", "Grafana",
    "OpenTelemetry", "Datadog", "Jaeger", "ArgoCD", "GitOps", "CI/CD", "DevOps",
    "DevSecOps", "SRE", "Site Reliability Engineering",
])

DATABASES_STREAMING = _json_categories.get("databases_streaming", [
    "Postgres", "PostgreSQL", "MySQL", "Redis", "Kafka", "MongoDB", "DynamoDB",
    "Cassandra", "Elasticsearch", "OpenSearch", "SQLite", "CockroachDB", "Neo4j",
    "Supabase", "Firebase", "RabbitMQ", "Celery", "NATS",
])

LANGUAGES_FRAMEWORKS = _json_categories.get("languages_frameworks", [
    "Python", "TypeScript", "JavaScript", "Golang", "Go", "Rust", "Java", "Kotlin",
    "Swift", "C++", "C#", ".NET", "Node.js", "Next.js", "React", "Vue", "Angular",
    "Svelte", "FastAPI", "Flask", "Django", "Spring Boot", "Express", "NestJS",
    "GraphQL", "gRPC", "REST", "RESTful", "WebSocket", "WebSockets", "WebRTC", "SSE",
])

AI_MACHINE_LEARNING = _json_categories.get("ai_machine_learning", [
    "LLM", "LLMs", "RAG", "Gemini", "ChatGPT", "Claude", "OpenAI", "PyTorch",
    "TensorFlow", "Hugging Face", "Transformers", "Vector DB", "Qdrant", "ChromaDB",
    "Pinecone", "Milvus", "Embeddings", "Embedding", "Fine-tuning", "Prompt Engineering",
    "Agentic", "Zero-shot", "Few-shot", "Airflow", "Spark", "dbt", "Pandas", "NumPy", "Scikit-learn",
])

ARCHITECTURE_NETWORKING = _json_categories.get("architecture_networking", [
    "Cloud Native", "Microservices", "Monolith", "Frontend", "Backend", "Fullstack",
    "Reverse Proxy", "Nginx", "Caddy", "OAuth", "OAuth2", "JWT", "SSO", "Multi-tenant",
    "Deadlock", "Race Condition", "Concurrency", "Garbage Collector", "Memory Leak",
    "Benchmark", "Throughput", "Latency", "SLA", "SLO", "SLI", "MTTR", "Failover",
    "High Availability", "Open Source", "Linux",
])

DEVELOPMENT_GIT_OPS = _json_categories.get("development_git_ops", [
    "Pull Request", "Merge Request", "PR", "Commit", "Branch", "Rebase", "Cherry-pick",
    "Code Review", "Staging", "Production", "Canary", "Blue-Green", "Healthcheck",
    "Rollback", "Deploy", "Pipeline", "Middleware", "Payload", "Endpoint", "Token",
    "Stack", "Thread", "Thread Pool", "Caching", "Cache", "Mock", "Boilerplate",
    "Refactor", "Troubleshooting",
])

# Unión ordenada y deduplicada de todas las categorías
DO_NOT_TRANSLATE: List[str] = list(dict.fromkeys(
    CLOUD_DEVOPS +
    DATABASES_STREAMING +
    LANGUAGES_FRAMEWORKS +
    AI_MACHINE_LEARNING +
    ARCHITECTURE_NETWORKING +
    DEVELOPMENT_GIT_OPS
))

# Términos con forma técnica preferida
PREFERRED_TRANSLATIONS: Dict[str, str] = _json_preferred or {
    "AI": "IA",
    "Artificial Intelligence": "Inteligencia Artificial",
    "microservices": "microservicios",
    "pull request": "pull request",
    "merge request": "merge request",
    "deploy": "deploy",
    "deployment": "despliegue",
    "pipeline": "pipeline",
    "health check": "health check",
    "middleware": "middleware",
    "endpoint": "endpoint",
    "payload": "payload",
    "framework": "framework",
    "runtime": "runtime",
    "open source": "open source",
    "feature": "feature",
    "bug": "bug",
    "issue": "issue",
    "commit": "commit",
    "branch": "branch",
    "load balancer": "balanceador de carga",
    "thread pool": "thread pool",
    "zero-shot": "zero-shot",
    "few-shot": "few-shot",
    "prompt": "prompt",
    "standby": "standby",
}

# Lista plana para customVocabulary en Gemini Live (ASR)
TECHNICAL_GLOSSARY: List[str] = list(dict.fromkeys(DO_NOT_TRANSLATE + list(PREFERRED_TRANSLATIONS.keys())))
NERDEARLA_GLOSSARY: List[str] = TECHNICAL_GLOSSARY  # Alias retrocompatible# Alias retrocompatible


def build_multi_target_instruction(source_lang: str = "auto", targets: List[str] = None, extra_terms: List[str] = None) -> str:
    """Genera instrucción para traducir a múltiples idiomas en una sola llamada JSON rápida y concisa."""
    combined = list(DO_NOT_TRANSLATE)
    extra_rule = ""
    if extra_terms:
        clean_extra = [t.strip() for t in extra_terms if t.strip()]
        if clean_extra:
            combined.extend(clean_extra)
            extra_rule = f"\n5. ATENCIÓN ESPECIAL al glosario de esta charla: {', '.join(clean_extra)}.\n"

    do_not_translate_str = ", ".join(dict.fromkeys(combined))
    preferred_str = ", ".join(f'"{k}" -> "{v}"' for k, v in PREFERRED_TRANSLATIONS.items())
    
    is_auto = (not source_lang) or source_lang.lower() == "auto"
    target_langs = targets or (["es", "en", "pt"] if is_auto else [l for l in ["es", "en", "pt"] if l != source_lang.lower()])

    if is_auto:
        task_desc = (
            "Tu tarea es detectar automáticamente el idioma del texto del orador (es, en o pt) y generar las versiones limpias para los 3 idiomas: ['es', 'en', 'pt'] (el idioma original se preserva o mejora y los demás se traducen con máxima precisión).\n"
            "IMPORTANTE: Devolvé ÚNICAMENTE un objeto JSON válido con este esquema exacto:\n"
            '{"detected_lang": "es|en|pt", "translations": {"es": "texto en español", "en": "text in English", "pt": "texto em português"}}\n\n'
        )
    else:
        task_desc = (
            f"Tu tarea es traducir el texto del orador (idioma original '{source_lang}') a los siguientes idiomas destino: {target_langs}.\n"
            f"IMPORTANTE: Devolvé ÚNICAMENTE un objeto JSON válido con las traducciones directas, sin bloques markdown extra, con este esquema exacto:\n"
            f'{{"translations": {{' + ", ".join(f'"{lang}": "traducción al {lang}"' for lang in target_langs) + f"}}}}\n\n"
        )

    return (
        f"Sos un traductor simultáneo ultra-rápido para conferencias tech (estilo Nerdearla).\n"
        f"{task_desc}"
        f"REGLAS ESTRICTAS:\n"
        f"1. No agregues introducciones, explicaciones ni comentarios.\n"
        f"2. NUNCA traduzcas nombres propios, marcas o tecnologías tech:\n"
        f"   {do_not_translate_str}\n"
        f"3. Respetá las formas técnicas preferidas:\n"
        f"   {preferred_str}\n"
        f"4. Tono conciso y natural de conferencia tech en vivo.\n"
        f"{extra_rule}"
    )


def build_system_instruction(target_lang: str = "es", extra_terms: List[str] = None) -> str:
    """Función de instrucción para un solo idioma."""
    lang_key = (target_lang or "es").lower().strip()
    return build_multi_target_instruction(source_lang="es", targets=[lang_key], extra_terms=extra_terms)