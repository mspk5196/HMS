"""
ollama_client.py
Local Ollama LLM Client for Hospital Duty Roster Natural Language Understanding.
Communicates with local Ollama service (e.g. qwen2.5-coder:1.5b, llama3.2:3b, qwen2.5:3b)
to extract structured scheduling constraints with zero external API calls or cloud dependencies.
"""

import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)

OLLAMA_API_URL = settings.OLLAMA_API_URL
DEFAULT_OLLAMA_MODEL = settings.OLLAMA_MODEL

def query_ollama_json(
    prompt: str,
    system: Optional[str] = None,
    model_name: Optional[str] = None,
    timeout: Optional[int] = None,
    temperature: float = 0.1
) -> Optional[Dict[str, Any]]:
    """
    Queries local Ollama instance with structured JSON output enforcement.
    Returns parsed JSON dictionary or None if unreachable/timed out.
    """
    effective_model = model_name or settings.OLLAMA_MODEL
    effective_timeout = timeout or settings.OLLAMA_TIMEOUT_SECONDS
    payload = {
        "model": effective_model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": temperature,
            "num_predict": 1500
        }
    }
    if system:
        payload["system"] = system

    try:
        req = urllib.request.Request(
            OLLAMA_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=effective_timeout) as response:
            if response.status == 200:
                raw_res = json.loads(response.read().decode("utf-8"))
                text_response = raw_res.get("response", "{}")
                if isinstance(text_response, dict):
                    return text_response
                return json.loads(text_response)
    except Exception as e:
        logger.warning(f"Ollama local LLM query failed or timed out: {e}")
        return None

query_ollama = query_ollama_json

def extract_constraints_with_ollama(
    prompt_text: str,
    employee_names: List[str],
    shift_names: List[str],
    date_range: List[str],
    model_name: str = DEFAULT_OLLAMA_MODEL
) -> Optional[Dict[str, Any]]:
    """
    Prompts local Ollama LLM to extract hospital roster constraints into structured JSON.
    Uses few-shot in-context learning with null defaults for extreme accuracy.
    """
    if not prompt_text or not prompt_text.strip():
        return None

    system_instruction = (
        f'You are an expert Hospital Duty Roster AI Constraint Parser.\n'
        f'Extract constraints from the Admin Prompt into structured JSON according to the schema.\n\n'
        f'STAFF LIST: {json.dumps(employee_names[:35])}\n'
        f'SHIFTS: {json.dumps(shift_names)}\n'
        f'DATES: {date_range[0]} to {date_range[-1]}\n\n'
        f'CRITICAL RULES:\n'
        f'1. "named_employee_assignments": ONLY include an employee if their exact name (e.g. "Aiswarya", "Deepa") or role is explicitly typed in the Admin Prompt. NEVER assign employees whose names are not in the prompt.\n'
        f'2. "rotation_rule": ONLY set if the prompt explicitly describes shift rotation (e.g., 2 staff on night shift, 3 days each). Otherwise set to null.\n'
        f'3. "shift_coverage": Set min/max staff per shift ONLY if explicitly stated in the prompt (e.g. {{"Morning Shift": {{"min": 2}}}}).\n'
        f'4. "exact_weekly_offs": Set number of week-offs per person if stated (e.g. 1). Otherwise null.\n'
        f'5. "default_fill_shift": Shift name to fill other days if stated (e.g. "Morning Shift"). Otherwise null.\n'
        f'6. "night_to_day_rotation": Set true if staff ending night shift transition directly to day shift.\n'
        f'7. "transition_from_last_week_nights": Set true if prompt mentions past week continuity (e.g. "if last week this emp had night shift give day shift this week").\n\n'
        f'---\n'
        f'EXAMPLE 1:\n'
        f'Admin Prompt: "Need 2 staff in morning, 1 in night. Max 6 consecutive days. Sunday off for Deepa K."\n'
        f'JSON:\n'
        f'{{\n'
        f'  "named_employee_assignments": [{{"name_or_role": "Deepa K", "shift_or_timing": "Week Off", "is_week_off": true, "days_of_week": ["Sunday"]}}],\n'
        f'  "rotation_rule": null,\n'
        f'  "shift_coverage": {{"Morning Shift": {{"min": 2}}, "Night Shift": {{"min": 1}}}},\n'
        f'  "exact_weekly_offs": null,\n'
        f'  "default_fill_shift": null,\n'
        f'  "max_consecutive_working_days": 6,\n'
        f'  "min_rest_hours": null,\n'
        f'  "night_to_day_rotation": false,\n'
        f'  "transition_from_last_week_nights": false,\n'
        f'  "interpretations": ["2 staff in morning, 1 in night", "Sunday off for Deepa K", "Max 6 consecutive working days"]\n'
        f'}}\n\n'
        f'---\n'
        f'EXAMPLE 2:\n'
        f'Admin Prompt: "two employee should be in night shift, one in first 3days and another in next 3 days, then work day shift. If emp worked night last week give day shift this week."\n'
        f'JSON:\n'
        f'{{\n'
        f'  "named_employee_assignments": [],\n'
        f'  "rotation_rule": {{"total_staff_count": 2, "shift_name": "Night Shift", "block_days": 3, "transition_to_day": true}},\n'
        f'  "shift_coverage": {{"Night Shift": {{"min": 1, "max": 1}}}},\n'
        f'  "exact_weekly_offs": 1,\n'
        f'  "default_fill_shift": "Morning Shift",\n'
        f'  "max_consecutive_working_days": null,\n'
        f'  "min_rest_hours": null,\n'
        f'  "night_to_day_rotation": true,\n'
        f'  "transition_from_last_week_nights": true,\n'
        f'  "interpretations": ["2 employees rotate on night shift for 3 days each", "Seamless transition to day shift", "Staff who worked night last week get day shift this week"]\n'
        f'}}\n\n'
        f'---\n'
        f'NOW PARSE THIS ADMIN PROMPT:\n'
        f'"{prompt_text}"\n'
        f'JSON:'
    )
    return query_ollama_json(system_instruction, model_name=model_name)
