import os
import json
import re
import time
from dotenv import load_dotenv
import openai
from openai import OpenAI
import anthropic
from anthropic import APIStatusError, RateLimitError, APIConnectionError, APITimeoutError
from anthropic.types import TextBlock
from typing import Dict, Optional, Any, Tuple

# Load environment variables
load_dotenv()

class HintGenerator:
    def __init__(self):
        """Initialize the hint generator with Claude and GPT clients"""
        
        # Get API keys
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.claude_api_key = os.getenv('CLAUDE_API_KEY')
        
        if not self.claude_api_key:
            raise ValueError("Please set CLAUDE_API_KEY in .env file")
        if not self.openai_api_key:
            raise ValueError("Please set OPENAI_API_KEY in .env file")
        
        # Initialize clients (timeouts set per-request)
        self.openai_client = OpenAI(api_key=self.openai_api_key)
        self.claude_client = anthropic.Anthropic(api_key=self.claude_api_key)
        
        # System prompts (using the same prompts from the original system)
        self.CODE_SYSTEM_PROMPT ="""You are Claude, an expert AI coding assistant with deep knowledge of data structures and algorithms.

Your task is to analyze the user's current code state and provide exactly the next step they need to progress, not a full solution.

You will receive detailed instructions and the user's coding situation. Follow the analysis framework provided and respond with only a JSON object containing the next minimal code snippet.

Return ONLY a single, valid JSON object—no prose."""

        self.HINT_SYSTEM_PROMPT = """You are Claude, a senior engineer mentor who delivers clear, actionable guidance.

Your task is to analyze the user's current code state and provide exactly the next conceptual step they need, not a full solution.

You will receive detailed instructions and the user's coding situation. Follow the analysis framework provided and respond with only a JSON object containing a concise, plain-English hint.

Return ONLY a single, valid JSON object—no prose."""


        self.GPT_EVALUATOR_PROMPT = """You are an expert coding mentor evaluating Claude's response for quality and effectiveness.

Analyze the response comprehensively across these dimensions and provide feedback FIRST, then provide a score:

TECHNICAL ACCURACY:
- Is the code syntactically correct?
- Does it use appropriate algorithms/data structures?
- Are there any logical errors or bugs?
- Is it technically sound for the given problem?

PEDAGOGICAL VALUE:
- Does it match the requested mode (hint vs code)?
- Is it appropriately scoped (not too much, not too little)?
- Will it genuinely help the user learn and progress?
- Does it build on what they already have?

CLARITY & FORMAT:
- Is the response clear and understandable?
- Does it follow the required JSON format exactly?
- Are any comments helpful and concise?
- Is the response well-structured?

CONTEXTUAL APPROPRIATENESS:
- Does it address the user's current state properly?
- Is it the logical next step from their code?
- Does it avoid giving away the entire solution?
- Is the difficulty level appropriate?

Rate on a scale of 1-5:
5 = Excellent (technically perfect, pedagogically optimal, clearly formatted)
4 = Good (very helpful with only minor issues)
3 = Adequate (acceptable but has room for improvement)
2 = Poor (significant problems that limit effectiveness)
1 = Very Poor (incorrect, confusing, or completely unhelpful)

Respond with exactly one JSON object:
{
  "score": 1-5,
  "is_good": true/false,
  "feedback": "Detailed explanation covering technical accuracy, pedagogical value, and clarity",
  "improvement_advice": "Specific actionable advice for improvement if score < 3, null otherwise"
}"""

    def extract_json_from_response(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract JSON from Claude response with robust parsing"""
        txt = text.strip()
        
        # Strip markdown fences
        if txt.startswith("```"):
            txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt, flags=re.S)
        
        # Fast path - try direct parsing
        try:
            return json.loads(txt)
        except json.JSONDecodeError:
            pass
        
        # Scan for balanced braces
        start = txt.find("{")
        while start != -1:
            depth = 0
            for i in range(start, len(txt)):
                c = txt[i]
                if c == "{": 
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        cand = txt[start:i+1]
                        try:
                            return json.loads(cand)
                        except json.JSONDecodeError:
                            break
            start = txt.find("{", start + 1)
        
        return None

    def is_valid_schema(self, obj: Dict[str, Any], mode: str) -> Tuple[bool, str]:
        """Strict schema validation with specific error reporting"""
        if not isinstance(obj, dict):
            return False, "Response is not a JSON object"
        
        # Require exactly one key - no extras allowed
        key = "hint" if mode == "hint" else "next_code"
        if set(obj.keys()) != {key}:
            found_keys = list(obj.keys())
            return False, f"Expected exactly '{key}' key, found: {found_keys}"
        
        val = obj[key]
        if not isinstance(val, str):
            return False, f"Value for '{key}' must be a string, got {type(val).__name__}"
        
        if len(val.strip()) < 5:
            return False, f"Value for '{key}' too short ({len(val.strip())} chars), minimum 5 characters"
        
        # Mode-specific validation
        if mode == "next_code":
            lines = [ln for ln in val.splitlines() if ln.strip()]
            if len(lines) > 3:  # Enforce 1-3 lines max (more breathing room)
                return False, f"Code snippet too long ({len(lines)} lines), maximum 3 lines allowed"
            if "```" in val:  # No code fences allowed
                return False, "Code fences (```) not allowed in code snippets"
        
        return True, "Valid schema"

    def generate_without_evaluation(self, problem_name: str, code_so_far: str, language: str = "python", mode: str = "hint") -> Dict[str, Any]:
        """
        Convenience method to generate response with Claude only (no GPT evaluation)
        
        Args:
            problem_name: The coding problem name
            code_so_far: User's current code
            language: Programming language (default: python)
            mode: Either "hint" or "next_code"
        
        Returns:
            Dictionary with Claude response only
        """
        return self.generate_and_evaluate(
            problem_name=problem_name,
            code_so_far=code_so_far,
            language=language,
            mode=mode,
            threshold=3.0,
            max_retries=0,  # No retries since no evaluation
            use_evaluation=False
        )

    def get_claude_response(self, problem_name: str, code_so_far: str, language: str, mode: str, advice: Optional[str] = None) -> Dict[str, Any]:
        """Get response from Claude for either hint or code generation"""
        
        # Select system prompt and create detailed user prompt based on mode
        if mode == "hint":
            system_prompt = self.HINT_SYSTEM_PROMPT
            user_prompt = f"""You are an expert coding mentor.

TASK:
Given the problem name, the user's current code, and the language, identify exactly the next **conceptual** step they should take — not the full solution.

<problem_name>
{problem_name}
</problem_name>

<code_so_far>
{code_so_far}
</code_so_far>

<language>
{language}
</language>

PROCESS:
1. Determine the user's current implementation state from these categories:
   - just_starting
   - wrong_approach
   - mid_gap
   - boundary_issue
   - performance
   - edge_case
   - debug
   - memo_needed
   - finalize_output
   - syntax_fix
2. If a standard algorithmic pattern applies (DFS, DP, BFS, two_pointers, sliding_window, heap, etc.), briefly name it.
3. State **only one** concise, plain-English next step.

OUTPUT:
- One JSON object in the form:
  {{"hint":"<single next step in plain English>"}}

RULES:
- No full solutions.
- No extra keys or formatting.
- No commentary outside JSON.
- Keep the hint under 25 words.
- If the code is empty or unrelated, suggest the starting step.

EXAMPLES:
Input: Problem: "Two Sum", Code: def twoSum(nums, target): pass
Output: {{"hint":"Use a hash map to store complements for O(n) lookup"}}

Input: Problem: "Binary Search", Code: while left <= right:
Output: {{"hint":"Compute mid as (left + right) // 2 before comparisons"}}

Input: Problem: "Valid Parentheses", Code: def isValid(s): stack = []
Output: {{"hint":"Iterate through characters, push opening brackets, pop and check closing ones"}}

AVOID (counterexamples):
❌ {{"hint":"You need to solve this problem"}} - Too vague
❌ {{"hint":"Create a for loop that iterates through the array and checks each element against every other element"}} - Too long and detailed
❌ {{"hint":"Use hash maps", "note":"extra key"}} - Extra keys not allowed"""
            
        elif mode == "next_code":
            system_prompt = self.CODE_SYSTEM_PROMPT
            user_prompt = f"""You are an expert coding mentor.

TASK:
Given the problem name, the user's current code, and the language, output exactly the **next small code snippet** (1–3 lines) they should write to progress.

<problem_name>
{problem_name}
</problem_name>

<code_so_far>
{code_so_far}
</code_so_far>

<language>
{language}
</language>

PROCESS:
1. Identify the user's current progress stage from:
   - just_starting
   - wrong_approach
   - mid_gap
   - minor_bug
   - performance
   - edge_case
   - debug
   - memo_needed
   - finalize_output
   - syntax_fix
2. Internally note if a common algorithmic pattern applies (DFS, DP, BFS, two_pointers, sliding_window, heap, etc.), but do **not** mention it in output.
3. Output only the single most useful next code line(s) in the specified language.

OUTPUT FORMAT:
- One JSON object only:
  {{"next_code":"<minimal {language} snippet with optional inline comment>"}}
- Keep to **1–3 lines** (≤120 characters per line).
- Use only the `{language}` provided.
- Inline comment is optional but encouraged.
- No full function/class definitions.
- No markdown, extra keys, or explanations.

EXAMPLES:
Input: Problem: "Two Sum", Code: def twoSum(nums, target): pass
Output: {{"next_code":"    hashmap = {{}}  # store num:index for O(1) lookup"}}

Input: Problem: "Binary Search", Code: while left <= right:
Output: {{"next_code":"        mid = (left + right) // 2  # midpoint"}}

Input: Problem: "Merge Intervals", Code: # done merging, missing final add
Output: {{"next_code":"    if current_interval: merged.append(current_interval)"}}

AVOID (counterexamples):
❌ {{"next_code":"def solve_problem():\\n    return solution"}} - Too complete, full function
❌ {{"next_code":"# TODO: implement this"}} - No actual code
❌ {{"next_code":"x = 1\\ny = 2\\nz = 3\\nresult = x+y+z"}} - Too many lines (>3)

CONSTRAINTS:
- Think step-by-step internally, but output only the JSON.
- If code is empty or unrelated, start with the most basic setup line."""
            
        else:
            raise ValueError("Mode must be 'hint' or 'next_code'")
        
        # Add improvement advice if provided (for retrial)
        if advice:
            user_prompt += f"\n\n<improvement_advice>\nPrevious attempt was marked as poor. Improvement advice: {advice}\n</improvement_advice>"
        
        # Retry with exponential backoff
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                response = self.claude_client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=160,  # Reduced for tighter outputs
                    temperature=0.1,  # Lower for more deterministic
                    timeout=10.0,  # Per-request timeout
                    stop_sequences=["</end>", "---"],  # Prevent extra prose
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_prompt}
                    ]
                )
                break  # Success, exit retry loop
            except (APITimeoutError, RateLimitError, APIConnectionError, APIStatusError) as e:
                if attempt == max_attempts - 1:
                    return {
                        "success": False,
                        "error": f"Claude API error after {max_attempts} attempts: {str(e)}"
                    }
                # Exponential backoff
                time.sleep(2 ** attempt)
                continue
        
        try:
            
            # Robust content extraction - join only TextBlocks
            parts = []
            for blk in response.content:
                if isinstance(blk, TextBlock):
                    parts.append(blk.text)
                elif isinstance(blk, dict) and blk.get("type") == "text":
                    parts.append(blk.get("text", ""))
            
            response_text = "".join(parts).strip()
            if not response_text:
                return {
                    "success": False,
                    "error": "No text blocks in Claude response"
                }
            
            # Log Claude prediction
            print(f"\n🤖 Claude Prediction ({mode}):")
            print(f"   Response: {response_text}")
            
            return {
                "success": True,
                "response": response_text,
                "system_prompt": system_prompt,
                "user_prompt": user_prompt
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_gpt_evaluation(self, claude_response: str, problem_name: str, code_so_far: str, mode: str) -> Dict[str, Any]:
        """Get GPT's evaluation of Claude's response"""
        
        evaluation_input = {
            "mode_requested": mode,
            "problem_name": problem_name,
            "code_so_far": code_so_far,
            "claude_response": claude_response
        }
        
        prompt = f"{self.GPT_EVALUATOR_PROMPT}\n\nEvaluation Input:\n{json.dumps(evaluation_input, indent=2)}"
        
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",  # Faster and cheaper
                    messages=[
                        {"role": "system", "content": "You are an expert coding mentor. Respond with valid JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1,
                    max_tokens=200,  # Increased to prevent JSON truncation
                    timeout=10.0,  # Per-request timeout
                    extra_headers={"X-Title": "HintEval"}  # For tracing
                )
                break  # Success, exit retry loop
            except (openai.APITimeoutError, openai.RateLimitError, openai.APIConnectionError) as e:
                if attempt == max_attempts - 1:
                    return {
                        "success": False,
                        "error": f"OpenAI API error after {max_attempts} attempts: {str(e)}"
                    }
                # Exponential backoff
                time.sleep(2 ** attempt)
                continue
        
        try:
            
            response_text = response.choices[0].message.content.strip()
            
            # Log GPT evaluation
            print(f"\n⚖️ GPT Evaluation:")
            print(f"   Input - Problem: {problem_name}")
            print(f"   Input - Code: {code_so_far[:50]}{'...' if len(code_so_far) > 50 else ''}")
            print(f"   Input - Claude Response: {claude_response[:50]}{'...' if len(claude_response) > 50 else ''}")
            print(f"   GPT Raw Response: {response_text}")
            
            # Parse JSON response
            try:
                evaluation = json.loads(response_text)
                print(f"   📊 Score: {evaluation.get('score', 'N/A')}/5")
                print(f"   ✅ Is Good: {evaluation.get('is_good', 'N/A')}")
                print(f"   💬 Feedback: {evaluation.get('feedback', 'No feedback')[:100]}{'...' if len(evaluation.get('feedback', '')) > 100 else ''}")
                return {
                    "success": True,
                    "evaluation": evaluation
                }
            except json.JSONDecodeError as e:
                print(f"   ❌ JSON Parse Error: {str(e)}")
                return {
                    "success": False,
                    "error": f"Invalid JSON from GPT: {response_text[:200]}..."
                }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def generate_and_evaluate(self, problem_name: str, code_so_far: str, language: str = "python", mode: str = "hint", threshold: float = 3.0, max_retries: int = 0, use_evaluation: bool = False) -> Dict[str, Any]:
        """
        Generate hint/code with Claude and optionally evaluate with GPT, with optional retrial
        
        Args:
            problem_name: The coding problem name
            code_so_far: User's current code
            language: Programming language (default: python)
            mode: Either "hint" or "next_code"
            threshold: Score threshold below which to retry (default: 3.0)
            max_retries: Maximum number of retries (default: 0)
            use_evaluation: Whether to use GPT evaluation (default: False)
        
        Returns:
            Dictionary with final response and evaluation details
        """
        
        results = {
            "problem_name": problem_name,
            "code_so_far": code_so_far,
            "language": language,
            "mode": mode,
            "attempts": [],
            "final_response": None,
            "final_parsed": None,  # Add parsed JSON result
            "final_evaluation": None,
            "success": False
        }
        
        advice = None
        
        for attempt in range(max_retries + 1):
            # Get Claude response
            claude_result = self.get_claude_response(problem_name, code_so_far, language, mode, advice)
            
            if not claude_result["success"]:
                results["attempts"].append({
                    "attempt": attempt + 1,
                    "claude_result": claude_result,
                    "gpt_evaluation": None,
                    "advice_used": advice
                })
                continue
            
            # Quick local validation first
            response_json = self.extract_json_from_response(claude_result["response"])
            
            if response_json is None:
                # Invalid JSON, skip evaluation and continue to next attempt
                results["attempts"].append({
                    "attempt": attempt + 1,
                    "claude_result": claude_result,
                    "gpt_evaluation": {"success": False, "error": "Invalid JSON"},
                    "advice_used": advice
                })
                advice = "Please ensure your response is valid JSON format"
                continue
            
            # Schema validation
            is_valid, schema_error = self.is_valid_schema(response_json, mode)
            if not is_valid:
                # Failed schema check, skip evaluation and continue
                results["attempts"].append({
                    "attempt": attempt + 1,
                    "claude_result": claude_result,
                    "gpt_evaluation": {"success": False, "error": f"Schema validation failed: {schema_error}"},
                    "advice_used": advice
                })
                advice = f"Schema error: {schema_error}. Please fix your response format."
                continue
            
            # If evaluation is disabled, accept any valid schema response
            if not use_evaluation:
                no_eval_result = {
                    "score": None,
                    "is_good": True,
                    "feedback": "No evaluation - accepted valid schema response"
                }
                
                attempt_data = {
                    "attempt": attempt + 1,
                    "claude_result": claude_result,
                    "gpt_evaluation": {"success": True, "evaluation": no_eval_result},
                    "advice_used": advice
                }
                results["attempts"].append(attempt_data)
                results["final_response"] = claude_result["response"]
                results["final_parsed"] = response_json  # Store parsed JSON
                results["final_evaluation"] = no_eval_result
                results["success"] = True
                break
            
            # Get GPT evaluation
            gpt_result = self.get_gpt_evaluation(
                claude_result["response"], problem_name, code_so_far, mode
            )
            
            attempt_data = {
                "attempt": attempt + 1,
                "claude_result": claude_result,
                "gpt_evaluation": gpt_result,
                "advice_used": advice
            }
            results["attempts"].append(attempt_data)
            
            if not gpt_result["success"]:
                # Record negative evaluation and continue
                advice = "GPT evaluation failed - please ensure valid JSON format"
                continue
            
            evaluation = gpt_result["evaluation"]
            score = evaluation.get("score", 0)
            is_good = evaluation.get("is_good", False)
            
            if score >= threshold or attempt == max_retries:
                # Either good response or max retries reached
                results["final_response"] = claude_result["response"]
                results["final_parsed"] = response_json  # Store parsed JSON
                results["final_evaluation"] = evaluation
                results["success"] = True
                break
            else:
                # Get improvement advice for next attempt
                advice = evaluation.get("improvement_advice")
        
        return results 